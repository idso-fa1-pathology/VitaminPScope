<?php
/*
	Desc: Functions to create and send an email - ENHANCED for Tiered Storage
	Author:	Sebastian Schmittner
	Date: - 
	Last Author: Enhanced for Tiered Storage
	Last Date: 2025.06.23
	Version: 0.3.0 - TIERED STORAGE SUPPORT
*/

require_once __DIR__ . '/polyzoomerGlobals.php';
require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/serverCredentials.php';
require_once __DIR__ . '/randomKeygen.php';
require_once __DIR__ . '/tools.php';
require_once __DIR__ . '/customerProject.php';
require_once __DIR__ . '/addLineToFile.php';
require_once __DIR__ . '/taskFileManipulator.php';
require_once __DIR__ . '/pz_scripts/userpage/userFileSystem.php';

function executeLinkAndEmail( $path, $file, $email, $cleanmail ) {
	$indexHtml = createSymbolLink($path, $cleanmail, $email);
	$logFile = getLogfileName( $path );
}

function createSymbolLink($path, $cleanmail, $email) {
	
	global $externalLink;
	
	$emailDirectory = safePath( userPath($cleanmail) );
	$multizoomPath = safePath($emailDirectory . "multizooms/");

	if(!file_exists($emailDirectory . 'email.txt')) {
		$updateUserPage = "cp -r " . rootPath() . "pz_scripts/userpage/* " . $emailDirectory;
		executeSync($updateUserPage);
	}
	
	$emailFile = $emailDirectory . 'email.txt';
	if(!file_exists($emailFile)) {
		file_put_contents($emailFile, $email);
	}
	
	// ENHANCED: Smart path resolution for tiered storage
	$resolvedPath = resolvePolyzoomerPath($path);
	
	if ($resolvedPath['path'] === null) {
		$data = array(
			'Msg' => 'The polyzoomer path is missing in both hot and cold storage!',
			'Path' => $path,
			'HotPath' => polyzoomerHotPath() . $path,
			'ColdPath' => polyzoomerColdPath() . $path,
			'Stack' => getStackTrace(),
			'Vars' => get_defined_vars()
		);
		
		logTieredStorage("ERROR: Polyzoomer path not found: " . $path);
		throw new Exception(json_encode($data));
	}
	
	$indexPath = $resolvedPath['path'] . "/page/indexes";
	
	if(!file_exists($indexPath)) {
		$data = array(
			'Msg' => 'The indexpath is missing!',
			'IndexPath' => $indexPath,
			'ResolvedLocation' => $resolvedPath['location'],
			'Stack' => getStackTrace(),
			'Vars' => get_defined_vars()
		);
		
		logTieredStorage("ERROR: Index path missing: " . $indexPath . " (location: " . $resolvedPath['location'] . ")");
		throw new Exception(json_encode($data));
	}
	
	$referenceEmail = $resolvedPath['path'] . "/email.txt";
	if(!file_exists($referenceEmail)) {
		file_put_contents($referenceEmail, $email);
	}
	
	$indexPath = "cat " . $indexPath;
	$indexPath = executeSync($indexPath);
	$indexPath = $indexPath[0];
	
	// ENHANCED: Create symlink to the resolved path (hot or cold)
	$zoomPath = '"' . $resolvedPath['path'] . '"';
	if(!file_exists($emailDirectory . '/' . $path)) {
		$symbolLinkCommand = 'ln -s ' . $zoomPath . ' "' . $emailDirectory . '"';
		executeSync($symbolLinkCommand);
		
		logTieredStorage("Created symlink for user {$cleanmail}: {$path} -> {$resolvedPath['location']} storage");
	}
	else {
		doLog('[WARNING] Path already exists [' . $emailDirectory . '/' . $path . ']', logfile());
	}
	
	$fullIndexPath = "/customers/" . $cleanmail . "/" . $path . "/page/" . $indexPath;

	appendZoomToUserCache($cleanmail, $path, $fullIndexPath, $resolvedPath);
	
	return $externalLink . $fullIndexPath;
	
}

function getLogfileName( $path ) {
	// ENHANCED: Smart path resolution for log files
	$resolvedPath = resolvePolyzoomerPath($path);
	if ($resolvedPath['path']) {
		return '"' . $resolvedPath['path'] . '/email.log"';
	} else {
		// Fallback to hot storage path for new files
		return '"' . polyzoomerHotPath() . $path . '/email.log"';
	}
}

