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
$success = '';

// Check if form is submitted
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $username = $_POST['username'];
    $email = $_POST['email'];

    // Prepare and bind
    $stmt = $conn->prepare("SELECT id FROM users WHERE username = ? AND email = ?");
    $stmt->bind_param("ss", $username, $email);

    // Execute the query
    $stmt->execute();
    $stmt->store_result();

    // Check if user exists
    if ($stmt->num_rows > 0) {
        // Generate recovery code
        $recovery_code = bin2hex(random_bytes(16));

        // Update the user with the recovery code
        $stmt = $conn->prepare("UPDATE users SET recovery_code = ? WHERE username = ? AND email = ?");
        $stmt->bind_param("sss", $recovery_code, $username, $email);
        $stmt->execute();

        // Send email with the recovery code (for simplicity, we'll just print it)
        // In a real application, use mail() function to send the email
        $success = "A recovery code has been sent to your email. Code: $recovery_code";
    } else {
        $error = "No account found with that username and email.";
    }

    $stmt->close();
}

$conn->close();
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <title>Account Recovery</title>
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
            <form class="login100-form validate-form" method="POST" action="recovery.php">
                <span class="login100-form-title">
                    Account Recovery
                </span>

                <?php if (!empty($error)): ?>
                    <p style="color: red;"><?php echo $error; ?></p>
                <?php endif; ?>
                <?php if (!empty($success)): ?>
                    <p style="color: green;"><?php echo $success; ?></p>
                <?php endif; ?>

                <div class="wrap-input100 validate-input" data-validate="Valid username is required: abc">
                    <input class="input100" type="text" name="username" placeholder="Username">
                    <span class="focus-input100"></span>
                    <span class="symbol-input100">
                        <i class="fa fa-user" aria-hidden="true"></i>
                    </span>
                </div>

                <div class="wrap-input100 validate-input" data-validate="Valid email is required: ex@abc.xyz">
                    <input class="input100" type="email" name="email" placeholder="Email">
                    <span class="focus-input100"></span>
                    <span class="symbol-input100">
                        <i class="fa fa-envelope" aria-hidden="true"></i>
                    </span>
                </div>

                <div class="container-login100-form-btn">
                    <button class="login100-form-btn">
                        Recover Account
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
