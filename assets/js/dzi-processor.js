// Enhanced DZI Processor with User Filtering
class DZIProcessor {
  constructor(fileManager) {
    console.log('=== DZI Processor Constructor Started ===');
    this.fileManager = fileManager;
    this.activeJobs = new Map();
    this.statusCheckInterval = null;
    this.totalQueueCount = 0; // Track total jobs in queue
    this.currentUser = window.PolyscopeConfig?.user?.username || 'guest';
    this.storageKey = `polyscope_jobs_${this.currentUser}`; // User-specific storage key
    
    // Processing steps mapping - Updated with server status mapping
    this.processingSteps = {
      'pending': { step: 1, label: 'Pending', description: 'Job queued for processing', icon: '⏳' },
      'checksum': { step: 2, label: 'Checksum', description: 'Computing file checksum', icon: '🔍' },
      'upload': { step: 3, label: 'Upload', description: 'Uploading file', icon: '📤' },
      'uploading': { step: 3, label: 'Uploading', description: 'File upload in progress', icon: '📤' },
      'uploaded': { step: 3, label: 'Uploaded', description: 'File uploaded successfully', icon: '✅' },
      'prepare': { step: 4, label: 'Prepare', description: 'Preparing for processing', icon: '⚙️' },
      'queue': { step: 5, label: 'Queued', description: 'Waiting in processing queue', icon: '🕐' },
      'inqueue': { step: 5, label: 'Queued', description: 'Waiting in processing queue', icon: '🕐' }, // Server format
      'processing': { step: 6, label: 'Processing', description: 'Converting to DZI format', icon: '🔄' },
      'finished': { step: 7, label: 'Finished', description: 'DZI conversion complete', icon: '🎉' },
      'completed': { step: 7, label: 'Completed', description: 'DZI conversion complete', icon: '🎉' },
      'failed': { step: 0, label: 'Failed', description: 'Processing failed', icon: '❌' },
      'error': { step: 0, label: 'Error', description: 'An error occurred', icon: '❌' }
    };
    
    // Status mapping from server format to UI format
    this.statusMapping = {
      'inQueue': 'queue',
      'inqueue': 'queue',
      'finished': 'finished',
      'completed': 'completed',
      'processing': 'processing',
      'failed': 'failed',
      'error': 'error',
      'pending': 'pending',
      'checksum': 'checksum',
      'upload': 'upload',
      'uploading': 'uploading',
      'uploaded': 'uploaded',
      'prepare': 'prepare'
    };
    
    // Initialize UI
    setTimeout(() => {
      this.loadPersistedJobs(); // Load jobs from storage first
      this.initializeUI();
      this.performInitialJobSync(); // Sync with server on page load
    }, 500);
    
    console.log('=== DZI Processor Constructor Complete ===');
  }
  
  // Save jobs to localStorage for persistence
  saveJobsToStorage() {
    try {
      const jobsArray = Array.from(this.activeJobs.entries()).map(([guid, job]) => ({
        guid,
        ...job
      }));
      localStorage.setItem(this.storageKey, JSON.stringify({
        jobs: jobsArray,
        timestamp: Date.now()
      }));
      console.log('Saved', jobsArray.length, 'jobs to storage');
    } catch (error) {
      console.warn('Failed to save jobs to storage:', error);
    }
  }
  
  // Load jobs from localStorage on page load
  loadPersistedJobs() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        console.log('No persisted jobs found');
        return;
      }
      
      const data = JSON.parse(stored);
      const now = Date.now();
      
      // Only load jobs that are less than 24 hours old
      if (data.timestamp && (now - data.timestamp) > (24 * 60 * 60 * 1000)) {
        console.log('Persisted jobs too old, clearing storage');
        localStorage.removeItem(this.storageKey);
        return;
      }
      
      if (data.jobs && Array.isArray(data.jobs)) {
        data.jobs.forEach(job => {
          // Only restore jobs that are not completed
          if (!['finished', 'completed', 'failed', 'error'].includes(job.status)) {
            this.activeJobs.set(job.guid, {
              ...job,
              restoredFromStorage: true
            });
          }
        });
        console.log('Restored', this.activeJobs.size, 'active jobs from storage');
      }
    } catch (error) {
      console.warn('Failed to load persisted jobs:', error);
      localStorage.removeItem(this.storageKey);
    }
  }
  
  // Map server status to UI status
  mapServerStatus(serverStatus) {
    const mapped = this.statusMapping[serverStatus] || serverStatus;
    console.log('Status mapping:', serverStatus, '->', mapped);
    return mapped;
  }
  
  // Enhanced job status updates with user filtering
