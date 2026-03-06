<?php
/*
	Desc: Supervises all tasks
	Author:	Sebastian Schmittner
	Date: 2014.08.20 13:09:31 (+02:00)
	Last Author: Sebastian Schmittner
	Last Date: 2015.07.20 21:34:46 (+02:00)
	Version: 0.3.2
*/

require_once 'polyzoomerGlobals.php';
require_once 'logging.php';
require_once 'tools.php';
require_once 'md5chk.php';
require_once 'taskFileManipulator.php';
require_once 'jobRepresentation.php';
require_once 'handleSubTasks.php';

class WrongArgumentCountException extends Exception {};

class TaskSupervisor {
	
	private $jobStati = array(
		'1' => array('checksum', 'pending'), 
		'2' => array('upload', 'uploading', 'uploaded', 'putToOwnFolder'),
		'3' => array('estimateSize'),
		'4' => array('readyForQueue', 'inQueue'),
		'5' => array('processing'),
		'6' => array('finished', 'emailSent', 'readyToBeRemoved')
	);

	private $taskFileName;
	private $taskFileHandler;
	private $jobs;
	
	private $doneTaskHandler;
	
	private $statusMap;
		
	private $config;
	
	public function __construct( $taskFile ) {
		$this->taskFileName = $taskFile;
		
		// Enhanced error handling for task file handler
		try {
			error_log("TaskSupervisor: Creating TaskFileManipulator for: " . $taskFile);
			$this->taskFileHandler = new TaskFileManipulator( $this->taskFileName );
			
			if ($this->taskFileHandler === null) {
				throw new Exception("TaskFileManipulator constructor returned null");
			}
			
			error_log("TaskSupervisor: TaskFileManipulator created successfully");
			
		} catch (Exception $e) {
			error_log("TaskSupervisor: Failed to create TaskFileManipulator: " . $e->getMessage());
			
			// Try to create/fix the job file
			if (!file_exists($taskFile)) {
				error_log("TaskSupervisor: Creating missing job file: " . $taskFile);
				touch($taskFile);
				chmod($taskFile, 0666);
			} else {
				// Check if file is readable/writable
				if (!is_readable($taskFile)) {
					error_log("TaskSupervisor: Job file not readable: " . $taskFile);
					chmod($taskFile, 0666);
				}
				if (!is_writable($taskFile)) {
					error_log("TaskSupervisor: Job file not writable: " . $taskFile);
					chmod($taskFile, 0666);
				}
			}
			
			// Try again
			try {
				$this->taskFileHandler = new TaskFileManipulator( $this->taskFileName );
				if ($this->taskFileHandler === null) {
					throw new Exception("TaskFileManipulator still null after retry");
				}
			} catch (Exception $e2) {
				error_log("TaskSupervisor: Second attempt failed: " . $e2->getMessage());
				throw new Exception("Cannot create TaskFileManipulator for: " . $taskFile);
			}
		}
		
		// Enhanced error handling for done task handler
		try {
			error_log("TaskSupervisor: Creating done task handler for: " . jobDoneFile());
			$this->doneTaskHandler = new TaskFileManipulator( jobDoneFile() );
			
			if ($this->doneTaskHandler === null) {
				throw new Exception("Done TaskFileManipulator constructor returned null");
			}
			
		} catch (Exception $e) {
			error_log("TaskSupervisor: Failed to create done TaskFileManipulator: " . $e->getMessage());
			
			// Try to create the done file
			$doneFile = jobDoneFile();
			if (!file_exists($doneFile)) {
				error_log("TaskSupervisor: Creating missing done file: " . $doneFile);
				touch($doneFile);
				chmod($doneFile, 0666);
			}
			
			// Try again
			try {
				$this->doneTaskHandler = new TaskFileManipulator( $doneFile );
				if ($this->doneTaskHandler === null) {
					throw new Exception("Done TaskFileManipulator still null after retry");
				}
			} catch (Exception $e2) {
				error_log("TaskSupervisor: Second attempt for done handler failed: " . $e2->getMessage());
				throw new Exception("Cannot create done TaskFileManipulator");
			}
		}
		
		// Load config
		try {
			$this->config = $this->loadConfig();
			error_log("TaskSupervisor: Config loaded successfully");
		} catch (Exception $e) {
			error_log("TaskSupervisor: Config loading failed: " . $e->getMessage());
			// Provide default config
			$this->config = array('upload' => 2, 'polyzoom' => 4);
			error_log("TaskSupervisor: Using default config");
		}
		
		error_log("TaskSupervisor: Constructor completed successfully");
	}
	
