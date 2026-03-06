<?php
/*
 Desc: updateAnnotationFile
 updates the annotationFile
 Author: Sebastian Schmittner
 Date: 2014.09.23 00:17:26 (+02:00)
 Last Author: Sebastian Schmittner
 Last Date: 2015.04.29 13:32:35 (+02:00)
 Version: 0.0.4
*/

// Enable error logging for troubleshooting
ini_set('display_errors', 1);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// Get the POST data
$annotationPath = json_decode($_POST['path']);
$from = json_decode($_POST['from']);
$to = json_decode($_POST['to']);

// Normalize and resolve the path
$aPath = enhancedSanitizePath($annotationPath);

if ($aPath === FALSE) {
    echo json_encode([
        'id' => 3, 
        'error' => 'Path resolution failed',
        'path' => $annotationPath
    ]);
    return;
}

// Use direct file operations instead of TaskFileManipulator
$success = directUpdateAnnotationFile($aPath, $from, $to);
echo json_encode($success);
return;

// Updates the annotation file using direct file operations
function directUpdateAnnotationFile($path, $from, $to)
{
    // Check if file exists
    if (!file_exists($path)) {
        return [
            'id' => 3, 
            'error' => 'File not found',
            'path' => $path
        ];
    }
    
    // Check if file is writable
    if (!is_writable($path)) {
        return [
            'id' => 4, 
            'error' => 'File not writable',
            'path' => $path
        ];
    }
    
    try {
        // Read the file content
        $content = file_get_contents($path);
        if ($content === false) {
            return [
                'id' => 1,
                'error' => 'Failed to read file',
                'path' => $path
            ];
        }
        
        // Replace the content (same logic as in doSafeRegexUpdate)
        $updatedContent = str_replace($from, $to, $content);
        
        // Write the file
        $result = file_put_contents($path, $updatedContent);
        if ($result === false) {
            return [
                'id' => 1,
                'error' => 'Failed to write file',
                'path' => $path
            ];
        }
        
        return [
            'id' => 0,
            'status' => 'ok',
            'path' => $path,
            'bytesWritten' => $result
        ];
    } catch (Exception $e) {
        return [
            'id' => 1,
            'error' => $e->getMessage(),
            'path' => $path
        ];
    }
}

function getPrefix()
{
    if (!file_exists("./indexes")) {
        return "./";
    }
    
    $file = fopen("./indexes", "r");
    if (!$file) {
        return "./";
    }
    
    $index = fgets($file);
    fclose($file);
    $parts = pathinfo($index);
    return $parts['dirname'] . '/';
}

function urlToPath($url) {
    $path = parse_url($url, PHP_URL_PATH);
    return $_SERVER['DOCUMENT_ROOT'] . '/' . $path;
}

function isExternalPath($path) {
    return $path[0] == 'h'; // like [h]ttp ... TODO find better solution (read: safer one)
}

// Enhanced path sanitization function
function enhancedSanitizePath($path) {
    // Fix double slashes
    $path = str_replace('//', '/', $path);
    
    // Try all standard paths from the original function
    $path0 = '../' . $path;
    $path0 = str_replace('//', '/', $path0);
    
    try {
        $prefix = getPrefix();
        $path1 = $prefix . $path;
        $path1 = str_replace('//', '/', $path1);
    } catch (Exception $e) {
        $path1 = './' . $path;
        $path1 = str_replace('//', '/', $path1);
    }
    
    $path2 = urlToPath($path);
    $path2 = str_replace('//', '/', $path2);
    
    // Direct path
    $directPath = $path;
    $directPath = str_replace('//', '/', $directPath);
    
    // Try each path
    if (file_exists($path0)) {
        return $path0;
    }
    
    if (file_exists($path1)) {
        return $path1;
    }
    
    if (file_exists($path2)) {
        return $path2;
    }
    
    if (file_exists($directPath)) {
        return $directPath;
    }
    
    // Try common path patterns
    $pathPatterns = [
        // Pattern with MOS prefix in current directory
        "./MOS*/" . ltrim($path, "./"),
        // Pattern with _UNKNOWN in page directory
        "./page/MOS*/_UNKNOWN*/" . basename($path),
        // Current directory with deep zoom files
        "./*/" . basename($path)
    ];
    
    foreach ($pathPatterns as $pattern) {
        $matchingFiles = glob($pattern);
        if (!empty($matchingFiles)) {
            return $matchingFiles[0];
        }
    }
    
    // If file cannot be found, log the error
    $errorMsg = "File could not be resolved! [" . $path0 . " - " . $path1 . " - " . $path2 . "]";
    error_log($errorMsg);
    
    // Define errorMessage function if it doesn't exist
    if (!function_exists('errorMessage')) {
        function errorMessage($message, $code) {
            error_log("ERROR (code " . $code . "): " . $message);
        }
    } else {
        errorMessage($errorMsg, 3);
    }
    
    return FALSE;
}
?>