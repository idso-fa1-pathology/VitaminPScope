<?php
/*
	Desc: Removes all specified zooms
	Author:	Sebastian Schmittner
	Date: 2015.04.20 23:00:06 (+02:00)
	Last Author: Sebastian Schmittner
	Last Date: 2015.09.06 00:15:23 (+02:00)
	Version: 0.0.8
	
*/

require_once '../../polyzoomerGlobals.php';
require_once '../../logging.php';
require_once '../../taskFileManipulator.php';

set_time_limit(600);

$userCode = json_decode($_POST["usercode"]);
$files = json_decode($_POST["files"]);

$emailPath = realpath(dirname(__FILE__));

$result = array(
	"message" => null,
	"value" => null,
	);
	
if( !checkUserCode($userCode, $emailPath) ) {
	$result['message'] = 'The provided USER code is invalid! Please request a new key and try again.';
	doLog('[REMOVEZOOMS] User [' . $emailPath . '] used wrong USER code [' . $userCode . '] for deletion request!', logFile());
}
else {
	$result['message'] = 'The specified Zooms were removed.';
	$result['value'] = removeZooms( $userCode, $emailPath, $files );
}

echo json_encode( $result );

//////////////////////////////////////////////////////////////////

function removeZooms( $userCode, $emailPath, $files ) {

	$proofEmail = basename($emailPath);
	
	// clean paths
	$files = str_replace('//', '/', $files);
	
	$deletedCount = 0;
	
	for( $i = 0; $i < count($files); ++$i ) {
		
		if( strpos($files[$i], $proofEmail) !== FALSE ) {
			//$pathElements = explode('/', $files[$i]);
			$pathElements = preg_split('@/@', $files[$i], 0, PREG_SPLIT_NO_EMPTY);
			
			// seems to be a valid folder
			if( count($pathElements) > 3 ) {
				
				$pathsToBeDeleted = getPathToRemove($pathElements);
				
				$symbolLink = $pathsToBeDeleted['symbolLink'];
				$realPath = $pathsToBeDeleted['realPath'];
				
				if( $symbolLink == null || 
					$realPath == null ) {
					
					doLog('[REMOVEZOOMS] Path could not be deleted! [' . json_encode($pathElements) . '] - [' . json_encode($pathsToBeDeleted). ']', logFile());
				}
				else {
					execute('rm -r ' . $symbolLink);
					execute('rm -r ' . $realPath);
					
					doLog('[REMOVEZOOMS] Removed [' . $symbolLink . ']', logFile());
					
					$match = getPathName( $files[$i] );
					
					if($match != '') {
						$cacheFile = $emailPath . '/cache.lst';
						
						if(isMulti($pathElements)) {
							$cacheFile = $emailPath . '/multizooms/multi_cache.lst';
						}

						$file = new TaskFileManipulator( $cacheFile );
						$file->doSafeRegexRemove($match, 10000000);
					}
					
					++$deletedCount;
				}
			}
		}
		else {
			doLog('[REMOVEZOOMS] Specified path [' . $files[$i] . '] is NOT part of this user!', logFile());
		}
	}
	
	return $deletedCount;

}

function isMulti( $pathElements ) {
	return array_search('multizooms', $pathElements) !== FALSE;
}

function getPathToRemove( $pathElements ) {
	
	$result = array(
		'symbolLink' => null,
		'realPath' => null,
	);
	
	if( array_search('multizooms', $pathElements) !== FALSE ) {
		
		$multizoomIndex = array_search('multizooms', $pathElements);
		
		if( $multizoomIndex > 0 ) {
			$cleanMailIndex = $multizoomIndex - 1;

			$result['symbolLink'] = rootPath() . '/customers/' . $pathElements[$cleanMailIndex] . '/multizooms/' . $pathElements[$cleanMailIndex + 2];
			$result['realPath'] = rootPath() . '/polyzoomer/' . $pathElements[$cleanMailIndex + 2];
		}
		else {
			doLog('[REMOVEZOOMS] No user could be extracted! [' . implode('/', $pathElements) . ']', logFile());
		}
	}
	else if ( strcasecmp( $pathElements[0], 'customers' ) == 0 ) {
		$result['symbolLink'] = rootPath() . '/' . $pathElements[0] . '/' . $pathElements[1] . '/' . $pathElements[2];
		$result['realPath'] = rootPath() . '/polyzoomer/' . $pathElements[2];
	}
	else {
		doLog('[REMOVEZOOMS] Specified path does not comply to the delete patterns [' . implode('/', $pathElements) . ']', logFile());
	}
	
	return $result;
}

function checkUserCode( $userCode, $emailPath ) {
	
	$realUserCode = file_get_contents( $emailPath . '/.userkey' );
	
	return strcasecmp( $userCode, $realUserCode ) == 0;
}

function getPathName( $path ) {
	$matches = '';
	$pattern = '/(Path[0-9]*_[0-9]{12})/';
	$finalMatch = '';
	
	$result = preg_match($pattern, $path, $matches);
	
	if( $result === 1 ) {
		$finalMatch = $matches[0];
	}
	else if( $result === 0 ) {
		doLog('[REMOVEZOOMS] No Path element in path (' . $path . '), Cache may not be correct!', logFile());
	}
	else {
		doLog('[REMOVEZOOMS] Error in retrieval of Pathname, Cache may not be correct!', logFile());
	}
	
	return $finalMatch;
}

?>