	public function __destruct() {
	}
	
	public function update() {
		
		doEcho("update()\n");
		
		$this->taskFileHandler->update();
		$contents = $this->taskFileHandler->getContents();
		
		$comments = preg_grep("/^#/i", $contents);
		$jobs = preg_grep("/^#/i", $contents, PREG_GREP_INVERT);
		
		$this->jobs = array();
		
		foreach($jobs as $guid) {
			
			$guid = trim($guid);
			if(empty($guid)) {
				continue;
			}
			
			$localJob = null;
			
			try {
				$jobFile = jobFileG($guid);
				$result = lockedFileRead($jobFile, filesize($jobFile), 'r', false);
				
				if($result['id'] == 0) {
					$entry = $result['data'];
					$localJob = new Job($entry);
				}
				else {
					jobLog($guid, "Could not read the job content of the file! [" . $guid . "]");
				}
			}
			catch (Exception $e) {
				$localJob = null;
				jobLog($guid, 'Failed to load job specific file!');
			}
			
			if(isset($localJob)) {
				array_push($this->jobs, $localJob);
			}
		}
		
		$this->createMaps($this->jobs);
		
		$this->takeCareOfJobs($this->jobs);
	}
		
	public function createMaps($jobs) {
		
		$this->statusMap = array();
		$this->createStatusMap($this->statusMap);
		
		$i = 0;
		
		foreach($jobs as $job) {
			array_push($this->statusMap[$job->data['status']], $i);

			++$i;
		}
	}

	public function createStatusMap(&$map) {
		
		$map['checksum'] = array();
		$map['pending'] = array();
		$map['upload'] = array();
		$map['uploading'] = array();
		$map['uploaded'] = array();
		$map['putToOwnFolder'] = array();
		$map['estimateSize'] = array();
		$map['readyForQueue'] = array();
		$map['inQueue'] = array();
		$map['processing'] = array();
		$map['finished'] = array();
		$map['emailSent'] = array();
		$map['readyToBeRemoved'] = array();
	}

	public function takeCareOfJobs(&$jobs) {
		
		// Status 6
		doEcho("6 - Finished");
		$this->handleSentEmailJobs($jobs);
		$this->handleFinishedJobs($jobs);
			
		// Status 5
		doEcho("5 - Processing");
		$this->handleProcessingJobs($jobs);
		
		// Status 4
		doEcho("4 - Queueing");
		$this->handleQueuedJobs($jobs);
		//$this->handleReadyForQueueJobs($jobs);
		
		// Status 3
		doEcho("3 - Prepare");
		//$this->handleEstimateSizeJobs($jobs);
		
		// Status 2
		doEcho("2 - Upload");
		//$this->handlePutToFolderJobs($jobs);
		$this->handleUploadedJobs($jobs);
		$this->handleUploadingJobs($jobs);
		$this->handleUploadReadyJobs($jobs);
		
		// Status 1
		doEcho("1 - Pending");
		$this->handlePendingJobs($jobs);
		$this->handleChecksumJobs($jobs);
		
		// the only function which removes elements (must be last)
		doEcho("Remove");
		$this->removeJobs($jobs);

		doEcho("Cycle Complete");
	}
	
	public function removeJobs(&$jobs) {
		
		$entries = $this->getEntriesByStatus('readyToBeRemoved');
		
		doEcho(" >> " . count($entries) . " projects to be removed.");
		
		foreach($entries as $index) {
			$guid = $jobs[$index]->data['guid'];
			$jobFile = jobFileG($guid);
			$jobFileContent = lockedFileRead($jobFile, filesize($jobFile), 'r');
			jobLog($guid, "Last job file status: [" . $jobFileContent . "]");
			
			unlink($jobFile);
			
			$result = $this->taskFileHandler->doSafeRegexRemove($guid, 1000000);
			
			doLog('[JOB]: Removed ' . print_r($result, true), logfile());

			$jobText = trim($result['deletedData']);
			$jobText = str_pad($jobText, 300);
			$this->doneTaskHandler->appendLine($jobText);
		}
	}
	
	public function handleSentEmailJobs(&$jobs) {

		$entries = $this->getEntriesByStatus('emailSent');

		doEcho(" >> " . count($entries) . " emails sent.");
		
		foreach($entries as $index) {
			$job = $jobs[$index];
			
			if($job->data['taskfile'] != '') {
				handleSubTasks( $job );
			}
			$this->doTransfer($jobs[$index], 6, 'readyToBeRemoved');
		}
	}
	
