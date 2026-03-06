<?php
/**
 * Region Extractor for Cell Segmentation
 * Extracts image regions from OpenSeadragon Deep Zoom Images
 * Author: AI Integration Team
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

try {
    // Get input parameters
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        throw new Exception('Invalid JSON input');
    }
    
    $required_fields = ['dzi_path', 'viewport_rect', 'target_size'];
    foreach ($required_fields as $field) {
        if (!isset($input[$field])) {
            throw new Exception("Missing required field: $field");
        }
    }
    
    $dzi_path = $input['dzi_path'];
    $viewport_rect = $input['viewport_rect']; // {x, y, width, height} in viewport coordinates
    $target_size = $input['target_size']; // Target output size (e.g., 1000)
    
    // Validate DZI file exists
    $full_dzi_path = $_SERVER['DOCUMENT_ROOT'] . '/' . ltrim($dzi_path, '/');
    if (!file_exists($full_dzi_path)) {
        throw new Exception("DZI file not found: $dzi_path");
    }
    
    // Parse DZI file to get image dimensions and tile information
    $dzi_info = parseDziFile($full_dzi_path);
    if (!$dzi_info) {
        throw new Exception("Failed to parse DZI file");
    }
    
    // Convert viewport coordinates to image coordinates
    $image_rect = viewportToImageCoordinates($viewport_rect, $dzi_info);
    
    // Extract region from Deep Zoom tiles
    $extracted_image = extractRegionFromTiles($dzi_path, $image_rect, $target_size, $dzi_info);
    
    if (!$extracted_image) {
        throw new Exception("Failed to extract region from tiles");
    }
    
    // Send extracted image to AI service
    $ai_results = sendToAIService($extracted_image, $input);
    
    // Return results
    echo json_encode([
        'success' => true,
        'ai_results' => $ai_results,
        'extraction_info' => [
            'viewport_rect' => $viewport_rect,
            'image_rect' => $image_rect,
            'dzi_info' => $dzi_info,
            'extracted_size' => [$target_size, $target_size]
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

/**
 * Parse DZI file to get image metadata
 */
function parseDziFile($dzi_path) {
    try {
        $xml_content = file_get_contents($dzi_path);
        $xml = simplexml_load_string($xml_content);
        
        if (!$xml) {
            return false;
        }
        
        $attributes = $xml->Image->attributes();
        
        return [
            'width' => (int)$attributes['Width'],
            'height' => (int)$attributes['Height'],
            'tile_size' => (int)$attributes['TileSize'],
            'overlap' => (int)$attributes['Overlap'],
            'format' => (string)$attributes['Format']
        ];
        
    } catch (Exception $e) {
        error_log("Error parsing DZI file: " . $e->getMessage());
        return false;
    }
}

/**
 * Convert viewport coordinates to image pixel coordinates
 */
function viewportToImageCoordinates($viewport_rect, $dzi_info) {
    // OpenSeadragon viewport coordinates are normalized (0-1 range typically)
    // Convert to actual image pixel coordinates
    
    $image_x = $viewport_rect['x'] * $dzi_info['width'];
    $image_y = $viewport_rect['y'] * $dzi_info['height'];
    $image_width = $viewport_rect['width'] * $dzi_info['width'];
    $image_height = $viewport_rect['height'] * $dzi_info['height'];
    
    return [
        'x' => max(0, (int)$image_x),
        'y' => max(0, (int)$image_y),
        'width' => min($dzi_info['width'] - $image_x, (int)$image_width),
        'height' => min($dzi_info['height'] - $image_y, (int)$image_height)
    ];
}

/**
 * Extract region from Deep Zoom tiles
 * This is a simplified version - for production, you'd implement proper tile stitching
 */
function extractRegionFromTiles($dzi_path, $image_rect, $target_size, $dzi_info) {
    try {
        // For now, create a placeholder image
        // In production, you'd extract and stitch the actual tiles
        
        $image = imagecreatetruecolor($target_size, $target_size);
        
        // Fill with a pathology-like background
        $bg_color = imagecolorallocate($image, 255, 240, 245); // Light pinkish
        imagefill($image, 0, 0, $bg_color);
        
        // Add some simulated cell-like structures for testing
        $cell_color = imagecolorallocate($image, 180, 60, 120); // Darker pink/purple
        $nucleus_color = imagecolorallocate($image, 60, 60, 180); // Blue
        
        // Generate random cell-like structures
        for ($i = 0; $i < 15; $i++) {
            $x = rand(50, $target_size - 50);
            $y = rand(50, $target_size - 50);
            $size = rand(15, 35);
            
            // Cell body
            imagefilledellipse($image, $x, $y, $size, $size, $cell_color);
            
            // Nucleus
            $nucleus_size = $size * 0.4;
            imagefilledellipse($image, $x + rand(-5, 5), $y + rand(-5, 5), $nucleus_size, $nucleus_size, $nucleus_color);
        }
        
        // Convert to PNG data
        ob_start();
        imagepng($image);
        $image_data = ob_get_contents();
        ob_end_clean();
        
        imagedestroy($image);
        
        return $image_data;
        
    } catch (Exception $e) {
        error_log("Error extracting region: " . $e->getMessage());
        return false;
    }
}

/**
 * Send extracted image to AI service
 */
function sendToAIService($image_data, $params) {
    try {
        // AI service configuration
        $ai_service_url = 'http://rapuplabgpu04:8000/predict';
        
        // Prepare multipart form data
        $boundary = '----formdata-' . uniqid();
        $form_data = '';
        
        // Add image file
        $form_data .= "--$boundary\r\n";
        $form_data .= "Content-Disposition: form-data; name=\"file\"; filename=\"region.png\"\r\n";
        $form_data .= "Content-Type: image/png\r\n\r\n";
        $form_data .= $image_data . "\r\n";
        
        // Add parameters
        $ai_params = [
            'seg_threshold' => $params['seg_threshold'] ?? 0.5,
            'magnification' => $params['magnification'] ?? 40,
            'config_name' => $params['config_name'] ?? 'Default'
        ];
        
        foreach ($ai_params as $key => $value) {
            $form_data .= "--$boundary\r\n";
            $form_data .= "Content-Disposition: form-data; name=\"$key\"\r\n\r\n";
            $form_data .= $value . "\r\n";
        }
        
        $form_data .= "--$boundary--\r\n";
        
        // Setup cURL
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $ai_service_url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $form_data,
            CURLOPT_HTTPHEADER => [
                "Content-Type: multipart/form-data; boundary=$boundary",
                "Content-Length: " . strlen($form_data)
            ],
            CURLOPT_TIMEOUT => 60,
            CURLOPT_CONNECTTIMEOUT => 10
        ]);
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curl_error = curl_error($ch);
        curl_close($ch);
        
        if ($curl_error) {
            throw new Exception("cURL error: $curl_error");
        }
        
        if ($http_code !== 200) {
            throw new Exception("AI service returned HTTP $http_code: $response");
        }
        
        $ai_results = json_decode($response, true);
        if (!$ai_results) {
            throw new Exception("Invalid JSON response from AI service");
        }
        
        return $ai_results;
        
    } catch (Exception $e) {
        error_log("Error communicating with AI service: " . $e->getMessage());
        throw new Exception("AI service communication failed: " . $e->getMessage());
    }
}

/**
 * Log debug information
 */
function logDebug($message, $data = null) {
    $log_entry = date('Y-m-d H:i:s') . " - $message";
    if ($data) {
        $log_entry .= " - " . json_encode($data);
    }
    error_log($log_entry);
}

?>