<?php
/*
	Desc: Followup file functions.
	Author:	Sebastian Schmittner (stp.schmittner@gmail.com)
	Date: 2015.07.17 13:00 (+02:00)
	Last Author: Sebastian Schmittner
	Last Date: 2015.07.23 22:38:00 (+02:00)
	Version: 0.0.2
*/

require_once 'polyzoomerGlobals.php';
require_once 'guid.php';
require_once 'lockedFileAccess.php';
require_once 'tools.php';
require_once 'logging.php';

// Task types
abstract class SubTaskType {
	const __default = 0;
	const UNDEFINED = 0;
	const CREATEMULTIZOOM = 1;
	const DOANALYSIS = 2;
	const SHAREWITH = 3;
	const SENDEMAIL = 4;
}

// Subtask
interface SubTask {
	public function taskType();
	public function parameters();
	public function execute( Job $job );
}

// TaskSet Queue
class TaskSet {
	public $taskSet;
	public $guid;
	
	public function __construct( $guid = '0' ) {
		$this->taskSet = array();
		$this->guid = $guid;
	}
	
	public function __destruct() {}
	
	public function pushTask( $task ) {
		array_push( $this->taskSet, $task );
	}
	
	public function popTask() {
		
		$task = NULL;
		
		if( count($this->taskSet) != 0 ) {
			$task = array_pop( $this->taskSet );
		}
		
		return $task;
	}
	
	public function guid() {
		return $this->guid;
	}
}

// task file handler
function createTaskFile() {
	
	$guid = createUniqueTaskFileName();
	$taskSet = new TaskSet();
	
	$result = FALSE;
	$result = file_put_contents( taskFile($guid), safeSerialize($taskSet) );
	
	if( $result == FALSE ) {
		$guid = '';
	}
	
	return $guid;
}

function loadTaskFile( $guid ) {
	
	$taskSet = NULL;
	
	try {
		$filename = taskFile( $guid );
		//$content = lockedFileRead($filename, safeFileSize($filename), 'r');
		$content = file_get_contents($filename);
		
/*		if($content['id'] == 0) {
			$content = $content['data'];*/
		doLog(base64_decode($content), logfile());
		$taskSet = safeUnSerialize( $content );
		$taskSet->guid = $guid;
		//}
	}
	catch(Exception $e) {
		doLog('[ERROR] Taskfile could not be read [' . $guid . ']', logfile());
	}
	
	return $taskSet;
}

function saveTaskFile( $guid, $taskSet ) {

	try {
		$filename = taskFile( $guid );
		$content = safeSerialize( $taskSet );
		//$result = put_file_contents(lockedFileWrite( $filename, $content );
		file_put_contents( $filename, $content );
	}
	catch(Exception $e) {
		doLog('[ERROR] Taskfile could not be written [' . $guid . ']', logfile());
	}
}

function createUniqueTaskFileName() {
	
	$doesExist = true;
	
	while( $doesExist ) {
		$guid = GUID();
		$filename = taskFile($guid);
		$doesExist = file_exists( $filename );
	}
	
	return $guid;
}

?>
