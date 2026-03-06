<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$ai_base_url = 'http://rapuplabgpu04:8000';

// Get the endpoint from the request
$endpoint = $_GET['endpoint'] ?? '';
$url = $ai_base_url . '/' . ltrim($endpoint, '/');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $response = @file_get_contents($url);
} else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => 'Content-Type: application/json',
            'content' => file_get_contents('php://input')
        ]
    ]);
    $response = @file_get_contents($url, false, $context);
}

if ($response === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to connect to AI service']);
} else {
    echo $response;
}
?>
