<?php
/*
	Desc: Functions for locked file access.
	Author:	Sebastian Schmittner
	Date: 2014.07.24 15:04:19 (+02:00)
	Last Author: Sebastian Schmittner
	Last Date: 2015.07.12 21:59:39 (+02:00)
	Version: 0.1.0
*/

require_once __DIR__ . '/polyzoomerGlobals.php';
require_once __DIR__ . '/md5chk.php';

//class FileReadException extends Exception {};

// tries to lock the file and write the text to it
// return values
// 0 - ok 		- everything went fine
// 1 - error  	- the file could not be locked
// 2 - error 	- the write seems to have failed
function lockedFileWrite( $filename, $text, $expectedMd5 = 0) {

	$waitIfLocked = true;
	$returnValue = createReturnValue(0, "ok", "");
	
	$file = fopen( $filename, 'c+' );
	
	if ( flock($file, LOCK_EX, $waitIfLocked) ) {
		
		$bytesWritten = 0;
		$buffer = "";
		
		// write ONLY if the file is not yet changed
		if ( $expectedMd5 == 0 || $expectedMd5 == md5chk($filename) ) {

			if(filesize($filename) > 0) {
				$buffer = fread($file, filesize($filename));

				if(strlen($buffer) == 0) {
					throw new Exception();
				}

				$bytesWritten = internalWrite( $file, $text );
				$returnValue['bytesWritten'] = $bytesWritten;
				
				if ( $bytesWritten != strlen($text) ) {
					$returnValue = createReturnValue(2, "error", "File write did not perform properly!");
					internalWrite( $file, $buffer );
				}
			}
		}

		flock( $file, LOCK_UN );
	}
	else {
		$returnValue = createReturnValue(1, "error", "File could not be locked.");
	}

	fclose( $file );

	return $returnValue;
}

function internalWrite( $file, $data ) {
	ftruncate( $file, 0 );
	fseek( $file, 0, SEEK_SET );
	$bytesWritten = fwrite( $file, $data );
	fflush( $file );
	return $bytesWritten;
}

// tries to lock the file and append the text to it
// return values
// 0 - ok 		- everything went fine
// 1 - error  	- the file could not be locked
// 2 - error 	- the write seems to have failed
function lockedFileAppend( $filename, $text, $expectedMd5 = 0) {

	$returnValue = createReturnValue(3, "error", "could not open file");
	$waitIfLocked = true;
	
	$file = fopen( $filename, 'a' );
	
	if ( $file !== false && flock($file, LOCK_EX, $waitIfLocked) ) {
		
		$bytesWritten = 0;
		
		// write ONLY if the file has not yet changed
		if ( $expectedMd5 == 0 || $expectedMd5 == md5chk($filename) ) {
			$temp = tempnam( tempFolder(), tempPrefix() );
			$copied = copy( $filename, $temp );
			
			if( !$copied ) {
				$returnValue = createReturnValue(1, "error", "File could not be backedup.");
			}
			else {
				$bytesWritten = fwrite( $file, $text );
				fflush($file);
				$returnValue['bytesWritten'] = $bytesWritten;
			
				if ( $bytesWritten != strlen($text) ) {
					$returnValue = createReturnValue(2, "error", "File write did not perform properly!");
					rename( $temp, $filename );
				}
				else {
					unlink( $temp );
					$returnValue = createReturnValue(0, "ok", "");
				}
			}
		}
		
		flock( $file, LOCK_UN );
	}
	else {
		$returnValue = createReturnValue(1, "error", "File could not be locked.");
	}

	if($file !== false) {
		fclose( $file );
	}
	
	return $returnValue;
}

// tries to lock the file and read the length of it
// return values
// 0 - ok 		- everything went fine
// 1 - error  	- the file could not be locked
// 2 - error 	- the read seems to have failed
function lockedFileRead( $filename, $length, $mode, $waitIfLocked = true ) {
	
	$returnValue = createReturnValue(0, "ok", "");
	$data = "";
	
	// FIX: Always initialize data key to prevent "Undefined index: data" error
	$returnValue["data"] = "";
	
	if(filesize($filename) == 0) {
		return $returnValue;  // Now safe - data key is already set
	}
	
	$file = fopen( $filename, $mode );
	
	if ( flock($file, LOCK_SH, $waitIfLocked) ) {

		if(filesize($filename) != $length) {
			$returnValue = createReturnValue(3, "error", "Filesize of file " . $filename . " has changed 0!");
		}
		elseif (filesize($filename) == 0) {
			$data = "";
		}
		else {
			$data = fread( $file, $length );
		}

		if ( $data === false ) {
			$returnValue = createReturnValue(2, "error", "File read did not perform properly!");
		}
	}
	else {
		$returnValue = createReturnValue(1, "error", "File could not be locked.");
	}

	flock( $file, LOCK_UN );
	fclose( $file );
	
	$returnValue["data"] = $data;  // Update with actual data

	return $returnValue;
}

// tries to lock the file, increment a counter and return its value
// return values
// >= 0 - current index
// -1   - failed (possibly the lock)
function atomicCounterIncrement( $filename ) {
	
	$file = fopen( $filename, "r+" );
	$counter = -1;
	$failed = false;
	
	if ( flock( $file, LOCK_EX ) ) {
		clearstatcache();
		$counter = fread( $file, filesize( $filename ) );
		$counter = intval( $counter ) + 1;
		
		ftruncate( $file, 0 );
		fseek( $file, 0, SEEK_SET );
		fwrite( $file, $counter );
		fflush($file);
		flock( $file, LOCK_UN );
	}
	else {
		$failed = true;
	}
	
	fclose( $file );
	
	return $counter;
}

function createReturnValue( $id, $status, $comment ) {
	
	return array (
		"id" => $id,
		"status" => $status,
		"comment" => $comment,
	);
	
}

?>