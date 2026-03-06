<?php
/*
	Desc: Logging and debugging facilities.
	Author:	Sebastian Schmittner (stp.schmittner@gmail.com)
	Date: 2015.01.30 15:04:51 (+01:00)
	Last Author: Sebastian Schmittner
	Last Date: 2015.07.12 22:04:04 (+02:00)
	Version: 0.1.0
*/

require_once __DIR__ . '/lockedFileAccess.php';
require_once __DIR__ . '/polyzoomerGlobals.php';
require_once __DIR__ . '/tools.php';

date_default_timezone_set('Europe/London');

// global debug flag
function isDebugActive() {
	return true;
}

function doEcho( $toBeLogged ) {
	if( isDebugActive() ) {
		var_dump($toBeLogged);
	}
}

function executionName() {
	if( isDebugActive() ) {
		return '[DEBUG]';
	}
	else
	{
		return '[RELEASE]';
	}
}

function executeAsync($command) {

	doLog('[EXECUTE] [ASYNC] ' . $command, logFile());
	$command = addLogToCommand($command);
	system($command);
}

function executeSync($command) {

	doLog('[EXECUTE] [SYNC] ' . $command, logFile());

	$output = array();
	$result = array();
		
	exec($command, $output, $result);
		
	doLog('[EXECUTE] [OUTPUT] ' . json_encode( $output ), logFile());
	doLog('[EXECUTE] [RESULT] ' . json_encode( $result ), logFile());
	
	return $output;
}

function execute($command) {
	
	doLog('[EXECUTE] ' . executionName() . ' ' . $command, logFile());

	if( isDebugActive() ) {
		$r1 = array();
		$r2 = array();
		
		exec($command, $output, $result);
		
		doLog('[EXECUTE] [OUTPUT] ' . json_encode( $output ), logFile());
		doLog('[EXECUTE] [RESULT] ' . json_encode( $result ), logFile());
	}
	else {
		$command = addLogToCommand($command);
		system($command);
	}
}

function doLog( $message, $logfile ) {
	$message = addTimeToLogMessage( $message );
	appendLog( $message, $logfile );
}

function appendLog( $message, $logfile ) {
	
	$logFilesize = safeFileSize( $logfile );
	
	if( $logFilesize > maximumLogfileSizeInBytes() ) {
		rollFile( $logfile );
	}
	
	$returnValue = lockedFileAppend( $logfile, $message );
}

function doErrorLog( $message ) {
	$message = addTimeToLogMessage( $message );
	appendLog( $message, logfile() );
	
	$message = addStackTrace( $message, getStackTrace() );
	// sendAdminMail( '[FATAL] Unexpected issue occured!', $message );
}

function addStackTrace( $message, $stackTrace ) {
	return $message . '\n\n' . $stackTrace;
}

/* From http://stackoverflow.com/questions/1423157/print-php-call-stack */
function getStackTrace() {
	$e = new Exception;
	return $e->getTraceAsString();	
}

function addLogToCommand($command) {
	return $command . ' >> ' . logFile() . ' & echo $!';
}

function jobLog( $guid, $message ) {
	doLog( $message, jobFolder() . "$guid.log" );
	doLog($message, logfile());
}

function getTime() {
	return date("[Y-m-d H:i:s]");
}

function logEvent( $text, $logFile, $filename, $md5sum ) {
	$logString = $md5sum . ";" . $text . ";'" . $filename . "';" . date('YmdHi') . ";";
	$logSuccess = addLineToFile($logFile, $logString);
	
	return $logSuccess;
}

function addTimeToLogMessage( $message ) {
	return getTime() . ' ' . $message . "\n";
}

function rollFile( $filename ) {	
	$filenameParts = pathinfo($filename);
	$archivedFilename = $filenameParts['dirname'] . '/' . $filenameParts['filename'] . '-' . date("YmdHi") . '.log';
	rename( $filename, $archivedFilename );
}

?>
