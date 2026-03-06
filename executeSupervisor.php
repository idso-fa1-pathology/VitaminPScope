<?php
/*
 Desc: Executes the supervisor 1 time with enhanced error handling
 Author: Sebastian Schmittner
 Date: 2014.09.02 23:24:39 (+02:00)
 Last Author: Sebastian Schmittner
 Last Date: 2015.01.31 09:19:57 (+01:00)
 Version: 0.0.2
*/

require_once __DIR__ . '/polyzoomerGlobals.php';
require_once __DIR__ . '/taskSupervisor.php';

// Enhanced error handling
try {
    // Check if job file exists, create if missing
    $jobFile = jobFile();
    if (!file_exists($jobFile)) {
        error_log("Creating missing job file: " . $jobFile);
        touch($jobFile);
        chmod($jobFile, 0666);
    }
    
    // Create supervisor with null check
    $supervisor = new TaskSupervisor($jobFile);
    
    if ($supervisor === null) {
        throw new Exception("Failed to create TaskSupervisor");
    }
    
    // Run update with error handling
    $supervisor->update();
    
    error_log("Supervisor cycle completed successfully");
    
} catch (Exception $e) {
    error_log("Supervisor error: " . $e->getMessage());
    error_log("Supervisor trace: " . $e->getTraceAsString());
    
    // Try to continue despite errors
    sleep(5);
    
} catch (Error $e) {
    error_log("Supervisor fatal error: " . $e->getMessage());
    error_log("Supervisor trace: " . $e->getTraceAsString());
    
    sleep(10);
}

?>