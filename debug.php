<?php
// Create a simple test file: testUpload.php
// This will help us debug what's happening

// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Log all activity
error_log("=== testUpload.php called ===");
error_log("REQUEST_METHOD: " . $_SERVER['REQUEST_METHOD']);
error_log("POST data: " . print_r($_POST, true));

// Test basic response
echo "TEST: PHP is working\n";

// Test if POST data exists
if (empty($_POST)) {
    echo "ERROR: No POST data received\n";
    error_log("ERROR: No POST data received");
} else {
    echo "SUCCESS: POST data received\n";
    error_log("SUCCESS: POST data received");
}

// Test if specific fields exist
if (isset($_POST['path'])) {
    echo "SUCCESS: path field exists\n";
    echo "Path value: " . $_POST['path'] . "\n";
    error_log("Path value: " . $_POST['path']);
} else {
    echo "ERROR: path field missing\n";
    error_log("ERROR: path field missing");
}

if (isset($_POST['isDir'])) {
    echo "SUCCESS: isDir field exists\n";
    echo "isDir value: " . $_POST['isDir'] . "\n";
    error_log("isDir value: " . $_POST['isDir']);
} else {
    echo "ERROR: isDir field missing\n";
    error_log("ERROR: isDir field missing");
}

// Test JSON decoding
if (isset($_POST['path'])) {
    $pathDecoded = json_decode($_POST['path']);
    if ($pathDecoded === null) {
        echo "ERROR: Failed to decode path JSON\n";
        echo "JSON error: " . json_last_error_msg() . "\n";
        error_log("JSON decode error: " . json_last_error_msg());
    } else {
        echo "SUCCESS: JSON decoded\n";
        echo "Decoded path: " . print_r($pathDecoded, true) . "\n";
        error_log("Decoded path: " . print_r($pathDecoded, true));
    }
}

// Test include files (without actually including them)
$issueProjectFile = __DIR__ . '/issueProject.php';
if (file_exists($issueProjectFile)) {
    echo "SUCCESS: issueProject.php file exists\n";
    error_log("SUCCESS: issueProject.php exists at: " . $issueProjectFile);
} else {
    echo "ERROR: issueProject.php file missing\n";
    error_log("ERROR: issueProject.php missing at: " . $issueProjectFile);
}

// Simple JSON response test
$testResponse = array(
    "test" => "success",
    "timestamp" => date('Y-m-d H:i:s'),
    "post_data" => $_POST
);

echo "\nJSON Response Test:\n";
echo json_encode($testResponse);

error_log("=== testUpload.php complete ===");
?>