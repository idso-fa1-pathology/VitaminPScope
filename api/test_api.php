<?php
// PHP 7.0 compatible test API
session_start();

header('Content-Type: application/json');

$response = array(
    'success' => true,
    'message' => 'API is working',
    'session_data' => $_SESSION,
    'php_version' => phpversion(),
    'current_dir' => getcwd(),
    'media_exists' => file_exists('/media'),
    'media_writable' => is_writable('/media'),
    'users_exists' => file_exists('/media/Users'),
    'request_method' => $_SERVER['REQUEST_METHOD'],
    'input_data' => file_get_contents('php://input'),
    'timestamp' => time()
);

echo json_encode($response);
?>