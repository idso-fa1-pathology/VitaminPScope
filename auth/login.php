<?php
session_start();
require 'ldap_functions.php';
require 'db_functions.php';

// Current nonce generation remains the same
$nonce = base64_encode(random_bytes(16));
$_SESSION['csp_nonce'] = $nonce;

// Final updated CSP header with proper backward compatibility
header("Content-Security-Policy: ".
    "default-src 'self'; ".
    "style-src 'self' 'nonce-{$nonce}' https://cdnjs.cloudflare.com; ".
    "script-src 'unsafe-inline' 'strict-dynamic' 'nonce-{$nonce}' https: http:; ".
    "frame-src 'none'; ".
    "frame-ancestors 'none'; ".
    "form-action 'self'; ".
    "base-uri 'self'; ".
    "require-trusted-types-for 'script'; ".
    "object-src 'none'; ".
    "img-src 'self' data:; ".
    "font-src 'self' https://cdnjs.cloudflare.com;"
);
header("X-Content-Type-Options: nosniff");
header("X-XSS-Protection: 1; mode=block");
header("Strict-Transport-Security: max-age=31536000; includeSubDomains; preload");
header("Referrer-Policy: strict-origin-when-cross-origin");
header("Permissions-Policy: geolocation=(), camera=(), microphone=()");
header("Cross-Origin-Embedder-Policy: require-corp");
header("Cross-Origin-Opener-Policy: same-origin");
header("Cross-Origin-Resource-Policy: same-origin");

// Regenerate session ID to prevent session fixation
if (!isset($_SESSION['initiated'])) {
    session_regenerate_id(true);
    $_SESSION['initiated'] = true;
}

$error = '';

// Check if the user is already logged in
if (isset($_SESSION['loggedin']) && $_SESSION['loggedin'] === true) {
    header('Location: /index.php');
    exit;
}

// Check if form is submitted
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $username = filter_input(INPUT_POST, 'username', FILTER_SANITIZE_STRING);
    // convert to lowercase
    $username = strtolower($username);
    $password = $_POST['password'];
    $ip_address = $_SERVER['REMOTE_ADDR'];
    $additional_info = json_encode(['user_agent' => $_SERVER['HTTP_USER_AGENT']]);

    // Implement basic password policy check
    if (strlen($password) < 8) {
        $error = "Password must be at least 8 characters long";
        log_audit(null, "Login failure - Weak password", $ip_address, $additional_info);
    } else {
        // First, try LDAP authentication
        $user_dn = find_user_dn($username);
        if ($user_dn && verify_password($user_dn, $password)) {
            // LDAP authentication successful
            $job_title = get_user_job_title($username); // NEW: Add this line
            session_regenerate_id(true);
            $_SESSION['loggedin'] = true;
            $_SESSION['username'] = $username;
            $_SESSION['job_title'] = $job_title; // NEW: Add this line
            $_SESSION['last_activity'] = time();

            // Check if the user exists in the local database
            $stmt = $conn->prepare("SELECT id FROM users WHERE username = ?");
            $stmt->bind_param("s", $username);
            $stmt->execute();
            $stmt->store_result();

            if ($stmt->num_rows == 0) {
                $stmt->close();
                create_db_user($username, $password);
                $stmt = $conn->prepare("SELECT id FROM users WHERE username = ?");
                $stmt->bind_param("s", $username);
                $stmt->execute();
                $stmt->bind_result($user_id);
                $stmt->fetch();
            } else {
                $stmt->bind_result($user_id);
                $stmt->fetch();
            }
            $stmt->close();

            // Create a folder for the new user if it doesn't exist
            $user_folder = "/media/Users/" . strtolower($username);
            if (!file_exists($user_folder)) {
                mkdir($user_folder, 0700, true);
            }

            log_audit($user_id, "Login success", $ip_address, $additional_info);
            header('Location: /index.php');
            exit;
        }

        // If LDAP authentication fails, try local database authentication
        $db_auth = authenticate_db_user($username, $password);
        if ($db_auth['status']) {
            session_regenerate_id(true);
            $_SESSION['loggedin'] = true;
            $_SESSION['username'] = $username;
            $_SESSION['last_activity'] = time();

            $user_folder = "/media/Users/" . strtolower($username);
            if (!file_exists($user_folder)) {
                mkdir($user_folder, 0700, true);
            }

            log_audit($db_auth['id'], "Login success", $ip_address, $additional_info);
            header('Location: /index.php');
            exit;
        } else {
            $error = $db_auth['message'];
            log_audit(null, "Login failure - " . $error, $ip_address, $additional_info);
        }
    }
}

