<?php
/*
 Desc: OPTIMIZED - Prepare and start the polyzooming process with LOCAL processing
 Author: Sebastian Schmittner
 Date: 2014.08.24 22:56:00 (+02:00)
 Last Author: Enhanced for local processing optimization
 Last Date: 2025.06.19
 Version: 0.2.0 - LOCAL PROCESSING OPTIMIZATION
*/

require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/lockedFileAccess.php';
require_once __DIR__ . '/taskFileManipulator.php';
require_once __DIR__ . '/polyzoomerGlobals.php';  // FIX: Add this include

class WrongArgumentCountException extends Exception {};

if($argc != 4) {
    throw new WrongArgumentCountException("Wrong argument count. Expected 4, got $argc. Args: " . implode(', ', $argv));
}

$path = $argv[1];
$guid = $argv[2];
$taskFileName = $argv[3];

set_time_limit(600);

try {
	doPolyzoom($path, $guid, $taskFileName);
}
catch (Exception $e) {
	print_r($e);
}

function doPolyzoom($path, $guid, $taskFileName) {
	
	$result = array();
	$jobFile = jobFileG($guid);
	$taskFile = new taskFileManipulator($jobFile);
	
	$pattern = ";$guid;4;inQueue;";
	$text    = ";$guid;5;processing;";
	$result = $taskFile->doSafeRegexUpdate($pattern, $text, 1000000);
	
	// OPTIMIZATION: Use local processing
	$localPath = prepareLocalPolyzoom($path, $guid);
	$output = polyzoomLocal($localPath["localPath"], $localPath["filename"], $localPath["networkPath"], $guid);
	
	// Update job with final network path
	$result = $taskFile->doSafeRegexUpdate(";FINAL_FILENAME_PLACEHOLDER;FINAL_PATH_PLACEHOLDER", ";" . $localPath['filename'] . ";" . $localPath['networkPathName'], 3000);
	
	$pattern = ";$guid;5;processing;";
	$text    = ";$guid;6;finished;";
	$result = $taskFile->doSafeRegexUpdate($pattern, $text, 1000000);

	return array(
		"path" => $localPath["networkPathName"],
		"output" => $output
	);
}

/**
 * OPTIMIZATION: Prepare processing in LOCAL temp directory
 * Stage files locally for fast processing, reserve network path for final transfer
 */
