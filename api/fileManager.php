<?php
// PHP 7.0 Compatible File Manager API for Pathology Image Management
ini_set('upload_max_filesize', '2048M');
ini_set('post_max_size', '2048M');
ini_set('memory_limit', '1024M');
ini_set('max_execution_time', 600);

// Enable error reporting but don't display errors (only log them)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Start session only if not already started
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

// Simple debug logging
function debug_log($message, $data = null) {
    error_log("FILEMANAGER: " . $message);
    if ($data !== null) {
        error_log("FILEMANAGER DATA: " . print_r($data, true));
    }
}

debug_log("FileManager API called");

// Try to include session timeout, but don't fail if it doesn't exist
$auth_file = '../auth/session_timeout.php';
if (file_exists($auth_file)) {
    // Capture any output from the auth file to prevent HTML in JSON response
    ob_start();
    require_once $auth_file;
    ob_end_clean();
    debug_log("Session timeout included");
} else {
    debug_log("Session timeout file not found, continuing without it");
}

// Set headers after any includes to prevent conflicts
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    debug_log("OPTIONS request handled");
    exit(0);
}

class FileManagerAPI {
    
    private $username;
    private $userBaseDir;
    private $allowedExtensions = array(
        'svs', 'ndpi', 'czi', 'scn', 'mrxs', 'vsi', 'vms',
        'jpg', 'jpeg', 'png', 'tiff', 'tif', 'bmp',
        'dcm', 'nii', 'nrrd', 'pdf'
    );
    
    public function __construct() {
        debug_log("Constructor started");
        
        // Check session
        debug_log("Session data: " . print_r($_SESSION, true));
        
        // Validate authentication
        if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true || empty($_SESSION['username'])) {
            debug_log("Authentication failed");
            $this->sendError('Authentication required', 401);
        }
        
        $this->username = $_SESSION['username'];
        $this->userBaseDir = '/media/Users/' . $this->username;
        
        debug_log("Username: " . $this->username);
        debug_log("User base dir: " . $this->userBaseDir);
        
        // Create directory structure if it doesn't exist
        $this->ensureDirectoryStructure();
        
