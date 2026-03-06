<?php

/*
 Desc:		getAnnotation
			This function returns one (ID) or all lines from the 
			annotation file specified by PATH.
 
	Author:	Sebastian Schmittner
	Date: - 
	Last Author: Sebastian Schmittner
	Last Date: 2014.07.24 15:07:33 (+02:00)
	Version: 0.0.2
 
 Errors:	1 - The provided file could not be found.
			2 - The provided annotation id is < 0 (therefore invalid)
			3 - The provided file could not be resolved.
*/

require_once "../../../polyzoomerGlobals.php";

$annotationPath = json_decode($_POST['path']);
$annotationId = $_POST['id'];

$annotationPath = sanitizePath( $annotationPath );

if ( $annotationPath === FALSE ) {
	errorMessage("File could not be resolved!", 3);
}

if ( !file_exists( $annotationPath ) )
{
	errorMessage("File does not exist!", 1);
}

// 0 - all annotations shall be returned
if ( $annotationId >= 0 )
{
	$annotations = loadAnnotations( $annotationPath );
	
	if ( $annotationId > 0 )
	{
		$annotations = getSpecificEntry( $annotations, $annotationId );
	}
	
	echo json_encode( $annotations );
}
else
{
	errorMessage("Invalid annotation ID!", 2);
}

return;

// returns annotation with the given id
function getSpecificEntry($annotations, $id)
{
	foreach ( $annotations as $line )
	{
		$splitLine = explode(",", $line, 2);
		
		if ( $splitLine[0] == $id )
		{
			return $line;
		}
	}
	
	return "";
}

// load all lines from the file
function loadAnnotations($path)
{
	$file = fopen( $path, "r" );
	
	$annotations = array();
	
	while ( !feof($file) )
	{
		array_push($annotations, fgets($file));
	}
	
	fclose( $file );

	return $annotations;
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

function sanitizePath( $path ) {
		
	$path1 = getPrefix() . $path;
	$path2 = makeInternal( $path );
	
	if(file_exists($path1)) {
		return $path1;
	}
	elseif(file_exists($path2)){
		return $path2;
	}
	else {
		errorMessage("File could not be resolved! [" . $path1 . " - " . $path2 . "]", 3);
		return FALSE;
	}
}

function makeInternal( $path ) {
	$customers = '/customers/';
	$polyzoomer = '/polyzoomer/';
	
	$ic = strpos($path, $customers);
	$ip = strpos($path, $polyzoomer);
	
	$validPos = array();
	
	if($ic !== FALSE) {
		array_push($validPos, $ic);
	}
	
	if($ip !== FALSE) {
		array_push($validPos, $ip);
	}
	
	$lowest = min($validPos);
	
	$returnPath = rootPath() . '/' . substr($path, $lowest);
	
	return $returnPath;
}

?>
