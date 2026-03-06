<?php
session_start();

class CSRFProtection {
    private static function generateToken() {
        return bin2hex(random_bytes(32));
    }

    public static function getToken() {
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = self::generateToken();
        }
        return $_SESSION['csrf_token'];
    }

    public static function verifyToken($token) {
        if (empty($_SESSION['csrf_token']) || empty($token)) {
            return false;
        }
        return hash_equals($_SESSION['csrf_token'], $token);
    }

    public static function removeToken() {
        unset($_SESSION['csrf_token']);
    }

    public static function refreshToken() {
        $_SESSION['csrf_token'] = self::generateToken();
        return $_SESSION['csrf_token'];
    }
}

// Initialize CSRF token if it doesn't exist
CSRFProtection::getToken();