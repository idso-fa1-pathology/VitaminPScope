<?php
/*
 Desc: deleteAnnotation
 Deletes a specific annotation by ID from the annotation file.
 Author: User
 Date: 2025.03.14
 Version: 1.0.0
 Errors: 1 - The provided file could not be found.
         2 - The provided annotation id is invalid
         3 - The provided file could not be resolved.
*/
require_once 'lockedFileAccess.php';
require_once "../../../polyzoomerGlobals.php";

$annotationPath = json_decode($_POST['path']);
$annotationId = intval($_POST['id']);

// Validate the annotation ID
if ($annotationId <= 0) {
    errorMessage("Invalid annotation ID!", 2);
}

// Sanitize and validate the path
$annotationPath = sanitizePath($annotationPath);
if ($annotationPath === FALSE) {
    errorMessage("File could not be resolved!", 3);
}

if (!file_exists($annotationPath)) {
    errorMessage("File does not exist!", 1);
}

// Delete the annotation and return result
$success = deleteAnnotation($annotationPath, $annotationId);
if ($success) {
    echo json_encode(array('success' => true));
} else {
    errorMessage("Failed to delete annotation!", 4);
}
return;

// Function to delete annotation by ID
function deleteAnnotation($path, $id) {
    // Read the file content
    $file = fopen($path, "r");
    $lines = array();
    $found = false;
    
    // Read all lines except the one with matching ID
    while (!feof($file)) {
        $line = fgets($file);
        if (empty(trim($line))) continue;
        
        // Parse the line to get the ID
        $parts = explode(",", $line, 2);
        if (isset($parts[0]) && intval($parts[0]) == $id) {
            $found = true;
            continue; // Skip this line to delete it
        }
        
        $lines[] = $line;
    }
    fclose($file);
    
    if (!$found) {
        return false;
    }
    
    // Use the TaskFileManipulator class as it's already part of the system
    require_once 'taskFileManipulator.php';
    $fileManipulator = new TaskFileManipulator($path);
    
    try {
        // Replace the entire file content
        $newContent = implode("", $lines); // Don't add extra newlines
        $result = $fileManipulator->doSafeFileReplace($newContent);
        return ($result['id'] == 0);
    } catch (Exception $e) {
        return false;
    }
}

// Error message handling
function errorMessage($errorMsg, $errorCode) {
    header('HTTP/1.1 500 Internal Server Error');
    header('Content-Type: application/json; charset=UTF-8');
    die(json_encode(array('message' => $errorMsg, 'code' => $errorCode)));
}

// Path handling functions - reusing existing code patterns
function getPrefix() {
    $file = fopen("./indexes", "r");
    $index = fgets($file);
    fclose($file);
    $parts = pathinfo($index);
    return $parts['dirname'] . '/';
}

function sanitizePath($path) {
    $path0 = '../' . $path;
    $prefix = getPrefix();
    $path1 = $prefix . $path;
    $path2 = makeInternal($path);
    
    if (file_exists($path0)) {
        return $path0;
    }
    if (file_exists($path1)) {
        return $path1;
    }
    if (file_exists($path2)) {
        return $path2;
    }
    
    errorMessage("File could not be resolved! [" . $path0 . " - " . $path1 . " - " . $path2 . "]", 3);
    return FALSE;
}

function makeInternal($path) {
    $customers = '/customers/';
    $polyzoomer = '/polyzoomer/';
    $ic = strpos($path, $customers);
    $ip = strpos($path, $polyzoomer);
    $validPos = array();
    if ($ic !== FALSE) {
        array_push($validPos, $ic);
    }
    if ($ip !== FALSE) {
        array_push($validPos, $ip);
    }
    
    if (empty($validPos)) {
        return $path; // No matching paths found
    }
    
    $lowest = min($validPos);
    $returnPath = rootPath() . '/' . substr($path, $lowest);
    return $returnPath;
}
?>