<?php
/*
	Desc: Adds a text line to the end of a file.
	Author:	Sebastian Schmittner
	Date: 2014.08.14 
	Last Author: Sebastian Schmittner
	Last Date: 2014.12.21 12:45:14 (+01:00)
	Version: 0.0.3
	
*/

require_once __DIR__ . '/md5chk.php';
require_once __DIR__ . '/lockedFileAccess.php';

// appends a line to a file
function addLineToFile($path, $text)
{
	$success = array( 'id' => 1 );
	
	$counter = 1000000;
	
	while($success['id'] != 0 && $counter > 0) {
		$md5Sum = md5chk($path);
		$success = lockedFileAppend( $path, $text . "\n", $md5Sum );
		--$counter;
	}
	
	return $success;
}

?>
