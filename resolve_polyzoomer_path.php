<?php
/*
 Desc: Smart polyzoomer path resolver for tiered storage
 Author: Enhanced Polyscope System
 Date: 2025.06.23
 Version: 1.0.0
 
 Purpose: Resolves polyzoomer file requests when symlinks are broken
          or files have been moved between hot and cold storage
*/

require_once __DIR__ . '/polyzoomerGlobals.php';

// Get request parameters
$user = $_GET['user'] ?? '';
$path = $_GET['path'] ?? '';
$file = $_GET['file'] ?? '';

if (empty($user) || empty($path)) {
    http_response_code(400);
    die('Invalid request parameters');
}

try {
    $resolvedFile = resolveAndServeFile($user, $path, $file);
    if (!$resolvedFile) {
        http_response_code(404);
        logTieredStorage("File not found: user={$user}, path={$path}, file={$file}");
        die('File not found');
    }
} catch (Exception $e) {
    http_response_code(500);
    logTieredStorage("Error resolving file: " . $e->getMessage());
    die('Internal server error');
}

function resolveAndServeFile($user, $path, $file) {
    
    // Clean inputs
    $user = preg_replace('/[^a-zA-Z0-9@._-]/', '', $user);
    $path = preg_replace('/[^a-zA-Z0-9_.-]/', '', $path);
    $file = preg_replace('/[^a-zA-Z0-9_.-\/]/', '', $file);
    
    // Try to resolve the polyzoomer path
    $resolvedPath = resolvePolyzoomerPath($path);
    
    if ($resolvedPath['path'] === null) {
        logTieredStorage("Path resolution failed: {$path}");
        return false;
    }
    
    // Construct full file path
    $fullFilePath = $resolvedPath['path'] . '/' . $file;
    
    if (!file_exists($fullFilePath)) {
        // Try common variations
        $variations = [
            $resolvedPath['path'] . '/page/' . $file,
            $resolvedPath['path'] . '/tiles/' . $file,
            $resolvedPath['path'] . '/' . basename($file)
        ];
        
        foreach ($variations as $variation) {
            if (file_exists($variation)) {
                $fullFilePath = $variation;
                break;
            }
        }
        
        if (!file_exists($fullFilePath)) {
            logTieredStorage("File not found after resolution: {$fullFilePath}");
            return false;
        }
    }
    
    // Update symlink if it's broken
    $userPath = userPath(cleanString($user));
    $symlinkPath = $userPath . $path;
    
    if (!file_exists($symlinkPath) || !is_link($symlinkPath)) {
        updateSymlink($userPath, $path, $resolvedPath['path']);
    }
    
    // Log successful resolution
    logTieredStorage("Resolved file: {$path}/{$file} -> {$resolvedPath['location']} storage");
    
    // Serve the file
    serveFile($fullFilePath);
    return true;
}

function updateSymlink($userPath, $pathName, $targetPath) {
    $symlinkPath = $userPath . $pathName;
    
    try {
        // Remove broken symlink if exists
        if (is_link($symlinkPath)) {
            unlink($symlinkPath);
        }
        
        // Create new symlink
        if (symlink($targetPath, $symlinkPath)) {
            logTieredStorage("Updated symlink: {$symlinkPath} -> {$targetPath}");
            return true;
        } else {
            logTieredStorage("Failed to create symlink: {$symlinkPath} -> {$targetPath}");
            return false;
        }
    } catch (Exception $e) {
        logTieredStorage("Error updating symlink: " . $e->getMessage());
        return false;
    }
}

function serveFile($filePath) {
    
    // Security check
    $realPath = realpath($filePath);
    $allowedPaths = [
        realpath(polyzoomerHotPath()),
        realpath(polyzoomerColdPath())
    ];
    
    $isAllowed = false;
    foreach ($allowedPaths as $allowedPath) {
        if ($allowedPath && strpos($realPath, $allowedPath) === 0) {
            $isAllowed = true;
            break;
        }
    }
    
    if (!$isAllowed) {
        http_response_code(403);
        logTieredStorage("Security violation: Attempted access to: {$realPath}");
        die('Access denied');
    }
    
    // Determine content type
    $contentType = getContentType($filePath);
    
    // Set headers
    header('Content-Type: ' . $contentType);
    header('Content-Length: ' . filesize($filePath));
    header('Cache-Control: public, max-age=2592000'); // 30 days
    header('Expires: ' . gmdate('D, d M Y H:i:s', time() + 2592000) . ' GMT');
    
    // Output file
    readfile($filePath);
}

function getContentType($filePath) {
    $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    
    $mimeTypes = [
        'html' => 'text/html',
        'htm' => 'text/html',
        'xml' => 'application/xml',
        'dzi' => 'application/xml',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'gif' => 'image/gif',
        'js' => 'application/javascript',
        'css' => 'text/css',
        'json' => 'application/json'
    ];
    
    return $mimeTypes[$extension] ?? 'application/octet-stream';
}

function cleanString($string) {
    // Same function as used elsewhere in the system
    return preg_replace('/[^a-zA-Z0-9@._-]/', '', $string);
}

?>