// FIXED: Process ALL server jobs first, then filter only for NEW job additions
updateJobStatuses(serverJobs) {
  let hasActiveJobs = false;
  let statusChanged = false;
  
  console.log('=== updateJobStatuses called ===');
  console.log('Server jobs:', serverJobs?.length || 0);
  console.log('Current user:', this.currentUser);
  console.log('Active jobs in UI:', this.activeJobs.size);
  
  if (!serverJobs || !Array.isArray(serverJobs)) {
    console.warn('Invalid server jobs data:', serverJobs);
    return;
  }
  
  // Count only active jobs for queue display (not for processing logic!)
  const activeServerJobs = serverJobs.filter(serverJobWrapper => {
    const serverJob = serverJobWrapper.data || serverJobWrapper;
    const mappedStatus = this.mapServerStatus(serverJob.status);
    return !['finished', 'completed', 'failed', 'error'].includes(mappedStatus);
  });
  this.totalQueueCount = activeServerJobs.length;
  console.log('Total active jobs in queue:', this.totalQueueCount, 'out of', serverJobs.length, 'total jobs');
  
  // CRITICAL FIX: Process ALL server jobs (not just active ones!)
  console.log('Processing ALL server jobs for status updates...');
  
  serverJobs.forEach((serverJobWrapper, index) => {
    const serverJob = serverJobWrapper.data || serverJobWrapper;
    
    console.log(`Processing server job ${index}:`, {
      guid: serverJob.guid?.substring(0, 8),
      status: serverJob.status,
      filename: this.extractFilenameFromPath(serverJob.origFilename)
    });
    
    // Check if this job exists in our UI (regardless of status or user filtering)
    if (this.activeJobs.has(serverJob.guid)) {
      const localJob = this.activeJobs.get(serverJob.guid);
      const oldStatus = localJob.status;
      
      // Map server status to UI status
      const mappedStatus = this.mapServerStatus(serverJob.status);
      
      console.log(`Job ${serverJob.guid.substring(0, 8)} status check:`, {
        oldStatus: oldStatus,
        serverStatus: serverJob.status,
        mappedStatus: mappedStatus,
        willUpdate: oldStatus !== mappedStatus
      });
      
      if (oldStatus !== mappedStatus) {
        localJob.status = mappedStatus;
        statusChanged = true;
        
        console.log('✅ Job status UPDATED:', {
          guid: serverJob.guid.substring(0, 8),
          from: oldStatus,
          to: mappedStatus,
          filename: localJob.origFilename
        });
        
        // Show notification for important status changes
        if (mappedStatus === 'finished' || mappedStatus === 'completed') {
          console.log('🎉 Job completed notification:', localJob.origFilename);
          this.fileManager.showSuccess(`DZI processing completed for ${localJob.origFilename}!`);
          
          // Mark completion time
          if (!localJob.completedTime) {
            localJob.completedTime = Date.now();
          }
        } else if (mappedStatus === 'failed' || mappedStatus === 'error') {
          console.log('❌ Job failed notification:', localJob.origFilename);
          this.fileManager.showError(`DZI processing failed for ${localJob.origFilename}`);
          
          if (!localJob.completedTime) {
            localJob.completedTime = Date.now();
          }
        }
      } else {
        console.log(`Job ${serverJob.guid.substring(0, 8)} status unchanged:`, mappedStatus);
      }
      
      // Check if job is still active (not finished)
      if (!['finished', 'completed', 'failed', 'error'].includes(mappedStatus)) {
        hasActiveJobs = true;
        console.log('Job still active:', serverJob.guid.substring(0, 8), 'status:', mappedStatus);
      }
      
    } else {
      // This is a NEW job not in our UI - apply user filtering
      console.log('⚠️ New server job not in UI:', serverJob.guid?.substring(0, 8));
      
      // Only add new jobs if they belong to current user AND are not finished
      if (this.isUserJob(serverJob)) {
        const mappedStatus = this.mapServerStatus(serverJob.status);
        
        // Only add if it's an active job (not finished)
        if (!['finished', 'completed', 'failed', 'error'].includes(mappedStatus)) {
          console.log('Adding missing active job to UI:', serverJob.guid.substring(0, 8));
          const filename = this.extractFilenameFromPath(serverJob.origFilename);
          const jobData = {
            guid: serverJob.guid,
            id: serverJob.id || serverJob.guid,
            name: serverJob.name || filename,
            origFilename: filename,
            status: mappedStatus,
            addedTime: Date.now(),
            username: this.extractUsernameFromJob(serverJob)
          };
          
          this.activeJobs.set(serverJob.guid, jobData);
          statusChanged = true;
          hasActiveJobs = true;
          console.log('Added missing job:', jobData);
        } else {
          console.log('Skipping finished job not in UI:', serverJob.guid.substring(0, 8));
        }
      } else {
        console.log('Job does not belong to current user, skipping');
      }
    }
  });
  
  // Clean up old completed jobs (after 2 minutes)
  const now = Date.now();
  const jobsToRemove = [];
  
  this.activeJobs.forEach((job, guid) => {
    if (job.completedTime && (now - job.completedTime > 120000)) { // 2 minutes
      jobsToRemove.push(guid);
    }
  });
  
  jobsToRemove.forEach(guid => {
    console.log('Removing old completed job:', guid.substring(0, 8));
    this.activeJobs.delete(guid);
    statusChanged = true;
  });
  
  // Force UI update if anything changed
  if (statusChanged) {
    console.log('🔄 Status changed, forcing UI update');
    this.updateProcessingUI();
    this.saveJobsToStorage();
  } else {
    console.log('No status changes detected');
  }
  
  // Determine if we should continue status checking
  const hasIncompleteJobs = Array.from(this.activeJobs.values()).some(job => 
    !['finished', 'completed', 'failed', 'error'].includes(job.status)
  );
  
  console.log('Status check summary:', {
    hasActiveJobs: hasActiveJobs,
    hasIncompleteJobs: hasIncompleteJobs,
    totalUIJobs: this.activeJobs.size,
    shouldContinueChecking: hasIncompleteJobs
  });
  
  // Stop checking if no incomplete jobs
  if (!hasIncompleteJobs) {
    if (this.activeJobs.size === 0) {
      console.log('🛑 No jobs remaining, stopping status checks');
      this.stopStatusChecking();
    } else {
      console.log('🛑 All jobs completed, will stop checking after cleanup delay');
      // Jobs will be cleaned up after 2 minutes, then checking will stop
    }
  }
}
  
  // Check if a job belongs to the current user
  isUserJob(serverJob) {
    // Method 1: Check if origFilename contains the username path
    if (serverJob.origFilename && serverJob.origFilename.includes(`/Users/${this.currentUser}/`)) {
      return true;
    }
    
    // Method 2: Check if there's a username field that matches
    if (serverJob.username && serverJob.username === this.currentUser) {
      return true;
    }
    
    // Method 3: Check if any path-like field contains the user directory
    const pathFields = ['origFilename', 'path', 'filePath', 'inputPath'];
    for (const field of pathFields) {
      if (serverJob[field] && typeof serverJob[field] === 'string') {
        if (serverJob[field].includes(`/${this.currentUser}/`) || 
            serverJob[field].includes(`Users/${this.currentUser}/`) ||
            serverJob[field].includes(`${this.currentUser}-`)) {
          return true;
        }
      }
    }
    
    console.log('Job does not belong to current user:', serverJob.guid, 'user:', this.currentUser);
    return false;
  }
  
  // Extract username from job data
  extractUsernameFromJob(serverJob) {
    if (serverJob.username) return serverJob.username;
    
    // Try to extract from path
    if (serverJob.origFilename) {
      const pathMatch = serverJob.origFilename.match(/\/Users\/([^\/]+)\//);
      if (pathMatch) return pathMatch[1];
    }
    
    return this.currentUser; // Default to current user
  }
  
  // Helper function to extract filename from full path
  extractFilenameFromPath(fullPath) {
    if (!fullPath) return 'Unknown file';
    return fullPath.split('/').pop() || fullPath;
  }
  
  // Initialize UI enhancements
  initializeUI() {
    this.createProcessingStatusUI();
  }
  
  // Create processing status UI with queue stats
  createProcessingStatusUI() {
    const processingView = document.getElementById('processingView');
    const processingContent = document.getElementById('processingContent');
    
    processingContent.innerHTML = `
      <div class="file-toolbar">
        <div class="toolbar-left">
          <h3 style="margin: 0; color: var(--text-primary);">Processing Status</h3>
          <div class="queue-stats" style="display: flex; gap: var(--space-4); align-items: center; margin-left: var(--space-4);">
            <div class="stat-item" style="display: flex; align-items: center; gap: var(--space-2);">
              <span style="color: var(--text-secondary); font-size: 0.875rem;">My Jobs:</span>
              <span id="myJobsCount" style="font-weight: 600; color: var(--primary-color);">0</span>
            </div>
            <div class="stat-item" style="display: flex; align-items: center; gap: var(--space-2);">
              <span style="color: var(--text-secondary); font-size: 0.875rem;">Total Queue:</span>
              <span id="totalQueueCount" style="font-weight: 600; color: var(--warning-color);">0</span>
            </div>
          </div>
        </div>
        <div class="toolbar-right">
          <button id="refreshStatusBtn" class="btn btn-outline">🔄 Refresh Status</button>
        </div>
      </div>
      <div id="processingJobs" style="padding: 1.5rem;"></div>
    `;
    
    // Add refresh button handler
    document.getElementById('refreshStatusBtn').addEventListener('click', () => {
      console.log('Manual refresh button clicked');
      this.manualStatusCheck();
    });
    
    this.updateProcessingUI();
  }
  
  // Update processing UI with current jobs and stats
  updateProcessingUI() {
    const jobsContainer = document.getElementById('processingJobs');
    const myJobsCountEl = document.getElementById('myJobsCount');
    const totalQueueCountEl = document.getElementById('totalQueueCount');
    
    if (!jobsContainer) return;
    
    // Update counters
    if (myJobsCountEl) {
      myJobsCountEl.textContent = this.activeJobs.size;
    }
    if (totalQueueCountEl) {
      totalQueueCountEl.textContent = this.totalQueueCount;
    }
    
    if (this.activeJobs.size === 0) {
      jobsContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <h3>No active processing jobs</h3>
          <p>Process some files from the file manager to see status here</p>
          ${this.totalQueueCount > 0 ? `<p style="margin-top: var(--space-4); color: var(--text-secondary);">
            <strong>${this.totalQueueCount}</strong> total jobs in the system queue
          </p>` : ''}
        </div>
      `;
      return;
    }
    
    let jobsHTML = '';
    this.activeJobs.forEach((job, guid) => {
      const stepInfo = this.processingSteps[job.status] || this.processingSteps['pending'];
      const progressPercent = Math.min(100, (stepInfo.step / 7) * 100);
      
      jobsHTML += `
        <div class="processing-job-card" style="
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          padding: 1.5rem;
          margin-bottom: 1rem;
          box-shadow: var(--shadow-sm);
        ">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
            <div style="flex: 1;">
              <h4 style="margin: 0 0 0.5rem 0; color: var(--text-primary);">
                ${job.origFilename}
              </h4>
              <p style="margin: 0; color: var(--text-secondary); font-size: 0.875rem;">
                Job ID: ${guid.substring(0, 8)}... | Status: ${job.status}
              </p>
            </div>
            <div style="text-align: right;">
              <span class="status-indicator status-${job.status.toLowerCase()}" style="
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.5rem 1rem;
                border-radius: 20px;
                font-size: 0.875rem;
                font-weight: 500;
              ">
                <span>${stepInfo.icon}</span>
                <span>${stepInfo.label}</span>
              </span>
            </div>
          </div>
          
          <div style="margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span style="font-size: 0.875rem; color: var(--text-secondary);">
                ${stepInfo.description}
              </span>
              <span style="font-size: 0.875rem; color: var(--text-secondary);">
                Step ${stepInfo.step} of 7
              </span>
            </div>
            <div style="
              width: 100%;
              height: 8px;
              background: var(--bg-tertiary);
              border-radius: 4px;
              overflow: hidden;
            ">
              <div style="
                width: ${progressPercent}%;
                height: 100%;
                background: ${stepInfo.step === 0 ? 'var(--error-color)' : 'var(--primary-color)'};
                border-radius: 4px;
                transition: width 0.3s ease;
              "></div>
            </div>
          </div>
          
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <small style="color: var(--text-muted);">
              Started: ${new Date(job.addedTime).toLocaleTimeString()}
            </small>
            ${stepInfo.step === 7 ? `
              <button class="btn btn-success btn-sm" onclick="alert('DZI files ready for viewing!')">
                View Result
              </button>
            ` : stepInfo.step === 0 ? `
              <button class="btn btn-outline btn-sm" onclick="window.dziProcessor.retryJob('${guid}')">
                Retry
              </button>
            ` : ''}
          </div>
        </div>
      `;
    });
    
    jobsContainer.innerHTML = jobsHTML;
  }
  
  // View switching methods
  showProcessingView() {
    document.getElementById('fileManagerView').classList.remove('active');
    document.getElementById('fileManagerView').style.display = 'none';
    document.getElementById('processingView').classList.add('active');
    document.getElementById('processingView').style.display = 'block';
    this.updateProcessingUI();
  }
  
  showFileManagerView() {
    document.getElementById('fileManagerView').classList.add('active');
    document.getElementById('fileManagerView').style.display = 'block';
    document.getElementById('processingView').classList.remove('active');
    document.getElementById('processingView').style.display = 'none';
  }
  
  async processSelectedFiles() {
    console.log('=== processSelectedFiles() Called ===');
    
    if (this.fileManager.selectedFiles.size === 0) {
      PolyscopeUI.error('No files selected for processing');
      return;
    }
    
    const selectedFiles = Array.from(this.fileManager.selectedFiles);
    console.log('Selected files array:', selectedFiles);
    
    const dziCompatibleFiles = selectedFiles.filter(path => {
      const ext = path.toLowerCase().split('.').pop();
      return [
        'svs', 'ndpi', 'czi', 'scn', 'mrxs', 'vsi', 'vms',
        'tiff', 'tif', 'jpg', 'jpeg', 'png', 'bmp', 'gif', 'webp',
        'dcm', 'dicom', 'nii', 'nrrd',
        'jp2', 'j2k', 'jpx', 'jpm'
      ].includes(ext);
    });
    
    if (dziCompatibleFiles.length === 0) {
      PolyscopeUI.error('No DZI-compatible image files selected');
      return;
    }
    
    const filesToProcess = dziCompatibleFiles.map(relativePath => {
      const cleanPath = relativePath.replace(/^\/+/, '');
      return '/media/Users/' + PolyscopeConfig.user.username + '/' + cleanPath;
    });
    
    try {
      this.fileManager.showLoading('Starting DZI processing...');
      
      const formData = new URLSearchParams();
      formData.append('path', JSON.stringify(filesToProcess));
      formData.append('isDir', JSON.stringify(false));
      
      const response = await fetch('/issueUploadProject.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: formData.toString()
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const responseText = await response.text();
      if (!responseText || responseText.trim() === '') {
        throw new Error('Empty response from server');
      }
      
      const result = JSON.parse(responseText);
      console.log('Processing result:', result);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      this.handleProcessingResult(result, filesToProcess);
      PolyscopeUI.success('DZI processing started! Switching to status view...');
      
      setTimeout(() => {
        this.showProcessingView();
      }, 1000);
      
      this.startStatusChecking();
      
    } catch (error) {
      console.error('Error starting DZI processing:', error);
      PolyscopeUI.error('Error: ' + error.message);
    } finally {
      this.fileManager.hideLoading();
    }
  }
  
  handleProcessingResult(result, originalFilePaths) {
    console.log('=== handleProcessingResult ===');
    console.log('Result:', result);
    
    if (result.typ === 'single') {
      this.handleSingleJob(result, originalFilePaths[0]);
    } else if (result.typ === 'multiple') {
      this.handleMultipleJobs(result, originalFilePaths);
    } else if (result.guid) {
      this.handleSingleJob(result, originalFilePaths[0]);
    } else if (result.jobs && Array.isArray(result.jobs)) {
      this.handleMultipleJobs(result, originalFilePaths);
    } else {
      console.warn('Unknown result format, but likely successful:', result);
    }
  }
  
  handleSingleJob(result, originalFilePath) {
    console.log('=== handleSingleJob ===');
    const filename = originalFilePath.split('/').pop();
    
    if (result.guid) {
      const jobData = {
        guid: result.guid,
        id: result.id || result.guid,
        name: result.name || filename,
        origFilename: filename,
        status: 'checksum',
        addedTime: Date.now(),
        username: this.currentUser
      };
      
      this.activeJobs.set(result.guid, jobData);
      console.log('Added single job:', jobData);
      this.saveJobsToStorage(); // Save immediately when job is added
    }
  }
  
  handleMultipleJobs(result, originalFilePaths) {
    console.log('=== handleMultipleJobs ===');
    
    if (result.jobs && Array.isArray(result.jobs)) {
      result.jobs.forEach((job, index) => {
        const originalFilename = originalFilePaths[index] ? 
          originalFilePaths[index].split('/').pop() : 'Unknown file';
        
        if (job.guid) {
          const jobData = {
            guid: job.guid,
            id: job.id || job.guid,
            name: job.name || originalFilename,
            origFilename: originalFilename,
            status: 'checksum',
            addedTime: Date.now(),
            username: this.currentUser
          };
          
          this.activeJobs.set(job.guid, jobData);
          console.log('Added job:', jobData);
        }
      });
      this.saveJobsToStorage(); // Save immediately when jobs are added
    }
  }
  
  async checkJobStatus() {
    try {
      const response = await fetch('/getProjectStatus.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.warn('Status check failed:', response.status);
        return;
      }
      
      const responseText = await response.text();
      if (!responseText || responseText.trim() === '') {
        console.warn('Empty status response');
        return;
      }
      
      let statusData;
      try {
        statusData = JSON.parse(responseText);
      } catch (parseError) {
        console.warn('Status response not valid JSON');
        return;
      }
      
      if (statusData && statusData.valid && statusData.jobs) {
        console.log('Status update received for', statusData.jobs.length, 'total jobs');
        this.updateJobStatuses(statusData.jobs);
      }
      
    } catch (error) {
      console.warn('Status check error:', error.message);
    }
  }
  
  startStatusChecking() {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }
    
    this.updateProcessingUI();
    
    this.statusCheckInterval = setInterval(() => {
      this.checkJobStatus();
    }, 5000);
    
    console.log('Started status checking with UI updates');
  }
  
  stopStatusChecking() {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
      console.log('Stopped status checking');
    }
  }
  
  retryJob(guid) {
    console.log('Retrying job:', guid);
    PolyscopeUI.info('Job retry requested');
  }
  
  manualStatusCheck() {
    console.log('=== Manual Status Check ===');
    this.checkJobStatus();
  }
  
  showJobState() {
    console.log('=== Current Job State ===');
    console.log('Active jobs count:', this.activeJobs.size);
    console.log('Total queue count:', this.totalQueueCount);
    this.activeJobs.forEach((job, guid) => {
      console.log('Job:', guid, job);
    });
  }
  
  destroy() {
    this.stopStatusChecking();
    this.saveJobsToStorage(); // Save before destroying
    this.activeJobs.clear();
  }
}
