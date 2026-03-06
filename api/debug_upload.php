<?php
// Debug upload paths and permissions
session_start();

header('Content-Type: application/json');

$username = $_SESSION['username'] ?? 'unknown';
$testPath = '/media/Users/' . $username . '/test_2';

$debug = array(
    'username' => $username,
    'session_data' => $_SESSION,
    'test_path' => $testPath,
    'test_path_exists' => file_exists($testPath),
    'test_path_readable' => is_readable($testPath),
    'test_path_writable' => is_writable($testPath),
    'test_path_contents' => array(),
    'user_base_dir' => '/media/Users/' . $username,
    'user_base_exists' => file_exists('/media/Users/' . $username),
    'media_permissions' => array(),
    'current_user' => posix_getpwuid(posix_geteuid()),
    'web_server_user' => get_current_user()
);

// Get directory contents if it exists
if (file_exists($testPath)) {
    $contents = scandir($testPath);
    foreach ($contents as $item) {
        if ($item !== '.' && $item !== '..') {
            $itemPath = $testPath . '/' . $item;
            $debug['test_path_contents'][] = array(
                'name' => $item,
                'size' => filesize($itemPath),
                'permissions' => substr(sprintf('%o', fileperms($itemPath)), -4),
                'is_readable' => is_readable($itemPath),
                'owner' => posix_getpwuid(fileowner($itemPath)),
                'group' => posix_getgrgid(filegroup($itemPath))
            );
        }
    }
}

// Check directory permissions up the chain
$paths_to_check = array(
    '/media',
    '/media/Users',
    '/media/Users/' . $username,
    $testPath
);

foreach ($paths_to_check as $path) {
    if (file_exists($path)) {
        $debug['media_permissions'][$path] = array(
            'exists' => true,
            'permissions' => substr(sprintf('%o', fileperms($path)), -4),
            'owner' => posix_getpwuid(fileowner($path)),
            'group' => posix_getgrgid(filegroup($path)),
            'readable' => is_readable($path),
            'writable' => is_writable($path)
        );
    } else {
        $debug['media_permissions'][$path] = array('exists' => false);
    }
}

echo json_encode($debug, JSON_PRETTY_PRINT);
?>