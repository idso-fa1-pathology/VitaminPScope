<?php
/*
	Desc: Adds a text line to the end of a file (locked).
	Author:	Sebastian Schmittner
	Date: 2014.07.24 15:04:02 (+02:00)
	Last Author: Sebastian Schmittner
	Last Date: 2015.06.14 14:28:42 (+02:00)
	Version: 0.0.4
	
*/

require_once '../../lockedFileAccess.php';

// appends a line to a file
function addLineToFile($path, $text)
{
	$text = $text . PHP_EOL;
	
	$status = 1;
	$result = null;
	$tries = 10;
	
	while($status == 1 && $tries > 0) {
		if($result != null) {
			sleep(2);
		}
		
		$result = lockedFileAppend($path, $text);
		$status = $result['id'];
		--$tries;
	}
	
	$result['tries'] = $tries;
	$result['success'] = ($tries > 0) && ($result['bytesWritten'] == strlen($text));
	
	return $result;
}

?>
