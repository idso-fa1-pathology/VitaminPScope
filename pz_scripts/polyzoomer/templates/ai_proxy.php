<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Determine which AI service to use based on endpoint
$endpoint = $_GET['endpoint'] ?? '';

// Check if endpoint starts with any TME pattern
$is_tme_endpoint = false;
$tme_prefixes = ['health_tme', 'process_tme', 'status_tme', 'result_tme', 'configs_tme', 'jobs_tme', 'overlay_tme', 'check_results_tme', 'load_results_tme', 'overlay_file_tme'];

foreach ($tme_prefixes as $prefix) {
    if (strpos($endpoint, $prefix) === 0) {
        $is_tme_endpoint = true;
        break;
    }
}

if ($is_tme_endpoint) {
    // TME service on port 8001
    $ai_base_url = 'http://rapuplabgpu15.mdanderson.edu:8001';
    // Remove _tme suffix from the endpoint
    $endpoint = str_replace('_tme', '', $endpoint);
} else {
    // Cell segmentation service on port 8000
    $ai_base_url = 'http://rapuplabgpu15.mdanderson.edu:8000';
}

// ✅ NEW: Handle VPS filesystem result endpoints FIRST (before cURL setup)
if ($endpoint === 'check_results') {
    header('Content-Type: application/json');
    
    if (!isset($_POST['file_path'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing file_path parameter']);
        exit;
    }
    
    $slidePath = $_POST['file_path'];
    
    // ✅ Resolve relative path to absolute
    $scriptDir = dirname(__FILE__); // Location of ai_proxy.php
    $absolutePath = realpath($scriptDir . '/' . $slidePath);
    
    if (!$absolutePath || !file_exists($absolutePath)) {
        http_response_code(404);
        echo json_encode([
            'error' => 'Slide file not found',
            'requested_path' => $slidePath,
            'resolved_path' => $absolutePath,
            'script_dir' => $scriptDir
        ]);
        exit;
    }
    
    $slideBasename = pathinfo($absolutePath, PATHINFO_FILENAME);
    $slideDir = dirname($absolutePath);
    $resultsDir = $slideDir . '/' . $slideBasename . '_tme_results';
    
    $exists = file_exists($resultsDir);
    $hasOverlay = $exists && file_exists($resultsDir . '/overlay.png');
    $hasResults = $exists && file_exists($resultsDir . '/results.json');
    $hasJobInfo = $exists && file_exists($resultsDir . '/job_info.json');
    
    echo json_encode([
        'exists' => $exists,
        'has_overlay' => $hasOverlay,
        'has_results' => $hasResults,
        'has_job_info' => $hasJobInfo,
        'results_directory' => $resultsDir
    ]);
    exit;
}

if ($endpoint === 'load_results') {
    if (!isset($_POST['file_path'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing file_path parameter']);
        exit;
    }
    
    $slidePath = $_POST['file_path'];
    
    // ✅ Resolve relative path to absolute
    $scriptDir = dirname(__FILE__);
    $absolutePath = realpath($scriptDir . '/' . $slidePath);
    
    if (!$absolutePath || !file_exists($absolutePath)) {
        http_response_code(404);
        echo json_encode([
            'error' => 'Slide file not found',
            'requested_path' => $slidePath
        ]);
        exit;
    }
    
    $slideBasename = pathinfo($absolutePath, PATHINFO_FILENAME);
    $slideDir = dirname($absolutePath);
    $resultsFile = $slideDir . '/' . $slideBasename . '_tme_results/results.json';
    
    if (!file_exists($resultsFile)) {
        http_response_code(404);
        echo json_encode(['error' => 'Results file not found', 'path' => $resultsFile]);
        exit;
    }
    
    $resultsJson = file_get_contents($resultsFile);
    header('Content-Type: application/json');
    echo $resultsJson;
    exit;
}

if ($endpoint === 'overlay_file') {
    if (!isset($_GET['file_path']) && !isset($_POST['file_path'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing file_path parameter']);
        exit;
    }
    
    $slidePath = $_GET['file_path'] ?? $_POST['file_path'];
    
    // ✅ Resolve relative path to absolute
    $scriptDir = dirname(__FILE__);
    $absolutePath = realpath($scriptDir . '/' . $slidePath);
    
    if (!$absolutePath || !file_exists($absolutePath)) {
        http_response_code(404);
        echo json_encode([
            'error' => 'Slide file not found',
            'requested_path' => $slidePath
        ]);
        exit;
    }
    
    $slideBasename = pathinfo($absolutePath, PATHINFO_FILENAME);
    $slideDir = dirname($absolutePath);
    $overlayFile = $slideDir . '/' . $slideBasename . '_tme_results/overlay.png';
    
    if (!file_exists($overlayFile)) {
        http_response_code(404);
        echo json_encode(['error' => 'Overlay file not found', 'path' => $overlayFile]);
        exit;
    }
    
    header('Content-Type: image/png');
    header('Content-Length: ' . filesize($overlayFile));
    readfile($overlayFile);
    exit;
}

// ✅ Continue with normal AI proxy for other endpoints
$url = $ai_base_url . '/' . ltrim($endpoint, '/');

// Check if this is an overlay image request
$is_overlay_request = strpos($endpoint, 'overlay/') !== false;

// Use cURL for all requests to AI server
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

// For image requests, we need to capture headers
if ($is_overlay_request) {
    curl_setopt($ch, CURLOPT_HEADER, true);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    curl_setopt($ch, CURLOPT_TIMEOUT, 120);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    
} else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 300);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    
    if (isset($_FILES['file']) || isset($_POST['file_path'])) {
        $postFields = array();
        
        if (isset($_POST['file_path']) && !isset($_FILES['file'])) {
            $filePath = $_POST['file_path'];
            $realPath = realpath($filePath);
            
            if (!$realPath || !file_exists($realPath)) {
                http_response_code(404);
                echo json_encode([
                    'error' => 'File not found',
                    'requested_path' => $filePath,
                    'resolved_path' => $realPath
                ]);
                exit;
            }
            
            if (!is_readable($realPath)) {
                http_response_code(403);
                echo json_encode(['error' => 'File not readable: ' . $realPath]);
                exit;
            }
            
            $postFields['file'] = new CURLFile($realPath);
            $postFields['original_file_path'] = $realPath;
            
            $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
            $baseUrl = $protocol . '://' . $_SERVER['HTTP_HOST'] . dirname($_SERVER['SCRIPT_NAME']);
            $postFields['vps_base_url'] = $baseUrl;
        }
        else if (isset($_FILES['file'])) {
            $postFields['file'] = new CURLFile(
                $_FILES['file']['tmp_name'],
                $_FILES['file']['type'],
                $_FILES['file']['name']
            );
        }
        
        foreach ($_POST as $key => $value) {
            if ($key !== 'file_path') {
                $postFields[$key] = $value;
            }
        }
        
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
    } else {
        curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
        curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents('php://input'));
    }
    
} else if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
}

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
$curlError = curl_error($ch);

if ($is_overlay_request && $httpCode === 200) {
    $header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $body = substr($response, $header_size);
    
    curl_close($ch);
    
    header('Content-Type: ' . ($contentType ?: 'image/png'));
    echo $body;
    exit;
}

curl_close($ch);

if (!$is_overlay_request) {
    header('Content-Type: application/json');
}

if ($response === false || $httpCode >= 400) {
    http_response_code($httpCode >= 400 ? $httpCode : 500);
    echo json_encode([
        'error' => 'Failed to connect to AI service',
        'http_code' => $httpCode,
        'curl_error' => $curlError,
        'url' => $url
    ]);
} else {
    echo $response;
}
?>