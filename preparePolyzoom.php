<?php
/*
	Desc: Prepare and start the polyzooming process - ENHANCED for Hot Storage
	Author:	Sebastian Schmittner
	Date: - 
	Last Author: Enhanced for Tiered Storage
	Last Date: 2025.06.23
	Version: 0.1.0 - HOT STORAGE OPTIMIZATION
*/

require_once __DIR__ . '/lockedFileAccess.php';
require_once __DIR__ . '/logging.php';

echo json_encode(doPolyzoom());

function doPolyzoom() {

	$path = preparePolyzoom();
	$output = polyzoom( $path["path"], $path["filename"] );
	return array(
		"path" => $path["path"],
		"output" => $output,
	);
}

function polyzoom( $path, $filename ) {
	
	// ENHANCED: Use hot storage for new files
	$rootPath = polyzoomerHotPath(); // Points to local fast storage

	$output = chdir($rootPath . $path . "/");
	
	// detox
	$executestring = "detox -n './$filename' > detox.log";
	log_error($executestring);
	$loutput = shell_exec($executestring);
	$output = $output . " - " . $loutput;
	
	$executestring = "cat detox.log";
	$realOutput = shell_exec($executestring);
	log_error($executestring);

	// detox returns nothing if there is no change done
	if(strlen($realOutput) != 0) {
		$realOutput = substr($realOutput, 0, -1);
		$executestring = "detox './$filename'";
		log_error($executestring);
		$loutput = shell_exec($executestring);
		$output = $output . " - " . $loutput;
		
		$detoxString = "./" . $filename . " -> ";
		$filenameLength = strlen($realOutput) - (strlen($detoxString) + 2);
		//$nameLength = strlen($filename) + 2;
		$filename = substr($realOutput, strlen($detoxString) + 2, $filenameLength);
		log_error($filename);
	}
	
	// add the pat_id and channel_id if missing
    $newfilename = testAndCorrectFilename($filename);
	$executestring = "mv -f './$filename' './$newfilename' >> ./process.log";
	log_error($executestring);
	$loutput = shell_exec($executestring);
	$output = $output . " - " . $loutput;
		
	// polyzoom
	$executestring = "chmod 777 ./doPolyzoom.sh";
	log_error($executestring);
	$loutput = shell_exec($executestring);
	$output = $output . " - " . $loutput;
	
	$executestring = "./doPolyzoom.sh \"" . $newfilename . "\" 2>&1 & echo $! >> ./polyzoom.pid";
	log_error($executestring);
	$loutput = shell_exec($executestring);
	$output = $output . " - " . $loutput;
	
	// ENHANCED: Log creation in hot storage
	logTieredStorage("New polyzoomer created in HOT storage: " . $path);
	
	return $output . " - " . $rootPath . $path;
}

// check if there is the expected pattern for pat_id and channel_id
// otherwise add it
function testAndCorrectFilename( $filename ) {
	
	$pat_id = array();
	$channel_id = array();
	
	preg_match('/([a-zA-Z]+[0-9]+)/', $filename, $pat_id, PREG_OFFSET_CAPTURE);
	preg_match('/.*_([a-zA-Z]+[0-9]+)/', $filename, $channel_id, PREG_OFFSET_CAPTURE);

	if ( count($pat_id) == 0 && count($channel_id) == 0 ) {
		$filename = 'UNKNOWNPAT0001_UNKNOWNCHANNEL0001_' . $filename;
	}
	else if ( count($pat_id) == 0 ) {
		$filename = 'UNKNOWNPAT0001_' . $filename;
	}
	else if ( count($channel_id) == 0 ) {
		$filename = $pat_id[0][0] . '_UNKNOWNCHANNEL0001_' . $filename;
	}
	
	return $filename;
}

function preparePolyzoom() {
	
	$rootPath = "/var/www/";
	$counterFile = $rootPath . "/counter.log";
	
	$filePath = json_decode($_POST["path"]);
	$toFile = basename( $filePath );
	
	$counter = atomicCounterIncrement( $counterFile );
	
	if ( $counter == -1 ) {
		errorMessage("Counter seems to be invalid!", 1);
	}
	
	$basePathName = "Path" . number_pad($counter, 6) . "_" . date('YmdHi');
	
	// ENHANCED: Create in hot storage for fast processing
	$pathName = polyzoomerHotPath() . $basePathName;
	
	$dirCreated = mkdir( $pathName );
	
	if ( !$dirCreated ) {
		errorMessage("Directory could not be created! [" . $pathName . "]", 2);
	}
	
	$success = copy($filePath, $pathName . "/" . $toFile);
	if ( !$success ) {
		errorMessage("Copy of file failed: " . $filePath, 3);		
	}
	
	$success = copy("/var/www/pz_scripts/polyzoomer/createPolyzoomerSite.sh", $pathName . "/createPolyzoomerSite.sh");
	if ( !$success ) {
		errorMessage("Copy of creationscript failed!", 4);		
	}

	$success = copy("/var/www/pz_scripts/DssConverter/DigitalSlideStudio.sh", $pathName . "/DigitalSlideStudio.sh");
	if ( !$success ) {
		errorMessage("Copy of DigitalSlideStudio failed!", 5);		
	}

	$success = copy("/var/www/pz_scripts/DssConverter/FinalScan_template", $pathName . "/FinalScan_template");
	if ( !$success ) {
		errorMessage("Copy of FinalScan_template failed!", 6);		
	}

	$success = copy("/var/www/pz_scripts/doDeepzoom.sh", $pathName . "/doDeepzoom.sh");
	if ( !$success ) {
		errorMessage("Copy of doDeepzoom.sh failed!", 7);		
	}

	$success = copy("/var/www/pz_scripts/doTiling.sh", $pathName . "/doTiling.sh");
	if ( !$success ) {
		errorMessage("Copy of doTiling.sh failed!", 7);		
	}

	$success = copy("/var/www/pz_scripts/doPolyzoom.sh", $pathName . "/doPolyzoom.sh");
	if ( !$success ) {
		errorMessage("Copy of doPolyzoom.sh failed!", 7);		
	}

	return array(
		"filename" => $toFile,
		"name" => $pathName,
		"path" => $basePathName,
	);
}

function number_pad($number,$n) {
	return str_pad((int) $number,$n,"0",STR_PAD_LEFT);
}

function log_error($text) {
	shell_exec("echo " . $text . " >> process.log");
}

?>