<?php
/*
	Desc: Customer project for the Cache system
	Author:	Sebastian Schmittner
	Date: 2015.06.13 22:47:34 (+02:00)
	Last Author: Sebastian Schmittner
	Last Date: 2015.06.13 22:47:34 (+02:00)
	Version: 0.0.1
*/

class Project {
	public $name;
	public $index;
	public $image;
	public $fileDate;
	public $dzi;
	
	public function __construct( $name, $indexPath, $imagePath, $date, $dzi ) {
		
		$this->name = $name;
		$this->index = $indexPath;
		$this->image = $imagePath;
		$this->fileDate = $date; 
		$this->dzi = $dzi;
	}
	
	public function __destruct() {}
}

?>
