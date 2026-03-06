<?php
/*
	Desc: Receives all parameters to create a new multizoom
	Author:	Sebastian Schmittner (stp.schmittner@gmail.com)
	Date: 2014.11.24 23:40:00 (+01:00)
	Last Author: Sebastian Schmittner
	Last Date: 2015.07.20 21:35:04 (+02:00)
	Version: 0.0.8
	
*/

require_once 'createMultiZoomTools.php';

set_time_limit(3600);

$layout = json_decode($_POST['layout'], true);
$fs_path = json_decode($_POST['fspath'], true);

echo json_encode( doMultiZoom($layout, $fs_path) );

?>