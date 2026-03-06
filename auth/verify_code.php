<?php
session_start();

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
    $username = $_POST['username'];
    $recovery_code = $_POST['recovery_code'];

    // Prepare and bind
    $stmt = $conn->prepare("SELECT id FROM users WHERE username = ? AND recovery_code = ?");
    $stmt->bind_param("ss", $username, $recovery_code);

    // Execute the query
    $stmt->execute();
    $stmt->store_result();

    // Check if recovery code is valid
    if ($stmt->num_rows > 0) {
        $_SESSION['recovery_username'] = $username;
        header('Location: reset_password.php'); // Redirect to the reset password page
        exit;
    } else {
        $error = "Invalid recovery code.";
    }

    $stmt->close();
}

$conn->close();
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <title>Verify Recovery Code</title>
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
            <form class="login100-form validate-form" method="POST" action="verify_code.php">
                <span class="login100-form-title">
                    Verify Recovery Code
                </span>

                <?php if (!empty($error)): ?>
                    <p style="color: red;"><?php echo $error; ?></p>
                <?php endif; ?>

                <div class="wrap-input100 validate-input" data-validate="Valid username is required: abc">
                    <input class="input100" type="text" name="username" placeholder="Username">
                    <span class="focus-input100"></span>
                    <span class="symbol-input100">
                        <i class="fa fa-user" aria-hidden="true"></i>
                    </span>
                </div>

                <div class="wrap-input100 validate-input" data-validate="Recovery code is required">
                    <input class="input100" type="text" name="recovery_code" placeholder="Recovery Code">
                    <span class="focus-input100"></span>
                    <span class="symbol-input100">
                        <i class="fa fa-lock" aria-hidden="true"></i>
                    </span>
                </div>

                <div class="container-login100-form-btn">
                    <button class="login100-form-btn">
                        Verify Code
                    </button>
                </div>

                <div class="text-center p-t-12">
                    <span class="txt1">
                        Remember your password?
                    </span>
                    <a class="txt2" href="login.php">
                        Login here
                    </a>
                </div>

                <div class="text-center p-t-136">
                    <a class="txt2" href="signup.php">
                        Create your Account
                        <i class="fa fa-long-arrow-right m-l-5" aria-hidden="true"></i>
                    </a>
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