// Set secure cookie parameters
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'domain' => '',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Strict'
]);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Login - Polyscope</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" type="image/png" href="images/icons/favicon.ico"/>
    <link rel="stylesheet" href="vendor/bootstrap/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
    <link rel="stylesheet" href="vendor/animate/animate.css">
    <link rel="stylesheet" href="vendor/css-hamburgers/hamburgers.min.css">
    <link rel="stylesheet" href="vendor/select2/select2.min.css">
    <link rel="stylesheet" href="css/util.css">
    
    <style nonce="<?php echo htmlspecialchars($nonce); ?>">
        /* Modern variables matching main app */
        :root {
            --primary-color: #2563eb;
            --primary-hover: #1d4ed8;
            --primary-light: #dbeafe;
            --success-color: #059669;
            --error-color: #dc2626;
            --error-light: #fee2e2;
            --bg-primary: #ffffff;
            --bg-secondary: #f8fafc;
            --text-primary: #1e293b;
            --text-secondary: #64748b;
            --text-muted: #94a3b8;
            --border-color: #e2e8f0;
            --border-radius: 12px;
            --border-radius-sm: 8px;
            --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -1px rgb(0 0 0 / 0.06);
            --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -2px rgb(0 0 0 / 0.05);
            --space-4: 1rem;
            --space-6: 1.5rem;
        }

        * { 
            box-sizing: border-box; 
            margin: 0; 
            padding: 0; 
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            color: var(--text-primary);
            line-height: 1.6;
            min-height: 100vh;
            position: relative;
        }

        /* Subtle animated background pattern */
        body::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="1.5" fill="rgba(100,116,139,0.1)"/></pattern></defs><rect width="100" height="100" fill="url(%23dots)"/></svg>');
            animation: float 30s ease-in-out infinite;
        }

        @keyframes float {
            0%, 100% { opacity: 0.3; transform: translateY(0px); }
            50% { opacity: 0.5; transform: translateY(-10px); }
        }

        /* Modern header matching main app */
        .app-header {
            background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-hover) 100%);
            color: white;
            padding: var(--space-6) 0;
            box-shadow: var(--shadow-lg);
            position: relative;
            z-index: 1000;
        }

        .header-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            max-width: 1400px;
            margin: 0 auto;
            padding: 0 var(--space-6);
        }

        .app-title {
            display: flex;
            align-items: center;
            gap: var(--space-4);
            font-size: 1.75rem;
            font-weight: 700;
            letter-spacing: -0.025em;
        }

        .app-logo {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .logo-image {
            height: 48px;
            width: auto;
            max-width: 200px;
            object-fit: contain;
            filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
        }

        .app-title-text {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
        }

        .app-title-main {
            font-size: 1.75rem;
            font-weight: 700;
            letter-spacing: -0.025em;
        }

        .app-title-sub {
            font-size: 0.875rem;
            opacity: 0.9;
            font-weight: 400;
        }

        .header-nav {
            display: flex;
            gap: var(--space-6);
        }

        .header-nav a {
            color: white;
            text-decoration: none;
            font-weight: 500;
            padding: 0.5rem 1rem;
            border-radius: var(--border-radius-sm);
            transition: all 0.2s;
            background: rgba(255, 255, 255, 0.1);
        }

        .header-nav a:hover {
            background: rgba(255, 255, 255, 0.2);
            text-decoration: none;
        }

        /* Modern login container */
        .login-container {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: calc(100vh - 120px);
            padding: var(--space-6);
            position: relative;
            z-index: 1;
        }

        .login-card {
            background: var(--bg-primary);
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-lg);
            overflow: hidden;
            width: 100%;
            max-width: 900px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            min-height: 600px;
            position: relative;
        }

        .login-card::before {
            content: '';
            position: absolute;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
            background: conic-gradient(from 0deg, 
                var(--primary-color), 
                #7c3aed, 
                var(--success-color), 
                var(--primary-color));
            border-radius: calc(var(--border-radius) + 2px);
            z-index: -1;
            animation: rotate 4s linear infinite;
        }

        @keyframes rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        .login-image {
            background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: var(--space-6);
            position: relative;
            overflow: hidden;
        }

        .login-image::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(37, 99, 235, 0.05) 0%, transparent 70%);
            animation: pulse 4s ease-in-out infinite;
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.1); opacity: 0.8; }
        }

        .feature-text {
            position: relative;
            z-index: 2;
            text-align: center;
            padding: 2rem;
            max-width: 400px;
        }

        .feature-text h2 {
            font-size: 2.5rem;
            font-weight: 800;
            background: linear-gradient(135deg, var(--primary-color), #7c3aed);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 1rem;
            line-height: 1.2;
            opacity: 0;
            animation: typeIn 1s ease-out 0.5s forwards;
        }

        .feature-text p {
            font-size: 1.1rem;
            color: var(--text-secondary);
            font-weight: 500;
            line-height: 1.8;
            margin-bottom: 1.5rem;
        }

        .typing-line {
            opacity: 0;
            border-right: 2px solid var(--primary-color);
            white-space: nowrap;
            overflow: hidden;
            margin: 0.5rem 0;
        }

        .typing-line.bold {
            font-weight: 700;
            color: var(--text-primary);
        }

        .typing-line.italic {
            font-style: italic;
            color: var(--primary-color);
            font-weight: 600;
        }

        .typing-line:nth-child(1) { animation: typewriter 1s steps(25) 1.5s forwards, blink 0.5s step-end 2.5s forwards; }
        .typing-line:nth-child(2) { animation: typewriter 1s steps(20) 2.8s forwards, blink 0.5s step-end 3.8s forwards; }
        .typing-line:nth-child(3) { animation: typewriter 1s steps(18) 4.1s forwards, blink 0.5s step-end 5.1s forwards; }
        .typing-line:nth-child(4) { animation: typewriter 1.2s steps(35) 5.4s forwards, blink 0.5s step-end 6.6s forwards; }

        @keyframes typeIn {
            to { opacity: 1; }
        }

        @keyframes typewriter {
            to { 
                opacity: 1;
                width: 100%; 
            }
        }

        @keyframes blink {
            to { border-right: none; }
        }

        .feature-icons {
            display: flex;
            justify-content: center;
            gap: 1rem;
            margin-top: 1.5rem;
            opacity: 0;
            animation: fadeIn 0.8s ease-out 7s forwards;
        }

        .feature-icon {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, var(--primary-color), #7c3aed);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 1.2rem;
            animation: bounce 2s ease-in-out infinite;
        }

        .feature-icon:nth-child(2) {
            animation-delay: 0.2s;
        }

        .feature-icon:nth-child(3) {
            animation-delay: 0.4s;
        }

        .feature-icon:nth-child(4) {
            animation-delay: 0.6s;
        }

        @keyframes bounce {
            0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-8px); }
            60% { transform: translateY(-4px); }
        }

        .lab-credit {
            margin-top: 2rem;
            font-size: 0.85rem;
            color: var(--text-muted);
            font-weight: 500;
            opacity: 0;
            animation: fadeIn 0.8s ease-out 7.5s forwards;
        }

        @keyframes fadeIn {
            to { opacity: 1; }
        }

        .login-image img {
            max-width: 100%;
            height: auto;
            border-radius: var(--border-radius-sm);
            filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
            position: relative;
            z-index: 1;
        }

        .login-form-container {
            padding: 3rem 2.5rem;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .login-title {
            font-size: 2rem;
            font-weight: 700;
            color: var(--text-primary);
            text-align: center;
            margin-bottom: 0.5rem;
        }

        .login-subtitle {
            color: var(--text-secondary);
            text-align: center;
            margin-bottom: 2rem;
            font-size: 0.95rem;
        }


        /* MD Anderson Credentials Info Box */
        .info-message {
            background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%);
            border: 1px solid #93c5fd;
            border-radius: var(--border-radius-sm);
            padding: 1rem;
            margin-bottom: 1.5rem;
            position: relative;
            overflow: hidden;
        }

        .info-message::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 4px;
            height: 100%;
            background: linear-gradient(180deg, var(--primary-color) 0%, #3b82f6 100%);
        }

        .info-title {
            display: block;
            font-weight: 600;
            color: var(--primary-color);
            font-size: 0.9rem;
            margin-bottom: 0.5rem;
            padding-left: 0.5rem;
        }

        .info-text {
            display: block;
            color: #1e40af;
            font-size: 0.85rem;
            line-height: 1.5;
            padding-left: 0.5rem;
        }

        /* Privacy Notice Box */
        .privacy-notice {
            background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
            border: 1px solid #86efac;
            border-radius: var(--border-radius-sm);
            padding: 1rem;
            margin-top: 1rem;
            position: relative;
            overflow: hidden;
            font-size: 0.8rem;
            line-height: 1.5;
        }

        .privacy-notice::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 4px;
            height: 100%;
            background: linear-gradient(180deg, var(--success-color) 0%, #10b981 100%);
        }

        .privacy-title {
            display: block;
            font-weight: 600;
            color: var(--success-color);
            font-size: 0.85rem;
            margin-bottom: 0.5rem;
            padding-left: 0.5rem;
        }

        .privacy-notice {
            color: #065f46;
            padding-left: 0.5rem;
        }

        /* Hover effects */
        .info-message:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
            transition: all 0.3s ease;
        }

        .privacy-notice:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(5, 150, 105, 0.15);
            transition: all 0.3s ease;
        }

        /* Mobile responsiveness */
        @media (max-width: 480px) {
            .info-message,
            .privacy-notice {
                padding: 0.75rem;
                font-size: 0.8rem;
            }
            
            .info-title,
            .privacy-title {
                font-size: 0.8rem;
            }
            
            .info-text {
                font-size: 0.75rem;
            }
        }


        /* Error message styling */
        .error-message {
            background: var(--error-light);
            color: var(--error-color);
            padding: 0.75rem 1rem;
            border-radius: var(--border-radius-sm);
            border: 1px solid #fecaca;
            margin-bottom: 1.5rem;
            font-size: 0.875rem;
            text-align: center;
        }

        /* Modern form inputs */
        .form-group {
            margin-bottom: 1.5rem;
            position: relative;
        }

        .form-input {
            width: 100%;
            padding: 1rem 1rem 1rem 3rem;
            border: 2px solid var(--border-color);
            border-radius: var(--border-radius-sm);
            font-size: 1rem;
            background: var(--bg-primary);
            color: var(--text-primary);
            transition: all 0.3s ease;
        }

        .form-input:focus {
            outline: none;
            border-color: var(--primary-color);
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .form-input::placeholder {
            color: var(--text-muted);
        }

        .input-icon {
            position: absolute;
            left: 1rem;
            top: 1.4rem;
            color: var(--text-muted);
            font-size: 1.1rem;
            transition: color 0.3s ease;
            z-index: 2;
            pointer-events: none;
            line-height: 1.1rem;
        }

        .form-input:focus + .input-icon {
            color: var(--primary-color);
        }

        .password-requirements {
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-top: 0.5rem;
            padding-left: 0.25rem;
        }

        /* Modern button */
        .login-button {
            width: 100%;
            padding: 1rem;
            background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
            color: white;
            border: none;
            border-radius: var(--border-radius-sm);
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-bottom: 1.5rem;
            box-shadow: var(--shadow-md);
        }

        .login-button:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow-lg);
            background: linear-gradient(135deg, var(--primary-hover), #1e40af);
        }

        .login-button:active {
            transform: translateY(0);
        }

        /* Form links */
        .form-links {
            text-align: center;
        }

        .form-link {
            color: var(--text-secondary);
            font-size: 0.875rem;
            margin-bottom: 1rem;
            display: block;
        }

        .form-link a {
            color: var(--primary-color);
            text-decoration: none;
            font-weight: 500;
            transition: color 0.2s;
        }

        .form-link a:hover {
            color: var(--primary-hover);
            text-decoration: none;
        }

        .signup-link {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            color: var(--primary-color);
            text-decoration: none;
            font-weight: 500;
            transition: all 0.2s;
        }

        .signup-link:hover {
            color: var(--primary-hover);
            text-decoration: none;
        }

        /* Footer */
        .footer {
            text-align: center;
            padding: var(--space-4);
            color: var(--text-secondary);
            font-size: 0.875rem;
            position: relative;
            z-index: 1;
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
            .header-content {
                flex-direction: column;
                gap: 1rem;
                text-align: center;
            }

            .header-nav {
                gap: 1rem;
            }

            .login-card {
                grid-template-columns: 1fr;
                max-width: 450px;
            }

            .login-image {
                display: none;
            }

            .login-form-container {
                padding: 2rem 1.5rem;
            }

            .app-title {
                flex-direction: column;
                text-align: center;
                gap: 0.5rem;
            }
        }

        @media (max-width: 480px) {
            .login-container {
                padding: 1rem;
            }

            .login-form-container {
                padding: 1.5rem 1rem;
            }

            .login-title {
                font-size: 1.5rem;
            }
        }
    </style>
