<?php
/*
	Desc: Functions to upload a project to a specified path.
	Author:	Sebastian Schmittner
	Date: - 
	Last Author: Sebastian Schmittner
	Last Date: 2015.01.31 09:21:05 (+01:00)
	Version: 0.1.1
*/

class FileContentChangedException extends Exception {};
class WrongArgumentCountException extends Exception {};

require_once 'polyzoomerGlobals.php';
require_once 'logging.php';
require_once 'md5chk.php';
require_once 'addLineToFile.php';
require_once 'taskFileManipulator.php';

if($argc != 5) {
	doLog('[' . $argc . '/' . json_encode($argv). ']', logfile());
	throw new WrongArgumentCountException();
}

set_time_limit(600);

$filename = $argv[1];
$uploadTo = $argv[2];
$jobGuid = $argv[3];
$md5File = $argv[4];

uploadProject($filename, $uploadTo, $jobGuid, $md5File);
/////////////////////////////////

function uploadProject($filePath, $uploadFile, $jobGuid, $md5File) {

	$logFile = uploadLog();
	
	$md5OfFile = md5chk( $filePath );
	
	if($md5OfFile != $md5File) {
		jobLog($jobGuid, 'MD5 is not the same, it is assumed that the content has changed!');
		throw new FileContentChangedException();
	}
	
	$shallDoCopy = false;
	
	updateJobEntry($jobGuid, '2;upload', '2;uploading');
	
	// file exists?
	if ( file_exists( $uploadFile ) ) {
		$md5OfFileNew = md5chk( $uploadFile );
		
		// is it the same?
		if( strcmp($md5OfFile, $md5OfFileNew) == 0 ) {
			$logSuccess = logEvent( "already-there", $logFile, $uploadFile, $md5OfFile );
			jobLog($jobGuid, 'File is already there!');
		}
		else
		{
			$shallDoCopy = true;
		}
	}
	else
	{
		$shallDoCopy = true;
	}

	/// CLEANUP - if docopy fails there is nothing done about it!!!
	if ( $shallDoCopy ) {
		doCopy( $filePath, $filePath, $uploadFile, $logFile, $md5OfFile );
	}

	updateJobEntry($jobGuid, '2;uploading', '2;uploaded');
}

function doCopy($filename, $fromPath, $toPath, $logFile, $md5OfFile) {

	// log the start
	$logSuccess = logEvent( "start", $logFile, $filename, $md5OfFile );
	
	// copy
	$success = copy($fromPath, $toPath);
		
	if ( !$success ) {
		$logSuccess = logEvent( "error (copy failed)", $logFile, $filename, $md5OfFile );
	}
		
	$md5OfFileNew = md5chk( $toPath );
	
	// check the result
	if( strcmp($md5OfFile, $md5OfFileNew) == 0 ) {
		$logSuccess = logEvent( "finish", $logFile, $filename, $md5OfFile );
	}
	else
	{
		$logSuccess = logEvent( "error (MD5 different)", $logFile, $filename, $md5OfFileNew );
	}
}

function updateJobEntry($jobGuid, $currentStatus, $newStatus) {
	$jobFile = jobFileG($jobGuid);
	
	$taskFile = new taskFileManipulator($jobFile);
	
	$pattern = ";$currentStatus;";
	$text    = ";$newStatus;";

	$result = $taskFile->doSafeRegexUpdate($pattern, $text, 3000);
	
	jobLog($jobGuid, $jobGuid . " changes from [" . $currentStatus . "] to [" . $newStatus . "]");
	
	if( $result['id'] != 0 ) {
		jobLog($jobGuid, 'Could not lock the jobfile!');
		throw new LockFailedException();
	}
}

?>
