<?php
/*
	Desc: User file system access
	Author:	Sebastian Schmittner (stp.schmittner@gmail.com)
	Date: 2016.01.22
	Last Author: Sebastian Schmittner (stp.schmittner@gmail.com)
	Last Date: 2016.01.22
	Version: 0.0.1
	
*/

require_once __DIR__ . '/accessUfsTools.php';

$pathName = pathinfo(dirname(__FILE__));
$cleanMail = $pathName['basename'];

$ufsCommands = json_decode($_POST['command'], true);
$result = executeUfsCommands($ufsCommands, $cleanMail);
echo json_encode($result);

?>
