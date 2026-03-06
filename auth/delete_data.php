<?php
session_start();
include 'auth/session_timeout.php';

// Check if the user is logged in and has admin privileges
if (!isset($_SESSION['loggedin']) || $_SESSION['username'] !== 'admin') {
    echo "Access denied.";
    exit;
}

$servername = "localhost";
$username = "root";
$password = "newpassword";  // Make sure this matches your root password
$dbname = "polyscope";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['table'])) {
    $table = $_POST['table'];

    if (in_array($table, ['users', 'audit_logs'])) {
        $sql = "DELETE FROM $table";
        if ($conn->query($sql) === TRUE) {
            echo ucfirst($table) . " table data deleted successfully.";
        } else {
            echo "Error deleting data: " . $conn->error;
        }
    } else {
        echo "Invalid table.";
    }
} else {
    echo "Invalid request.";
}

$conn->close();
?>
