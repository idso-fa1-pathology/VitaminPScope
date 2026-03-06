<?php
session_start();
include 'auth/session_timeout.php';

// Check if the user is logged in and has admin privileges
if (!isset($_SESSION['loggedin']) || $_SESSION['username'] !== 'yshokrollahi') {
    header('Location: login.php');
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

// Fetch users
$users_result = $conn->query("SELECT * FROM users");

// Fetch audit logs
$audit_logs_result = $conn->query("SELECT * FROM audit_logs");

$conn->close();
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <title>Admin Dashboard</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" type="image/png" href="images/icons/favicon.ico"/>
    <link rel="stylesheet" href="vendor/bootstrap/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
    <link rel="stylesheet" href="vendor/animate/animate.css">
    <link rel="stylesheet" href="vendor/css-hamburgers/hamburgers.min.css">
    <link rel="stylesheet" href="vendor/select2/select2.min.css">
    <link rel="stylesheet" href="css/util.css">
    <link rel="stylesheet" href="css/main.css">
    <link rel="stylesheet" href="https://cdn.datatables.net/1.11.3/css/jquery.dataTables.min.css">
    <style>
        body {
            font-family: 'Roboto', sans-serif;
        }
        .navbar {
            display: flex;
            align-items: center;
            background: linear-gradient(to right, #007bff, #6699ff);
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            padding: 10px;
            overflow: hidden;
        }

        .navbar img {
            height: 50px;
            margin-right: 20px;
        }

        .navbar ul {
            list-style-type: none;
            margin: 0;
            padding: 0;
            display: flex;
            align-items: center;
            margin-right: auto; /* Push the items to the left */
        }

        .navbar ul li {
            margin-left: 20px;
        }

        .navbar ul li a {
            color: white;
            text-decoration: none;
            font-weight: bold;
        }

        .navbar ul li a:hover {
            text-decoration: underline;
        }

        .footer {
            position: absolute;
            bottom: 20px;
            width: 100%;
            text-align: center;
            font-size: 14px;
        }

        .container {
            margin-top: 20px;
        }

        .delete-btn {
            margin: 10px 0;
        }
    </style>
</head>
<body>

<div class="navbar">
    <img src="images/logo.png" alt="Logo">
    <ul>
        <li><a href="/index.php">Home</a></li>
        <li><a href="/customers/" target="_blank">Customers</a></li>
        <li><a href="/docs/index.html" target="_blank">Documentation</a></li>
        <li><a href="logout.php">Logout</a></li>
    </ul>
</div>

<div class="container">
    <h2>Users</h2>
    <button class="btn btn-danger delete-btn" id="deleteUsers">Delete All Users</button>
    <table id="usersTable" class="table table-bordered">
        <thead>
            <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Email</th>
                <th>Failed Login Attempts</th>
                <th>Account Locked</th>
                <th>Last Login</th>
            </tr>
        </thead>
        <tbody>
            <?php while ($row = $users_result->fetch_assoc()): ?>
                <tr>
                    <td><?php echo htmlspecialchars($row['id']); ?></td>
                    <td><?php echo htmlspecialchars($row['username']); ?></td>
                    <td><?php echo htmlspecialchars($row['email']); ?></td>
                    <td><?php echo htmlspecialchars($row['failed_login_attempts']); ?></td>
                    <td><?php echo htmlspecialchars($row['account_locked']); ?></td>
                    <td><?php echo htmlspecialchars($row['last_login']); ?></td>
                </tr>
            <?php endwhile; ?>
        </tbody>
    </table>

    <h2>Audit Logs</h2>
    <button class="btn btn-danger delete-btn" id="deleteAuditLogs">Delete All Audit Logs</button>
    <table id="auditLogsTable" class="table table-bordered">
        <thead>
            <tr>
                <th>ID</th>
                <th>User ID</th>
                <th>Action</th>
                <th>IP Address</th>
                <th>Additional Info</th>
                <th>Timestamp</th>
            </tr>
        </thead>
        <tbody>
            <?php while ($row = $audit_logs_result->fetch_assoc()): ?>
                <tr>
                    <td><?php echo htmlspecialchars($row['id']); ?></td>
                    <td><?php echo htmlspecialchars($row['user_id']); ?></td>
                    <td><?php echo htmlspecialchars($row['action']); ?></td>
                    <td><?php echo htmlspecialchars($row['ip_address']); ?></td>
                    <td><?php echo htmlspecialchars($row['additional_info']); ?></td>
                    <td><?php echo htmlspecialchars($row['timestamp']); ?></td>
                </tr>
            <?php endwhile; ?>
        </tbody>
    </table>
</div>


<script src="vendor/jquery/jquery-3.2.1.min.js"></script>
<script src="vendor/bootstrap/js/popper.js"></script>
<script src="vendor/bootstrap/js/bootstrap.min.js"></script>
<script src="vendor/select2/select2.min.js"></script>
<script src="vendor/tilt/tilt.jquery.min.js"></script>
<script src="https://cdn.datatables.net/1.11.3/js/jquery.dataTables.min.js"></script>
<script>
    $(document).ready(function() {
        $('#usersTable').DataTable();
        $('#auditLogsTable').DataTable();
    });

    $('.js-tilt').tilt({
        scale: 1.1
    });

    // Delete all users
    $('#deleteUsers').on('click', function() {
        if (confirm('Are you sure you want to delete all users?')) {
            $.ajax({
                url: 'delete_data.php',
                type: 'POST',
                data: { table: 'users' },
                success: function(response) {
                    alert(response);
                    location.reload();
                }
            });
        }
    });

    // Delete all audit logs
    $('#deleteAuditLogs').on('click', function() {
        if (confirm('Are you sure you want to delete all audit logs?')) {
            $.ajax({
                url: 'delete_data.php',
                type: 'POST',
                data: { table: 'audit_logs' },
                success: function(response) {
                    alert(response);
                    location.reload();
                }
            });
        }
    });
</script>
<script src="js/main.js"></script>

</body>
</html>
