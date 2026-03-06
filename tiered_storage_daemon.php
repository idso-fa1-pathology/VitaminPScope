<?php
/*
 Desc: Tiered Storage Daemon - Automatically archives old polyzoomer files
 Author: Enhanced Polyscope System
 Date: 2025.06.23
 Version: 1.2.0 - FIXED: Updated path handling for new Docker mount structure
 
 Purpose: Moves polyzoomer files older than 30 days from hot storage (local)
          to cold storage (research drive) while maintaining user access
          Now includes multizoom symlink management
*/

require_once __DIR__ . '/polyzoomerGlobals.php';
require_once __DIR__ . '/lockedFileAccess.php';

class TieredStorageDaemon {
    
    private $config;
    private $dry_run;
    
    public function __construct($dry_run = false) {
        $this->config = tieringConfig();
        $this->dry_run = $dry_run;
        
        logTieredStorage("=== Tiered Storage Daemon Starting ===");
        logTieredStorage("Hot path: " . $this->config['hot_path']);
        logTieredStorage("Cold path: " . $this->config['cold_path']);
        logTieredStorage("Archive age: " . $this->config['archive_age_days'] . " days");
        logTieredStorage("Dry run: " . ($dry_run ? "YES" : "NO"));
    }
    
    /**
     * Main execution function
     */
    public function run() {
        try {
            $this->createColdStorageDir();
            $candidatesForArchival = $this->findFilesForArchival();
            $this->archiveFiles($candidatesForArchival);
            $this->updateUserCaches($candidatesForArchival);
            $this->updateUserSymlinks($candidatesForArchival);  // ENHANCED: Now includes multizooms
            $this->updateMultizoomCaches($candidatesForArchival); // NEW: Update multizoom cache files
            $this->cleanupEmptyDirectories();
            
            logTieredStorage("=== Tiered Storage Daemon Complete ===");
            
        } catch (Exception $e) {
            logTieredStorage("ERROR: " . $e->getMessage());
            throw $e;
        }
    }
    
    /**
     * Ensure cold storage directory exists
     */
    private function createColdStorageDir() {
        if (!is_dir($this->config['cold_path'])) {
            if (!$this->dry_run) {
                mkdir($this->config['cold_path'], 0755, true);
            }
            logTieredStorage("Created cold storage directory: " . $this->config['cold_path']);
        }
    }
    
    /**
     * Find polyzoomer directories older than configured age
     */
    private function findFilesForArchival() {
        $candidates = array();
        $cutoffTime = time() - ($this->config['archive_age_days'] * 24 * 60 * 60);
        
        logTieredStorage("Looking for files older than " . date('Y-m-d H:i:s', $cutoffTime));
        
        if (!is_dir($this->config['hot_path'])) {
            logTieredStorage("Hot storage directory does not exist: " . $this->config['hot_path']);
            return $candidates;
        }
        
        $dirs = scandir($this->config['hot_path']);
        foreach ($dirs as $dir) {
            if ($dir === '.' || $dir === '..') continue;
            
            $fullPath = $this->config['hot_path'] . $dir;
            if (!is_dir($fullPath)) continue;
            
            $mtime = filemtime($fullPath);
            if ($mtime < $cutoffTime) {
                $candidates[] = array(
                    'name' => $dir,
                    'hot_path' => $fullPath,
                    'cold_path' => $this->config['cold_path'] . $dir,
                    'age_days' => round((time() - $mtime) / (24 * 60 * 60), 1),
                    'size' => $this->getDirectorySize($fullPath)
                );
                
                logTieredStorage("Found candidate: {$dir} (age: " . round((time() - $mtime) / (24 * 60 * 60), 1) . " days)");
            }
        }
        
        logTieredStorage("Found " . count($candidates) . " directories for archival");
        return $candidates;
    }
    
    /**
     * Archive files from hot to cold storage
     */
    private function archiveFiles($candidates) {
        $totalSize = 0;
        $successCount = 0;
        
        foreach ($candidates as $candidate) {
            try {
                logTieredStorage("Archiving: {$candidate['name']} ({$candidate['size']} bytes)");
                
                if (!$this->dry_run) {
                    // Use copy + remove for cross-filesystem moves
                    if ($this->copyDirectory($candidate['hot_path'], $candidate['cold_path'])) {
                        $this->removeDirectory($candidate['hot_path']);
                        $successCount++;
                        $totalSize += $candidate['size'];
                        logTieredStorage("SUCCESS: Moved {$candidate['name']} to cold storage");
                    } else {
                        logTieredStorage("ERROR: Failed to move {$candidate['name']}");
                    }
                } else {
                    logTieredStorage("DRY RUN: Would move {$candidate['name']} to cold storage");
                    $successCount++;
                    $totalSize += $candidate['size'];
                }
                
            } catch (Exception $e) {
                logTieredStorage("ERROR archiving {$candidate['name']}: " . $e->getMessage());
            }
        }
        
        logTieredStorage("Archival complete: {$successCount}/" . count($candidates) . " files moved");
        logTieredStorage("Total size archived: " . $this->formatBytes($totalSize));
    }
    
