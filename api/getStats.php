<?php
session_start();
header('Content-Type: application/json');

// Check if user is logged in
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    http_response_code(401);
    echo json_encode(['error' => 'Not authenticated']);
    exit;
}

$username = $_SESSION['username'] ?? 'guest';

try {
    // Get user's directory path
    $userDir = "/media/Users/" . $username;
    
    if (!is_dir($userDir)) {
        echo json_encode([
            'success' => true,
            'totalFiles' => 0,
            'processedFiles' => 0,
            'storageUsed' => 0
        ]);
        exit;
    }
    
    $stats = [
        'totalFiles' => 0,
        'processedFiles' => 0,
        'storageUsed' => 0,
        'success' => true
    ];
    
    // Count files and calculate storage recursively
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($userDir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );
    
    $dziFiles = [];
    
    foreach ($iterator as $file) {
        if ($file->isFile()) {
            $stats['totalFiles']++;
            $stats['storageUsed'] += $file->getSize();
            
            // Check for DZI files (processed files)
            $extension = strtolower($file->getExtension());
            if ($extension === 'dzi') {
                $dziFiles[] = $file->getPathname();
            }
        }
    }
    
    // Count processed files (files that have DZI counterparts)
    $processedCount = 0;
    foreach ($dziFiles as $dziFile) {
        // Check if there's an original file for this DZI
        $baseName = pathinfo($dziFile, PATHINFO_FILENAME);
        $directory = dirname($dziFile);
        
        // Look for original files with supported extensions
        $supportedExtensions = [
            'svs', 'ndpi', 'czi', 'scn', 'mrxs', 'vsi', 'vms',
            'tiff', 'tif', 'jpg', 'jpeg', 'png', 'bmp', 'gif', 'webp',
            'dcm', 'dicom', 'nii', 'nrrd', 'jp2', 'j2k', 'jpx', 'jpm'
        ];
        
        foreach ($supportedExtensions as $ext) {
            if (file_exists($directory . '/' . $baseName . '.' . $ext)) {
                $processedCount++;
                break; // Found a match, don't count multiple times
            }
        }
    }
    
    $stats['processedFiles'] = $processedCount;
    
    // Format the response
    echo json_encode($stats);
    
} catch (Exception $e) {
    error_log("Stats API error: " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to calculate statistics'
    ]);
}
?>