	public function handleFinishedJobs(&$jobs) {
		
		$entries = $this->getEntriesByStatus('finished');

		doEcho(" >> " . count($entries) . " finished jobs will be processed.");
		
		// Do nothing
	}
	
	public function handleProcessingJobs(&$jobs) {
	
		$entries = $this->getEntriesByStatus('processing');
		
		// Do nothing
	}
	
	public function handleQueuedJobs(&$jobs) {
	
		$entries = $this->getEntriesByStatus('inQueue');
		
		doEcho(" >> " . count($entries) . " projects in queue.");
		
		//$freeSlots = max($this->config['polyzoom'] - $this->getCurrentZooms(), 0);
		$freeSlots = max(4 - $this->getCurrentZooms(), 0);
		
		doEcho(" >> Only " . $freeSlots . " slots available.");

		if($freeSlots > 0) {
			$entriesToZoom = array_splice($entries, 0, $freeSlots);
			
			foreach($entriesToZoom as $index) {
				$current = $jobs[$index];
				execute("php " . rootPath() . "issueDoPolyzoom.php '" . $current->data['targetFilename'] . "' " . $current->data['guid'] . " " . $this->taskFileName);
			}
		}
	}
	
	public function handleReadyForQueueJobs(&$jobs) {
	
		$entries = $this->getEntriesByStatus('readyForQueue');
		
		foreach($entries as $index) {
			$this->doTransfer($jobs[$index], 4, 'inQueue');
		}
	}
	
	public function handleEstimateSizeJobs(&$jobs) {
	
		$entries = $this->getEntriesByStatus('estimateSize');
		
		foreach($entries as $index) {
			$this->doTransfer($jobs[$index], 4, 'readyForQueue');
		}
	}
	
	public function handlePutToFolderJobs(&$jobs) {
	
		$entries = $this->getEntriesByStatus('putToOwnFolder');
		
		foreach($entries as $index) {
			$this->doTransfer($jobs[$index], 3, 'estimateSize');
		}
	}
	
	public function handleUploadedJobs(&$jobs) {
	
		$entries = $this->getEntriesByStatus('uploaded');
		
		doEcho(" >> " . count($entries) . " projects uploaded.");

		foreach($entries as $index) {
			//$this->doTransfer($jobs[$index], 2, 'putToOwnFolder');
			$this->doTransfer($jobs[$index], 4, 'inQueue');
		}
	}
	
	public function handleUploadingJobs(&$jobs) {
	
		$entries = $this->getEntriesByStatus('uploading');
		
		doEcho(" >> " . count($entries) . " projects uploading.");

		foreach($entries as $index) {
		
			$current = $jobs[$index];
			$targetFileName = $current->data['targetFilename'];
			$sourceFileName = $current->data['origFilename'];
			$guid = $current->data['guid'];
			
			if(file_exists($targetFileName)) {
				if(md5chk($targetFileName) == $current->data['md5']) {
					$this->doTransfer($jobs[$index], 4, 'inQueue');
					doLog('[JOB]: File uploaded but upload process stuck [' . $sourceFileName . '] [' . $targetFileName . '] [' . $guid . ']', logfile());
				}
			}
			else {
				if(!file_exists($sourceFileName)) {
					// file and/or drive was removed
					$this->doTransfer($jobs[$index], 6, 'readyToBeRemoved');
					doLog('[JOB]: File and/or drive was removed [' . $sourceFileName . '] [' . $guid . ']', logfile());
				}
			}
		}
	}
	
	public function handleUploadReadyJobs(&$jobs) {
	
		$entries = $this->getEntriesByStatus('upload');
		
		doEcho(" >> " . count($entries) . " projects whose upload will start soon.");

		foreach($entries as $index) {
			
			$current = $jobs[$index];
			$targetFileName = $current->data['targetFilename'];
			$sourceFileName = $current->data['origFilename'];
			$guid = $current->data['guid'];
			
			jobLog($guid, "Job should be uploaded [" . $guid . "]");
			
			if(file_exists($targetFileName)) {
				if(md5chk($targetFileName) == $current->data['md5']) {
					$this->doTransfer($jobs[$index], 4, 'inQueue');
					doLog('[JOB]: File uploaded but upload process stuck [' . $sourceFileName . '] [' . $targetFileName . '] [' . $guid . ']', logfile());
					jobLog($guid, "File uploaded but upload process stuck!");
				}
				else {
					jobLog($guid, "MD5 different - is [" . md5chk($targetFileName) . "] should [" . $current->data['md5'] . "]");
				}
			}
			else {
				if(!file_exists($sourceFileName)) {
					// file and/or drive was removed
					$this->doTransfer($jobs[$index], 6, 'readyToBeRemoved');
					doLog('[HARDWARE]: ' . "File and/or drive was removed [" . $sourceFileName . "] [" . $guid . "]", logfile());
					jobLog($guid, "File and/or drive was removed before the upload could be initiated!");
				}
			}
		}
	}
	
