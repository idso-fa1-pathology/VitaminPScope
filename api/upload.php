<?php
// Enhanced upload.php with better debugging
ini_set('upload_max_filesize', '1024M');
ini_set('post_max_size', '1024M');
ini_set('memory_limit', '1024M');
ini_set('max_execution_time', 600);
ini_set('max_input_time', 600);

// Start session and include security files
session_start();
require_once '../auth/session_timeout.php';

header('Content-Type: application/json');

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', '/var/log/apache2/error.log');

function debug_log($message, $data = null) {
    error_log("UPLOAD DEBUG: " . $message);
    if ($data !== null) {
        error_log("UPLOAD DATA: " . print_r($data, true));
    }
}
function getUniqueFilename($directory, $filename) {
    $pathinfo = pathinfo($filename);
    $basename = $pathinfo['filename'];
    $extension = isset($pathinfo['extension']) ? '.' . $pathinfo['extension'] : '';
    
    $counter = 1;
    $newFilename = $filename;
    
    while (file_exists($directory . '/' . $newFilename)) {
        $newFilename = $basename . '_' . $counter . $extension;
        $counter++;
    }
    
    return $newFilename;
}
try {
    debug_log("=== UPLOAD PROCESS STARTED ===");
    debug_log("POST data", $_POST);
    debug_log("FILES data", $_FILES);
    
    // Check authentication
    if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true || empty($_SESSION['username'])) {
        throw new Exception('Authentication required');
    }

    $username = $_SESSION['username'];
    debug_log("User authenticated: " . $username);

    // Validate and sanitize upload directory
    $uploadDir = isset($_POST['directory']) ? $_POST['directory'] : '';
    $uploadDir = str_replace('___SLASH___', '/', $uploadDir);
    debug_log("Original upload directory: " . $uploadDir);

    if (empty($uploadDir)) {
        throw new Exception('No directory specified');
    }

    // Verify directory is within user's allowed space
    $userBaseDir = '/media/Users/' . $username;
    debug_log("User base directory: " . $userBaseDir);

    if (strpos($uploadDir, $userBaseDir) !== 0) {
        debug_log("SECURITY VIOLATION", array(
            'uploadDir' => $uploadDir,
            'userBaseDir' => $userBaseDir,
            'username' => $username
        ));
        throw new Exception('Invalid directory access: ' . $uploadDir);
    }

    // Check if directory exists or can be created
    if (!file_exists($uploadDir)) {
        debug_log("Directory doesn't exist, attempting to create: " . $uploadDir);
        if (!mkdir($uploadDir, 0755, true)) {
            throw new Exception('Failed to create upload directory: ' . $uploadDir);
        }
        debug_log("Directory created successfully");
    } else {
        debug_log("Directory already exists: " . $uploadDir);
    }

    // Verify directory is writable
    if (!is_writable($uploadDir)) {
        debug_log("Directory is not writable: " . $uploadDir);
        throw new Exception('Upload directory is not writable: ' . $uploadDir);
    }

    $response = array(
        'success' => false,
        'uploaded' => array(),
        'failed' => array(),
        'messages' => array(),
        'debug' => array(
            'uploadDir' => $uploadDir,
            'userBaseDir' => $userBaseDir,
            'username' => $username,
            'dirExists' => file_exists($uploadDir),
            'dirWritable' => is_writable($uploadDir),
            'filesReceived' => isset($_FILES['files']) ? count($_FILES['files']['name']) : 0
        )
    );

    // Process uploaded files
    if (empty($_FILES['files'])) {
        throw new Exception('No files received in upload');
    }

    debug_log("Processing " . count($_FILES['files']['name']) . " files");

    foreach ($_FILES['files']['tmp_name'] as $key => $tmp_name) {
        try {
            $filename = $_FILES['files']['name'][$key];
            $filesize = $_FILES['files']['size'][$key];
            $error = $_FILES['files']['error'][$key];

            debug_log("Processing file #" . $key, array(
                'filename' => $filename,
                'size' => $filesize,
                'tmp_name' => $tmp_name,
                'error' => $error,
                'tmp_file_exists' => file_exists($tmp_name)
            ));

            // Check for upload errors
            if ($error !== UPLOAD_ERR_OK) {
                $errorMessages = array(
                    UPLOAD_ERR_INI_SIZE => 'File exceeds upload_max_filesize',
                    UPLOAD_ERR_FORM_SIZE => 'File exceeds MAX_FILE_SIZE',
                    UPLOAD_ERR_PARTIAL => 'File was only partially uploaded',
                    UPLOAD_ERR_NO_FILE => 'No file was uploaded',
                    UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder',
                    UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
                    UPLOAD_ERR_EXTENSION => 'Upload stopped by extension'
                );
                
                $errorMsg = isset($errorMessages[$error]) ? $errorMessages[$error] : 'Unknown upload error: ' . $error;
                throw new Exception($errorMsg);
            }

            // Validate file exists
            if (!is_uploaded_file($tmp_name)) {
                throw new Exception('Not a valid uploaded file: ' . $tmp_name);
            }

            // Create safe filename
            $safe_filename = preg_replace("/[^a-zA-Z0-9._-]/", "_", $filename);

            // Make filename unique if it already exists
            $unique_filename = getUniqueFilename($uploadDir, $safe_filename);
            $destination = $uploadDir . '/' . $unique_filename;

            debug_log("Filename processing", array(
                'original' => $filename,
                'safe' => $safe_filename,
                'unique' => $unique_filename,
                'destination' => $destination
            ));

            debug_log("Moving file", array(
                'from' => $tmp_name,
                'to' => $destination,
                'destination_dir_exists' => file_exists(dirname($destination)),
                'destination_dir_writable' => is_writable(dirname($destination))
            ));

            // Attempt to move file
            if (!move_uploaded_file($tmp_name, $destination)) {
                $moveError = error_get_last();
                debug_log("Move failed", array(
                    'error' => $moveError,
                    'destination' => $destination,
                    'tmp_name' => $tmp_name,
                    'tmp_exists' => file_exists($tmp_name)
                ));
                throw new Exception('Failed to move uploaded file: ' . (isset($moveError['message']) ? $moveError['message'] : 'Unknown error'));
            }

            // Verify file was actually moved
            if (!file_exists($destination)) {
                throw new Exception('File move appeared successful but file does not exist at destination: ' . $destination);
            }

            // Set permissions
            chmod($destination, 0644);
            
            debug_log("File successfully uploaded", array(
                'destination' => $destination,
                'size' => filesize($destination),
                'permissions' => substr(sprintf('%o', fileperms($destination)), -4)
            ));

            $response['uploaded'][] = array(
                'name' => $unique_filename,
                'originalName' => $filename,
                'size' => $filesize,
                'destination' => $destination
            );

        } catch (Exception $e) {
            debug_log("Failed to process file: " . (isset($filename) ? $filename : 'unknown'), array(
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ));

            $response['failed'][] = array(
                'name' => isset($filename) ? $filename : 'unknown',
                'reason' => $e->getMessage()
            );
            continue;
        }
    }

    // Set success flag and messages
    $response['success'] = !empty($response['uploaded']);
    $response['messages'][] = count($response['uploaded']) . ' files uploaded successfully';
    if (!empty($response['failed'])) {
        $response['messages'][] = count($response['failed']) . ' files failed';
    }

    debug_log("Upload complete", array(
        'uploaded_count' => count($response['uploaded']),
        'failed_count' => count($response['failed']),
        'final_dir_contents' => scandir($uploadDir)
    ));

} catch (Exception $e) {
    debug_log("Main process error: " . $e->getMessage(), array(
        'trace' => $e->getTraceAsString()
    ));

    $response = array(
        'success' => false,
        'message' => $e->getMessage(),
        'uploaded' => array(),
        'failed' => array(),
        'debug' => array(
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
            'post_data' => $_POST,
            'files_data' => $_FILES
        )
    );
}

debug_log("Sending response", $response);
echo json_encode($response);

debug_log("=== UPLOAD PROCESS COMPLETED ===");
?>