function appendZoomToUserCache($cleanmail, $pathName, $fullIndexPath, $resolvedPath = null) {
	
	// ENHANCED: Use resolved path for tiered storage
	if ($resolvedPath === null) {
		$resolvedPath = resolvePolyzoomerPath($pathName);
	}
	
	if ($resolvedPath['path'] === null) {
		logTieredStorage("WARNING: Cannot add to cache, path not found: " . $pathName);
		return;
	}
	
	$startDir = $resolvedPath['path'] . dirname($fullIndexPath);
	// Remove the customer path prefix to get relative path
	$startDir = str_replace('/customers/' . $cleanmail . '/' . $pathName, '', $startDir);
	
	$dzi = getDziFile( $startDir );
	$thumbnail = getThumbnailImageFile( $startDir );
	
	$date = 0;
	
	$pos = strrpos($pathName, '_');
	if($pos !== false) {
		$dateTimeStr = substr($pathName, $pos + 1);
		$date = DateTime::createFromFormat('YmdHi', $dateTimeStr);
	}
	else {
		$date = new DateTime();
	}

	// ENHANCED: Create project with storage location metadata
	$newProject = new ProjectTiered($pathName, $fullIndexPath, $thumbnail, $date, $dzi, $resolvedPath['location']);
	$newLine = json_encode( $newProject ) . PHP_EOL;
	
	$cacheFile = new TaskFileManipulator( cacheFile($cleanmail) );
	$cacheFile->appendLine( $newLine );
        
    appendZoomToUserFS($cleanmail, $newProject);
    
    logTieredStorage("Added to user cache: {$cleanmail} -> {$pathName} (location: {$resolvedPath['location']})");
}

function appendZoomToUserFS($cleanmail, $project) {
    $pwd = getcwd();
    chdir(userPath($cleanmail));
    
    $item = projectToItem($project);
    
    $ufs = UserFileSystem::fromDefault($cleanmail);
    
    if($ufs !== NULL){
        if(!$ufs->doesItemExist(ufsUploadFolder())){
            $result = $ufs->addItem('///', $item);
            doLog('[' . $cleanmail . ']: Uploadfolder does not exist! [' . ufsUploadFolder() . ']', logfile());
        }
        else {
            if(!$ufs->doesItemExist(ufsUploadFolder() . $project->name)){
                $result = $ufs->addItem(ufsUploadFolder(), $item);
            }
            else {
                doLog('[' . $cleanmail . ']: Item does exist [' . $project->name . '] <= [' . json_encode($item) . ']', logfile());
            }
        }
    }
    else {
        doLog('[' . $cleanmail . ']: Creation of UFS failed! [' . json_encode($item) . ']', logfile());
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
    
    // ENHANCED: Add storage location metadata
    if (isset($project->storageLocation)) {
        $item['storageLocation'] = $project->storageLocation;
    }
    
    return $item;
}

function getDziFile( $path ) {
	$dzi = rglob($path . '/*.dzi*');

	return $dzi;
}

function getThumbnailImageFile( $path ) {
	
	$images = rglob($path . '/*/0_1.*');
	$numbers = array();
	
	for($k = 0; $k < count($images); ++$k) {
		$key = basename(dirname($images[$k]));
		array_push($numbers, $key);
	}
	
	$minKey = min($numbers) - 1;
	if($minKey < 0){
		$minKey = 0;
	}
	
	$image = rglob($path . '/*/*/' . $minKey . '/0_0.*');
	
	$largest = str_replace(rootPath(), '/', $image);
	
	return cleanPath( $largest );
}

function getArguments() {
	global $argv;
	global $argc;
	
	$path = $argv[$argc - 4];
	$file = $argv[$argc - 3];
	
	$email = $argv[$argc - 2];
	$cleanmail = $argv[$argc - 1];
	
	return array (
		"path" => $path,
		"file" => $file,
		"email" => $email,
		"cleanmail" => $cleanmail
	);
}

// =============================================================================
// ENHANCED PROJECT CLASS for Tiered Storage
// =============================================================================

class ProjectTiered extends Project {
    public $storageLocation; // 'hot' or 'cold'
    
    public function __construct( $name, $indexPath, $imagePath, $date, $dzi, $storageLocation = 'hot' ) {
        parent::__construct($name, $indexPath, $imagePath, $date, $dzi);
        $this->storageLocation = $storageLocation;
    }
}

?>