    /**
     * FIXED: Update user cache files to reflect new file locations
     */
    private function updateUserCaches($archivedFiles) {
        if (empty($archivedFiles) || $this->dry_run) {
            return;
        }
        
        logTieredStorage("Updating user cache files...");
        
        // Get all user directories
        $customersDir = customersPath();
        if (!is_dir($customersDir)) {
            return;
        }
        
        $users = scandir($customersDir);
        foreach ($users as $user) {
            if ($user === '.' || $user === '..') continue;
            
            $userDir = $customersDir . $user;
            if (!is_dir($userDir)) continue;
            
            $this->updateUserCacheFile($user, $archivedFiles);
        }
    }
    
    /**
     * FIXED: Update individual user cache file with correct path mapping
     */
    private function updateUserCacheFile($cleanEmail, $archivedFiles) {
        $cacheFilePath = cacheFile($cleanEmail);
        if (!file_exists($cacheFilePath)) {
            return;
        }
        
        try {
            $updated = false;
            $lines = file($cacheFilePath, FILE_IGNORE_NEW_LINES);
            $newLines = array();
            
            foreach ($lines as $line) {
                $project = json_decode($line, true);
                if ($project && isset($project['name'])) {
                    
                    // Check if this project was archived
                    foreach ($archivedFiles as $archived) {
                        if (strpos($project['name'], $archived['name']) !== false) {
                            // FIXED: Update paths to point to cold storage using correct mount paths
                            // Hot: /var/www/polyzoomer_hot -> Cold: /var/www/polyzoomer
                            if (isset($project['index'])) {
                                $project['index'] = str_replace('/polyzoomer_hot/', '/polyzoomer/', $project['index']);
                            }
                            if (isset($project['image'])) {
                                $project['image'] = str_replace('/polyzoomer_hot/', '/polyzoomer/', $project['image']);
                            }
                            if (isset($project['dzi'])) {
                                $project['dzi'] = str_replace('/polyzoomer_hot/', '/polyzoomer/', $project['dzi']);
                            }
                            
                            $updated = true;
                            logTieredStorage("Updated cache entry for user {$cleanEmail}: {$project['name']}");
                            break;
                        }
                    }
                }
                
                $newLines[] = json_encode($project);
            }
            
            if ($updated) {
                file_put_contents($cacheFilePath, implode("\n", $newLines) . "\n");
                logTieredStorage("Cache file updated: {$cacheFilePath}");
            }
            
        } catch (Exception $e) {
            logTieredStorage("ERROR updating cache for user {$cleanEmail}: " . $e->getMessage());
        }
    }
    
    /**
     * FIXED: Update multizoom cache files with correct path mapping
     */
    private function updateMultizoomCaches($archivedFiles) {
        if (empty($archivedFiles) || $this->dry_run) {
            return;
        }
        
        logTieredStorage("Updating multizoom cache files...");
        
        $customersDir = customersPath();
        if (!is_dir($customersDir)) {
            return;
        }
        
        $users = scandir($customersDir);
        foreach ($users as $user) {
            if ($user === '.' || $user === '..') continue;
            
            $userDir = $customersDir . $user;
            if (!is_dir($userDir)) continue;
            
            $this->updateMultizoomCacheFile($user, $archivedFiles);
        }
    }
    
    /**
     * FIXED: Update individual user multizoom cache file with correct path mapping
     */
    private function updateMultizoomCacheFile($cleanEmail, $archivedFiles) {
        $multiCacheFilePath = multiCacheFile($cleanEmail);
        if (!file_exists($multiCacheFilePath)) {
            return;
        }
        
        try {
            $updated = false;
            $lines = file($multiCacheFilePath, FILE_IGNORE_NEW_LINES);
            $newLines = array();
            
            foreach ($lines as $line) {
                $project = json_decode($line, true);
                if ($project && isset($project['name'])) {
                    
                    // Check if this multizoom project was archived
                    foreach ($archivedFiles as $archived) {
                        if (strpos($project['name'], $archived['name']) !== false) {
                            // FIXED: Update paths to point to cold storage using correct mount paths
                            // Hot: /var/www/polyzoomer_hot -> Cold: /var/www/polyzoomer
                            if (isset($project['index'])) {
                                $project['index'] = str_replace('/polyzoomer_hot/', '/polyzoomer/', $project['index']);
                                $project['index'] = str_replace('/customers/' . $cleanEmail . '/multizooms/', '/polyzoomer/', $project['index']);
                            }
                            if (isset($project['image'])) {
                                $project['image'] = str_replace('/polyzoomer_hot/', '/polyzoomer/', $project['image']);
                                $project['image'] = str_replace('/customers/' . $cleanEmail . '/multizooms/', '/polyzoomer/', $project['image']);
                            }
                            if (isset($project['dzi'])) {
                                $project['dzi'] = str_replace('/polyzoomer_hot/', '/polyzoomer/', $project['dzi']);
                                $project['dzi'] = str_replace('/customers/' . $cleanEmail . '/multizooms/', '/polyzoomer/', $project['dzi']);
                            }
                            
                            $updated = true;
                            logTieredStorage("Updated multizoom cache entry for user {$cleanEmail}: {$project['name']}");
                            break;
                        }
                    }
                }
                
                $newLines[] = json_encode($project);
            }
            
            if ($updated) {
                file_put_contents($multiCacheFilePath, implode("\n", $newLines) . "\n");
                logTieredStorage("Multizoom cache file updated: {$multiCacheFilePath}");
            }
            
        } catch (Exception $e) {
            logTieredStorage("ERROR updating multizoom cache for user {$cleanEmail}: " . $e->getMessage());
        }
    }
    
