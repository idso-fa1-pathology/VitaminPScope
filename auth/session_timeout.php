<?php
session_start();

// Define the session timeout duration (in seconds)
define('SESSION_TIMEOUT', 2700); // 45 minutes for testing
 
// Check if the last activity session variable is set
if (isset($_SESSION['LAST_ACTIVITY'])) {
    // Calculate the session's lifetime
    $session_life = time() - $_SESSION['LAST_ACTIVITY'];

    // Check if the session has expired
    if ($session_life > SESSION_TIMEOUT) {
        // Destroy the session and redirect to the login page with a timeout message
        session_unset();
        session_destroy();
        header("Location: /auth/login.php?message=Session expired due to inactivity. Please log in again.");
        exit;
    }
}

// Update the last activity time
$_SESSION['LAST_ACTIVITY'] = time();
?>