function prepareLocalPolyzoom($path, $guid) {
	
	$rootPath = rootPath();
	$counterFile = $rootPath . "/counter.log";
	
	$filePath = $path;
	$toFile = basename( $filePath );
	
	// Remove the unique id while uploading from 'issueUploadProject.php'
	$uidSeparator = strpos($toFile, '_');
	$toFile = substr($toFile, $uidSeparator + 1);
	
	$counter = atomicCounterIncrement( $counterFile );
	
	if ( $counter == -1 ) {
		log_error("Counter seems to be invalid!");
	}
	
	$basePathName = "Path" . number_pad($counter, 6) . "_" . date('YmdHi');
	
	// OPTIMIZATION: Create LOCAL temp directory for fast processing
	$localTempDir = "/tmp/polyscope_processing_" . $guid . "_" . time();
	$localProcessingPath = $localTempDir . "/" . $basePathName;
	
	// FIX: Use HOT STORAGE for new files instead of hardcoded path
	$networkPath = polyzoomerHotPath() . $basePathName;
	
	log_error("OPTIMIZATION: Creating local processing directory: " . $localProcessingPath);
	log_error("FIX: Using HOT STORAGE for new files: " . $networkPath);
	
	// Create local processing directory
	$dirCreated = mkdir( $localProcessingPath, 0755, true );
	
	if ( !$dirCreated ) {
		log_error("Local directory could not be created! [" . $localProcessingPath . "]");
		throw new Exception("Failed to create local processing directory");
	}
	
	// OPTIMIZATION: Copy file to LOCAL storage for processing (fast)
	log_error("OPTIMIZATION: Copying file to local storage for processing");
	$success = copy($filePath, $localProcessingPath . "/" . $toFile);
	if ( !$success ) {
		log_error("Copying to local failed: " . $filePath . " -> " . $localProcessingPath . "/" . $toFile);
		throw new Exception("Failed to copy file to local processing directory");
	}
	
	// Remove original uploaded file to save space
	unlink($filePath);
	
	// Copy processing scripts to local directory
	$success = copy(rootPath() . "pz_scripts/polyzoomer/createPolyzoomerSite.sh", $localProcessingPath . "/createPolyzoomerSite.sh");
	if ( !$success ) {
		log_error("Copy of creationscript failed!");		
	}

	$success = copy(rootPath() . "pz_scripts/DssConverter/DigitalSlideStudio.sh", $localProcessingPath . "/DigitalSlideStudio.sh");
	if ( !$success ) {
		log_error("Copy of DigitalSlideStudio failed!");		
	}

	$success = copy(rootPath() . "pz_scripts/DssConverter/FinalScan_template", $localProcessingPath . "/FinalScan_template");
	if ( !$success ) {
		log_error("Copy of FinalScan_template failed!");		
	}

	$success = copy(rootPath() . "pz_scripts/doDeepzoom.sh", $localProcessingPath . "/doDeepzoom.sh");
	if ( !$success ) {
		log_error("Copy of doDeepzoom.sh failed!");		
	}

	$success = copy(rootPath() . "pz_scripts/doTiling.sh", $localProcessingPath . "/doTiling.sh");
	if ( !$success ) {
		log_error("Copy of doTiling.sh failed!");		
	}

	$success = copy(rootPath() . "pz_scripts/doPolyzoom.sh", $localProcessingPath . "/doPolyzoom.sh");
	if ( !$success ) {
		log_error("Copy of doPolyzoom.sh failed!");		
	}

	return array(
		"filename" => $toFile,
		"localPath" => $localProcessingPath,
		"networkPath" => $networkPath,
		"networkPathName" => $basePathName,
		"tempDir" => $localTempDir
	);
}

/**
 * OPTIMIZATION: Process DZI tiles in LOCAL storage, then transfer to network
 * This is where the major performance gain happens!
 */
function polyzoomLocal( $localPath, $filename, $networkPath, $guid ) {
	
	$output = chdir($localPath . "/");
	
	log_error("OPTIMIZATION: Starting LOCAL DZI processing in: " . $localPath);
	
	// detox
	$executestring = "detox -n './$filename' > detox.log";
	log_error($executestring);
	$loutput = shell_exec($executestring);
	$output = $output . " - " . $loutput;
	
	$executestring = "cat detox.log";
	$realOutput = shell_exec($executestring);
	log_error($executestring);

	// detox returns nothing if there is no change done
	if(strlen($realOutput) != 0) {
		$realOutput = substr($realOutput, 0, -1);
		$executestring = "detox './$filename'";
		log_error($executestring);
		$loutput = shell_exec($executestring);
		$output = $output . " - " . $loutput;
		
		$detoxString = "./" . $filename . " -> ";
		$filenameLength = strlen($realOutput) - (strlen($detoxString) + 2);
		$filename = substr($realOutput, strlen($detoxString) + 2, $filenameLength);
		log_error($filename);
	}
	
	// add the pat_id and channel_id if missing
    $newfilename = testAndCorrectFilename($filename);
	$executestring = "mv -f './$filename' './$newfilename' >> ./process.log";
	log_error($executestring);
	$loutput = shell_exec($executestring);
	$output = $output . " - " . $loutput;
		
	// OPTIMIZATION: polyzoom processing in LOCAL storage (FAST!)
	$executestring = "chmod 777 ./doPolyzoom.sh";
	log_error($executestring);
	$loutput = shell_exec($executestring);
	$output = $output . " - " . $loutput;
	
	// Run DZI processing in local directory - this creates thousands of tiles LOCALLY
	log_error("OPTIMIZATION: Running DZI processing LOCALLY (fast tile generation)");
	$executestring = "./doPolyzoom.sh \"" . $newfilename . "\" 2>&1";
	log_error($executestring);
	$loutput = shell_exec($executestring);
	$output = $output . " - " . $loutput;
	
	// OPTIMIZATION: Transfer completed DZI to network storage
	log_error("OPTIMIZATION: DZI processing complete, transferring to HOT STORAGE");
	transferToNetworkStorage($localPath, $networkPath, $guid);
	
	// OPTIMIZATION: Cleanup local temp directory
	log_error("OPTIMIZATION: Cleaning up local temp directory");
	$tempDir = dirname($localPath);
	shell_exec("rm -rf " . escapeshellarg($tempDir));
	
	return $output . " - LOCAL->HOT STORAGE TRANSFER COMPLETE: " . $networkPath;
}

