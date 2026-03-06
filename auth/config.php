<?php
// Prevent caching
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");
header("Expires: 0");

// LDAP configuration
define('LDAP_SERVER', 'ldaps://LDAP.MDANDERSON.EDU');
define('LDAP_ADMIN_USER', 'Polyscope'); // Replace with your actual admin login ID
define('LDAP_ADMIN_PASS', 'bvAD67wYEW5w5LZ'); // Replace with your actual admin password
define('LDAP_SEARCH_BASE', 'OU=People,DC=mdanderson,DC=edu');

// Database configuration
define('DB_SERVER', 'localhost');
define('DB_USERNAME', 'root');
define('DB_PASSWORD', 'newpassword'); // Replace with your actual database password
define('DB_NAME', 'polyscope');

// Prevent direct file access
if (basename($_SERVER['SCRIPT_FILENAME']) === basename(__FILE__)) {
    header('HTTP/1.0 403 Forbidden');
    exit('Access denied');
}

// Create database connection
try {
    $conn = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_NAME);
    
    // Check connection
    if ($conn->connect_error) {
        error_log("Connection failed: " . $conn->connect_error);
        die("Connection failed");
    }
    
    // Set charset
    $conn->set_charset("utf8mb4");
    
} catch (Exception $e) {
    error_log("Database error: " . $e->getMessage());
    die("Connection failed");
}
?>