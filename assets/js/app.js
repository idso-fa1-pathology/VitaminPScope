// Enhanced Main Application with Real Dashboard Stats
window.PolyscopeApp = {
  
  // Dashboard stats tracking
  stats: {
    totalFiles: 0,
    processedFiles: 0,
    processingFiles: 0,
    storageUsed: 0
  },

  // Initialize dashboard stats
  initializeDashboard() {
    console.log('Initializing dashboard stats...');
    this.updateDashboardStats();
    
    // Update stats periodically
    setInterval(() => {
      this.updateDashboardStats();
    }, 10000); // Update every 10 seconds
  },

  // Calculate and update dashboard statistics
  async updateDashboardStats() {
    try {
      // Get file count and storage from file manager
      if (window.fileManager) {
        await this.calculateFileStats();
      }
      
      // Get processing stats from DZI processor
      if (window.dziProcessor) {
        this.calculateProcessingStats();
      }
      
      // Update the UI
      this.renderDashboardStats();
      
    } catch (error) {
      console.warn('Error updating dashboard stats:', error);
    }
  },

  // Calculate file statistics from the file manager
  // Replace the calculateFileStats method in your PolyscopeApp with this enhanced version

  // Calculate file statistics from the file manager
  async calculateFileStats() {
    try {
      console.log('📊 === Starting File Stats Calculation ===');
      console.log('📊 Current path:', window.fileManager?.currentPath);
      console.log('📊 File manager available:', !!window.fileManager);
      
      // Get current directory listing (for fallback counting if needed)
      const response = await window.fileManager.apiCall('listDirectory', { 
        path: window.fileManager.currentPath || '' 
      });
      
      console.log('📊 listDirectory response:', response);
      
      if (response.success && response.files) {
        console.log('📊 Files in current directory:', response.files.length);
        
        // Count all files recursively using the API (this is the correct approach)
        await this.countAllFiles();
        
        // ❌ REMOVED: Don't call calculateStorageUsed here!
        // This was overwriting the correct recursive size from the API
        // this.calculateStorageUsed(response.files);
        
      } else {
        console.warn('📊 listDirectory failed or no files returned');
        // Only use fallback if API completely fails
        this.countVisibleFiles();
      }
    } catch (error) {
      console.error('📊 Error calculating file stats:', error);
      // Only use fallback if there's an error
      this.countVisibleFiles();
    }
  },

  // Enhanced countAllFiles with better debugging
  async countAllFiles() {
    try {
      console.log('📊 === Calling getStats API ===');
      
      const response = await window.fileManager.apiCall('getStats', {});
      
      console.log('📊 getStats full response:', response);
      
      if (response.success) {
        console.log('📊 ✅ API call successful, updating stats:');
        
        this.stats.totalFiles = response.totalFiles || 0;
        this.stats.storageUsed = response.storageUsed || 0;
        this.stats.processedFiles = response.processedFiles || 0;
        
        console.log('📊 Updated stats object:', this.stats);
        
      } else {
        console.warn('📊 ❌ API call failed, using fallback counting');
        console.warn('📊 Error from API:', response.error);
        
        // Fallback: count files in current view
        this.countVisibleFiles();
      }
    } catch (error) {
      console.error('📊 ❌ Stats API not available, using fallback counting:', error);
      this.countVisibleFiles();
    }
  },

  // Enhanced fallback method with debugging
  countVisibleFiles() {
    console.log('📊 === Using Fallback File Counting ===');
    
    const fileItems = document.querySelectorAll('.file-item[data-type="file"]');
    this.stats.totalFiles = fileItems.length;
    
    console.log('📊 Visible files found:', fileItems.length);
    
    // Estimate storage from visible files
    let totalSize = 0;
    fileItems.forEach((item, index) => {
      const sizeText = item.querySelector('.file-details')?.textContent || '';
      const sizeMatch = sizeText.match(/(\d+(?:\.\d+)?)\s*(KB|MB|GB)/i);
      if (sizeMatch) {
        const size = parseFloat(sizeMatch[1]);
        const unit = sizeMatch[2].toUpperCase();
        const multiplier = { KB: 1024, MB: 1024*1024, GB: 1024*1024*1024 }[unit] || 1;
        const fileSize = size * multiplier;
        totalSize += fileSize;
        
        if (index < 5) { // Log first 5 files for debugging
          console.log(`📊 File ${index + 1}: ${sizeText} = ${fileSize} bytes`);
        }
      }
    });
    
    this.stats.storageUsed = totalSize;
    console.log('📊 Fallback calculation complete - Total size:', totalSize, '(', this.formatFileSize(totalSize), ')');
  },

  // Calculate storage used from file list
  calculateStorageUsed(files) {
    let totalSize = 0;
    
    files.forEach(file => {
      if (file.type === 'file' && file.size) {
        totalSize += parseInt(file.size) || 0;
      }
    });
    
    // Only update if we got a meaningful result
    if (totalSize > 0) {
      this.stats.storageUsed = totalSize;
    }
  },

  // Calculate processing statistics from DZI processor
  calculateProcessingStats() {
    if (!window.dziProcessor || !window.dziProcessor.activeJobs) {
      this.stats.processingFiles = 0;
      return;
    }
    
    let processingCount = 0;
    let completedCount = 0;
    
    window.dziProcessor.activeJobs.forEach((job, guid) => {
      const status = job.status || 'pending';
      
      if (['finished', 'completed'].includes(status)) {
        completedCount++;
      } else if (!['failed', 'error'].includes(status)) {
        processingCount++;
      }
    });
    
    this.stats.processingFiles = processingCount;
    
    // Add completed jobs to processed count (but don't double count)
    // This is a simple approximation - in a real system you'd track this properly
    if (completedCount > 0 && this.stats.processedFiles === 0) {
      this.stats.processedFiles = completedCount;
    }
  },

  // Render dashboard statistics to the UI
  renderDashboardStats() {
    // Update total files
    const totalFilesElement = document.getElementById('totalFilesCount');
    if (totalFilesElement) {
      this.animateCounterUpdate(totalFilesElement, this.stats.totalFiles);
    }
    
    // Update processed files
    const processedFilesElement = document.getElementById('processedFilesCount');
    if (processedFilesElement) {
      this.animateCounterUpdate(processedFilesElement, this.stats.processedFiles);
    }
    
    // Update processing files
    const processingFilesElement = document.getElementById('processingFilesCount');
    if (processingFilesElement) {
      this.animateCounterUpdate(processingFilesElement, this.stats.processingFiles);
    }
    
    // Update storage used
    const storageUsedElement = document.getElementById('storageUsed');
    if (storageUsedElement) {
      const formattedStorage = this.formatFileSize(this.stats.storageUsed);
      this.animateTextUpdate(storageUsedElement, formattedStorage);
    }
    
    console.log('Dashboard stats updated:', this.stats);
  },

  // Animate counter updates
  animateCounterUpdate(element, newValue) {
    const currentValue = parseInt(element.textContent) || 0;
    
    if (currentValue === newValue) return;
    
    const duration = 500; // 500ms animation
    const steps = 20;
    const stepValue = (newValue - currentValue) / steps;
    const stepDuration = duration / steps;
    
    let currentStep = 0;
    
    const updateStep = () => {
      currentStep++;
      const value = Math.round(currentValue + (stepValue * currentStep));
      element.textContent = currentStep === steps ? newValue : value;
      
      if (currentStep < steps) {
        setTimeout(updateStep, stepDuration);
      }
    };
    
    updateStep();
  },

  // Animate text updates with a subtle transition
  animateTextUpdate(element, newText) {
    if (element.textContent === newText) return;
    
    element.style.transition = 'opacity 0.3s ease';
    element.style.opacity = '0.5';
    
    setTimeout(() => {
      element.textContent = newText;
      element.style.opacity = '1';
    }, 150);
  },

  // Format file size for display
  formatFileSize(bytes) {
    if (bytes === 0) return '0 MB';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    const size = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
    return size + ' ' + sizes[i];
  },

  // Manually refresh dashboard stats
  refreshDashboard() {
    console.log('Manually refreshing dashboard stats...');
    this.updateDashboardStats();
  },

  // Event handlers for file operations that should update stats
  onFileUploaded() {
    console.log('File uploaded - updating stats');
    setTimeout(() => this.updateDashboardStats(), 1000);
  },

  onFileDeleted() {
    console.log('File deleted - updating stats');
    setTimeout(() => this.updateDashboardStats(), 1000);
  },

  onFileProcessingStarted() {
    console.log('File processing started - updating stats');
    this.updateDashboardStats();
  },

  onFileProcessingCompleted() {
    console.log('File processing completed - updating stats');
    this.updateDashboardStats();
  },

  // Original loading methods
  showLoading(message) {
    message = message || 'Loading...';
    const overlay = document.getElementById('loadingOverlay');
    const text = overlay.querySelector('p');
    if (text) text.textContent = message;
    overlay.classList.add('active');
  },

  hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.remove('active');
  }
};

