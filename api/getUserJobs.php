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
    // First get all jobs from the main status endpoint
    $statusResponse = file_get_contents('http://localhost/getProjectStatus.php', false, stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => [
                'Content-Type: application/json',
                'Cookie: ' . $_SERVER['HTTP_COOKIE'] // Forward session cookies
            ]
        ]
    ]));
    
    if ($statusResponse === false) {
        throw new Exception('Failed to fetch job status');
    }
    
    $statusData = json_decode($statusResponse, true);
    
    if (!$statusData || !isset($statusData['valid']) || !$statusData['valid']) {
        throw new Exception('Invalid status response');
    }
    
    $allJobs = $statusData['jobs'] ?? [];
    $userJobs = [];
    $activeJobs = [];
    
    // Filter jobs for current user and count active jobs
    foreach ($allJobs as $jobWrapper) {
        $job = $jobWrapper['data'] ?? $jobWrapper;
        
        // Determine if job is active (not completed)
        $status = $job['status'] ?? 'unknown';
        $isActive = !in_array($status, ['finished', 'completed', 'failed', 'error']);
        
        if ($isActive) {
            $activeJobs[] = $jobWrapper;
        }
        
        // Check if this job belongs to the current user
        $belongsToUser = false;
        
        // Method 1: Check origFilename path
        if (isset($job['origFilename']) && strpos($job['origFilename'], "/Users/{$username}/") !== false) {
            $belongsToUser = true;
        }
        
        // Method 2: Check username field
        if (isset($job['username']) && $job['username'] === $username) {
            $belongsToUser = true;
        }
        
        // Method 3: Check other path fields
        $pathFields = ['origFilename', 'path', 'filePath', 'inputPath'];
        foreach ($pathFields as $field) {
            if (isset($job[$field]) && is_string($job[$field])) {
                if (strpos($job[$field], "/{$username}/") !== false ||
                    strpos($job[$field], "Users/{$username}/") !== false ||
                    strpos($job[$field], "{$username}-") !== false) {
                    $belongsToUser = true;
                    break;
                }
            }
        }
        
        if ($belongsToUser) {
            // Add user context to the job
            $job['belongsToUser'] = true;
            $job['detectedUser'] = $username;
            $job['isActive'] = $isActive;
            $userJobs[] = ['data' => $job];
        }
    }
    
    // Return the filtered result
    echo json_encode([
        'valid' => true,
        'totalJobs' => count($allJobs),
        'activeJobs' => count($activeJobs),
        'userJobs' => count($userJobs),
        'jobs' => $userJobs,
        'allJobs' => $activeJobs, // Only active jobs from all users
        'username' => $username,
        'success' => true
    ]);
    
} catch (Exception $e) {
    error_log("getUserJobs error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'valid' => false,
        'error' => $e->getMessage(),
        'success' => false
    ]);
}
?>
