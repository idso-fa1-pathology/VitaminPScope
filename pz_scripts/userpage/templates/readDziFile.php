<?php

/*
 Desc:		readDziFile
 
	Author:	Sebastian Schmittner
	Date: 2015.11.02 
	Last Author: Sebastian Schmittner
	Last Date: 2015.11.02
	Version: 0.0.2
 
 Errors:	1 - The provided file could not be found.
			2 - The provided annotation id is < 0 (therefore invalid)
			3 - The provided file could not be resolved.
*/

require_once "../../../polyzoomerGlobals.php";

$dziPath = json_decode($_POST['path']);

$dziPath = sanitizePath( $dziPath );

if ( $dziPath === FALSE ) {
	errorMessage("File could not be resolved!", 3);
}

if ( !file_exists( $dziPath ) )
{
	errorMessage("File does not exist!", 1);
}

$dziContents = readDzi( $dziPath );
$dzi = interpretDzi($dziContents);

echo json_encode( $dzi );

return;


// interprets the dzi
function interpretDzi($dziContent)
{
	//echo json_encode($dziContent);
	
	$heightRegexp = '/Height="([0-9]*)"/';
	$widthRegexp = '/Width="([0-9]*)"/';
	$formatRegexp = '/Format="([a-zA-Z0-9]*)"/';
	$tileSizeRegexp = '/TileSize="([0-9]*)"/';
	
	$height = -1;
	$width = -1;
	$tileSize = -1;
	$format = "";
	
	$matches = array();
	
	for($i = 0; $i < count($dziContent); ++$i) {
		preg_match($heightRegexp, $dziContent[$i], $matches);
		if(count($matches) != 0) {
			$height = $matches[1];
		}
	}

	for($i = 0; $i < count($dziContent); ++$i) {
		preg_match($widthRegexp, $dziContent[$i], $matches);
		if(count($matches) != 0) {
			$width = $matches[1];
		}
	}

	for($i = 0; $i < count($dziContent); ++$i) {
		preg_match($formatRegexp, $dziContent[$i], $matches);
		if(count($matches) != 0) {
			$tileSize = $matches[1];
		}
	}

	for($i = 0; $i < count($dziContent); ++$i) {
		preg_match($tileSizeRegexp, $dziContent[$i], $matches);
		if(count($matches) != 0) {
			$format = $matches[1];
		}
	}

	$dzi = array(
		'imageWidth' => $width,
		'imageHeight' => $height,
		'tileFormat' => $format,
		'tileSize' => $tileSize
	);
	
	return $dzi;
}

// load all lines from the file
function readDzi($path)
{
	$file = fopen( $path, "r" );
	
	$contents = array();
	
	while ( !feof($file) )
	{
		array_push($contents, fgets($file));
	}
	
	fclose( $file );

	return $contents;
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
