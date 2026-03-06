<?php
/*
	Desc: Random key generator
	Author:	Sebastian Schmittner (stp.schmittner@gmail.com)
	Date: 2015.04.16 17:52:24 (+02:00)
	Last Author: Sebastian Schmittner
	Last Date: 2015.04.16 17:52:24 (+02:00)
	Version: 0.0.4
*/

require_once 'polyzoomerGlobals.php'; 

function keygen() {
	return createRandomKey( userKeySize(), userKeySet() );
}

function createRandomKey( $digitCount, $setToSelectFrom ) {
	
	$command = 'head -' . $digitCount . ' /dev/urandom | tr -cd ' . $setToSelectFrom . ' | head -c ' . $digitCount;
	
	$key = array();
	$error = array();

	exec($command, $key, $error);

	return $key[0];
}

?>
