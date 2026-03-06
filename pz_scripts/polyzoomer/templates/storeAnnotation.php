<?php
/*
 Desc:		storeAnnotation
			Adds a new annotation at the end of the file specified by PATH.
 
	Author:	Sebastian Schmittner
	Date: - 
	Last Author: Sebastian Schmittner
	Last Date: 2014.11.08 13:14:51 (+01:00)
	Version: 0.0.3
 
 Errors:	1 - The provided file could not be found.
*/

require_once 'lockedFileAccess.php';
require_once "../../../polyzoomerGlobals.php";

$annotationPath = json_decode($_POST['path']);
$annotation = json_decode($_POST['annotation']);

//$prefix = getPrefix();
//$annotationPath = $prefix . $annotationPath;
//$annotationPath = urlToPath($annotationPath);
$aPath = sanitizePath($annotationPath);

if($aPath !== FALSE) {
	$success = appendAnnotation( $aPath, $annotation );
	echo json_encode( $annotation );
}
else {
	echo json_encode('ERROR: Path could not be found! [' . $aPath . ']');
}

return;

// appends the annotation to the end of the file
function appendAnnotation($path, $annotation)
{
	$base = trim($annotation);
	$baselen = strlen($base);
	
	$annotation = str_pad($base, $baselen + 299) . "\n"; 
	
	$md5Sum = md5_file($path);
	
	$result = lockedFileAppend($path, $annotation, $md5Sum);
	
	return $result['id'] == 0;
	//$file = fopen( $path, "ab" );

	//$annotation = $annotation;
	
	//$numberOfBytesWritten = fwrite( $file, $annotation );
	//$numberOfBytesWritten += fwrite( $file, "\n" );
	
	//fclose( $file );

	//return $numberOfBytesWritten == strlen($annotation);
}

// generates a proper HTML error (HTTP != 200)
// from: (http://stackoverflow.com/questions/4417690/return-errors-from-php-run-via-ajax)
function errorMessage($errorMsg, $errorCode)
{
    header('HTTP/1.1 500 Internal Server Error');
    header('Content-Type: application/json; charset=UTF-8');
    die(json_encode(array('message' => $errorMsg, 'code' => $errorCode)));
}

function getPrefix()
{
	$file = fopen( "./indexes", "r" );
	$index = fgets($file);
	fclose( $file );
	
	$parts = pathinfo($index);
	
	return $parts['dirname'] . '/';
}

function urlToPath($url) {
	
	$path = parse_url($url, PHP_URL_PATH);
	$path = $_SERVER['DOCUMENT_ROOT'] . '/' . $path;
	return $path;
}

function sanitizePath($path) {

	$path0 = '../' . $path;
	$prefix = getPrefix();
	$path1 = $prefix . $path;
	
	$path2 = urlToPath($path);
	
	if(file_exists($path0)) {
		return $path0;
	}
	
	if(file_exists($path1)) {
		return $path1;
	}
	
	if(file_exists($path2)) {
		return $path2;
	}
	
	errorMessage("File could not be resolved! [" . $path0 . " - " . $path1 . " - " . $path2 . "]", 3);
	return FALSE;
}

?>


