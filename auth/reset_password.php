<?php
session_start();

if (!isset($_SESSION['recovery_username'])) {
    header('Location: recovery.php');
    exit;
}

$servername = "localhost";
$username = "root";
$password = "newpassword";
$dbname = "polyscope";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

$error = '';

// Check if form is submitted
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $new_password = $_POST['new_password'];
    $repeat_password = $_POST['repeat_password'];

    // Check if passwords match
    if ($new_password !== $repeat_password) {
        $error = "Passwords do not match.";
    } else {
        // Hash the new password
        $hashed_password = password_hash($new_password, PASSWORD_DEFAULT);

        // Update the user's password
        $stmt = $conn->prepare("UPDATE users SET password = ?, recovery_code = NULL WHERE username = ?");
        $stmt->bind_param("ss", $hashed_password, $_SESSION['recovery_username']);

        if ($stmt->execute()) {
            // Password updated, clear the recovery session
            unset($_SESSION['recovery_username']);
            $_SESSION['loggedin'] = true;
            $_SESSION['username'] = $_POST['username'];
            header('Location: /index.php'); // Redirect to the main index page
            exit;
        } else {
            $error = "Error updating password.";
        }

        $stmt->close();
    }
}

$conn->close();
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <title>Reset Password</title>
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
    </style>
</head>
<body>

<div class="navbar">
    <img src="images/logo.png" alt="Logo">
    <ul>
        <li><a href="/index.php">Home</a></li>
        <li><a href="/customers/" target="_blank">Customers</a></li>
        <li><a href="/docs/index.html" target="_blank">Documentation</a></li>
        <li><a href="#">Contact</a></li>
    </ul>
</div>

<div class="limiter">
    <div class="container-login100">
        <div class="wrap-login100">
            <form class="login100-form validate-form" method="POST" action="reset_password.php">
                <span class="login100-form-title">
                    Reset Password
                </span>

                <?php if (!empty($error)): ?>
                    <p style="color: red;"><?php echo $error; ?></p>
                <?php endif; ?>

                <div class="wrap-input100 validate-input" data-validate="Password is required">
                    <input class="input100" type="password" name="new_password" placeholder="New Password">
                    <span class="focus-input100"></span>
                    <span class="symbol-input100">
                        <i class="fa fa-lock" aria-hidden="true"></i>
                    </span>
                </div>

                <div class="wrap-input100 validate-input" data-validate="Password is required">
                    <input class="input100" type="password" name="repeat_password" placeholder="Repeat Password">
                    <span class="focus-input100"></span>
                    <span class="symbol-input100">
                        <i class="fa fa-lock" aria-hidden="true"></i>
                    </span>
                </div>

                <div class="container-login100-form-btn">
                    <button class="login100-form-btn">
                        Reset Password
                    </button>
                </div>
            </form>
        </div>
    </div>
</div>

<div class="footer">
    Developed by Yinyin Yuan Lab @ 2024
</div>

<script src="vendor/jquery/jquery-3.2.1.min.js"></script>
<script src="vendor/bootstrap/js/popper.js"></script>
<script src="vendor/bootstrap/js/bootstrap.min.js"></script>
<script src="vendor/select2/select2.min.js"></script>
<script src="vendor/tilt/tilt.jquery.min.js"></script>
<script>
    $('.js-tilt').tilt({
        scale: 1.1
    })
</script>
<script src="js/main.js"></script>

</body>
</html>
