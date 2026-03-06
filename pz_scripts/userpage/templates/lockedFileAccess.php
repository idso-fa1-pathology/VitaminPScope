<?php
/*
	Desc: Functions for locked file access.
	Author:	Sebastian Schmittner
	Date: 2014.07.24 15:04:19 (+02:00)
	Last Author: Sebastian Schmittner
	Last Date: 2014.11.08 13:14:34 (+01:00)
	Version: 0.0.6
*/

class FileReadException extends Exception {};
// tries to lock the file and write the text to it
// return values
// 0 - ok 		- everything went fine
// 1 - error  	- the file could not be locked
// 2 - error 	- the write seems to have failed
function lockedFileWrite( $filename, $text, $expectedMd5 = 0) {

	$returnValue = createReturnValue(0, "ok", "");
	
	$file = fopen( $filename, 'c+' );
	
	if ( flock($file, LOCK_EX) ) {
		
		$bytesWritten = 0;
		
		// write ONLY if the file is not yet changed
		if ( $expectedMd5 == 0 || $expectedMd5 == md5_file($filename) ) {
			
			$buffer = '';

			if(filesize($filename) > 0) {
				$buffer = fread($file, filesize($filename));
			}
			
			ftruncate($file, 0);
			fseek( $file, 0, SEEK_SET );
			$bytesWritten = fwrite( $file, $text );
			$returnValue['bytesWritten'] = $bytesWritten;
		}
		
		if ( $bytesWritten != strlen($text) ) {
			$returnValue = createReturnValue(2, "error", "File write did not perform properly!");
			fwrite($file, $buffer);
		}

		flock( $file, LOCK_UN );
	}
	else {
		$returnValue = createReturnValue(1, "error", "File could not be locked.");
	}

	fclose( $file );
	
	return $returnValue;
}

function lockedFileAppend( $filename, $text, $expectedMd5 = 0) {

	$returnValue = createReturnValue(0, "ok", "");
	
	$file = fopen( $filename, 'ab' );
	
	if ( flock($file, LOCK_EX) ) {
		
		$bytesWritten = 0;
		
		// write ONLY if the file is not yet changed
		if ( $expectedMd5 == 0 || $expectedMd5 == md5_file($filename) ) {
			$bytesWritten = fwrite( $file, $text );
			$returnValue['bytesWritten'] = $bytesWritten;
		}
		
		if ( $bytesWritten != strlen($text) ) {
			$returnValue = createReturnValue(2, "error", "File write did not perform properly!");
		}

		flock( $file, LOCK_UN );
	}
	else {
		$returnValue = createReturnValue(1, "error", "File could not be locked.");
	}

	fclose( $file );
	
	return $returnValue;
}

// tries to lock the file and read the length of it
// return values
// 0 - ok 		- everything went fine
// 1 - error  	- the file could not be locked
// 2 - error 	- the read seems to have failed
function lockedFileRead( $filename, $length, $mode ) {
	$returnValue = createReturnValue(0, "ok", "");
	$data = "";
	
	$file = fopen( $filename, $mode );

  $fp = fopen('/var/www/jamie-debug.log', 'w');
  fwrite($fp, $filename);
  fwrite($fp, $length);
  fclose($fp);

	
	if ( flock($file, LOCK_EX) ) {
	
		$data = fread( $file, $length );
		
		flock( $file, LOCK_UN );
		
		if ( $data === false ) {
			$returnValue = createReturnValue(2, "error", "File read did not perform properly!");
		}
	}
	else {
		$returnValue = createReturnValue(1, "error", "File could not be locked.");
	}

	fclose( $file );
	
	$returnValue["data"] = $data;
	
	return $returnValue;
}

// tries to lock the file, increment a counter and return its value
// return values
// >= 0 - current index
// -1   - failed (possibly the lock)
function atomicCounterIncrement( $filename ) {
	
	$file = fopen( $filename, "r+" );
	$counter = -1;
	
	if ( flock( $file, LOCK_EX ) ) {
	
		$counter = fread( $file, filesize( $filename ) );
		$counter = intval( $counter ) + 1;
		
		ftruncate( $file, 0 );
		fseek( $file, 0, SEEK_SET );
		fwrite( $file, $counter );
		flock( $file, LOCK_UN );
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
