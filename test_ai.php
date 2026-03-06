<?php
header('Content-Type: application/json');

// The AI service is running on rapuplabgpu04, not locally
$url = 'http://rapuplabgpu04:8000/health';

$response = @file_get_contents($url, false, stream_context_create([
    'http' => [
        'timeout' => 5,
        'ignore_errors' => true
    ]
]));

if ($response !== false) {
    echo json_encode([
        'success' => true,
        'url_used' => $url,
        'response' => json_decode($response, true)
    ]);
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Cannot reach AI service on rapuplabgpu04',
        'tried_url' => $url
    ]);
}
?>
