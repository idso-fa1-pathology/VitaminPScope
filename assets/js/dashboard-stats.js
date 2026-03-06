// Dashboard Statistics Management
window.PolyscopeDashboard = {
  
    stats: {
      totalFiles: 0,
      processedFiles: 0,
      processingFiles: 0,
      storageUsed: '0 MB'
    },
    
    // Initialize dashboard
    init() {
      console.log('Dashboard stats initializing...');
      this.updateStats();
      
      // Update stats when files change
      if (window.PolyscopeUtils && window.PolyscopeUtils.events) {
        window.PolyscopeUtils.events.on('filesLoaded', () => {
          this.updateStats();
        });
        
        window.PolyscopeUtils.events.on('filesUploaded', () => {
          this.updateStats();
        });
        
        window.PolyscopeUtils.events.on('processingStarted', () => {
          this.updateStats();
        });
      }
      
      // Update stats every 30 seconds
      setInterval(() => {
        this.updateStats();
      }, 30000);
    },
    
    // Update all statistics
    async updateStats() {
      try {
        // Get file statistics from file manager if available
        if (window.fileManager) {
          await this.updateFileStats();
        }
        
        // Get processing statistics from DZI processor if available
        if (window.dziProcessor) {
          this.updateProcessingStats();
        }
        
        // Update storage statistics
        await this.updateStorageStats();
        
        // Update the UI
        this.renderStats();
        
      } catch (error) {
        console.warn('Error updating dashboard stats:', error);
      }
    },
    
    // Update file-related statistics
    async updateFileStats() {
      try {
        // Call your existing file manager API to get directory stats
        const response = await fetch('/api/fileManager.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'getDirectoryStats',
            path: '' // Root directory
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            this.stats.totalFiles = result.totalFiles || 0;
            this.stats.storageUsed = this.formatFileSize(result.totalSize || 0);
          }
        }
      } catch (error) {
        console.warn('Error getting file stats:', error);
        // Fallback: count files from current file list if available
        this.fallbackFileCount();
      }
    },
    
    // Fallback method to count files from UI
    fallbackFileCount() {
      const fileItems = document.querySelectorAll('.file-item');
      let fileCount = 0;
      
      fileItems.forEach(item => {
        if (item.dataset.type !== 'directory') {
          fileCount++;
        }
      });
      
      this.stats.totalFiles = fileCount;
    },
    
    // Update processing-related statistics
    updateProcessingStats() {
      if (!window.dziProcessor || !window.dziProcessor.activeJobs) {
        return;
      }
      
      let processing = 0;
      let completed = 0;
      
      window.dziProcessor.activeJobs.forEach((job) => {
        if (['finished', 'completed'].includes(job.status)) {
          completed++;
        } else if (!['failed', 'error'].includes(job.status)) {
          processing++;
        }
      });
      
      this.stats.processingFiles = processing;
      
      // Get completed count from customer results if possible
      this.getCompletedFilesCount().then(count => {
        this.stats.processedFiles = count + completed;
        this.renderStats();
      });
    },
    
    // Get completed files count from customer directory
    async getCompletedFilesCount() {
      try {
        const username = window.PolyscopeConfig?.user?.username;
        if (!username) return 0;
        
        const response = await fetch('/api/fileManager.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'getCustomerResultsCount',
            username: username
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          return result.success ? (result.count || 0) : 0;
        }
      } catch (error) {
        console.warn('Error getting completed files count:', error);
      }
      
      return 0;
    },
    
    // Update storage statistics
    async updateStorageStats() {
      try {
        const response = await fetch('/api/fileManager.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'getStorageStats'
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            this.stats.storageUsed = this.formatFileSize(result.usedSpace || 0);
          }
        }
      } catch (error) {
        console.warn('Error getting storage stats:', error);
      }
    },
    
    // Render statistics to the UI
    renderStats() {
      const elements = {
        totalFiles: document.getElementById('totalFiles'),
        processedFiles: document.getElementById('processedFiles'),
        processingFiles: document.getElementById('processingFiles'),
        storageUsed: document.getElementById('storageUsed')
      };
      
      // Update each stat element with animation
      Object.keys(elements).forEach(key => {
        const element = elements[key];
        if (element) {
          const newValue = this.stats[key];
          const currentValue = element.textContent;
          
          if (currentValue !== newValue.toString()) {
            // Add update animation
            element.style.transform = 'scale(1.1)';
            element.style.transition = 'transform 0.2s ease';
            
            setTimeout(() => {
              element.textContent = newValue;
              element.style.transform = 'scale(1)';
            }, 100);
          }
        }
      });
      
      // Update stat card hover effects based on values
      this.updateStatCardStates();
    },
    
    // Update stat card visual states
    updateStatCardStates() {
      const cards = document.querySelectorAll('.stat-card');
      
      cards.forEach((card, index) => {
        const value = card.querySelector('.stat-value');
        if (!value) return;
        
        const numValue = parseInt(value.textContent) || 0;
        
        // Add visual indicators based on values
        card.classList.remove('stat-active', 'stat-warning');
        
        if (index === 2 && numValue > 0) { // Processing files
          card.classList.add('stat-active');
        } else if (index === 0 && numValue > 100) { // Too many files
          card.classList.add('stat-warning');
        }
      });
    },
    
    // Format file size for display
    formatFileSize(bytes) {
      if (!bytes || bytes === 0) return '0 MB';
      
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      const index = Math.floor(Math.log(bytes) / Math.log(1024));
      const size = (bytes / Math.pow(1024, index)).toFixed(1);
      
      return `${size} ${units[index]}`;
    },
    
    // Manual refresh of stats
    refresh() {
      console.log('Manually refreshing dashboard stats...');
      this.updateStats();
    },
    
    // Get current stats for external use
    getCurrentStats() {
      return { ...this.stats };
    }
  };
  
  // Initialize dashboard when file manager is ready
  document.addEventListener('DOMContentLoaded', function() {
    // Wait for file manager to initialize first
    setTimeout(() => {
      if (window.PolyscopeDashboard) {
        window.PolyscopeDashboard.init();
        console.log('Dashboard statistics initialized');
      }
    }, 1000);
  });
  
  // Add CSS for stat card states
  if (document.head) {
    const style = document.createElement('style');
    style.textContent = `
      .stat-card.stat-active {
        border-left: 4px solid var(--primary-color);
        background: linear-gradient(135deg, var(--bg-primary), var(--primary-light));
      }
      
      .stat-card.stat-warning {
        border-left: 4px solid var(--warning-color);
        background: linear-gradient(135deg, var(--bg-primary), var(--warning-light));
      }
      
      .stat-card .stat-value {
        transition: all 0.3s ease;
      }
    `;
    document.head.appendChild(style);
  }