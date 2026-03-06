<?php
session_start();

// Security headers to prevent XSS and other attacks
header("X-Frame-Options: DENY");
header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';");
header("X-Content-Type-Options: nosniff");
header("X-XSS-Protection: 1; mode=block");

$servername = "localhost";
$username = "root";
$password = "newpassword";
$dbname = "polyscope";

// Sanitization function for input
function sanitizeInput($data) {
    $data = trim($data);
    $data = stripslashes($data);
    $data = htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
    return $data;
}

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

$error = '';

// Check if form is submitted
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Sanitize all inputs
    $username = sanitizeInput($_POST['username'] ?? '');
    $email = filter_var($_POST['email'] ?? '', FILTER_SANITIZE_EMAIL);
    $password = $_POST['password'] ?? '';
    $repeat_password = $_POST['repeat_password'] ?? '';

    // Validate inputs
    if (empty($username) || empty($email) || empty($password) || empty($repeat_password)) {
        $error = "All fields are required.";
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = "Invalid email format.";
    } elseif (!preg_match('/^[a-zA-Z0-9_-]{3,20}$/', $username)) {
        $error = "Username must be 3-20 characters and contain only letters, numbers, underscore, and hyphen.";
    } elseif ($password !== $repeat_password) {
        $error = "Passwords do not match.";
    } else {
        // Prepare and bind with error handling
        try {
            $stmt = $conn->prepare("SELECT id FROM users WHERE username = ?");
            if (!$stmt) {
                throw new Exception($conn->error);
            }
            
            $stmt->bind_param("s", $username);
            
            // Execute the query
            if (!$stmt->execute()) {
                throw new Exception($stmt->error);
            }
            
            $stmt->store_result();

            // Check if user exists
            if ($stmt->num_rows > 0) {
                $error = "Username already taken.";
            } else {
                // Hash the password
                $hashed_password = password_hash($password, PASSWORD_DEFAULT);
                $stmt->close();

                // Insert the new user
                $stmt = $conn->prepare("INSERT INTO users (username, email, password) VALUES (?, ?, ?)");
                if (!$stmt) {
                    throw new Exception($conn->error);
                }

                $stmt->bind_param("sss", $username, $email, $hashed_password);

                if ($stmt->execute()) {
                    // Create a folder for the new user inside /media/Users
                    $user_folder = "/media/Users/" . $username;
                    if (!file_exists($user_folder)) {
                        if (!mkdir($user_folder, 0750, true)) {
                            error_log("Failed to create user directory for: " . $username);
                        }
                    }

                    // Regenerate session ID to prevent session fixation
                    session_regenerate_id(true);
                    $_SESSION['loggedin'] = true;
                    $_SESSION['username'] = $username;
                    
                    // Set session cookie parameters
                    $secure = true; // Only transmit over HTTPS
                    $httponly = true; // Prevent JavaScript access
                    session_set_cookie_params([
                        'lifetime' => 3600,
                        'path' => '/',
                        'secure' => $secure,
                        'httponly' => $httponly,
                        'samesite' => 'Strict'
                    ]);
                    
                    header('Location: /index.php');
                    exit();
                } else {
                    throw new Exception($stmt->error);
                }
            }
            $stmt->close();
        } catch (Exception $e) {
            $error = "Error creating account. Please try again.";
            error_log("Error in signup: " . $e->getMessage());
        }
    }
}

$conn->close();
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <title>Sign Up</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <!-- Add CSP meta tag -->
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'">
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
                <div class="login100-pic js-tilt" data-tilt>
                    <img src="images/img-01.png" alt="IMG">
                </div>

                <form class="login100-form validate-form" method="POST" action="<?php echo htmlspecialchars($_SERVER['PHP_SELF']); ?>">
                    <span class="login100-form-title">
                        Create Your Account
                    </span>

                    <?php if (!empty($error)): ?>
                        <p style="color: red;"><?php echo htmlspecialchars($error); ?></p>
                    <?php endif; ?>

                    <div class="wrap-input100 validate-input" data-validate="Valid username is required">
                            <input class="input100" type="text" name="username" 
                                pattern="[a-zA-Z0-9_\-]{3,20}"
                                title="Username must be 3-20 characters and contain only letters, numbers, underscore, and hyphen"
                                value="<?php echo isset($_POST['username']) ? htmlspecialchars($_POST['username']) : ''; ?>"
                                placeholder="Username">
                        <span class="focus-input100"></span>
                        <span class="symbol-input100">
                            <i class="fa fa-user" aria-hidden="true"></i>
                        </span>
                    </div>

                    <div class="wrap-input100 validate-input" data-validate="Valid email is required">
                        <input class="input100" type="email" name="email" 
                               value="<?php echo isset($_POST['email']) ? htmlspecialchars($_POST['email']) : ''; ?>"
                               placeholder="Email">
                        <span class="focus-input100"></span>
                        <span class="symbol-input100">
                            <i class="fa fa-envelope" aria-hidden="true"></i>
                        </span>
                    </div>

                    <div class="wrap-input100 validate-input" data-validate="Password is required">
                        <input class="input100" type="password" name="password" 
                               pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}"
                               title="Must contain at least one number, one uppercase and lowercase letter, one special character, and at least 8 characters"
                               placeholder="Password">
                        <span class="focus-input100"></span>
                        <span class="symbol-input100">
                            <i class="fa fa-lock" aria-hidden="true"></i>
                        </span>
                    </div>

                    <div class="wrap-input100 validate-input" data-validate="Repeat password is required">
                        <input class="input100" type="password" name="repeat_password" placeholder="Repeat Password">
                        <span class="focus-input100"></span>
                        <span class="symbol-input100">
                            <i class="fa fa-lock" aria-hidden="true"></i>
                        </span>
                    </div>

                    <div class="container-login100-form-btn">
                        <button class="login100-form-btn">
                            Sign Up
                        </button>
                    </div>

                    <div class="text-center p-t-12">
                        <span class="txt1">
                            Already have an account?
                        </span>
                        <a class="txt2" href="login.php">
                            Login here
                        </a>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <div class="footer">
        Developed by Yinyin Yuan Lab @ 2024
    </div>

    <!-- Your existing scripts -->
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
