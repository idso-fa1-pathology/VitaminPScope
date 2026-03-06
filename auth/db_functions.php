<?php
require 'config.php';

function authenticate_db_user($username, $password) {
    global $conn;

    // Prepare and bind
    $stmt = $conn->prepare("SELECT id, password, failed_login_attempts, account_locked FROM users WHERE username = ?");
    $stmt->bind_param("s", $username);

    // Execute the query
    $stmt->execute();
    $stmt->store_result();

    // Check if user exists
    if ($stmt->num_rows > 0) {
        $stmt->bind_result($id, $hashed_password, $failed_login_attempts, $account_locked);
        $stmt->fetch();

        if ($account_locked) {
            return ['status' => false, 'message' => "Account is locked."];
        } else {
            // Verify password
            if (password_verify($password, $hashed_password)) {
                // Password is correct, reset failed_login_attempts and update last_login
                $conn->query("UPDATE users SET failed_login_attempts = 0, last_login = NOW() WHERE id = $id");
                return ['status' => true, 'id' => $id];
            } else {
                // Increment failed_login_attempts
                $failed_login_attempts++;
                $conn->query("UPDATE users SET failed_login_attempts = $failed_login_attempts WHERE id = $id");

                // Lock account if failed attempts exceed limit (e.g., 5)
                if ($failed_login_attempts >= 5) {
                    $conn->query("UPDATE users SET account_locked = 1 WHERE id = $id");
                    return ['status' => false, 'message' => "Account locked due to too many failed login attempts."];
                } else {
                    return ['status' => false, 'message' => "Invalid password."];
                }
            }
        }
    } else {
        return ['status' => false, 'message' => "Invalid username. Please create an account."];
    }

    $stmt->close();
}

function create_db_user($username, $password) {
    global $conn;

    $hashed_password = password_hash($password, PASSWORD_BCRYPT);
    $stmt = $conn->prepare("INSERT INTO users (username, password, last_login) VALUES (?, ?, NOW())");
    $stmt->bind_param("ss", $username, $hashed_password);
    $stmt->execute();
    $stmt->close();
}

function log_audit($user_id, $action, $ip_address, $additional_info) {
    global $conn;

    // Insert audit log
    $stmt_audit = $conn->prepare("INSERT INTO audit_logs (user_id, action, ip_address, additional_info) VALUES (?, ?, ?, ?)");
    $stmt_audit->bind_param("isss", $user_id, $action, $ip_address, $additional_info);
    $stmt_audit->execute();
    $stmt_audit->close();
}
?>
