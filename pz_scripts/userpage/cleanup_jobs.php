<?php
session_start();

// Only allow authenticated users
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    header('HTTP/1.1 403 Forbidden');
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
    exit;
}

// Directory where job files are stored
$jobs_dir = '/var/www/jobs';

// Remove all job files
array_map('unlink', glob("$jobs_dir/*.job"));

echo json_encode(['status' => 'success', 'message' => 'All stuck jobs have been cleaned up.']);
?>
