<?php
/*
	Desc: Followup file functions.
	Author:	Sebastian Schmittner (stp.schmittner@gmail.com)
	Date: 2015.07.17 13:00 (+02:00)
	Last Author: Sebastian Schmittner
	Last Date: 2015.07.23 22:37:34 (+02:00)
	Version: 0.0.2
*/

require_once __DIR__ . '/polyzoomerGlobals.php';
require_once __DIR__ . '/guid.php';
require_once __DIR__ . '/lockedFileAccess.php';
require_once __DIR__ . '/tools.php';
require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/jobRepresentation.php';
require_once __DIR__ . '/subtaskDefinition.php';

function handleSubTasks( $job ) {

	$taskFile = $job->data['taskfile'];
	
	$taskSet = loadTaskFile( $taskFile );

	$task = $taskSet->popTask();
	
	$task->execute( $job );
}

?>
