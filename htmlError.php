<?php
/*
	Desc: Returns a properly formatted html error.
	Author:	Sebastian Schmittner
	Date: - 
	Last Author: Sebastian Schmittner
	Last Date: 2015.01.30 15:03:36 (+01:00)
	Version: 0.0.4
*/

// generates a proper HTML error (HTTP != 200)
// from: (http://stackoverflow.com/questions/4417690/return-errors-from-php-run-via-ajax)
function errorMessage($errorMsg, $errorCode)
{
    header('HTTP/1.1 500 Internal Server Error');
    header('Content-Type: application/json; charset=UTF-8');
    die(json_encode(array('message' => $errorMsg, 'code' => $errorCode)));
}

?>