        debug_log("Constructor completed");
    }
    
    private function ensureDirectoryStructure() {
        // Create /media if it doesn't exist
        if (!file_exists('/media')) {
            debug_log("Creating /media directory");
            if (!mkdir('/media', 0755, true)) {
                debug_log("Failed to create /media");
                $this->sendError('Failed to create media directory', 500);
            }
        }
        
        // Create /media/Users if it doesn't exist
        if (!file_exists('/media/Users')) {
            debug_log("Creating /media/Users directory");
            if (!mkdir('/media/Users', 0755, true)) {
                debug_log("Failed to create /media/Users");
                $this->sendError('Failed to create Users directory', 500);
            }
        }
        
        // Create user directory if it doesn't exist
        if (!file_exists($this->userBaseDir)) {
            debug_log("Creating user directory: " . $this->userBaseDir);
            if (!mkdir($this->userBaseDir, 0755, true)) {
                debug_log("Failed to create user directory");
                $this->sendError('Failed to create user directory', 500);
            }
        }
        
        // Check if directory is writable
        if (!is_writable($this->userBaseDir)) {
            debug_log("User directory is not writable");
            $this->sendError('User directory is not writable', 500);
        }
        
        debug_log("Directory structure verified");
    }
    
    private function moveFile($sourcePath, $targetPath) {
        debug_log("=== moveFile: " . $sourcePath . " to " . $targetPath . " ===");
        
        if (empty($sourcePath) || empty($targetPath)) {
            $this->sendError('Source and target paths are required', 400);
        }
        
        try {
            $sourceAbsolutePath = $this->validateAndResolvePath($sourcePath);
            $targetAbsolutePath = $this->validateAndResolvePath($targetPath);
            
            // Check if source file exists
            if (!file_exists($sourceAbsolutePath)) {
                $this->sendError('Source file not found: ' . $sourcePath, 404);
            }
            
            // Check if target is a directory
            if (!is_dir($targetAbsolutePath)) {
                $this->sendError('Target must be a directory: ' . $targetPath, 400);
            }
            
            // Get the filename from source
            $fileName = basename($sourceAbsolutePath);
            $newFilePath = $targetAbsolutePath . '/' . $fileName;
            
            // Check if file already exists in target directory
            if (file_exists($newFilePath)) {
                $this->sendError('A file with that name already exists in the target directory', 409);
            }
            
            // Move the file
            if (!rename($sourceAbsolutePath, $newFilePath)) {
                $this->sendError('Failed to move file', 500);
            }
            
            debug_log("File moved successfully from " . $sourceAbsolutePath . " to " . $newFilePath);
            
            $response = array(
                'message' => 'File moved successfully',
                'sourcePath' => $sourcePath,
                'targetPath' => $targetPath,
                'newPath' => $this->getRelativePath($newFilePath),
                'fileName' => $fileName
            );
            
            $this->sendSuccess($response);
            
        } catch (Exception $e) {
            debug_log("Exception in moveFile: " . $e->getMessage());
            $this->sendError('Error moving file: ' . $e->getMessage(), 500);
        }
    }
    
    public function handleRequest() {
        try {
            debug_log("=== Handling Request ===");
            debug_log("REQUEST_METHOD: " . $_SERVER['REQUEST_METHOD']);
            debug_log("GET params: " . print_r($_GET, true));
            debug_log("POST params: " . print_r($_POST, true));
            
            // Get input data
            $rawInput = file_get_contents('php://input');
            debug_log("Raw input: " . substr($rawInput, 0, 200) . (strlen($rawInput) > 200 ? '...' : ''));
            
            $input = json_decode($rawInput, true);
            debug_log("Decoded input: " . print_r($input, true));
            
            // Determine action from multiple sources
            $action = '';
            if (!empty($input['action'])) {
                $action = $input['action'];
            } elseif (!empty($_POST['action'])) {
                $action = $_POST['action'];
            } elseif (!empty($_GET['action'])) {
                $action = $_GET['action'];
            }
            
            debug_log("Action determined: '" . $action . "'");
            
            // If no action provided and it's a GET request, default to listDirectory
            if (empty($action) && $_SERVER['REQUEST_METHOD'] === 'GET') {
                $action = 'listDirectory';
                debug_log("Defaulting to listDirectory for GET request");
            }
            
            switch ($action) {
                case 'listDirectory':
                    $path = isset($input['path']) ? $input['path'] : (isset($_GET['path']) ? $_GET['path'] : '');
                    debug_log("Calling listDirectory with path: '" . $path . "'");
                    $this->listDirectory($path);
                    break;
                    
                case 'createFolder':
                    $path = isset($input['path']) ? $input['path'] : '';
                    $name = isset($input['name']) ? $input['name'] : '';
                    $this->createFolder($path, $name);
                    break;
                    
                case 'deleteFiles':
                    $files = isset($input['files']) ? $input['files'] : array();
                    $this->deleteFiles($files);
                    break;
                    
                case 'renameFile':
                    $oldPath = isset($input['oldPath']) ? $input['oldPath'] : '';
                    $newName = isset($input['newName']) ? $input['newName'] : '';
                    $this->renameFile($oldPath, $newName);
                    break;
                    
                case 'getFileInfo':
                    $path = isset($input['path']) ? $input['path'] : '';
                    $this->getFileInfo($path);
                    break;
                case 'moveFile':
                    $sourcePath = isset($input['sourcePath']) ? $input['sourcePath'] : '';
                    $targetPath = isset($input['targetPath']) ? $input['targetPath'] : '';
                    $this->moveFile($sourcePath, $targetPath);
                    break;
                    
                default:
                    debug_log("Invalid or empty action: '" . $action . "'");
                    // Provide more helpful error message
                    if (empty($action)) {
                        $this->sendError('No action specified. Please provide an action parameter.', 400);
                    } else {
                        $this->sendError('Invalid action: ' . $action, 400);
                    }
            }
            
        } catch (Exception $e) {
            debug_log("Exception in handleRequest: " . $e->getMessage());
            debug_log("Exception trace: " . $e->getTraceAsString());
            $this->sendError($e->getMessage(), 500);
        }
    }
    
    private function listDirectory($path) {
        debug_log("=== listDirectory called with path: '" . $path . "' ===");
        
        try {
            $targetPath = $this->validateAndResolvePath($path);
            debug_log("Target path: " . $targetPath);
            
            if (!is_dir($targetPath)) {
                debug_log("Not a directory: " . $targetPath);
                $this->sendError('Directory not found: ' . $path, 404);
            }
            
            $items = scandir($targetPath);
            if ($items === false) {
                debug_log("Failed to scan directory");
                $this->sendError('Failed to read directory', 500);
            }
            
            debug_log("Found " . count($items) . " items");
            
            $files = array();
            
            foreach ($items as $item) {
                if ($item === '.' || $item === '..') continue;
                
                $itemPath = $targetPath . '/' . $item;
                $relativePath = $this->getRelativePath($itemPath);
                
                $fileInfo = array(
                    'name' => $item,
                    'path' => $relativePath,
                    'type' => is_dir($itemPath) ? 'directory' : 'file',
                    'size' => is_file($itemPath) ? filesize($itemPath) : 0,
                    'modified' => filemtime($itemPath),
                    'permissions' => $this->getPermissions($itemPath),
                    'extension' => is_file($itemPath) ? strtolower(pathinfo($item, PATHINFO_EXTENSION)) : null
                );
                
                // Add additional info for pathology files
                if ($fileInfo['type'] === 'file' && $this->isPathologySlide($fileInfo['extension'])) {
                    $fileInfo['isPathologySlide'] = true;
                    $fileInfo['processingStatus'] = $this->getProcessingStatus($relativePath);
                }
                
                $files[] = $fileInfo;
            }
            
            debug_log("Processed " . count($files) . " files");
            
            $response = array(
                'files' => $files,
                'currentPath' => $this->getRelativePath($targetPath),
                'totalItems' => count($files),
                'totalSize' => $this->getDirectorySize($targetPath)
            );
            
            $this->sendSuccess($response);
            
        } catch (Exception $e) {
            debug_log("Exception in listDirectory: " . $e->getMessage());
            throw $e;
        }
    }
    
    private function createFolder($parentPath, $folderName) {
        debug_log("=== createFolder: " . $folderName . " in " . $parentPath . " ===");
        
        if (empty($folderName)) {
            $this->sendError('Folder name is required', 400);
        }
        
        // Sanitize folder name
        $folderName = preg_replace('/[^a-zA-Z0-9._-]/', '_', $folderName);
        
        $parentDir = $this->validateAndResolvePath($parentPath);
        $newFolderPath = $parentDir . '/' . $folderName;
        
        debug_log("Creating folder: " . $newFolderPath);
        
        if (file_exists($newFolderPath)) {
            $this->sendError('Folder already exists: ' . $folderName, 409);
        }
        
        if (!mkdir($newFolderPath, 0755, true)) {
            debug_log("Failed to create folder");
            $this->sendError('Failed to create folder: ' . $folderName, 500);
        }
        
        debug_log("Folder created successfully");
        
        $response = array(
            'message' => 'Folder created successfully',
            'path' => $this->getRelativePath($newFolderPath),
            'name' => $folderName
        );
        
        $this->sendSuccess($response);
    }
    
    private function deleteFiles($filePaths) {
        debug_log("=== deleteFiles ===");
        debug_log("Files to delete: " . print_r($filePaths, true));
        
        if (empty($filePaths)) {
            $this->sendError('No files specified for deletion', 400);
        }
        
        $deleted = array();
        $failed = array();
        
        foreach ($filePaths as $filePath) {
            try {
                $absolutePath = $this->validateAndResolvePath($filePath);
                
                if (is_dir($absolutePath)) {
                    if ($this->deleteDirectory($absolutePath)) {
                        $deleted[] = $filePath;
                    } else {
                        $failed[] = array('path' => $filePath, 'reason' => 'Failed to delete directory');
                    }
                } else if (is_file($absolutePath)) {
                    if (unlink($absolutePath)) {
                        $deleted[] = $filePath;
                    } else {
                        $failed[] = array('path' => $filePath, 'reason' => 'Failed to delete file');
                    }
                } else {
                    $failed[] = array('path' => $filePath, 'reason' => 'File not found');
                }
                
            } catch (Exception $e) {
                $failed[] = array('path' => $filePath, 'reason' => $e->getMessage());
            }
        }
        
        $response = array(
            'deleted' => $deleted,
            'failed' => $failed,
            'message' => count($deleted) . ' items deleted, ' . count($failed) . ' failed'
        );
        
        $this->sendSuccess($response);
    }
    
    private function renameFile($oldPath, $newName) {
        debug_log("=== renameFile: " . $oldPath . " to " . $newName . " ===");
        
        if (empty($newName)) {
            $this->sendError('New name is required', 400);
        }
        
        $oldAbsolutePath = $this->validateAndResolvePath($oldPath);
        $parentDir = dirname($oldAbsolutePath);
        
        // Sanitize new name
        $newName = preg_replace('/[^a-zA-Z0-9._-]/', '_', $newName);
        $newAbsolutePath = $parentDir . '/' . $newName;
        
        if (file_exists($newAbsolutePath)) {
            $this->sendError('A file with that name already exists', 409);
        }
        
        if (!rename($oldAbsolutePath, $newAbsolutePath)) {
            $this->sendError('Failed to rename file', 500);
        }
        
        $response = array(
            'message' => 'File renamed successfully',
            'oldPath' => $oldPath,
            'newPath' => $this->getRelativePath($newAbsolutePath),
            'newName' => $newName
        );
        
        $this->sendSuccess($response);
    }
    
    private function getFileInfo($path) {
        debug_log("=== getFileInfo: " . $path . " ===");
        
        $absolutePath = $this->validateAndResolvePath($path);
        
        if (!file_exists($absolutePath)) {
            $this->sendError('File not found: ' . $path, 404);
        }
        
        $info = array(
            'name' => basename($absolutePath),
            'path' => $path,
            'type' => is_dir($absolutePath) ? 'directory' : 'file',
            'size' => is_file($absolutePath) ? filesize($absolutePath) : $this->getDirectorySize($absolutePath),
            'modified' => filemtime($absolutePath),
            'created' => filectime($absolutePath),
            'permissions' => $this->getPermissions($absolutePath)
        );
        
        if ($info['type'] === 'file') {
            $info['extension'] = strtolower(pathinfo($absolutePath, PATHINFO_EXTENSION));
            if (function_exists('mime_content_type')) {
                $info['mimeType'] = mime_content_type($absolutePath);
            }
            
            // Check if it's a pathology slide
            if ($this->isPathologySlide($info['extension'])) {
                $info['isPathologySlide'] = true;
                $info['processingStatus'] = $this->getProcessingStatus($path);
                $info['canProcess'] = true;
            }
        }
        
        $this->sendSuccess(array('fileInfo' => $info));
    }
    
    private function validateAndResolvePath($relativePath) {
        debug_log("Validating path: " . $relativePath);
        
        // Start with user base directory
        if (empty($relativePath) || $relativePath === '/') {
            debug_log("Empty path, returning base dir");
            return $this->userBaseDir;
        }
        
        // Remove leading slash if present
        $relativePath = ltrim($relativePath, '/');
        
        // Construct absolute path
        $absolutePath = $this->userBaseDir . '/' . $relativePath;
        
        // Resolve any .. or . components
        $realPath = realpath($absolutePath);
        if ($realPath !== false) {
            $absolutePath = $realPath;
        }
        
        // Security check: ensure path is within user directory
        if (strpos($absolutePath, $this->userBaseDir) !== 0) {
            debug_log("Security violation - path outside user directory");
            throw new Exception('Access denied: Path outside user directory');
        }
        
        debug_log("Validated path: " . $absolutePath);
        return $absolutePath;
    }
    
    private function getRelativePath($absolutePath) {
        if (strpos($absolutePath, $this->userBaseDir) === 0) {
            $relativePath = substr($absolutePath, strlen($this->userBaseDir));
            return ltrim($relativePath, '/');
        }
        return $absolutePath;
    }
    
    private function deleteDirectory($dir) {
        if (!is_dir($dir)) {
            return false;
        }
        
        $files = array_diff(scandir($dir), array('.', '..'));
        
        foreach ($files as $file) {
            $filePath = $dir . '/' . $file;
            if (is_dir($filePath)) {
                $this->deleteDirectory($filePath);
            } else {
                unlink($filePath);
            }
        }
        
        return rmdir($dir);
    }
    
    private function getDirectorySize($dir) {
        $size = 0;
        if (!is_dir($dir)) {
            return $size;
        }
        
        $files = array_diff(scandir($dir), array('.', '..'));
        
        foreach ($files as $file) {
            $filePath = $dir . '/' . $file;
            if (is_dir($filePath)) {
                $size += $this->getDirectorySize($filePath);
            } else {
                $size += filesize($filePath);
            }
        }
        
        return $size;
    }
    
    private function getPermissions($path) {
        $perms = fileperms($path);
        $info = '';
        
        // File type
        if (($perms & 0xC000) == 0xC000) $info = 's';
        elseif (($perms & 0xA000) == 0xA000) $info = 'l';
        elseif (($perms & 0x8000) == 0x8000) $info = '-';
        elseif (($perms & 0x6000) == 0x6000) $info = 'b';
        elseif (($perms & 0x4000) == 0x4000) $info = 'd';
        elseif (($perms & 0x2000) == 0x2000) $info = 'c';
        elseif (($perms & 0x1000) == 0x1000) $info = 'p';
        else $info = 'u';
        
        // Owner
        $info .= (($perms & 0x0100) ? 'r' : '-');
        $info .= (($perms & 0x0080) ? 'w' : '-');
        $info .= (($perms & 0x0040) ? (($perms & 0x0800) ? 's' : 'x' ) : (($perms & 0x0800) ? 'S' : '-'));
        
        // Group
        $info .= (($perms & 0x0020) ? 'r' : '-');
        $info .= (($perms & 0x0010) ? 'w' : '-');
        $info .= (($perms & 0x0008) ? (($perms & 0x0400) ? 's' : 'x' ) : (($perms & 0x0400) ? 'S' : '-'));
        
        // World
        $info .= (($perms & 0x0004) ? 'r' : '-');
        $info .= (($perms & 0x0002) ? 'w' : '-');
        $info .= (($perms & 0x0001) ? (($perms & 0x0200) ? 't' : 'x' ) : (($perms & 0x0200) ? 'T' : '-'));
        
        return $info;
    }
    
    private function isPathologySlide($extension) {
        $pathologyExtensions = array('svs', 'ndpi', 'czi', 'scn', 'mrxs', 'vsi', 'vms');
        return in_array(strtolower($extension), $pathologyExtensions);
    }
    
    private function getProcessingStatus($filePath) {
        return array(
            'status' => 'not_processed',
            'dzi_exists' => false,
            'thumbnail_exists' => false,
            'last_processed' => null
        );
    }
    
    private function sendSuccess($data) {
        debug_log("Sending success response");
        $response = array_merge(array(
            'success' => true,
            'timestamp' => time()
        ), $data);
        
        echo json_encode($response);
        exit;
    }
    
    private function sendError($message, $code = 500) {
        debug_log("Sending error: " . $message . " (code: " . $code . ")");
        http_response_code($code);
        echo json_encode(array(
            'success' => false,
            'error' => $message,
            'timestamp' => time()
        ));
        exit;
    }
}

// Initialize and handle request
try {
    debug_log("=== Starting FileManager API ===");
    $api = new FileManagerAPI();
    $api->handleRequest();
} catch (Exception $e) {
    debug_log("Fatal error: " . $e->getMessage());
    debug_log("Fatal trace: " . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode(array(
        'success' => false,
        'error' => 'Internal server error: ' . $e->getMessage(),
        'timestamp' => time()
    ));
}

debug_log("=== FileManager API Request Complete ===");
?>