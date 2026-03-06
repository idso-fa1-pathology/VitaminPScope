// Polyscope Configuration
// Note: User-specific config will be set inline in index.php
// This file contains static configuration only

window.PolyscopeConfig = window.PolyscopeConfig || {};

// Merge with any existing config (from index.php)
Object.assign(window.PolyscopeConfig, {
  api: {
    endpoints: {
      fileManager: '/api/fileManager.php',
      upload: '/api/upload.php',
      issueUploadProject: '/issueUploadProject.php',
      getProjectStatus: '/getProjectStatus.php'
    }
  },
  supportedFormats: {
    pathology: ['svs', 'ndpi', 'czi', 'scn', 'mrxs', 'vsi', 'vms'],
    images: ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'bmp', 'gif', 'webp'],
    medical: ['dcm', 'dicom', 'nii', 'nrrd'],
    other: ['jp2', 'j2k', 'jpx', 'jpm', 'pdf']
  },
  ui: {
    statusCheckInterval: 5000, // 5 seconds
    jobCompletedDisplayTime: 120000, // 2 minutes
    views: {
      fileManagerView: { id: 'fileManagerView', title: 'File Manager', icon: '📁' },
      processingView: { id: 'processingView', title: 'Processing Status', icon: '⚙️' }
    }
  },
  timing: {
    automaticTimeout: 10000, // 10 seconds before allowing auto-transition
    transitionDuration: 300 // CSS transition duration in ms
  },
  navigation: {
    enableKeyboard: true,
    enableAutoTransition: true,
    circularNavigation: true
  }
});