<?php
/*
	Desc: Misc Tools.
	Author:	Sebastian Schmittner (stp.schmittner@gmail.com)
	Date: 2015.01.30 15:05:05 (+01:00)
	Last Author: Sebastian Schmittner
	Last Date: 2015.07.15 21:34:23 (+02:00)
	Version: 0.0.8
*/

function uniqueId() {
	$randomKey = rand(0, 99999999);
	return padNumber( $randomKey, 8 );
}

function padNumber( $number, $digits ) {
	$format = "%0" . $digits . "d";
	return sprintf($format, $number);
}

function cleanString($stringToClean) 
{
	return preg_replace("/[^a-zA-Z0-9_-]/s", '-', $stringToClean);
}

function enclose( $text ) {
	return '"' . $text . '"';
}

// reference: http://php.net/manual/de/function.scandir.php
define('DTA_ALL', '3');
define('DTA_FILES', '1');
define('DTA_DIRS', '2');

define('DTA_NORMAL', '1');
define('DTA_MERGE', '2');

function dirToArray($dir, $INTENT = DTA_ALL, $STYLE = DTA_NORMAL) { 
   
   $result = array(); 

   $cdir = scandir($dir); 
   foreach ($cdir as $key => $value) 
   { 
      if (!in_array($value,array(".",".."))) 
      { 
         if (is_dir($dir . DIRECTORY_SEPARATOR . $value)) 
         { 
            if( $INTENT === DTA_ALL || $INTENT === DTA_DIRS ) {
				
				$subarray = dirToArray($dir . DIRECTORY_SEPARATOR . $value, $INTENT, $STYLE);
				
				if( $STYLE === DTA_NORMAL ) {
					$result[$value] = $subarray; 
				}
				else {
					$result = array_merge( $result, $subarray );
				}				
			}
         } 
         else 
         { 
            if( $INTENT === DTA_ALL || $INTENT === DTA_FILES ) {
				$result[] = $dir . '/' . $value; 
			}
         } 
      } 
   } 
   
   return $result; 
} 

function rglob($pattern, $flags = 0) {
	$files = glob($pattern, $flags);
	foreach (glob(dirname($pattern) . '/*', GLOB_ONLYDIR) as $dir) {
		$files = array_merge($files, rglob($dir.'/'.basename($pattern), $flags));
	}

	return $files;
}

function getLargest($files) {
	
	$size = 0;
	$name = "";
	
	foreach($files as $file) {
		if(filesize($file) > $size) {
			$size = filesize($file);
			$name = $file;
		}
	}
	
	return $name;
}

function safePath( $path ) {
	
	if(!file_exists( $path )) {
		$createDirectory = "mkdir -p " . enclose($path);
		executeSync($createDirectory);
	}
	
	return $path;
}

function cleanPath( $path ) {
	return str_replace('//', '/', $path);
}

function safeFileSize( $file ) {
	
	$filesize = 0;
	
	if(file_exists($file)) {
		clearstatcache();
		$filesize = filesize($file);
	}
	
	return $filesize;
}

function safeSerialize( $item ) {
	return base64_encode( serialize( $item ) );
}

function safeUnSerialize( $item ) {
	return unserialize( base64_decode( $item ) );
}

?>
