<?php
/*
 Debug version of issueUploadProject.php
*/
error_log("=== issueUploadProject.php started ===");
error_log("POST data: " . print_r($_POST, true));

require_once __DIR__ . '/issueProject.php';

$isDir = json_decode($_POST["isDir"]);
$pathToIssue = json_decode($_POST["path"]);

error_log("Decoded isDir: " . print_r($isDir, true));
error_log("Decoded pathToIssue: " . print_r($pathToIssue, true));

if($isDir == 1) {
    if(is_array($pathToIssue)) {
        error_log("Case: isDir=1, array - NOT IMPLEMENTED");
        echo json_encode('NOT YET IMPLEMENTED');
    } else {
        error_log("Case: isDir=1, single path");
        $result = issueOnDir($pathToIssue);
        error_log("issueOnDir result: " . print_r($result, true));
        echo json_encode($result);
    }
} else {
    if(is_array($pathToIssue)) {
        error_log("Case: isDir=0, array - calling issueFiles");
        error_log("Number of files: " . count($pathToIssue));
        
        // Check if files exist before processing
        foreach($pathToIssue as $index => $path) {
            $exists = file_exists($path);
            error_log("File $index: $path - exists: " . ($exists ? 'YES' : 'NO'));
            if (!$exists) {
                error_log("ERROR: File does not exist: $path");
            }
        }
        
        $startTime = time();
        error_log("Starting issueFiles at: " . date('Y-m-d H:i:s', $startTime));
        
        $result = issueFiles($pathToIssue);
        
        $endTime = time();
        error_log("Completed issueFiles at: " . date('Y-m-d H:i:s', $endTime));
        error_log("issueFiles took: " . ($endTime - $startTime) . " seconds");
        error_log("issueFiles result: " . print_r($result, true));
        
        echo json_encode($result);
    } else {
        error_log("Case: isDir=0, single path - calling issueFile");
        $exists = file_exists($pathToIssue);
        error_log("File exists: " . ($exists ? 'YES' : 'NO') . " - $pathToIssue");
        
        if (!$exists) {
            error_log("ERROR: File does not exist: $pathToIssue");
            
            // Debug: Check what files actually exist in the directory
            $directory = dirname($pathToIssue);
            $filename = basename($pathToIssue);
            
            error_log("Looking for file: $filename");
            error_log("In directory: $directory");
            error_log("Directory exists: " . (is_dir($directory) ? 'YES' : 'NO'));
            
            if (is_dir($directory)) {
                $files = scandir($directory);
                error_log("Files in directory: " . print_r($files, true));
            }
            
            echo json_encode(array(
                "error" => "File does not exist", 
                "path" => $pathToIssue,
                "directory" => $directory,
                "filename" => $filename,
                "directory_exists" => is_dir($directory),
                "files_in_dir" => is_dir($directory) ? scandir($directory) : "directory not found"
            ));
        } else {
            $result = issueFile($pathToIssue);
            error_log("issueFile result: " . print_r($result, true));
            echo json_encode($result);
        }
    }
}

error_log("=== issueUploadProject.php completed ===");
?>