	public function handleChecksumJobs(&$jobs) {
		
		$entries = $this->getEntriesByStatus('checksum');
		
		doEcho(" >> " . count($entries) . " checksums are computed.");

		foreach($entries as $index) {
			$current = $jobs[$index];

			try {
				execute("php " . rootPath() . "doChecksum.php '" . $current->data['origFilename'] . "' " . $current->data['guid']);
			}
			catch (Exception $e) {
				doEcho($index . " Failed \n");
				doEcho($e);
				$this->doTransfer($jobs[$index], 6, 'readyToBeRemoved');
			}
		}
	}
	
	public function handlePendingJobs(&$jobs) {
	
		$entries = $this->getEntriesByStatus('pending');
		
		doEcho(" >> " . count($entries) . " jobs are pending and waiting for upload.");

		//$freeSlots = max($this->config['upload'] - $this->getCurrentUploadsCount(), 0);
		$freeSlots = max(4 - $this->getCurrentUploadsCount(), 0);

		doEcho(" >> Only " . $freeSlots . " slots available. " . $this->getCurrentUploadsCount() . " currently used.");

		if($freeSlots > 0) {
			

			$entriesToSubmit = array_splice($entries, 0, $freeSlots);
			foreach($entriesToSubmit as $index) {
				//$jobs[$index]['status'] = 'upload';
				$current = $jobs[$index];

				try {
					$this->doTransfer($current, 2, 'upload');
					// start concurrent upload
					execute("php " . rootPath() . "uploadProject.php '" . $current->data['origFilename'] . "' '" . $current->data['targetFilename'] . "' '" . $current->data['guid'] . "' '" . $current->data['md5'] . "'");
				}
				catch (Exception $e) {
					doEcho($index . " Failed \n");
					doEcho($e);
					$this->doTransfer($current, 1, 'pending');
				}
			}
		}
	}
	
	public function doTransfer($job, $newStatusId, $newStatus) {
		$transfer = $this->makeUpStatusTransfer($job, $newStatusId, $newStatus);
		$file = new TaskFileManipulator( jobFileG( $job->data['guid'] ) );
		$file->doSafeRegexUpdate($transfer['pattern'], $transfer['text'], 3000);
		jobLog($job->data['guid'], $job->data['guid'] . " changes from [" . $transfer['pattern'] . "] to [" . $transfer['text'] . "]");
	}
	
	public function makeUpStatusTransfer($job, $newStatusId, $newStatus) {
		//$pattern = ";" . $job->data['guid'] . ";" . $job->data['statusId'] . ";" . $job->data['status'] . ";";
		//$text    = ";" . $job->data['guid'] . ";" . $newStatusId . ";" . $newStatus . ";";
		$pattern = ";" . $job->data['statusId'] . ";" . $job->data['status'] . ";";
		$text    = ";" . $newStatusId . ";" . $newStatus . ";";
		
		return array(
			'pattern' => $pattern,
			'text' => $text 
			);
	}
	
	public function getCurrentUploadsCount() {
		$uploadedCount = count($this->getEntriesByStatus('upload'));
		$uploadingCount = count($this->getEntriesByStatus('uploading'));
		
		$totalUploadCount = $uploadedCount + $uploadingCount;
		
		return $totalUploadCount;
	}
	
	public function getCurrentZooms() {
		$queuedCount = count($this->getEntriesByStatus('inQueue'));
		$processingCount = count($this->getEntriesByStatus('processing'));
		
		$totalZooms = $processingCount;
		
		return $totalZooms;
	}
	
	public function getEntriesByStatus($status) {
		return $this->statusMap[$status];
	}
	
	public function loadConfig() {
		$configFileName = rootPath() . 'concurrency.config';
		
		$result = lockedFileRead($configFileName, filesize($configFileName), 'r');
		
		if( $result['id'] != 0 ) {
			throw new FileReadException($result['comment'], $result['id']);
		}
		
		$data = explode("\n", $result['data']);
		
		$config = array();
		foreach($data as $entry) {
			if($entry != "") {
				$splitted = explode(":", $entry);
				$config[$splitted[0]] = $splitted[1];
			}
		}
		
		return $config;
	}
}

?>
