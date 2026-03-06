<?php
/*
	Desc: Retrieves all multizooms of the customer
	Author:	Sebastian Schmittner (stp.schmittner@gmail.com)
	Date: 2015.01.24 16:17:16 (+01:00)
	Last Author: Sebastian Schmittner
	Last Date: 2015.09.04 14:44:00 (+02:00)
	Version: 0.0.2
	
*/

require_once 'customerMultiZooms.php';
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
	
	$projects = new CustomerMultizooms($email);
	
	return $projects->toList();
}

function retrieveVersion( $email ) {

	$cacheFile = multiCacheFile( $email );
	
	$size = filesize( $cacheFile );
	$md5 = md5chk( $cacheFile );
	
	return array(
		'size' => $size,
		'md5' => $md5
	);
}

?>
