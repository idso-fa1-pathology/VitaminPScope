<?php
/**
 * TME Results Receiver
 * Receives results from AI server and saves to VPS filesystem at /data/polyzoomer/
 */

header('Content-Type: application/json');

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Get the slide filename from POST
$slideFilename = $_POST['slide_filename'] ?? null;
$resultsJson = $_POST['results_json'] ?? null;
$jobInfoJson = $_POST['job_info_json'] ?? null;

if (!$slideFilename) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing slide_filename']);
    exit;
}

// Log for debugging
error_log("TME Results Receiver: Processing slide: $slideFilename");

// SMART PATH DETECTION: Extract Path directory from the request URL
$requestUri = $_SERVER['REQUEST_URI']; // e.g., /customers/.../Path000168_202510171945/page/save_tme_results.php
$slideBaseName = pathinfo($slideFilename, PATHINFO_FILENAME);
$targetPath = null;

// Try to extract Path directory from URL
if (preg_match('#/(Path\d+_\d+)/#', $requestUri, $matches)) {
    $pathDirName = $matches[1]; // e.g., "Path000168_202510171945"
    $targetPath = '/var/www/polyzoomer_hot/' . $pathDirName;
    
    // Verify this Path directory exists and contains the slide
    if (file_exists($targetPath) && file_exists($targetPath . '/' . $slideFilename)) {
        error_log("TME Results Receiver: ✅ Found slide in URL-specified path: $targetPath");
    } else {
        error_log("TME Results Receiver: ⚠️ URL path exists but slide not found, searching all paths...");
        $targetPath = null; // Fall back to search
    }
} else {
    error_log("TME Results Receiver: ⚠️ Could not extract Path from URL: $requestUri");
    $targetPath = null;
}

// FALLBACK: If URL extraction failed, search all Path directories
if (!$targetPath) {
    $polyzoomerRoot = '/var/www/polyzoomer_hot';
    $pathDirs = glob($polyzoomerRoot . '/Path*');
    
    error_log("TME Results Receiver: Searching for slide in " . count($pathDirs) . " directories");
    
    // Search for the slide file - try multiple approaches
    foreach ($pathDirs as $pathDir) {
        // Try 1: Exact match with full filename
        if (file_exists($pathDir . '/' . $slideFilename)) {
            $targetPath = $pathDir;
            error_log("TME Results Receiver: Found slide (exact match) in: $targetPath");
            break;
        }
        
        // Try 2: Glob with basename
        $slideFiles = glob($pathDir . '/' . $slideBaseName . '.*');
        if (!empty($slideFiles)) {
            $targetPath = $pathDir;
            error_log("TME Results Receiver: Found slide (glob match) in: $targetPath (matched " . count($slideFiles) . " files)");
            break;
        }
    }
}

if (!$targetPath) {
    http_response_code(404);
    echo json_encode([
        'error' => 'Could not find slide directory',
        'slide_filename' => $slideFilename,
        'slide_basename' => $slideBaseName,
        'request_uri' => $requestUri,
        'searched_in' => '/var/www/polyzoomer_hot',
        'paths_searched' => isset($pathDirs) ? count($pathDirs) : 0
    ]);
    exit;
}

// Create results directory
$resultsDir = $targetPath . '/' . $slideBaseName . '_tme_results';
if (!file_exists($resultsDir)) {
    if (!mkdir($resultsDir, 0775, true)) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create results directory: ' . $resultsDir]);
        exit;
    }
    error_log("TME Results Receiver: Created results directory: $resultsDir");
} else {
    error_log("TME Results Receiver: Using existing results directory: $resultsDir");
}

// Save results.json
if ($resultsJson) {
    $resultsFile = $resultsDir . '/results.json';
    if (file_put_contents($resultsFile, $resultsJson) === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save results.json']);
        exit;
    }
    error_log("TME Results Receiver: Saved results.json");
}

// Save job_info.json
if ($jobInfoJson) {
    $jobInfoFile = $resultsDir . '/job_info.json';
    if (file_put_contents($jobInfoFile, $jobInfoJson) === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save job_info.json']);
        exit;
    }
    error_log("TME Results Receiver: Saved job_info.json");
}

// Handle overlay image if present
if (isset($_FILES['overlay_image']) && $_FILES['overlay_image']['error'] === UPLOAD_ERR_OK) {
    $overlayFile = $resultsDir . '/overlay.png';
    if (!move_uploaded_file($_FILES['overlay_image']['tmp_name'], $overlayFile)) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save overlay.png']);
        exit;
    }
    error_log("TME Results Receiver: Saved overlay.png");
}

// Success response
echo json_encode([
    'success' => true,
    'message' => 'Results saved successfully',
    'results_directory' => $resultsDir,
    'path_detection_method' => preg_match('#/(Path\d+_\d+)/#', $requestUri) ? 'url_extraction' : 'filesystem_search',
    'files_saved' => [
        'results_json' => $resultsJson ? true : false,
        'job_info_json' => $jobInfoJson ? true : false,
        'overlay_image' => isset($_FILES['overlay_image']) && $_FILES['overlay_image']['error'] === UPLOAD_ERR_OK
    ]
]);

error_log("TME Results Receiver: ✅ Successfully saved all results to: $resultsDir");
?>