/**
 * OPTIMIZATION: Transfer completed DZI from local to network storage
 * This is a single operation vs thousands of small file writes
 */
function transferToNetworkStorage($localPath, $networkPath, $guid) {
	
	log_error("OPTIMIZATION: Starting transfer from LOCAL to HOT STORAGE");
	log_error("OPTIMIZATION: Source: " . $localPath);
	log_error("OPTIMIZATION: Destination: " . $networkPath);
	
	// Create network directory
	$parentDir = dirname($networkPath);
	if (!file_exists($parentDir)) {
		mkdir($parentDir, 0755, true);
	}
	
	// OPTIMIZATION METHOD 1: Direct move (fastest)
	$success = rename($localPath, $networkPath);
	
	if (!$success) {
		log_error("OPTIMIZATION: Direct move failed, trying copy + remove");
		
		// OPTIMIZATION METHOD 2: Copy then remove (backup method)
		$copyCommand = "cp -r " . escapeshellarg($localPath) . " " . escapeshellarg($networkPath);
		$result = shell_exec($copyCommand . " 2>&1");
		
		if (file_exists($networkPath)) {
			log_error("OPTIMIZATION: Copy successful, removing local directory");
			shell_exec("rm -rf " . escapeshellarg($localPath));
			$success = true;
		} else {
			log_error("OPTIMIZATION: Copy failed: " . $result);
			throw new Exception("Failed to transfer DZI to network storage");
		}
	}
	
	if ($success) {
		log_error("OPTIMIZATION: Transfer complete - DZI now available at: " . $networkPath);
	} else {
		log_error("OPTIMIZATION: Transfer FAILED");
		throw new Exception("Failed to transfer processed DZI to network storage");
	}
}

// check if there is the expected pattern for pat_id and channel_id
// otherwise add it
function testAndCorrectFilename( $filename ) {
	
	$pat_id = array();
	$channel_id = array();
	
	preg_match('/([a-zA-Z]+[0-9]+)/', $filename, $pat_id, PREG_OFFSET_CAPTURE);
	preg_match('/.*_([a-zA-Z]+[0-9]+)/', $filename, $channel_id, PREG_OFFSET_CAPTURE);

	if ( count($pat_id) == 0 && count($channel_id) == 0 ) {
		$filename = 'UNKNOWNPAT0001_UNKNOWNCHANNEL0001_' . $filename;
	}
	else if ( count($pat_id) == 0 ) {
		$filename = 'UNKNOWNPAT0001_' . $filename;
	}
	else if ( count($channel_id) == 0 ) {
		$filename = $pat_id[0][0] . '_UNKNOWNCHANNEL0001_' . $filename;
	}
	
	return $filename;
}

function number_pad($number,$n) {
	return str_pad((int) $number,$n,"0",STR_PAD_LEFT);
}

function log_error($text) {
	error_log("POLYZOOM: " . $text);
	shell_exec("echo '[" . date('Y-m-d H:i:s') . "] " . $text . "' >> process.log");
}

?>