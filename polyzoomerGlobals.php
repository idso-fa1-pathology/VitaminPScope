<?php
/*
 Desc: Polyzoomer Globals - ENHANCED with Tiered Storage
 Author: Sebastian Schmittner (stp.schmittner@gmail.com)
 Date: 2015.01.30 15:05:01 (+01:00)
 Last Author: Enhanced for Tiered Storage
 Last Date: 2025.06.23
 Version: 0.2.0 - TIERED STORAGE SUPPORT
*/

function rootPath() {
    return '/var/www/';
}

function dataGrave() {
    return '/dev/mapper/zoom1-logical_zoom1';
}

function logFolder() {
    return '/var/www/';
}

function tempFolder() {
    return '/tmp/';
}

function tempPrefix() {
    return 'pzTemp_';
}

function uploadFolder() {
    return rootPath() . 'uploads/';
}

function jobFolder() {
    return rootPath() . 'jobs/';
}

function taskFolder() {
    return jobFolder() . 'tasks/';
}

function taskFile( $guid ) {
    return taskFolder() . $guid . '.task';
}

function jobCounter() {
    return rootPath() . 'jobCounter.log';
}

function logFile() {
    return logFolder() . 'polyzoomer.log';
}

function uploadLog() {
    return uploadFolder() . 'upload.log';
}

function jobFile() {
    return jobFolder() . 'jobs.log';
}

function jobDoneFile() {
    return jobFile() . '.done';
}

function jobFileG( $guid ) {
    return jobFolder() . $guid . '.job';
}

function customersPath() {
    return rootPath() . 'customers/';
}

function userPath( $cleanEmail ) {
    return customersPath() . $cleanEmail . '/';
}

function cacheFile( $cleanEmail ) {
    return userPath( $cleanEmail ) . 'cache.lst';
}

function multiCacheFile( $cleanEmail ) {
    return userPath( $cleanEmail ) . 'multizooms/multi_cache.lst';
}

// =============================================================================
// TIERED STORAGE FUNCTIONS - NEW
// =============================================================================

/**
 * Hot storage path (local SSD/NVMe) - for recent files < 30 days
 */
function polyzoomerHotPath() {
    return rootPath() . 'polyzoomer_hot/';
}

/**
 * Cold storage path (research drive) - for archived files > 30 days
 */
function polyzoomerColdPath() {
    return rootPath() . 'polyzoomer/';
}

/**
 * Tiered storage configuration
 */
function tieringConfig() {
    return array(
        'archive_age_days' => 30,
        'check_interval_hours' => 24,
        'hot_path' => polyzoomerHotPath(),
        'cold_path' => polyzoomerColdPath(),
        'log_file' => logFolder() . 'tiered_storage.log'
    );
}

/**
 * Smart polyzoomer path resolver - checks hot storage first, then cold
 * Returns array with 'path' and 'location' ('hot' or 'cold')
 */
function resolvePolyzoomerPath($pathName) {
    $hotPath = polyzoomerHotPath() . $pathName;
    $coldPath = polyzoomerColdPath() . $pathName;
    
    if (file_exists($hotPath)) {
        return array(
            'path' => $hotPath,
            'location' => 'hot',
            'web_path' => '/polyzoomer_hot/' . $pathName
        );
    } elseif (file_exists($coldPath)) {
        return array(
            'path' => $coldPath,
            'location' => 'cold',
            'web_path' => '/polyzoomer/' . $pathName
        );
    } else {
        return array(
            'path' => null,
            'location' => 'missing',
            'web_path' => null
        );
    }
}

/**
 * Get all polyzoomer directories from both hot and cold storage
 */
function getAllPolyzoomerPaths() {
    $paths = array();
    
    // Get from hot storage
    $hotBase = polyzoomerHotPath();
    if (is_dir($hotBase)) {
        $hotDirs = scandir($hotBase);
        foreach ($hotDirs as $dir) {
            if ($dir !== '.' && $dir !== '..' && is_dir($hotBase . $dir)) {
                $paths[] = array(
                    'name' => $dir,
                    'location' => 'hot',
                    'path' => $hotBase . $dir,
                    'mtime' => filemtime($hotBase . $dir)
                );
            }
        }
    }
    
    // Get from cold storage
    $coldBase = polyzoomerColdPath();
    if (is_dir($coldBase)) {
        $coldDirs = scandir($coldBase);
        foreach ($coldDirs as $dir) {
            if ($dir !== '.' && $dir !== '..' && is_dir($coldBase . $dir)) {
                $paths[] = array(
                    'name' => $dir,
                    'location' => 'cold',
                    'path' => $coldBase . $dir,
                    'mtime' => filemtime($coldBase . $dir)
                );
            }
        }
    }
    
    return $paths;
}

/**
 * Log tiered storage operations
 */
function logTieredStorage($message) {
    $config = tieringConfig();
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[{$timestamp}] TIERED_STORAGE: {$message}\n";
    file_put_contents($config['log_file'], $logEntry, FILE_APPEND | LOCK_EX);
}

// =============================================================================
// ORIGINAL FUNCTIONS (unchanged)
// =============================================================================

function userKeySize() {
    return 6;
}

function userKeySet() {
    return 'A-Z0-9';
}

function maximumLogfileSizeInBytes() {
    return 10 * 1024 * 1024; // 10MB
}

function mediaDirectory() {
    return '/media/';
}

function mediaExcludes() {
    return array('.', '..');
}

function ufsUploadFolder() {
    return '///new///';
}
?>