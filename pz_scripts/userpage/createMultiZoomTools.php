<?php
/*
	Desc: Receives all parameters to create a new multizoom
	Author:	Sebastian Schmittner (stp.schmittner@gmail.com)
	Date: 2015.07.20 21:35:23 (+02:00)
	Last Author: Sebastian Schmittner
	Last Date: 2015.09.04 14:40:27 (+02:00)
	Version: 0.0.9
	
*/

require_once '../../lockedFileAccess.php';
require_once '../../htmlError.php';
require_once '../../logging.php';
require_once '../../serverCredentials.php';
require_once '../../polyzoomerGlobals.php';
require_once '../../taskFileManipulator.php';
require_once '../../tools.php';
require_once __DIR__ . '/userFileSystem.php';

function doMultiZoom( $layout, $fsPath ) {
	$rootPath = "/var/www/";
	$pathName = getTargetDirectory($rootPath);
	
	$setupFile = $pathName . '/setup.cfg';

	$setupContent = generateSetupContent($layout);
	
	$result = file_put_contents($setupFile, $setupContent, LOCK_EX);
	
	if($result === FALSE) {
		errorMessage("Setupfile could not be created/written to! [" . $setupFile . "]", 1);
	}
	
	$x = shell_exec("cp ./createMultiZoomerSite.sh " . $pathName);
	$x = shell_exec("chmod 777 " . $pathName . "/createMultiZoomerSite.sh");
	$x = shell_exec("cd " . $pathName . " && ./createMultiZoomerSite.sh");
	
	$indexPath = $pathName . "/page/INDEX/index.html";
	
	$link = 'ln -s "' . $pathName . '" "./multizooms/"';
	shell_exec($link);
		
	while(!file_exists($indexPath)) {};

	$indexPath = str_replace("/var/www", "/./", $indexPath);
	
	$x = shell_exec('cp ./createThumbnails.sh ' . $pathName);
	$x = shell_exec('chmod 777 ' . $pathName . '/createThumbnails.sh');
	$x = shell_exec('cd ' . $pathName . ' && ./createThumbnails.sh "' . $setupFile . '"');
	
	$cleanMail = basename(getcwd());
	
	appendMultizoomToUserCache($cleanMail, basename($pathName), $indexPath, $fsPath);
	
	$imageRoot = 'customers/' . $cleanMail . '/multizooms/';
	$indexPath = str_replace('/polyzoomer/', $imageRoot, $indexPath);
	return $indexPath;
}

function generateSetupContent($layout) {
	$setupContent = Array();
	
	array_push($setupContent, $layout['cols']);
	array_push($setupContent, $layout['rows']);
	array_push($setupContent, $layout['email']);
	
	for($x = 0; $x < $layout['cols']; ++$x) {
		for($y = 0; $y < $layout['rows']; ++$y) {
			$dziPath = str_replace("/var/www", "/./", $layout['table'][$x][$y]['dzi']);
			array_push($setupContent, $dziPath);
			array_push($setupContent, $layout['table'][$x][$y]['alpha']);
		}
	}
	
	$setupContent = implode("\n", $setupContent);
	return $setupContent;
}

function getTargetDirectory($rootPath) {
	$counterFile = $rootPath . "/jobCounter.log";
	
	$counter = atomicCounterIncrement( $counterFile );
	
	if ( $counter == -1 ) {
		errorMessage("Counter seems to be invalid!", 1);
	}
	
	$basePathName = "Path" . number_pad($counter, 6) . "_" . date('YmdHi');
	$pathName = $rootPath . "polyzoomer/" . $basePathName;
	
	$dirCreated = mkdir( $pathName );
	
	if ( !$dirCreated ) {
		errorMessage("Directory could not be created! [" . $pathName . "]", 2);
	}
	
	return $pathName;
}

function number_pad($number,$n) {
	return str_pad((int) $number,$n,"0",STR_PAD_LEFT);
}

function log_error($text) {
	shell_exec("echo " . $text . " >> process.log");
}

function appendMultizoomToUserCache($cleanmail, $pathName, $fullIndexPath, $fsPath) {
	
	$origUrl = userPath( $cleanmail ) . 'multizooms/' . $pathName . '/';
	$imageRoot = 'customers/' . $cleanmail . '/multizooms/';
	
	$indexPath = str_replace('polyzoomer/', $imageRoot, $fullIndexPath);
	
	$origUrl = str_replace('/var/www/', '/', $origUrl);
	$setupFile = $origUrl . "/setup.cfg";
	$thumbnail = $origUrl . "/THUMBNAIL_OVERVIEW.png";
	
	$pos = strrpos($pathName, '_');
	if($pos !== false) {
		$dateTimeStr = substr($pathName, $pos + 1);
		$date = DateTime::createFromFormat('YmdHi', $dateTimeStr);
	}
	else {
		$date = new DateTime();
	}
	
	$newProject = new Project($pathName, $indexPath, $date, $setupFile, $thumbnail);
	$newLine = json_encode( $newProject ) . PHP_EOL;
	
	$cacheFile = new TaskFileManipulator( multiCacheFile( $cleanmail ) );
	$cacheFile->appendLine( $newLine );
        
    appendMultizoomToUserFS($cleanmail, $newProject, $fsPath);
}

function appendMultizoomToUserFS($cleanmail, $project, $fsPath) {
    if (is_null($fsPath)) {
        $fsPath = '///';
    }

    $pwd = getcwd();
    chdir(userPath($cleanmail));
    
    $item = projectToItem($project);
    
    $ufs = UserFileSystem::fromDefault($cleanmail);
    
    if($ufs !== NULL){
        if(!$ufs->doesItemExist($fsPath)){
            $result = $ufs->addItem('///', $item);
            doLog('[' . $cleanmail . ']: Uploadfolder does not exist! [' . fsPath . ']', logfile());
        }
        else {
            if(!$ufs->doesItemExist($fsPath . $item)){
                $result = $ufs->addItem($fsPath, $item);
            }
            else {
                doLog('[' . $cleanmail . ']: Item does exist [' . $item->name . '] <= [' . json_encode($item) . ']', logfile());
            }
        }
    }
    else {
        doLog('[' . $cleanmail . ']: Creation of UFS failed! [' . json_encode($item) . ']', log(file));
    }

    chdir($pwd);
    
    return $result;
}

function projectToItem($project){
    $item = array(
        'name' => $project->name,
        'creationDate' => $project->fileDate->date,
        'type' => 'FILE'
    );
    
    return $item;
}

class Project {
	public $name;
	public $index;
	public $fileDate;
	public $setupFile;
	public $thumbnail;
	
	public function __construct( $name, $indexPath, $date, $setupFile, $thumbnail ) {
		
		$this->name = $name;
		$this->index = $indexPath;
		$this->fileDate = $date; 
		$this->setupFile = $setupFile;
		$this->thumbnail = $thumbnail;
	}
	
	public function __destruct() {}
}
							
?>