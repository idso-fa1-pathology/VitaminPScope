<?php
header('Content-Type: application/json');

function logMessage($message) {
    error_log(date('[Y-m-d H:i:s] ') . $message . "\n", 3, '/var/log/cleanup_jobs.log');
}

function cleanupJobs($ageThresholdHours = 24) {
    $jobsDir = '/var/www/jobs';
    $deletedFiles = [];
    $keptFiles = [];
    $errors = [];

    if (!is_dir($jobsDir)) {
        return ['status' => 'error', 'message' => "Jobs directory not found: $jobsDir"];
    }

    $ageThresholdSeconds = $ageThresholdHours * 3600;
    $files = new DirectoryIterator($jobsDir);
    $fileCount = 0;
    foreach ($files as $file) {
        if ($file->isFile() && !$file->isDot()) {
            $fileCount++;
            $filePath = $file->getPathname();
            $fileAge = time() - $file->getCTime();
            $fileAgeHours = round($fileAge / 3600, 2);
            if ($fileAge > $ageThresholdSeconds) {
                if (unlink($filePath)) {
                    $deletedFiles[] = [
                        'path' => $filePath,
                        'age' => $fileAgeHours
                    ];
                } else {
                    $errors[] = "Failed to delete: $filePath";
                }
            } else {
                $keptFiles[] = [
                    'path' => $filePath,
                    'age' => $fileAgeHours
                ];
            }
        }
    }

    $result = [
        'status' => 'success',
        'message' => 'Job cleanup completed',
        'directoryPath' => $jobsDir,
        'totalFiles' => $fileCount,
        'ageThreshold' => $ageThresholdHours,
        'deletedFiles' => $deletedFiles,
        'keptFiles' => $keptFiles,
        'errors' => $errors
    ];

    if (!empty($errors)) {
        $result['status'] = 'partial';
        $result['message'] = 'Some files could not be deleted.';
    } elseif (empty($deletedFiles) && empty($keptFiles)) {
        $result['message'] = 'No files found in the jobs directory';
    }

    return $result;
}

try {
    logMessage("Cleanup process started");
    
    session_start();
    if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
        throw new Exception("Unauthorized access");
    }

    $ageThreshold = isset($_POST['ageThreshold']) ? intval($_POST['ageThreshold']) : 24;
    $result = cleanupJobs($ageThreshold);
    logMessage("Cleanup result: " . json_encode($result));
    echo json_encode($result);

} catch (Exception $e) {
    logMessage("Error: " . $e->getMessage());
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
?>