<?php
/*
 Desc: Functions to retrieve the current status of all open projects with automatic customer page integration
 Author: Sebastian Schmittner
 Date: 2014.09.07 20:37:27 (+02:00)
 Last Author: Enhanced for automatic customer integration and tiered storage
 Last Date: 2025.08.09
 Version: 0.2.0 - TIERED STORAGE SUPPORT
*/

// Suppress ALL output except our JSON response
error_reporting(0);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

class FileContentChangedException extends Exception {};
class WrongArgumentCountException extends Exception {};

require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/taskFileManipulator.php';
require_once __DIR__ . '/jobRepresentation.php';
require_once __DIR__ . '/polyzoomerGlobals.php';  // FIX: Add tiered storage support

// Start output buffering to capture ALL output
ob_start();

$result = retrieveProjectStatus();

// Discard ALL captured output (including SMTP errors)
ob_end_clean();

// Output only clean JSON
echo json_encode($result);

function retrieveProjectStatus() {
    $jobFile = jobFile();
    $taskFileHandler = null;
    $contents = null;
    
    try {
        $taskFileHandler = new taskFileManipulator($jobFile);
        $contents = $taskFileHandler->getContents();
    } catch (Exception $e) {
        // Handle exception silently as in original
    }
    
    $valid = false;
    $jobs = array();
    $commentsLines = array();
    
    if($contents !== null) {
        $commentsLines = preg_grep("/^#/i", $contents);
        $jobLines = preg_grep("/^#/i", $contents, PREG_GREP_INVERT);
        
        foreach($jobLines as $entry) {
            $entry = trim($entry);
            if(empty($entry)) {
                continue;
            }
            
            $localJob = null;
            try {
                $file = jobFileG($entry);
                $content = lockedFileRead($file, filesize($file), 'r', true);
                $localJob = new Job($content['data']);
                
                // Check if job is completed and needs to be added to customer page
                if($localJob && isJobCompleted($localJob)) {
                    processCompletedJob($localJob);
                }
                
            } catch (Exception $e) {
                $localJob = null;
            }
            
            if(isset($localJob)) {
                array_push($jobs, $localJob);
            }
        }
        $valid = true;
    }
    
    return array(
        'valid' => $valid,
        'jobs' => $jobs,
        'comments' => $commentsLines
    );
}

/**
 * Check if a job is completed
 */
function isJobCompleted($job) {
    if (!$job || !isset($job->data['statusId'])) {
        return false;
    }
    
    $status = $job->data['statusId'];
    // Status 6 = finished
    return ($status == '6' || strtolower($job->data['status']) == 'finished');
}

/**
 * Process completed job and add to customer page
 */
function processCompletedJob($job) {
    try {
        // Check if this job has already been processed
        if (hasJobBeenProcessedForCustomer($job)) {
            return true; // Already processed, skip
        }
        
        // Extract username from origFilename path
        $username = extractUsernameFromJob($job);
        if (!$username) {
            @error_log("Could not extract username from job: " . $job->data['guid']);
            return false;
        }
        
        // Get the polyzoomer directory path
        $polyzoomerId = getPolyzoomerId($job);
        if (!$polyzoomerId) {
            @error_log("Could not get polyzoomer path for job: " . $job->data['guid']);
            return false;
        }
        
        // FIX: Use tiered storage resolver instead of hardcoded path
        $resolvedPath = resolvePolyzoomerPath($polyzoomerId);
        if ($resolvedPath['path'] === null) {
            @error_log("Polyzoomer directory does not exist in hot or cold storage: " . $polyzoomerId);
            return false;
        }
        
        @error_log("Found polyzoomer path for job " . $job->data['guid'] . " in " . $resolvedPath['location'] . " storage: " . $resolvedPath['path']);
        
        // Create email from username (format: username@mdanderson.edu)
        $email = $username . '@mdanderson.edu';
        $cleanmail = $username . '-mdanderson-org';
        
        // Get original filename for email subject
        $origFilename = isset($job->data['origFilename']) ? $job->data['origFilename'] : 'Unknown file';
        $filename = basename($origFilename);
        
        // Load linkAndEmailTools only when needed and capture all output
        ob_start();
        require_once __DIR__ . '/linkAndEmailTools.php';
        
        // Add to customer page using existing infrastructure
        @executeLinkAndEmail($polyzoomerId, $filename, $email, $cleanmail);
        
        // Discard any output from the integration (including SMTP errors)
        ob_end_clean();
        
        // Mark this job as processed
        markJobAsProcessedForCustomer($job);
        
        @error_log("Successfully added job " . $job->data['guid'] . " to customer page for user: " . $username . " (storage: " . $resolvedPath['location'] . ")");
        return true;
        
    } catch (Exception $e) {
        @error_log("Error processing completed job " . $job->data['guid'] . ": " . $e->getMessage());
        return false;
    }
}

/**
 * Extract username from job's origFilename path
 */
function extractUsernameFromJob($job) {
    if (!isset($job->data['origFilename'])) {
        return null;
    }
    
    $origFilename = $job->data['origFilename'];
    
    // Pattern: /media/Users/{username}/filename
    if (preg_match('/\/media\/Users\/([^\/]+)\//', $origFilename, $matches)) {
        return $matches[1];
    }
    
    return null;
}

/**
 * Get the polyzoomer directory ID/path from job
 */
function getPolyzoomerId($job) {
    // Get the finalPath from job data
    if (isset($job->data['finalPath']) && !empty($job->data['finalPath'])) {
        return $job->data['finalPath']; // Path####_YmdHi
    }
    
    return null;
}

/**
 * Check if job has already been processed for customer page
 */
function hasJobBeenProcessedForCustomer($job) {
    $processedFile = rootPath() . '/logs/processed_jobs.log';
    
    if (!file_exists($processedFile)) {
        return false;
    }
    
    $processedJobs = file_get_contents($processedFile);
    return strpos($processedJobs, $job->data['guid']) !== false;
}

/**
 * Mark job as processed for customer page
 */
function markJobAsProcessedForCustomer($job) {
    $processedFile = rootPath() . '/logs/processed_jobs.log';
    $logDir = dirname($processedFile);
    
    // Create logs directory if it doesn't exist
    if (!file_exists($logDir)) {
        mkdir($logDir, 0755, true);
    }
    
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = $timestamp . " - " . $job->data['guid'] . " - Customer page created\n";
    
    file_put_contents($processedFile, $logEntry, FILE_APPEND | LOCK_EX);
}

?>