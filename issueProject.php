<?php
/*
	Desc: Functions to issue the upload of a project.
	Author:	Sebastian Schmittner
	Date: 2015.05.30 17:46:52 (+02:00)
	Last Author: Sebastian Schmittner
	Last Date: 2015.07.20 21:34:10 (+02:00)
	Version: 0.0.4
*/

require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/md5chk.php';
require_once __DIR__ . '/lockedFileAccess.php';
require_once __DIR__ . '/addLineToFile.php';
require_once __DIR__ . '/guid.php';
require_once __DIR__ . '/fileFormats.php';
require_once __DIR__ . '/tools.php';

function issueOnDir( $path ) {

	return array( "name" => "", 
			  "md5" => "",
			  "guid" => "",
			  "id" => "",
			  "fullStatus" => "");
}

function issueFile( $path, $email = 'EMAIL_PLACE_HOLDER', $followUpFile = '' ) {
	if (file_exists($path)) {
	    $uploadFolder = uploadFolder();
	    $filename = basename($path);
	    $uploadFile =  $uploadFolder . uniqueId() . "_" . $filename;
	    $md5OfFile = md5chk( $path );
	
	    $success = addJob( $path, $uploadFile, $email, $followUpFile );
	
	    return array( "typ" => "single",
				      "name" => $uploadFile, 
			          "md5" => $md5OfFile,
				      "guid" => $success['projectGuid'],
				      "id" => $success['projectId'],
				      "fullStatus" => $success);
        } else {
            return NULL;
        }
}

function issueFiles( $paths ) {
	
	$max = sizeof($paths);
	
	$rootPath = rootPath();
	$timeout = 30;
	$firstTime = time();
	$uploadFolder = uploadFolder();

	$jobList = "";
	$jobs = array();
	
	for($i = 0; $i < $max; ++$i) {
        if (file_exists($paths[$i])) {
		    $filename = basename($paths[$i]);
		    $uploadFile = $uploadFolder . uniqueId() . "_" . $filename;

		    $jobEntry = createJobEntry( $paths[$i], $uploadFile );
		    $guid = $jobEntry['guid'];
		
		    addLineToFile(jobFileG($guid), $jobEntry['entry']);
		    $jobList = $jobList . $guid . "\n";
		
		    $jobEntry["name"] = $uploadFile;
		    $jobEntry["fileId"] = $paths[$i];
		    array_push($jobs, $jobEntry);
        }
	}
	
	$jobFile = jobFile();
	$success = addLineToFile($jobFile, $jobList);
	
	while( $success['id'] != 0 && (time() - $firstTime) < $timeout ) {
		$success = addLineToFile($jobFile, $jobList);
	}
	
	return array( "typ" => "multiple",
				  "jobs" => $jobs,
				  "fullStatus" => $success);
}

/////////////////////////////////////////////////////////////////////

function createJobEntry( $fileFrom, $fileTo, $email = 'EMAIL_PLACE_HOLDER', $followUpFile = '' ) {
	
	$jobCounterFile = jobCounter();
	$counter = atomicCounterIncrement( $jobCounterFile );
	$guid = GUID();
	
	$projectEntry = $counter . ";" . 
					$guid . ";1;checksum;" . 
					$fileFrom . ";" . 
					$fileTo . ";MD5CHECKSUM;" . 
					$email . ";FINAL_FILENAME_PLACEHOLDER;FINAL_PATH_PLACEHOLDER;" . 
					$followUpFile . ";                                                                                                                                                            ";

	
	return array( "entry" => $projectEntry,
				  "id" => $counter,
				  "guid" => $guid);
}

// adds a new job to the job list
// it uses also a timeout in case that the atomic write does not 
// succeed
function addJob( $fileFrom, $fileTo, $email = 'EMAIL_PLACE_HOLDER', $followUpFile = '' ) {
	
	$timeout = 30;
	$firstTime = time();
	
	$project = createJobEntry($fileFrom, $fileTo, $email, $followUpFile);
	
	$guid = $project['guid'];
	$success = addLineToFile(jobFileG($guid), $project['entry']);
	
	$jobFile = jobFile();
	$success = addLineToFile($jobFile, $project['guid']);
	
	while( $success['id'] != 0 && (time() - $firstTime) < $timeout ) {
		$success = addLineToFile($jobFile, $project['guid']);
	}
	
	return array( "success" => $success, 
			      "projectGuid" => $project['guid'],
				  "projectId" => $project['id'] );
}

?>