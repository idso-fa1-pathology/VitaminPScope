<?php
/*
	Desc: User file system
	Author:	Sebastian Schmittner (stp.schmittner@gmail.com)
	Date: 2015.12.15 
	Last Author: Sebastian Schmittner (stp.schmittner@gmail.com)
	Last Date: 2016.01.14
	Version: 0.0.2
	
*/

require_once __DIR__ . '/../../taskFileManipulator.php';

/*
Internal structure directory item

type: 'CACHE', ** Path001745_20151111231125 directly matches an entry in the user's cache 
      'URL',   ** http://.../Path... directly references an URL
      'DIR'    ** array of other TYPE elements

CACHE:
[index]{
	name: '',
	type: 'CACHE',
	id:   ''
	}

URL:
[index]{
	name: '',
	type: 'URL',
	link: '',
	owner: ''
	}

@owner: 'ROOT' or any other clean-mail user id from Polyscope

DIR:
[index]{
	name: '',
	type: 'DIR',
	...
	}
*/

class PathDoesNotExist extends Exception {}
class CouldNotLoadFile extends Exception {}

class UserFileSystem {
	
	private $userFileSystem = NULL;
	private $fileHierarchy = array();
	private $cleanMail = '';
	private $lastUpdate = '';
	
	private $DELIMITER = '///';
	private $DATETIMEFORMAT = 'YYMMDDHHIISS';
	
        private $internalLog = array();
        
	public function __construct( $cleanMail, $ufsBase ) {
		
		$this->cleanMail = $cleanMail;
		$this->userFileSystem = $ufsBase;
	}
	
	private static function createInstance( $cleanMail, $ufs ) {
		$instance = NULL;
		
		if( $ufs !== NULL ) {
			$instance = new self( $cleanMail, $ufs );
			
			if( $instance !== NULL ) {
				try {
					$instance->update();
				}
				catch (Exception $e) {
					unset($instance);
					$instance = NULL;				
				}
			}
		}
		
		return $instance;
	}
	
	public static function fromDefault( $cleanMail ) {
		$ufs = UserFileSystemIO::fromDefault($cleanMail);
		return UserFileSystem::createInstance($cleanMail, $ufs);
	}
	
	public static function fromFile( $cleanMail, $filePath ) {
		$ufs = UserFileSystemIO::fromFile($cleanMail, $filePath);
		return UserFileSystem::createInstance($cleanMail, $ufs);
	}
	
	public function __destruct() {
		if($this->fileHierarchy !== NULL &&
		   $this->userFileSystem !== NULL) {
			$this->userFileSystem->setSystem($this->fileHierarchy);
		}
	}
	
	public function getNow() {
		return time();
	}
		
	public function doTimeStamp() {
		$this->lastUpdate = $this->getNow();
	}
	
	public function update( $force = FALSE ) {
		if($this->userFileSystem !== NULL) {
			$this->fileHierarchy = $this->userFileSystem->getSystem( $force );
			$this->doTimeStamp();
		}
	}
	
	public function addItem( $path, $item ) {
		if( $this->doesItemExist( $path ) ) {
			$selectors = $this->pathNameToSelectorNames( $path );
			return $this->recursiveSetItemBySelectors( $this->fileHierarchy, $selectors, $item['name'], $item) !== FALSE;
		}
		
		return FALSE;
	}
	
	public function moveItem( $from, $to ) {
		if( $this->doesItemExist( $from ) &&
			$this->doesItemExist( $to ) ) {
			$fromSelectors = $this->pathNameToSelectorNames( $from );
			$toSelectors = $this->pathNameToSelectorNames( $to );

			$sameCheck = TRUE;

			while ( !empty($toSelectors) ) {
				$fromSelector = array_shift( $fromSelectors );
				$toSelector = array_shift( $toSelectors );

				if ( strcmp( $toSelector, $fromSelector ) !== 0 ) {
					$sameCheck = FALSE;
					break;
				}
			}

			array_shift( $fromSelectors );

			if ( !$sameCheck || !empty($fromSelectors) ) {
				return $this->copyItem( $from, $to ) &&
				   $this->deleteItem( $from );
			} else {
				return FALSE;
			}
		}
			
		return FALSE;
	}

	public function copyItem( $from, $to ) {
		if( $this->doesItemExist( $from ) && 
			$this->doesItemExist( $to ) ) {

			$selectors = $this->pathNameToSelectorNames( $from );
			$item = $this->recursiveGetItemBySelectors( $this->fileHierarchy, $selectors );
			return $this->addItem( $to, $item );
		}
			
		return FALSE;
	}

	public function deleteItem( $path ) {
		if( $this->doesItemExist( $path ) ) {
			$selectors = $this->pathNameToSelectorNames( $path );
			$name = array_pop($selectors);
			
			return $this->recursiveRemoveItemBySelectors( $this->fileHierarchy, $selectors, $name );
		}
		
		return FALSE;
	}
	
	public function shareItem( $item, $receiver ) {
	}
	
	public function getHierarchy() {
		return $this->fileHierarchy;
	}
	
	public function setHierarchy( $hierarchy ) {
		if( isJson($hierarchy) ){
			$this->fileHierarchy = $hierarchy;
			return TRUE;
		}
		else {
			return FALSE;
		}
	}
	
	public function doesItemExist( $name ) {
		return $this->getItem( $name ) !== FALSE;
	}