    /**
     * ENHANCED: Update user symlinks to point to cold storage (includes multizooms)
     */
    private function updateUserSymlinks($archivedFiles) {
        if (empty($archivedFiles) || $this->dry_run) {
            return;
        }
        
        logTieredStorage("Updating user symlinks (regular and multizoom)...");
        
        $customersDir = customersPath();
        if (!is_dir($customersDir)) {
            return;
        }
        
        foreach ($archivedFiles as $archived) {
            $users = scandir($customersDir);
            foreach ($users as $user) {
                if ($user === '.' || $user === '..') continue;
                
                $userDir = $customersDir . $user;
                if (!is_dir($userDir)) continue;
                
                // Update regular polyzoomer symlinks
                $symlinkPath = $userDir . '/' . $archived['name'];
                if (is_link($symlinkPath)) {
                    unlink($symlinkPath);
                    symlink($archived['cold_path'], $symlinkPath);
                    logTieredStorage("Updated symlink: {$user}/{$archived['name']} -> cold storage");
                }
                
                // Update multizoom symlinks
                $multizoomDir = $userDir . '/multizooms/';
                if (is_dir($multizoomDir)) {
                    $multizoomSymlink = $multizoomDir . $archived['name'];
                    if (is_link($multizoomSymlink)) {
                        unlink($multizoomSymlink);
                        symlink($archived['cold_path'], $multizoomSymlink);
                        logTieredStorage("Updated multizoom symlink: {$user}/multizooms/{$archived['name']} -> cold storage");
                    }
                }
            }
        }
    }
    
    /**
     * Remove empty directories from hot storage
     */
    private function cleanupEmptyDirectories() {
        if ($this->dry_run) {
            return;
        }
        
        $hotPath = $this->config['hot_path'];
        if (!is_dir($hotPath)) {
            return;
        }
        
        $dirs = scandir($hotPath);
        foreach ($dirs as $dir) {
            if ($dir === '.' || $dir === '..') continue;
            
            $fullPath = $hotPath . $dir;
            if (is_dir($fullPath) && $this->isDirectoryEmpty($fullPath)) {
                rmdir($fullPath);
                logTieredStorage("Removed empty directory: {$dir}");
            }
        }
    }
    
    /**
     * Helper functions
     */
    private function getDirectorySize($dir) {
        $size = 0;
        if (is_dir($dir)) {
            $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir));
            foreach ($iterator as $file) {
                $size += $file->getSize();
            }
        }
        return $size;
    }
    
    /**
     * FIX: Copy directory with correct permissions
     */
    private function copyDirectory($src, $dst) {
        if (!is_dir($src)) {
            return false;
        }
        
        if (!mkdir($dst, 0755, true)) {
            return false;
        }
        
        $command = "cp -r " . escapeshellarg($src . "/.") . " " . escapeshellarg($dst . "/");
        shell_exec($command . " 2>&1");
        
        // FIX: Set correct permissions after copy
        shell_exec("chown -R www-data:www-data " . escapeshellarg($dst));
        shell_exec("chmod -R 755 " . escapeshellarg($dst));
        shell_exec("find " . escapeshellarg($dst) . " -type f -exec chmod 644 {} \\;");
        
        return is_dir($dst) && count(scandir($dst)) > 2;
    }
    
    private function removeDirectory($dir) {
        $command = "rm -rf " . escapeshellarg($dir);
        shell_exec($command);
    }
    
    private function isDirectoryEmpty($dir) {
        return count(scandir($dir)) <= 2; // Only . and ..
    }
    
    private function formatBytes($size) {
        $units = array('B', 'KB', 'MB', 'GB', 'TB');
        for ($i = 0; $size >= 1024 && $i < count($units) - 1; $i++) {
            $size /= 1024;
        }
        return round($size, 2) . ' ' . $units[$i];
    }
}

// ===============================================
// CLI EXECUTION
// ===============================================

if (php_sapi_name() === 'cli') {
    $dry_run = isset($argv[1]) && $argv[1] === '--dry-run';
    
    try {
        $daemon = new TieredStorageDaemon($dry_run);
        $daemon->run();
        echo "Tiered storage operation completed successfully.\n";
        exit(0);
    } catch (Exception $e) {
        echo "ERROR: " . $e->getMessage() . "\n";
        exit(1);
    }
}

?>
