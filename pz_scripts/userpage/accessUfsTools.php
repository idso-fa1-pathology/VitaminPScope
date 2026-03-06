<?php
/*
	Desc: User file system access tools
	Author:	Sebastian Schmittner (stp.schmittner@gmail.com)
	Date: 2016.02.07
	Last Author: Sebastian Schmittner (stp.schmittner@gmail.com)
	Last Date: 2016.02.15
	Version: 0.0.2
	
*/

/*
 * Commands:    getSystem   setSystem   delete          addDirectory    
 * 
 * Parameters:  -           data        [fullPaths]     name, root
 * 
 *
 * Commands:    move                    copy
 *  
 * Parameters:  [fullPaths], target     [fullPaths], target
 * 
 */
require_once 'userFileSystem.php';

function executeUfsCommands($commandObject, $mail) {
	
	$command = getCorrespondingCommand($commandObject);
	
	$ufs = UserFileSystem::fromDefault($mail);

	$result = NULL;
	
	if($ufs !== NULL) {
		$result = formatResult('OK', $command($commandObject, $ufs));
	}
	else {
		$result = formatResult('ERROR', 'UFS could not be created for [' . $mail . ']!' );
	}
        
        return $result;
}

function getCorrespondingCommand($commandObject) {
	$command = NULL;
	
	switch ($commandObject['task']) {
		case 'getSystem':
			$command = 'CMD_getSystem';
			break;
		case 'setSystem':
			$command = 'CMD_setSystem';
			break;
                case 'delete':
                        $command = 'CMD_delete';
                        break;
                case 'addDirectory':
                        $command = 'CMD_addDirectory';
                        break;
                case 'move':
                        $command = 'CMD_move';
                        break;
                case 'copy':
                        $command = 'CMD_copy';
                        break;
	}
	
	return $command;
}

function CMD_getSystem($params, $ufs) {
	return $ufs->getHierarchy();
}

function CMD_setSystem($params, $ufs) {
	$hierarchy = $params['data'];
	return $ufs->setHierarchy($hierarchy);
}

function CMD_delete($params, $ufs) {
    $items = $params['fullPaths'];
    
    $result = array();
    
    for($i = 0; $i < count($items); ++$i){
        $result[$i] = $ufs->deleteItem( $items[$i] );
    }
    
    return $result;
}

function CMD_addDirectory($params, $ufs) {
    $directoryName = $params['name'];
    $root = $params['root'];
    $item = array( 
                    'name' => $directoryName,
                    'type' => 'DIR'
                 );
                    
    return $ufs->addItem( $root, $item );
}

function CMD_move($params, $ufs) {
    $items = $params['fullPaths'];
    $target = $params['target'];
    
    $result = array();
    
    for($i = 0; $i < count($items); ++$i){
        $result[$i] = $ufs->moveItem( $items[$i], $target );
    }
    
    return $result;
}

function CMD_copy($params, $ufs) {
    $items = $params['fullPaths'];
    $target = $params['target'];
    
    $result = array();
    
    for($i = 0; $i < count($items); ++$i){
        $result[$i] = $ufs->copyItem( $items[$i], $target );
    }
    
    return $result;
}

function formatResult($status, $data = NULL) {
	return array(
                        'status' => $status,
                        'data' => $data
                    );
}

?>