// Enhanced integration with file operations
window.DashboardIntegration = {
  
  // Hook into file manager operations
  setupFileManagerHooks() {
    if (!window.fileManager) return;
    
    // Store original methods
    const originalUploadFiles = window.fileManager.uploadFiles;
    const originalDeleteSelectedFiles = window.fileManager.deleteSelectedFiles;
    const originalLoadDirectory = window.fileManager.loadDirectory;
    
    // Wrap upload method
    window.fileManager.uploadFiles = async function(...args) {
      const result = await originalUploadFiles.apply(this, args);
      window.PolyscopeApp.onFileUploaded();
      return result;
    };
    
    // Wrap delete method
    window.fileManager.deleteSelectedFiles = async function(...args) {
      const result = await originalDeleteSelectedFiles.apply(this, args);
      window.PolyscopeApp.onFileDeleted();
      return result;
    };
    
    // Wrap directory loading to update stats
    window.fileManager.loadDirectory = async function(...args) {
      const result = await originalLoadDirectory.apply(this, args);
      window.PolyscopeApp.updateDashboardStats();
      return result;
    };
    
    console.log('Dashboard integration hooks set up');
  },

  // Hook into DZI processor operations
  setupDZIProcessorHooks() {
    if (!window.dziProcessor) return;
    
    // Store original methods
    const originalProcessSelectedFiles = window.dziProcessor.processSelectedFiles;
    const originalUpdateJobStatuses = window.dziProcessor.updateJobStatuses;
    
    // Wrap process method
    window.dziProcessor.processSelectedFiles = async function(...args) {
      const result = await originalProcessSelectedFiles.apply(this, args);
      window.PolyscopeApp.onFileProcessingStarted();
      return result;
    };
    
    // Wrap status update method
    window.dziProcessor.updateJobStatuses = function(jobs) {
      const hadCompletedJobs = Array.from(this.activeJobs.values())
        .some(job => ['finished', 'completed'].includes(job.status));
      
      const result = originalUpdateJobStatuses.apply(this, [jobs]);
      
      const hasCompletedJobs = Array.from(this.activeJobs.values())
        .some(job => ['finished', 'completed'].includes(job.status));
      
      if (!hadCompletedJobs && hasCompletedJobs) {
        window.PolyscopeApp.onFileProcessingCompleted();
      }
      
      // Always update processing count
      window.PolyscopeApp.updateDashboardStats();
      
      return result;
    };
    
    console.log('DZI processor integration hooks set up');
  }
};

