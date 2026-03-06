<?php
session_start();
include 'auth/session_timeout.php';

// Check if the user is logged in
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    header('Location: /auth/login.php');
    exit;
}

$username = isset($_SESSION['username']) ? $_SESSION['username'] : 'Guest';
$isAdmin = ($username === 'yshokrollahi');
$userRole = isset($_SESSION['job_title']) ? $_SESSION['job_title'] : 'Medical Professional';

?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Polyscope - Pathology Image Manager</title>
    <link rel="icon" type="image/png" href="favicon.png">
    <link rel="stylesheet" href="assets/css/main.css">
    <link rel="stylesheet" href="assets/css/notifications.css">
    <link rel="stylesheet" href="assets/css/results-checker.css">
    <link rel="stylesheet" href="assets/css/folder-drag-drop.css">
</head>
<body>
    <!-- Enhanced Header -->
    <header class="app-header">
        <div class="header-content">
            <div class="app-title">
                <div class="app-logo">
                    <img src="auth/images/logo.png" alt="Polyscope Logo" class="logo-image">
                </div>
                <div class="app-title-text">
                    <div class="app-title-main">Polyscope</div>
                    <div class="app-title-sub">Pathology Image Processing Platform(v3.0.0)</div>
                </div>
            </div>
            
            <div class="nav-controls">
                <div class="view-indicators">
                    <button class="view-indicator active" data-view="fileManagerView" title="File Manager">
                        📁 <span>Files</span>
                    </button>
                    <button class="view-indicator" data-view="processingView" title="Processing Status">
                        ⚙️ <span>Processing</span>
                    </button>
                </div>
            </div>
            
            <div class="user-section">
                <!-- Top menu buttons -->
                <div class="user-actions">
                    <a href="/customers/<?php echo htmlspecialchars($username); ?>-mdanderson-org/" class="btn btn-outline" target="_blank" rel="noopener noreferrer">📋 My Results</a>
                    <a href="/docs/index.html" class="btn btn-outline" target="_blank" rel="noopener noreferrer">📚 Documentation/Help</a>
                    <?php if ($isAdmin): ?>
                        <a href="auth/admin_dashboard.php" class="btn btn-outline">👤 Dashboard</a>
                    <?php endif; ?>
                </div>
                
                <!-- User Dropdown Menu -->
                <div class="user-menu">
                    <button class="user-menu-trigger">
                        <div class="user-avatar">
                            <?php echo strtoupper(substr($username, 0, 2)); ?>
                        </div>
                        <div class="user-info">
                            <div class="user-name"><?php echo htmlspecialchars($username); ?></div>
                            <div class="user-role"><?php echo htmlspecialchars($userRole); ?></div>
                        </div>
                        <div class="dropdown-arrow">▼</div>
                    </button>
                    
                    <div class="user-menu-dropdown">
                        <div class="dropdown-menu">
                            <a href="auth/logout.php" class="dropdown-item logout-item">
                                <span class="item-icon">🚪</span>
                                <span class="item-text">Sign Out</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main class="main-container">
        <!-- Dashboard Stats -->
        <div class="dashboard-stats">
            <div class="stat-card">
                <div class="stat-icon primary">📊</div>
                <div class="stat-value" id="totalFilesCount">0</div>
                <div class="stat-label">Total Files Uploaded</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon success">✅</div>
                <div class="stat-value" id="processedFilesCount">0</div>
                <div class="stat-label">Successfully Processed</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon warning">⚙️</div>
                <div class="stat-value" id="processingFilesCount">0</div>
                <div class="stat-label">Currently Processing</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon primary">🔬</div>
                <div class="stat-value" id="storageUsed">0 MB</div>
                <div class="stat-label">Storage Used</div>
            </div>
        </div>

        <!-- File Manager View -->
        <div id="fileManagerView" class="view active">
            <div class="file-manager" id="fileManager">
                <!-- Enhanced Toolbar -->
                <div class="file-toolbar" id="fileToolbar">
                    <div class="toolbar-left">
                        <div class="toolbar-section">
                            <button id="newFolderBtn" class="btn btn-secondary">
                                📁 New Folder
                            </button>
                            <button id="uploadBtn" class="btn btn-primary">
                                📤 Upload Files
                            </button>
                        </div>
                        <div class="toolbar-section">
                            <button id="refreshBtn" class="btn btn-outline">
                                🔄 Refresh
                            </button>
                        </div>
                    </div>
                    
                    <div class="toolbar-right">
                        <div class="toolbar-section">
                            <button id="renameBtn" class="btn btn-outline" disabled>
                                ✏️ Rename
                            </button>
                            <button id="deleteBtn" class="btn btn-danger" disabled>
                                🗑️ Delete
                            </button>
                        </div>
                        <div class="toolbar-section">
                            <button id="processBtn" class="btn btn-success" disabled>
                                ⚙️ Process
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Enhanced Breadcrumb -->
                <div class="breadcrumb" id="breadcrumb">
                    <span class="breadcrumb-item active">🏠 Home</span>
                </div>
                
                <!-- Enhanced Upload Zone -->
                <div class="upload-zone" id="uploadZone">
                    <div class="upload-icon">📤</div>
                    <h3 class="upload-title">Drop files here to upload</h3>
                    <p class="upload-subtitle">Or click anywhere in this area to browse files</p>
                    
                    <div class="file-formats">
                        <div class="format-group">
                            <div class="format-title">🔬 Pathology Slides</div>
                            <div class="format-list">.svs, .ndpi, .czi, .scn, .mrxs, .vsi, .vms</div>
                        </div>
                        <div class="format-group">
                            <div class="format-title">📷 Standard Images</div>
                            <div class="format-list">.jpg, .jpeg, .png, .tiff, .tif, .bmp, .gif, .webp</div>
                        </div>
                        <div class="format-group">
                            <div class="format-title">🏥 Medical Formats</div>
                            <div class="format-list">.dcm, .nii, .nrrd</div>
                        </div>
                        <div class="format-group">
                            <div class="format-title">📄 Other Formats</div>
                            <div class="format-list">.jp2, .pdf</div>
                        </div>
                    </div>
                </div>
                
                <!-- File List -->
                <div class="file-list" id="fileList">
                    <!-- Files will be loaded here -->
                </div>
            </div>
        </div>

        <!-- Processing View -->
        <div id="processingView" class="view processing-view">
            <div id="processingContent">
                <!-- DZI Processing status will be populated here by DZI processor -->
            </div>
        </div>
    </main>

    <!-- Loading Overlay -->
    <div id="loadingOverlay" class="loading-overlay">
        <div class="spinner"></div>
        <p>Loading...</p>
    </div>

    <!-- JavaScript Configuration (inline for PHP variables) -->
    <script>
        // Initialize PolyscopeConfig with user-specific data
        window.PolyscopeConfig = {
            user: {
                username: '<?php echo addslashes($username); ?>',
                isAdmin: <?php echo $isAdmin ? 'true' : 'false'; ?>
            }
        };

        // User dropdown functionality
        document.addEventListener('DOMContentLoaded', function() {
            const userMenu = document.querySelector('.user-menu');
            const trigger = document.querySelector('.user-menu-trigger');
            
            // Toggle dropdown
            trigger.addEventListener('click', function(e) {
                e.stopPropagation();
                userMenu.classList.toggle('active');
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', function() {
                userMenu.classList.remove('active');
            });
            
            // Prevent dropdown from closing when clicking inside
            document.querySelector('.user-menu-dropdown').addEventListener('click', function(e) {
                e.stopPropagation();
            });
        });
    </script>

    <!-- JavaScript Files -->
    <script src="assets/js/config.js"></script>
    <script src="assets/js/utils.js"></script>
    <script src="assets/js/notifications.js"></script>
    <script src="assets/js/navigation.js"></script>
    <script src="assets/js/dzi-processor.js"></script>
    <script src="assets/js/file-manager.js"></script>
    <script src="assets/js/app.js"></script>
    <script src="assets/js/results-checker.js"></script>
</body>
</html>