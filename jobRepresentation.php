<?php
/*
	Desc: Represents a job
	Author:	Sebastian Schmittner
	Date: 2014.08.18
	Last Author: Sebastian Schmittner
	Last Date: 2015.07.20 21:34:24 (+02:00)
	Version: 0.0.7
*/

class Job {
	public $data;
	
	public function __construct( $text ) {
		$this->data = array();

		$this->disassemble( $text );		
	}
	
	public function __destruct() {
	}
	
	public function disassemble( $text ) {
	
		$parts = explode(";", $text);

		if(count($parts) < 11) {
			//var_dump($parts);
			throw new WrongArgumentCountException();
		}

		$this->data['id'] = $parts[0];
		$this->data['guid'] = $parts[1];
		$this->data['statusId'] = $parts[2];
		$this->data['status'] = $parts[3];
		$this->data['origFilename'] = $parts[4];
		$this->data['targetFilename'] = $parts[5];
		$this->data['md5'] = $parts[6];
		$this->data['email'] = $parts[7];
		$this->data['finalFilename'] = $parts[8];
		$this->data['finalPath'] = $parts[9];
		$this->data['taskfile'] = $parts[10];
	}
	
	public function reassemble() {
		return implode(";", $this->data);
	}
}

?>