<?php
/*
 Desc:		updateAnnotationFile
			updates the annotationFile 
 
	Author:	Sebastian Schmittner
	Date: 2014.09.23 00:17:26 (+02:00)
	Last Author: Sebastian Schmittner
	Last Date: 2015.04.29 13:32:35 (+02:00)
	Version: 0.0.4
 
*/

require_once 'taskFileManipulator.php';

$annotationPath = json_decode($_POST['path']);
$from = json_decode($_POST['from']);
$to = json_decode($_POST['to']);

$aPath = sanitizePath($annotationPath);

$success = updateAnnotationFile( $aPath, $from, $to );

echo json_encode( $success );

return;

// updates the annotation file
function updateAnnotationFile($path, $from, $to)
{
	$file = new TaskFileManipulator($path);
	
	try {
		$result = $file->doSafeRegexUpdate($from, $to, 1000);
	}
	catch(Exception $e) {
		$result['id'] = 1;
		$result['e'] = $e;
	}

	$result['path'] = $path;
	
	return $result;
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

function isExternalPath($path) {
	return $path[0] == 'h'; // like [h]ttp ... TODO find better solution (read: safer one)
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

