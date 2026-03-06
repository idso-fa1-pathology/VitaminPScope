<?php
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
echo "Connected successfully";
?>
