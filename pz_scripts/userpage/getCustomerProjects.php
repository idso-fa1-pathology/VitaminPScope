<?php
/*
	Desc: Retrieves all projects of the customer
	Author:	Sebastian Schmittner
	Date: 2014.10.21 23:42:35 (+02:00)
	Last Author: Sebastian Schmittner
	Last Date: 2015.07.29 11:59:02 (+02:00)
	Version: 0.0.4
	
*/

require_once 'customerProjects.php';
require_once '../../md5chk.php';
require_once '../../polyzoomerGlobals.php';

set_time_limit(600);

$cleanMail = pathinfo(dirname(__FILE__));
$cleanMail = $cleanMail['basename'];

if( isset($_POST['version']) ) {

	echo json_encode( retrieveVersion( $cleanMail ) );
}
else {

	echo json_encode( retrieveProjects($cleanMail) );
}

//////////////////////////////////////////////////////////////////

function retrieveProjects( $email ) {
	
	$projects = new CustomerProjects($email);
	
	return $projects->toList();
}

function retrieveVersion( $email ) {

	$cacheFile = cacheFile( $email );
	
	$size = filesize( $cacheFile );
	$md5 = md5chk( $cacheFile );
	
	return array(
		'size' => $size,
		'md5' => $md5
	);
}

?>