// Main Application Initialization and Testing Functions
window.testDZI = {
  checkStatus: function() {
    if (window.dziProcessor) {
      window.dziProcessor.manualStatusCheck();
    } else {
      console.log('DZI Processor not ready');
    }
  },
  
  showJobs: function() {
    if (window.dziProcessor) {
      window.dziProcessor.showJobState();
    } else {
      console.log('DZI Processor not ready');
    }
  },
  
  refreshDashboard: function() {
    window.PolyscopeApp.refreshDashboard();
  }
};

// Navigation testing functions
window.testNavigation = {
  goToFiles: () => window.PolyscopeNavigation.showView('fileManagerView', true),
  goToProcessing: () => window.PolyscopeNavigation.showView('processingView', true),
  toggleAutoTransition: () => {
    const current = window.PolyscopeNavigation.automaticTransitionEnabled;
    window.PolyscopeNavigation.setAutoTransition(!current);
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('Polyscope File Manager with Enhanced Navigation initialized');
  
  // Initialize UI system first
  PolyscopeUI.init();
  console.log('Modern UI system initialized');
  
  // Initialize file manager
  window.fileManager = new EnhancedPolyscopeFileManager();
  console.log('Enhanced Polyscope File Manager fully initialized');
  
  // Initialize dashboard
  window.PolyscopeApp.initializeDashboard();
  console.log('Dashboard stats system initialized');
  
  // Set up integration hooks after both systems are ready
  setTimeout(() => {
    window.DashboardIntegration.setupFileManagerHooks();
    window.DashboardIntegration.setupDZIProcessorHooks();
    console.log('Dashboard integration completed');
    
    // Initialize navigation
    if (window.PolyscopeNavigation) {
      window.PolyscopeNavigation.init();
      console.log('Navigation system initialized');
    }
    
    // Set up navigation event listeners
    if (window.PolyscopeUtils && window.PolyscopeUtils.events) {
      window.PolyscopeUtils.events.on('viewChanged', function(data) {
        console.log('View changed to:', data.viewId, 'Manual:', data.isManual);
        
        // Update dashboard when switching views
        if (data.viewId === 'fileManagerView') {
          setTimeout(() => window.PolyscopeApp.updateDashboardStats(), 500);
        }
      });
    }
    
    // Initial dashboard update
    setTimeout(() => {
      window.PolyscopeApp.updateDashboardStats();
    }, 1000);
    
  }, 1000); // Give all systems time to initialize
});

// Debug function to manually update stats
window.updateDashboard = () => {
  console.log('=== Manual Dashboard Update ===');
  window.PolyscopeApp.refreshDashboard();
};