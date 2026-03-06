<?php
/*
    Desc: Renames a folder
    Version: 1.0.0
*/

require_once '../../polyzoomerGlobals.php';
require_once '../../logging.php';

set_time_limit(60);

// Get the path and new name
$oldPath = $_POST["oldPath"];
$newName = $_POST["newName"];

// Ensure paths are clean
$oldPath = realpath($oldPath);
$emailPath = realpath(dirname(__FILE__));
$proofEmail = basename($emailPath);

$result = array(
    "success" => false,
    "message" => ""
);

// Validate the operation
if (strpos($oldPath, $proofEmail) === FALSE) {
    $result["message"] = "Access denied: The folder is not part of your content.";
    doLog('[RENAMEFOLDER] Attempted to rename folder outside user space: ' . $oldPath, logFile());
} else {
    // Get the parent directory
    $parentDir = dirname($oldPath);
    $newPath = $parentDir . '/' . $newName;
    
    // Check if target already exists
    if (file_exists($newPath)) {
        $result["message"] = "A folder with this name already exists.";
        doLog('[RENAMEFOLDER] Rename failed - target exists: ' . $newPath, logFile());
    } else {
        // Perform the rename
        if (rename($oldPath, $newPath)) {
            $result["success"] = true;
            $result["message"] = "Folder renamed successfully.";
            doLog('[RENAMEFOLDER] Renamed folder from ' . $oldPath . ' to ' . $newPath, logFile());
            
            // Update any necessary cache files
            // This is system-specific and may require additional code based on your application
            // Similar to how deletion updates cache files
        } else {
            $result["message"] = "Failed to rename folder. Check permissions.";
            doLog('[RENAMEFOLDER] Rename operation failed for: ' . $oldPath, logFile());
        }
    }
}

echo json_encode($result);
?>