	public function getItem( $name ) {
		if( $this->userFileSystem ) {
			$selectors = $this->pathNameToSelectorNames( $name );
			return $this->recursiveGetItemBySelectors($this->fileHierarchy, $selectors);
		}
		
		return FALSE;
	}
	
	public function recursiveRemoveItemBySelectors( &$root, $selectors, $name ) {
                array_push($this->internalLog, print_r($selectors, TRUE));
                array_push($this->internalLog, print_r($name, TRUE));

                if(count($selectors) == 0) {
			unset($root[$name]);
			return $root;
		}		
		
		if(count($selectors) != 0) {
			$selector = array_shift($selectors);
			if(key_exists($selector, $root)) {
				return $this->recursiveRemoveItemBySelectors($root[$selector], $selectors, $name);
			}
		}
		
		return FALSE;
	}

	public function recursiveSetItemBySelectors( &$root, $selectors, $name, $item ) {
		if(count($selectors) == 0) {
			if(!array_key_exists($name, $selectors)) {
				$root[$name] = $item;
				return $root;
			}
		}		
		
		if(count($selectors) != 0) {
			$selector = array_shift($selectors);
			if(key_exists($selector, $root)) {
				return $this->recursiveSetItemBySelectors($root[$selector], $selectors, $name, $item);
			}
		}
		
		return FALSE;
	}

	public function recursiveGetItemBySelectors( $root, $selectors ) {
		if($selectors === NULL ||
			count($selectors) == 0) {
			return $root;
		}
		
		$selector = array_shift($selectors);
		if(key_exists($selector, $root)) {
			return $this->recursiveGetItemBySelectors($root[$selector], $selectors);
		}
		
		return FALSE;
	}
	
	public function pathNameToSelectorNames( $filename ) {
		return array_filter(explode($this->DELIMITER, $filename));
	}
	
	public function selectorNamesToFilename( $selectors ) {
		return implode($this->DELIMITER, $selectors);
	}
        
        public function getLog() {
            return $this->internalLog;
        }
        
        public function clearLog() {
            $this->internalLog = array();
        }
}

class UserFileSystemIO {
	// every line in the fs file is one item, on the root of the dir
	private $cleanMail = '';
	private $rootPath = '';
	private $lastUpdate = '';
	private $items = NULL;
	private $fileSystem = 'userfs.json';
	private $wasModified = false;
	
	public function __construct( $cleanMail, $path, $fileName = NULL ) {
		$this->cleanMail = $cleanMail;
		$this->rootPath = $path;
		
		if( $fileName !== NULL ) {
			$this->fileSystem = $fileName;
		}
	}
	
	public static function fromDefault( $cleanMail ) {

		$path = '/var/www/customers/' . $cleanMail . '/';
		$instance = new self( $cleanMail, $path, 'userfs.json' );
		
		$instance = UserFileSystemIO::checkInstance($instance);
		
		return $instance;
	}
	
	public static function fromFile( $cleanMail, $filePath ) {
		
		$name = basename($filePath);
		$dir = dirname($filePath);
		
		$instance = new self( $cleanMail, $dir, $name );
		$instance = UserFileSystemIO::checkInstance($instance);
		
		return $instance;
	}
	
	private static function checkInstance($instance) {
		
		try {
			$instance->startUp();
		}
		catch (Exception $e) {
			unset($instance);
			$instance = NULL;
		}
		
		return $instance;
	}
	
	public function __destruct() {
		if( $this->wasModified ) {
			$this->storeFileSystem();
		}
	}
	
	public function startUp() {
		if( !file_exists($this->rootPath) ) {
			throw new PathDoesNotExist('[' . $this->rootPath . '] does NOT exist!');
		}
		
		if( $this->loadFileSystem() === FALSE ) {
			throw new CouldNotLoadFile('[' . $this->rootPath . '] does NOT exist!');
		}
	}
	
	public function getSystem( $force = FALSE ) {
		if( $force ) {
			$this->update();
		}

		return $this->items;
	}

	public function setSystem( $items ) {
		$this->items = $items;
		$this->wasModified = true;
	}
	
	public function dataFilePath() {
		return $this->rootPath . DIRECTORY_SEPARATOR . $this->fileSystem;
	}
	
	public function update() {
		if( $this->wasModified() ) {
			$this->storeFileSystem();
		}
		
		$this->loadFileSystem();
	}
	
	public function storeFileSystem() {
		$dataPath = $this->dataFilePath();
		$fileSystemFile = new TaskFileManipulator($dataPath);
		
		$fileSystemFile->doSetLine(0, json_encode($this->items));
	}
	
	public function loadFileSystem() {
		
		$fileSystem = array();
		$dataPath = $this->dataFilePath();
		$this->items = array();
		
		if(file_exists($dataPath)) {
			
			$fileSystemFile = new TaskFileManipulator($dataPath);
                        $fileSystem = $fileSystemFile->getContents();
			
			if( $fileSystem !== NULL &&
				is_array($fileSystem) && 
				count($fileSystem) > 0 ) {

				$fs = json_decode($fileSystem[0], TRUE);
				$this->items = $fs;
				return $this->items;
			}
		}
		
		return FALSE;
	}
}


// from: http://stackoverflow.com/questions/6041741/fastest-way-to-check-if-a-string-is-json-in-php
function isJson( $json ) {
	return !preg_match('/[^,:{}\\[\\]0-9.\\-+Eaeflnr-u \\n\\r\\t]/',
		preg_replace('/"(\\.|[^"\\\\])*"/', '', $json));
}
	   
?>