</head>
<body>
    <!-- Modern Header -->
    <header class="app-header">
        <div class="header-content">
            <div class="app-title">
                <div class="app-logo">
                    <img src="images/logo.png" alt="Polyscope Logo" class="logo-image">
                </div>
                <div class="app-title-text">
                    <div class="app-title-main">Polyscope</div>
                    <div class="app-title-sub">Pathology Image Processing Platform</div>
                </div>
            </div>
            
            <nav class="header-nav">
                <a href="/index.php">🏠 Home</a>
                <a href="/docs/index.html" target="_blank">📚 Documentation</a>
            </nav>
        </div>
    </header>

    <!-- Main Login Content -->
    <div class="login-container">
        <div class="login-card">
            <div class="login-image">
                <div class="feature-text">
                    <h2>Transform Medical Research</h2>
                    <div>
                        <div class="typing-line bold">Advanced Pathology Image Visualization</div>
                        <div class="typing-line">Seamless Data Sharing</div>
                        <div class="typing-line">AI Model Deployment</div>
                        <div class="typing-line italic">Revolutionizing Medical Image Research</div>
                    </div>
                    <div class="feature-icons">
                        <div class="feature-icon">🔬</div>
                        <div class="feature-icon">📊</div>
                        <div class="feature-icon">🤖</div>
                        <div class="feature-icon">🚀</div>
                    </div>
                    <div class="lab-credit">
                        Developed by <strong>SEQUOIA</strong> @ MD Anderson Cancer Center © 2025
                    </div>
                </div>
            </div>

            <div class="login-form-container">
                <h1 class="login-title">Welcome Back</h1>
                <p class="login-subtitle">Sign in to your Polyscope account</p>
                <!-- MD Anderson Credentials Info -->
                <div class="info-message">
                    <span class="info-title">🏥 MD Anderson Authentication</span>
                    <span class="info-text">Please use your MD Anderson Cancer Center credentials to access this platform.</span>
                </div>
                <?php if (!empty($error)): ?>
                    <div class="error-message">
                        <?php echo htmlspecialchars($error); ?>
                    </div>
                <?php endif; ?>

                <form method="POST" action="login.php">
                    <div class="form-group">
                        <input class="form-input" type="text" name="username" placeholder="Username" required>
                        <i class="fa fa-user input-icon" aria-hidden="true"></i>
                    </div>

                    <div class="form-group">
                        <input class="form-input" type="password" name="password" placeholder="Password" required 
                               pattern=".{8,}" title="Password must be at least 8 characters long">
                        <i class="fa fa-lock input-icon" aria-hidden="true"></i>
                        <div class="password-requirements">
                            Password must be at least 8 characters long
                        </div>
                    </div>

                    <button type="submit" class="login-button">
                        Sign In with MD Anderson Credentials
                    </button>

                    <!-- Privacy Notice -->
                    <div class="privacy-notice">
                        <span class="privacy-title">🔒 Privacy & Security</span>
                        This website does not store any personal data. All authentication and data processing occurs on secure MD Anderson Cancer Center servers. Your credentials are handled through the institutional LDAP system.
                    </div>


                    <!-- <div class="form-links">
                        <a href="signup.php" class="signup-link">
                            Create your Account <i class="fa fa-arrow-right" aria-hidden="true"></i>
                        </a>
                    </div> -->
                </form>
            </div>
        </div>
    </div>

    <footer class="footer">
        Developed by <strong>SEQUOIA</strong> @ MD Anderson Cancer Center © 2025
    </footer>

    <!-- Scripts -->
    <script nonce="<?php echo htmlspecialchars($nonce); ?>" src="vendor/jquery/jquery-3.2.1.min.js"></script>
    <script nonce="<?php echo htmlspecialchars($nonce); ?>" src="vendor/bootstrap/js/popper.js"></script>
    <script nonce="<?php echo htmlspecialchars($nonce); ?>" src="vendor/bootstrap/js/bootstrap.min.js"></script>
    <script nonce="<?php echo htmlspecialchars($nonce); ?>" src="vendor/select2/select2.min.js"></script>
    <script nonce="<?php echo htmlspecialchars($nonce); ?>" src="vendor/tilt/tilt.jquery.min.js"></script>
    
    <script nonce="<?php echo htmlspecialchars($nonce); ?>">
        $('.js-tilt').tilt({
            scale: 1.1
        });
    </script>
    
    <script nonce="<?php echo htmlspecialchars($nonce); ?>" src="js/main.js"></script>
</body>
</html>
