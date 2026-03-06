<?php
/*
	Desc: Performs the computation of the checksum 
	Author:	Sebastian Schmittner
	Date: 2014.12.23 11:34:03 (+01:00)
	Last Author: Sebastian Schmittner
	Last Date: 2015.06.06 17:39:43 (+02:00)
	Version: 0.0.5
*/

require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/md5chk.php';
require_once __DIR__ . '/lockedFileAccess.php';
require_once __DIR__ . '/addLineToFile.php';
require_once __DIR__ . '/guid.php';
require_once __DIR__ . '/fileFormats.php';
require_once __DIR__ . '/taskFileManipulator.php';

set_time_limit(28800);

$filename = $argv[1];
$guid = $argv[2];

doChecksum($filename, $guid);
/////////////////////////////////

function doChecksum($filename, $guid) {
	
	$success = false;
	
	try {
		$checksum = md5chk($filename);
		updateChecksum($guid, $checksum);
		$success = true;
	}
	catch (Exception $e) {
	}
	
	if($success) {
		updateJobEntry($guid, '1;checksum', '1;pending');
	}
}

function updateChecksum($guid, $checksum) {
	$jobFile = jobFileG($guid);
	
	$taskFile = new taskFileManipulator($jobFile);
	
	$result = $taskFile->doSafeRegexUpdate("MD5CHECKSUM", $checksum, 3000);
	
	if( $result['id'] != 0 ) {
		throw new LockFailedException();
	}
}
	
function updateJobEntry($guid, $currentStatus, $newStatus) {
	$jobFile = jobFileG($guid);
	
	$taskFile = new taskFileManipulator($jobFile);
	
	$pattern = ";$guid;$currentStatus;";
	$text    = ";$guid;$newStatus;";

	$result = $taskFile->doSafeRegexUpdate($pattern, $text, 3000);
	
	jobLog($guid, ' Changed from [' . $pattern . '] to [' . $text . ']');
	
	if( $result['id'] != 0 ) {
		throw new LockFailedException();
	}
}

?>
