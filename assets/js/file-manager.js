// Enhanced File Manager with DZI Processing
class EnhancedPolyscopeFileManager {
  constructor() {
    this.currentPath = '';
    this.selectedFiles = new Set();
    this.isUploading = false;
    this.dziProcessor = null;
    
    this.initializeEventListeners();
    this.loadDirectory('');
    
    // Initialize DZI processor
    setTimeout(() => {
      this.dziProcessor = new DZIProcessor(this);
      window.dziProcessor = this.dziProcessor;
    }, 100);
  }
  
  initializeEventListeners() {
    // Toolbar buttons
    document.getElementById('newFolderBtn').addEventListener('click', () => this.showNewFolderDialog());
    document.getElementById('uploadBtn').addEventListener('click', () => this.showUploadDialog());
    document.getElementById('refreshBtn').addEventListener('click', () => this.refreshCurrentDirectory());
    document.getElementById('deleteBtn').addEventListener('click', () => this.deleteSelectedFiles());
    document.getElementById('processBtn').addEventListener('click', () => this.processSelectedFiles());
    document.getElementById('renameBtn').addEventListener('click', () => this.renameSelectedFile());
    
    // Upload zone drag and drop
    const uploadZone = document.getElementById('uploadZone');
    uploadZone.addEventListener('click', () => this.showUploadDialog());
    uploadZone.addEventListener('dragover', (e) => this.handleDragOver(e));
    uploadZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    uploadZone.addEventListener('drop', (e) => this.handleDrop(e));
    
    // File selection handling
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' && this.selectedFiles.size > 0) {
        this.deleteSelectedFiles();
      } else if (e.key === 'F2' && this.selectedFiles.size === 1) {
        this.renameSelectedFile();
      }
    });
  }
  
  async loadDirectory(path) {
    try {
      this.showLoading('Loading directory...');
      
      const response = await this.apiCall('listDirectory', { path: path });
      
      if (response.success) {
        this.currentPath = response.currentPath || '';
        this.renderFileList(response.files);
        this.updateBreadcrumb();
        this.clearSelection();
      } else {
        this.showError(response.error || 'Failed to load directory');
      }
    } catch (error) {
      this.showError('Error loading directory: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }
  
  renderFileList(files) {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';
    
    if (files.length === 0) {
      fileList.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);"><p>This folder is empty</p><p>Drag and drop files here or use the upload button</p></div>';
      return;
    }
    
    // Sort files: directories first, then by name
    files.sort(function(a, b) {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    
    const self = this;
    files.forEach(function(file) {
      const fileItem = self.createFileItem(file);
      fileList.appendChild(fileItem);
    });
  }
  
  createFileItem(file) {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.dataset.path = file.path;
    item.dataset.type = file.type;
    
    const icon = this.getFileIcon(file);
    const formattedSize = this.formatFileSize(file.size);
    const formattedDate = new Date(file.modified * 1000).toLocaleDateString();
    
    item.innerHTML = '<input type="checkbox" class="file-checkbox" data-path="' + file.path + '">' +
      '<div class="file-icon">' + icon + '</div>' +
      '<div class="file-info">' +
      '<div class="file-name" data-original-name="' + this.escapeHtml(file.name) + '">' + this.escapeHtml(file.name) + '</div>' +
      '<div class="file-details">' +
      (file.type === 'directory' ? 'Folder' : formattedSize) + ' • ' + formattedDate +
      (file.isPathologySlide ? ' • Pathology Slide' : '') +
      '</div></div>' +
      '<div class="file-actions">' +
      '<button class="btn btn-sm btn-outline rename-btn" title="Rename (F2)">✏️</button>' +
      '</div>';
    
    // Add click handlers
    const checkbox = item.querySelector('.file-checkbox');
    const renameBtn = item.querySelector('.rename-btn');
    const self = this;
    
    checkbox.addEventListener('change', function(e) {
      e.stopPropagation();
      self.toggleFileSelection(file.path, checkbox.checked);
    });
    
    renameBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      self.startRename(file.path, file.name);
    });
    
    item.addEventListener('click', function(e) {
      if (e.target.type !== 'checkbox' && !e.target.classList.contains('rename-btn')) {
        if (file.type === 'directory') {
          self.navigateToDirectory(file.path);
        } else {
          checkbox.checked = !checkbox.checked;
          self.toggleFileSelection(file.path, checkbox.checked);
        }
      }
    });
    
    item.addEventListener('dblclick', function(e) {
      e.preventDefault();
      if (file.type === 'directory') {
        self.navigateToDirectory(file.path);
      } else if (file.isPathologySlide) {
        self.viewFile(file.path);
      }
    });
    
    // Add drag and drop functionality
    if (file.type === 'directory') {
      // Make folders droppable
      item.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        item.classList.add('drag-over-folder');
      });
      
      item.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        item.classList.remove('drag-over-folder');
      });
      
      item.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        item.classList.remove('drag-over-folder');
        self.handleDropOnFolder(file.path, e);
      });
    } else {
      // Make files draggable
      item.draggable = true;
      item.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('text/plain', file.path);
        e.dataTransfer.effectAllowed = 'move';
        item.classList.add('dragging');
      });
      
      item.addEventListener('dragend', function(e) {
        item.classList.remove('dragging');
      });
    }
    
    return item;
  }
  
  getFileIcon(file) {
    if (file.type === 'directory') return '📁';
    
    const ext = file.extension ? file.extension.toLowerCase() : '';
    
    if (['svs', 'ndpi', 'czi', 'scn', 'mrxs', 'vsi', 'vms'].indexOf(ext) !== -1) {
      return '🔬';
    }
    
    if (['jpg', 'jpeg', 'png', 'tiff', 'tif', 'bmp', 'gif', 'webp'].indexOf(ext) !== -1) {
      return '🖼️';
    }
    
    if (['dcm', 'dicom', 'nii', 'nrrd'].indexOf(ext) !== -1) {
      return '🏥';
    }
    
    if (['jp2', 'j2k', 'jpx', 'jpm'].indexOf(ext) !== -1) {
      return '🎨';
    }
    
    if (ext === 'pdf') return '📄';
    
    return '📄';
  }
  
  toggleFileSelection(path, selected) {
    if (selected) {
      this.selectedFiles.add(path);
    } else {
      this.selectedFiles.delete(path);
    }
    
    this.updateSelectionUI();
  }
  
  updateSelectionUI() {
    const selectedCount = this.selectedFiles.size;
    
    const deleteBtn = document.getElementById('deleteBtn');
    const processBtn = document.getElementById('processBtn');
    const renameBtn = document.getElementById('renameBtn');
    
    deleteBtn.disabled = selectedCount === 0;
    processBtn.disabled = selectedCount === 0;
    renameBtn.disabled = selectedCount !== 1; // Enable only when exactly 1 file is selected
    
    const self = this;
    document.querySelectorAll('.file-item').forEach(function(item) {
      const path = item.dataset.path;
      const isSelected = self.selectedFiles.has(path);
      
      if (isSelected) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
      item.querySelector('.file-checkbox').checked = isSelected;
    });
    
    const selectedFiles = Array.from(this.selectedFiles);
    const dziCompatibleFiles = selectedFiles.filter(path => {
      const ext = path.toLowerCase().split('.').pop();
      return [
        'svs', 'ndpi', 'czi', 'scn', 'mrxs', 'vsi', 'vms',
        'tiff', 'tif', 'jpg', 'jpeg', 'png', 'bmp', 'gif', 'webp',
        'dcm', 'dicom', 'nii', 'nrrd',
        'jp2', 'j2k', 'jpx', 'jpm'
      ].includes(ext);
    });
    
    if (selectedCount > 0) {
      deleteBtn.textContent = '🗑️ Delete (' + selectedCount + ')';
      renameBtn.textContent = selectedCount === 1 ? '✏️ Rename' : '✏️ Rename (select 1)';
      if (dziCompatibleFiles.length > 0) {
        processBtn.textContent = '⚙️ Process (' + dziCompatibleFiles.length + ')';
        processBtn.disabled = false;
      } else {
        processBtn.textContent = '⚙️ Process (no images)';
        processBtn.disabled = true;
      }
    } else {
      deleteBtn.textContent = '🗑️ Delete';
      processBtn.textContent = '⚙️ Process';
      renameBtn.textContent = '✏️ Rename';
    }
  }
  
  clearSelection() {
    this.selectedFiles.clear();
    this.updateSelectionUI();
  }
  
  navigateToDirectory(path) {
    this.loadDirectory(path);
  }
  
  updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    breadcrumb.innerHTML = '';
    
    const homeItem = document.createElement('span');
    homeItem.className = 'breadcrumb-item';
    homeItem.textContent = '🏠 Home';
    const self = this;
    homeItem.addEventListener('click', function() {
      self.navigateToDirectory('');
    });
    breadcrumb.appendChild(homeItem);
    
    if (this.currentPath) {
      const pathParts = this.currentPath.split('/').filter(function(part) {
        return part;
      });
      let currentPath = '';
      
      pathParts.forEach(function(part, index) {
        currentPath += '/' + part;
        
        const separator = document.createElement('span');
        separator.textContent = ' / ';
        separator.style.color = 'var(--text-muted)';
        breadcrumb.appendChild(separator);
        
        const pathItem = document.createElement('span');
        pathItem.className = 'breadcrumb-item';
        pathItem.textContent = part;
        
        if (index === pathParts.length - 1) {
          pathItem.classList.add('active');
        } else {
          const targetPath = currentPath;
          pathItem.addEventListener('click', function() {
            self.navigateToDirectory(targetPath);
          });
        }
        
        breadcrumb.appendChild(pathItem);
      });
    } else {
      homeItem.classList.add('active');
    }
  }
  
  // Replace your showNewFolderDialog method with this debug version
  // Add this to your file-manager.js

  async handleDropOnFolder(targetFolderPath, event) {
    const draggedFilePath = event.dataTransfer.getData('text/plain');
    
    if (!draggedFilePath || draggedFilePath === targetFolderPath) {
      return; // Can't drop on itself
    }
    
    const fileName = draggedFilePath.split('/').pop();
    
    try {
      this.showLoading(`Moving ${fileName} to folder...`);
      
      const response = await this.apiCall('moveFile', {
        sourcePath: draggedFilePath,
        targetPath: targetFolderPath
      });
      
      if (response.success) {
        PolyscopeUI.success(`${fileName} moved successfully`);
        this.refreshCurrentDirectory();
      } else {
        PolyscopeUI.error(response.error || 'Failed to move file');
      }
    } catch (error) {
      PolyscopeUI.error('Error moving file: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }


  async showNewFolderDialog() {
    console.log('showNewFolderDialog called');
    console.log('PolyscopeUI:', window.PolyscopeUI);
    console.log('PolyscopeUI.prompt:', window.PolyscopeUI ? window.PolyscopeUI.prompt : 'undefined');
    
    try {
      const folderName = await PolyscopeUI.prompt(
        'Create New Folder',
        'Enter folder name:',
        'My Folder',
        'Folder name'
      );
      
      console.log('Prompt result:', folderName);
      
      if (folderName && folderName.trim()) {
        try {
          this.showLoading('Creating folder...');
          
          const response = await this.apiCall('createFolder', {
            path: this.currentPath,
            name: folderName.trim()
          });
          
          console.log('API response:', response);
          
          if (response.success) {
            PolyscopeUI.success('Folder created successfully');
            this.refreshCurrentDirectory();
          } else {
            PolyscopeUI.error(response.error || 'Failed to create folder');
          }
        } catch (error) {
          console.error('API Error:', error);
          PolyscopeUI.error('Error creating folder: ' + error.message);
        } finally {
          this.hideLoading();
        }
      } else {
        console.log('No folder name provided or cancelled');
      }
    } catch (error) {
      console.error('Prompt error:', error);
      PolyscopeUI.error('Error showing dialog: ' + error.message);
    }
  }
  
  showUploadDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = [
      '.svs', '.ndpi', '.czi', '.scn', '.mrxs', '.vsi', '.vms',
      '.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp', '.gif', '.webp',
      '.dcm', '.dicom', '.nii', '.nrrd',
      '.jp2', '.j2k', '.jpx', '.jpm',
      '.pdf'
    ].join(',');
    
    const self = this;
    input.addEventListener('change', function(e) {
      if (e.target.files.length > 0) {
        self.uploadFiles(Array.from(e.target.files));
      }
    });
    
    input.click();
  }
  

  // Enhanced Upload System - Non-blocking progress bar
  // Replace the uploadFiles and related methods in your file-manager.js

  async uploadFiles(files) {
    if (this.isUploading) {
      this.showError('Upload already in progress');
      return;
    }
  
    this.isUploading = true;
  
    // Show warning notification about not refreshing
    PolyscopeUI.warning('Upload in progress - Please do not refresh or close the page', 'Upload Warning');
  
    try {
      // Show non-blocking upload progress bar
      this.showUploadProgressBar(files);
  
      const formData = new FormData();
      let targetDirectory = '/media/Users/' + PolyscopeConfig.user.username;
      
      if (this.currentPath && this.currentPath.trim() !== '') {
        const cleanPath = this.currentPath.replace(/^\/+/, '');
        targetDirectory += '/' + cleanPath;
      }
      
      files.forEach(function(file) {
        formData.append('files[]', file);
      });
      
      formData.append('directory', targetDirectory.replace(/\//g, '___SLASH___'));
  
      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      
      // Set up progress tracking
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          this.updateUploadProgress(percentComplete, e.loaded, e.total);
        }
      });
  
      // Set up completion handling
      xhr.addEventListener('load', () => {
        try {
          const result = JSON.parse(xhr.responseText);
          this.handleUploadComplete(result, files);
        } catch (error) {
          this.handleUploadError('Invalid response from server');
        }
      });
  
      // Set up error handling
      xhr.addEventListener('error', () => {
        this.handleUploadError('Upload failed due to network error');
      });
  
      // Set up abort handling
      xhr.addEventListener('abort', () => {
        this.handleUploadError('Upload was cancelled');
      });
  
      // Start the upload
      xhr.open('POST', '/api/upload.php');
      xhr.send(formData);
  
      // Store xhr reference for potential cancellation
      this.currentUploadXHR = xhr;
  
    } catch (error) {
      this.handleUploadError('Upload error: ' + error.message);
    }
  }

  // Show non-blocking upload progress bar
  // Updated showUploadProgressBar method for inline placement
  // Replace this method in your file-manager.js

  showUploadProgressBar(files) {
    // Remove any existing upload bar
    this.hideUploadProgressBar();

    // Create upload progress bar container
    const progressContainer = document.createElement('div');
    progressContainer.id = 'uploadProgressContainer';
    progressContainer.className = 'upload-progress-bar-container';
    
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const fileNames = files.length === 1 ? files[0].name : `${files.length} files`;

    progressContainer.innerHTML = `
      <div class="upload-progress-bar">
        <div class="upload-info">
          <div class="upload-main-info">
            <div class="upload-icon">📤</div>
            <div class="upload-details">
              <div class="upload-title">Uploading ${fileNames}</div>
              <div class="upload-subtitle" id="uploadStatusText">Preparing upload...</div>
            </div>
          </div>
          <div class="upload-controls">
            <div class="upload-stats">
              <span id="uploadPercentage">0%</span>
              <span id="uploadSpeed">0 KB/s</span>
              <span id="uploadETA">Calculating...</span>
            </div>
            <button id="cancelUploadBtn" class="btn btn-sm btn-outline upload-cancel-btn" title="Cancel Upload">×</button>
          </div>
        </div>
        
        <div class="upload-progress-track">
          <div class="upload-progress-fill" id="uploadProgressFill"></div>
        </div>
      </div>
    `;

    // Add to main content area (after dashboard stats, before file manager)
    const mainContainer = document.querySelector('.main-container');
    const fileManagerView = document.getElementById('fileManagerView');
    
    // Insert before the file manager view
    mainContainer.insertBefore(progressContainer, fileManagerView);

    // Animate in
    setTimeout(() => {
      progressContainer.classList.add('visible');
    }, 100);

    // Add cancel handler
    document.getElementById('cancelUploadBtn').addEventListener('click', () => {
      this.cancelUpload();
    });

    // Initialize progress tracking
    this.uploadStartTime = Date.now();
    this.lastProgressUpdate = Date.now();
    this.lastLoadedBytes = 0;
    this.totalUploadSize = totalSize;
  }

  // Update upload progress
  updateUploadProgress(percentage, loaded, total) {
    const now = Date.now();
    const elapsed = now - this.uploadStartTime;
    const timeSinceLastUpdate = now - this.lastProgressUpdate;
    
    // Update progress bar
    const progressFill = document.getElementById('uploadProgressFill');
    const percentageDisplay = document.getElementById('uploadPercentage');
    const statusText = document.getElementById('uploadStatusText');
    
    if (progressFill) {
      progressFill.style.width = percentage + '%';
      
      // Add completion class when done
      if (percentage >= 100) {
        progressFill.classList.add('complete');
      }
    }
    
    if (percentageDisplay) {
      percentageDisplay.textContent = percentage + '%';
    }
    
    if (statusText) {
      if (percentage < 100) {
        statusText.textContent = `${this.formatFileSize(loaded)} of ${this.formatFileSize(total)}`;
      } else {
        statusText.textContent = 'Processing upload...';
      }
    }

    // Calculate and display speed (update every 500ms to avoid flickering)
    if (timeSinceLastUpdate >= 500) {
      const bytesInInterval = loaded - this.lastLoadedBytes;
      const speed = bytesInInterval / (timeSinceLastUpdate / 1000); // bytes per second
      
      const speedDisplay = document.getElementById('uploadSpeed');
      if (speedDisplay) {
        speedDisplay.textContent = this.formatSpeed(speed);
      }
      
      this.lastProgressUpdate = now;
      this.lastLoadedBytes = loaded;
    }

    // Calculate and display ETA
    if (percentage > 0 && elapsed > 1000) { // Only show after 1 second
      const totalTime = (elapsed / percentage) * 100;
      const remainingTime = totalTime - elapsed;
      
      const etaDisplay = document.getElementById('uploadETA');
      if (etaDisplay && remainingTime > 0 && percentage < 100) {
        etaDisplay.textContent = this.formatTime(remainingTime);
      } else if (etaDisplay && percentage >= 100) {
        etaDisplay.textContent = 'Finishing...';
      }
    }
  }

  // Handle upload completion
  handleUploadComplete(result, files) {
    this.isUploading = false;
    this.currentUploadXHR = null;

    // Update progress bar to show completion
    const progressContainer = document.getElementById('uploadProgressContainer');
    const statusText = document.getElementById('uploadStatusText');
    const cancelBtn = document.getElementById('cancelUploadBtn');
    const progressFill = document.getElementById('uploadProgressFill');
    
    if (result.success) {
      if (statusText) {
        statusText.textContent = `${result.uploaded.length} file(s) uploaded successfully!`;
      }
      
      if (progressFill) {
        progressFill.classList.add('complete');
      }
      
      if (progressContainer) {
        progressContainer.classList.add('success');
      }
      
      PolyscopeUI.success(`${result.uploaded.length} file(s) uploaded successfully`);
      
      if (result.failed.length > 0) {
        PolyscopeUI.warning(`${result.failed.length} file(s) failed to upload`);
      }
      
      this.refreshCurrentDirectory();
    } else {
      if (statusText) {
        statusText.textContent = 'Upload failed!';
      }
      
      if (progressFill) {
        progressFill.classList.add('error');
      }
      
      if (progressContainer) {
        progressContainer.classList.add('error');
      }
      
      PolyscopeUI.error(result.message || 'Upload failed');
    }

    // Change cancel button to close button
    if (cancelBtn) {
      cancelBtn.innerHTML = '✓';
      cancelBtn.title = 'Close';
      cancelBtn.onclick = () => this.hideUploadProgressBar();
    }

    // Auto-hide progress bar after 5 seconds if successful
    if (result.success) {
      setTimeout(() => {
        this.hideUploadProgressBar();
      }, 5000);
    }
  }

  // Handle upload errors
  handleUploadError(message) {
    this.isUploading = false;
    this.currentUploadXHR = null;

    const progressContainer = document.getElementById('uploadProgressContainer');
    const statusText = document.getElementById('uploadStatusText');
    const cancelBtn = document.getElementById('cancelUploadBtn');
    const progressFill = document.getElementById('uploadProgressFill');
    
    if (statusText) {
      statusText.textContent = 'Upload failed!';
    }
    
    if (progressFill) {
      progressFill.classList.add('error');
    }
    
    if (progressContainer) {
      progressContainer.classList.add('error');
    }
    
    if (cancelBtn) {
      cancelBtn.innerHTML = '×';
      cancelBtn.title = 'Close';
      cancelBtn.onclick = () => this.hideUploadProgressBar();
    }

    PolyscopeUI.error(message);
  }

  // Cancel upload
  cancelUpload() {
    if (this.currentUploadXHR) {
      this.currentUploadXHR.abort();
      this.currentUploadXHR = null;
    }
    
    this.isUploading = false;
    this.hideUploadProgressBar();
    PolyscopeUI.info('Upload cancelled');
  }

  // Hide upload progress bar
  hideUploadProgressBar() {
    const progressContainer = document.getElementById('uploadProgressContainer');
    if (progressContainer) {
      progressContainer.classList.add('hiding');
      setTimeout(() => {
        progressContainer.remove();
      }, 300);
    }
  }

  // Format upload speed
  formatSpeed(bytesPerSecond) {
    if (bytesPerSecond < 1024) {
      return Math.round(bytesPerSecond) + ' B/s';
    } else if (bytesPerSecond < 1024 * 1024) {
      return Math.round(bytesPerSecond / 1024) + ' KB/s';
    } else {
      return (bytesPerSecond / (1024 * 1024)).toFixed(1) + ' MB/s';
    }
  }

  // Format time duration
  formatTime(milliseconds) {
    const seconds = Math.round(milliseconds / 1000);
    
    if (seconds < 60) {
      return seconds + 's';
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return minutes + 'm ' + remainingSeconds + 's';
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return hours + 'h ' + minutes + 'm';
    }
  }
  async deleteSelectedFiles() {
    if (this.selectedFiles.size === 0) return;
    
    const fileCount = this.selectedFiles.size;
    const fileText = fileCount === 1 ? 'item' : 'items';
    
    const confirmed = await PolyscopeUI.confirm(
      'Delete Files',
      `Are you sure you want to delete ${fileCount} ${fileText}? This action cannot be undone.`,
      'danger',
      {
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    );
    
    if (!confirmed) return;
    
    try {
      this.showLoading('Deleting files...');
      
      const filePaths = Array.from(this.selectedFiles);
      const response = await this.apiCall('deleteFiles', { files: filePaths });
      
      if (response.success) {
        PolyscopeUI.success(response.message || `${fileCount} ${fileText} deleted successfully`);
        this.refreshCurrentDirectory();
      } else {
        PolyscopeUI.error(response.error || 'Delete failed');
      }
    } catch (error) {
      PolyscopeUI.error('Error deleting files: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }
  
  async processSelectedFiles() {
    if (this.dziProcessor) {
      // Add these 4 lines to update header tabs
      document.querySelectorAll('.view-indicator').forEach(indicator => {
        indicator.classList.remove('active');
      });
      document.querySelector('[data-view="processingView"]').classList.add('active');
      
      await this.dziProcessor.processSelectedFiles();
    } else {
      this.showError('DZI processor not ready yet. Please try again in a moment.');
    }
  }
  
  async renameSelectedFile() {
    if (this.selectedFiles.size !== 1) {
      PolyscopeUI.error('Please select exactly one file to rename');
      return;
    }
    
    const selectedPath = Array.from(this.selectedFiles)[0];
    const fileName = selectedPath.split('/').pop();
    this.startRename(selectedPath, fileName);
  }
  
  startRename(filePath, currentName) {
    const fileItem = document.querySelector(`.file-item[data-path="${CSS.escape(filePath)}"]`);
    if (!fileItem) return;

    const fileNameElement = fileItem.querySelector('.file-name');
    const originalName = currentName;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalName;
    input.className = 'rename-input';
    input.style.cssText = `
      width: 100%;
      padding: 2px 4px;
      border: 1px solid var(--primary-color);
      border-radius: 4px;
      font-size: inherit;
      font-family: inherit;
      background: white;
    `;

    fileNameElement.innerHTML = '';
    fileNameElement.appendChild(input);

    input.addEventListener('mousedown', e => e.stopPropagation());
    input.addEventListener('click', e => e.stopPropagation());

    input.focus();
    input.select();

    const self = this;
    let notified = false;

    const notifySuccess = () => {
      if (notified) return;
      notified = true;
      PolyscopeUI.success('File renamed successfully');
    };

    const notifyError = (msg) => {
      if (notified) return;
      notified = true;
      PolyscopeUI.error(msg);
    };

    const saveRename = async function() {
      const newName = input.value.trim();

      if (!newName) {
        notifyError('Filename cannot be empty');
        cancelRename();
        return;
      }
      if (newName === originalName) {
        cancelRename();
        return;
      }
      if (!/^[^<>:"/\\|?*\x00-\x1f]+$/.test(newName)) {
        notifyError('Invalid filename. Avoid: < > : " / \\ | ? *');
        input.focus();
        input.select();
        return;
      }

      try {
        self.showLoading('Renaming file...');
        const response = await fetch('/api/fileManager.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'renameFile',
            oldPath: filePath,
            newName: newName
          })
        });

        let result;
        const responseText = await response.text();

        try {
          result = JSON.parse(responseText);
        } catch {
          result = { success: response.ok, error: response.statusText };
        }

        if (response.status === 409) {
          await self.refreshCurrentDirectory();
          setTimeout(() => {
            const renamedItem = document.querySelector(`.file-item[data-path][data-name="${CSS.escape(newName)}"]`);
            if (renamedItem) {
              notifySuccess();
            } else {
              notifyError('A file or folder with that name already exists');
              cancelRename();
            }
          }, 200);
          return;
        }

        if (!response.ok) throw new Error(`HTTP error ${response.status}`);

        if (result.success) {
          notifySuccess();
          self.refreshCurrentDirectory();
        } else {
          notifyError(result.error || 'Failed to rename');
          cancelRename();
        }

      } catch (error) {
        console.error('Rename error:', error);
        await self.refreshCurrentDirectory();
        setTimeout(() => {
          const renamedItem = document.querySelector(`.file-item[data-path][data-name="${CSS.escape(newName)}"]`);
          if (renamedItem) {
            notifySuccess();
          } else {
            notifyError('Error renaming file: ' + error.message);
            cancelRename();
          }
        }, 200);

      } finally {
        self.hideLoading();
      }
    };

    const cancelRename = function() {
      fileNameElement.textContent = originalName;
    };

    input.addEventListener('blur', saveRename);
    input.addEventListener('keydown', function(e) {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        saveRename();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelRename();
      }
    });
  }
  
  refreshCurrentDirectory() {
    this.loadDirectory(this.currentPath);
  }
  
  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    document.getElementById('uploadZone').classList.add('drag-active');
  }
  
  handleDragLeave(e) {
    e.preventDefault();
    document.getElementById('uploadZone').classList.remove('drag-active');
  }
  
  handleDrop(e) {
    e.preventDefault();
    document.getElementById('uploadZone').classList.remove('drag-active');
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      this.uploadFiles(files);
    }
  }
  
  viewFile(path) {
    console.log('Opening file viewer for:', path);
    this.showError('File viewer integration needed');
  }
  
  // Add this method to your EnhancedPolyscopeFileManager class
  // or replace the existing apiCall method with this enhanced version

  async apiCall(action, data) {
    data = data || {};
    
    // Handle special API calls
    if (action === 'getStats') {
      try {
        console.log('📊 Calling getStats API...');
        
        const response = await fetch('/api/getStats.php', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        console.log('📊 Response status:', response.status);
        console.log('📊 Response ok:', response.ok);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('📊 getStats API response:', result);
        
        // Validate the response structure
        if (result && typeof result === 'object') {
          console.log('📊 Stats breakdown:');
          console.log('  - Total files:', result.totalFiles);
          console.log('  - Processed files:', result.processedFiles);
          console.log('  - Storage used:', result.storageUsed, '(', this.formatFileSize(result.storageUsed), ')');
          console.log('  - Success:', result.success);
        }
        
        return result;
        
      } catch (error) {
        console.error('📊 Stats API call failed:', error);
        return { success: false, error: error.message };
      }
    }
    
    // Handle regular file manager API calls
    console.log(`🔧 API Call: ${action}`, data);
    
    const response = await fetch('/api/fileManager.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(Object.assign({
        action: action
      }, data))
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log(`🔧 API Response for ${action}:`, result);
    
    return result;
  }
  
  showLoading(message) {
    PolyscopeApp.showLoading(message);
  }
  
  hideLoading() {
    PolyscopeApp.hideLoading();
  }
  
  showSuccess(message) {
    PolyscopeUI.success(message);
  }
  
  showError(message) {
    PolyscopeUI.error(message);
  }
  
  formatFileSize(bytes) {
    return PolyscopeUtils.string.formatFileSize(bytes);
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}