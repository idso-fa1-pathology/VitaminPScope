<?php
/*
	Desc: Tool to handle all file accesses
	Author:	Sebastian Schmittner
	Date: 2014.08.20 13:09:25 (+02:00)
	Last Author: Sebastian Schmittner
	Last Date: 2015.07.15 21:34:15 (+02:00)
	Version: 0.3.2
*/

require_once 'md5chk.php';
require_once 'lockedFileAccess.php';
require_once 'polyzoomerGlobals.php';
require_once 'logging.php';
require_once 'tools.php';

class DoubleUpdateException extends Exception {};
class InvalidIndexCountException extends Exception {};
class LockFailedException extends Exception {};


// class: TaskFileManipulator 
// desc:  This class takes care of all file manipulations
//        It will automatically refresh the internal contents
//        It will take care of concurrency issues
class TaskFileManipulator {
	
	private $taskFileName;
	private $taskFileContents;
	private $timeOfRead;
	private $md5Sum;
	
	public function __construct( $taskFile ) {
		
		$this->taskFileName = $taskFile;
		$this->update();
	}
	
	public function __destruct() {
	}
	
	public function getFilename() {
		return $this->taskFileName;
	}
	
	public function getContents() {
		return $this->taskFileContents;
	}
	 
	public function getTimeOfRead() {
		return $this->timeOfRead;
	}
	
	public function getMd5Sum() {
		return $this->md5Sum;
	}
	
	public function getMe() {
		return array(
			$this->taskFileName,
			$this->taskFileContents,
			$this->timeOfRead,
			$this->md5Sum
		);
	}
	
	public function update() {
		
		$result = lockedFileRead( $this->taskFileName, safeFileSize($this->taskFileName), 'r+' );
		
		if( $result['id'] != 0 ) {
			throw new FileReadException($result['comment'], $result['id']);
		}

		$data = explode("\n", $result['data']);

		$this->taskFileContents = $data;

		$this->timeOfRead = time();
		$this->md5Sum = md5chk($this->taskFileName);

		usleep(1000);
	}
	
	public function appendLine( $text ) {
		
		$this->safeAppendLine( $text );
	}
	
	public function safeAppendLine( $text, $repeats = 3000 ) {
		
		$text = PHP_EOL . $text . str_repeat(' ', 300) . PHP_EOL;
		
		$result = array( 'id' => 1 );
		
		while( $result['id'] != 0 && $repeats > 0 ) {
			$this->update();
			$result = lockedFileAppend( $this->taskFileName, $text, $this->md5Sum );
			--$repeats;
			usleep(1000);
		}
		
		if( $result['id'] != 0 ) {
			doErrorLog('[FILEERROR]: Could not append to [' . $this->taskFileName . '] following [' . $text . ']');
		}
		
		$this->update();
	}
	
	public function getLines() {
		return count($this->taskFileContents);
	}
	
	// O(1)
	public function getLineByIndex($index) {
		if($index < 0 || $index > $this->getLines()) {
			throw new OutOfBoundsException('Tried to access element $index when only ' . count($this->taskFileContents) . ' elements exist!');
		}
		
		return $this->taskFileContents[$index];
	}
	
	public function doSetLine($index, $text) {
		$this->update();
		$this->taskFileContents[$index] = $text;
		$result = $this->write($this->md5Sum);
		return $result;
	}
	
	public function doSafeLineUpdate($linePattern, $pattern, $replacement, $repeats) {
		$result = array( 'id' => 1 );
		
		while($result['id'] == 1 && $repeats > 0) {
			$this->update();
			
			$contents = $this->taskFileContents;
			$index = $this->getIndexOfPattern($contents, $linePattern);
			
			if(is_array($index) && count($index) == 1) {
				$fullPattern = $contents[$index[0]];
				$fullReplacement = preg_replace("|($pattern)|i", $replacement, $fullPattern);
				
				$this->taskFileContents[$index[0]] = $fullReplacement;
				$result = $this->write($this->md5Sum);
			}

			--$repeats;
			usleep(1000);
		}
		
		if( $result['id'] != 0 ) {
			throw new LockFailedException();
		}

		$this->update();
		return $result;
	}
	
	public function doSafeRegexUpdate($pattern, $text, $repeats) {
	
		$result = array( 'id' => 1 );
		
		while($result['id'] == 1 && $repeats > 0) {
			$this->update();
			$result = $this->doRegexUpdate($pattern, $text);
			--$repeats;
			usleep(1000);
		}
		
		if( $result['id'] != 0 ) {
			throw new LockFailedException();
		}

		$this->update();
		return $result;
	}
	
	public function doRegexUpdate($pattern, $text) {
		$replacements = 1;
		
		$contents = $this->taskFileContents;

		for($i = 0; $i < count($contents); ++$i) {
			$contents[$i] = str_replace($pattern, $text, $contents[$i]);
		}
		
		if($replacements > 1) {
			throw new DoubleUpdateException();
		}
		
		if($replacements <= 0) {
			$result = array( 
				'id' => 1, 
				'replacements' => $replacements, 
				'pattern' => $pattern,  
				'text' => $text,
				'contents' => $contents);
			return $result;
		}
		
		$this->taskFileContents = $contents;
		$result = $this->write($this->md5Sum);
		
		return $result;
	}
	
	public function doSafeRegexRemove($pattern, $repeats) {
		$result = array();
		$result['id'] = 1;
		
		while($result['id'] == 1 && $repeats > 0) {
			$this->update();
			$result = $this->doRegexRemove($pattern);
			--$repeats;
			usleep(1000);
		}
		
		if( $result['id'] != 0 ) {
			throw new LockFailedException();
		}
		
		$this->update();
		return $result;
	}
	
	public function doRegexRemove($pattern) {
		$contents = $this->getContents();
		
		$pos = $this->getIndexOfPattern($contents, $pattern);
		
		$data = null;
		
		if(count($pos) == 1) {
			$temp = array();
			$max = sizeof($contents);
			
			for($i = 0; $i < $max; ++$i) {
				
				if($i != $pos[0]) {
					array_push($temp, $contents[$i]);
				}
				else {
					$data = $contents[$i];
				}
			}
			
			$contents = $temp;
		}
		else {
			//throw new InvalidIndexCountException();
		}
		
		$this->taskFileContents = $contents;
		$result = $this->write($this->md5Sum);
		$result['deletedData'] = $data;
		
		return $result;
	}
	
	public function getIndexOfPattern($haystack, $pattern) {
		$pos = array();
		
		$i = 0;
		foreach($haystack as $straw) {
			if($this->contains($pattern, $straw)) {
				array_push($pos, $i);
			}
			++$i;
		}
		
		return $pos;
	}
	
	public function contains($needle, $haystack) {
		return strpos($haystack, $needle) !== false;
	}
	
	public function compensate($string) {
		
		$buffer = array();
		
		$max = sizeof($string);
		for($i = 0; $i < $max; ++$i) {
			$copy = trim($string[$i]);
			if(strlen($copy) != 0) {
				$copy = $copy . str_repeat(' ', 300);
				array_push($buffer, $copy);
			}
		}
		
		return $buffer;
	}
	
	public function write($md5) {
		
		$this->taskFileContents = $this->compensate($this->taskFileContents);
		
		$data = implode("\n", $this->taskFileContents);
		$data = $data . "\n";
		$result = lockedFileWrite($this->taskFileName, $data, $md5);
		
		usleep(1000);
		return $result;
	}
}

?>
