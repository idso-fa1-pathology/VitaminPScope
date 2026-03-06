<?php
/*
 Desc: Class to interact with all the customer multizooms - ENHANCED with Tiered Storage
 Author: Sebastian Schmittner (stp.schmittner@gmail.com)
 Date: 2015.01.24 16:17:05 (+01:00)
 Last Author: Enhanced for Tiered Storage
 Last Date: 2025.06.23
 Version: 0.1.0 - TIERED STORAGE SUPPORT
*/
require_once '../../taskFileManipulator.php';
require_once '../../polyzoomerGlobals.php';

class PathDoesNotExist extends Exception {};

class CustomerMultizooms {
    private $cleanMail;
    private $rootPath;
    private $lastUpdate;
    private $projects;
    private $imageRoot;
    private $cacheFileName = 'multi_cache.lst';
    
    public function __construct( $cleanMail ) {
        $this->cleanMail = $cleanMail;
        $this->rootPath = '/var/www/customers/' . $this->cleanMail . '/multizooms/';
        $this->imageRoot = '/customers/' . $this->cleanMail . '/multizooms/';
        
        if( !file_exists($this->rootPath) ) {
            throw new PathDoesNotExist('[' . $this->rootPath . '] does NOT exist!');
        }
        
        $this->loadCacheFile();
    }
    
    public function __destruct() {
    }
    
    public function toList() {
        return $this->projects;
    }
    
    public function cacheFilePath() {
        return $this->rootPath . $this->cacheFileName;
    }
    
    /**
     * NEW: Resolve multizoom file path with tiered storage support
     */
    private function resolveMultizoomPath($projectName, $fileName = '') {
        // First check in customer multizooms directory (symlinks)
        $customerPath = $this->rootPath . $projectName;
        $customerWebPath = $this->imageRoot . $projectName;
        
        if (file_exists($customerPath . '/' . $fileName)) {
            return $customerWebPath . '/' . $fileName;
        }
        
        // If symlink is broken, try to resolve through tiered storage
        $resolved = resolvePolyzoomerPath($projectName);
        
        if ($resolved['path'] !== null) {
            $filePath = $resolved['path'] . '/' . $fileName;
            if (file_exists($filePath)) {
                // Return the web path for tiered storage
                return $resolved['web_path'] . '/' . $fileName;
            }
        }
        
        // Fallback to original path (might 404, but that's expected)
        return $customerWebPath . '/' . $fileName;
    }
    
    /**
     * NEW: Get thumbnail path with tiered storage support
     */
    public function getThumbnailPath($projectName) {
        return $this->resolveMultizoomPath($projectName, 'THUMBNAIL_OVERVIEW.png');
    }
    
    /**
     * NEW: Get index path with tiered storage support
     */
    public function getIndexPath($projectName) {
        $indexFile = 'page/INDEX/index.html';
        
        // Check customer directory first
        $customerPath = $this->rootPath . $projectName;
        if (file_exists($customerPath . '/' . $indexFile)) {
            return $this->imageRoot . $projectName . '/' . $indexFile;
        }
        
        // Try tiered storage
        $resolved = resolvePolyzoomerPath($projectName);
        if ($resolved['path'] !== null && file_exists($resolved['path'] . '/' . $indexFile)) {
            return $resolved['web_path'] . '/' . $indexFile;
        }
        
        // Fallback
        return $this->imageRoot . $projectName . '/' . $indexFile;
    }
    
    public function loadCacheFile() {
        $cache = array();
        $cachePath = $this->cacheFilePath();
        
        if(file_exists($cachePath)) {
            $cacheFile = new TaskFileManipulator($cachePath);
            $cache = $cacheFile->getContents();
            $this->projects = array();
            
            foreach( $cache as $line ) {
                $line = trim($line);
                if(strlen($line) > 0) {
                    $project = json_decode($line);
                    if($project !== null ) {
                        // ENHANCED: Use tiered storage-aware path resolution
                        $projectName = $project->name ?? basename($project->index ?? '');
                        
                        // Update paths to use tiered storage resolver
                        if (isset($project->index)) {
                            $project->index = $this->getIndexPath($projectName);
                        }
                        
                        // Add thumbnail path with tiered storage support
                        $project->thumbnail = $this->getThumbnailPath($projectName);
                        
                        array_push($this->projects, $project);
                    }
                }
            }
        }
    }
    
    /**
     * NEW: Update symlinks to point to correct storage location
     */
    public function updateSymlinks() {
        if (!is_dir($this->rootPath)) {
            return false;
        }
        
        $updated = 0;
        $dirs = scandir($this->rootPath);
        
        foreach ($dirs as $dir) {
            if ($dir === '.' || $dir === '..') continue;
            
            $symlinkPath = $this->rootPath . $dir;
            
            // Check if it's a broken symlink
            if (is_link($symlinkPath) && !file_exists($symlinkPath)) {
                // Try to resolve the correct path
                $resolved = resolvePolyzoomerPath($dir);
                
                if ($resolved['path'] !== null) {
                    // Remove broken symlink
                    unlink($symlinkPath);
                    
                    // Create new symlink
                    if (symlink($resolved['path'], $symlinkPath)) {
                        logTieredStorage("Updated multizoom symlink: {$this->cleanMail}/{$dir} -> {$resolved['location']} storage");
                        $updated++;
                    }
                }
            }
        }
        
        return $updated;
    }
}
?>
