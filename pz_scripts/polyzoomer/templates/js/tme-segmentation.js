/**
 * TME (Tumor Microenvironment) Segmentation Module
 * Integrates with FastAPI service at rapuplabgpu15:8001
 * Provides 11-class tissue segmentation for whole slide images
 * 
 * Dependencies: tme-storage.js (must be loaded before this file)
 */

// TME Service Configuration
const TME_CONFIG = {
    baseUrl: 'http://rapuplabgpu15:8001',
    endpoints: {
        health: '/health',
        process: '/process',
        status: '/status',
        result: '/result',
        configs: '/configs',
        jobs: '/jobs'
    },
    pollInterval: 3000, // Poll status every 3 seconds
    maxRetries: 3
};

// TME Tissue Class Colors (from model config) - UPDATED NAMES
const TME_TISSUE_COLORS = {
    0: { name: 'Non tissue', color: '#000000' },              // Black
    1: { name: 'Tumor', color: '#8B0000' },                   // Dark red/maroon
    2: { name: 'Non-inflamed stroma', color: '#FFFF00' },     // Yellow
    3: { name: 'Inflamed stroma', color: '#FF0000' },         // Red
    4: { name: 'Necrosis/Hemorrhage', color: '#FF00FF' },     // Magenta
    5: { name: 'Adipose tissue', color: '#808000' },          // Olive/dark yellow
    6: { name: 'Bronchial epithelium', color: '#00FFFF' },    // Cyan
    7: { name: 'Microvessel', color: '#0000FF' },             // Blue
    8: { name: 'Foam-like macrophages', color: '#800080' },   // Purple/dark magenta
    9: { name: 'Alveoli', color: '#008000' },                 // Green
    10: { name: 'Muscle tissue', color: '#000080' }           // Navy blue
};

// Global TME state
window.TMESegmentation = {
    isProcessing: false,
    currentJobId: null,
    pollTimer: null,
    viewer: null,
    overlays: [],
    resultsData: null,
    
    // Settings
    patchSize: 512,
    inputSize: 512,
    colorNorm: false,
    scaleFactor: 0.0625
};

// DOM elements cache
const TME_DOM = {
    status: null,
    progressContainer: null,
    progressFill: null,
    progressText: null,
    progressDetail: null,
    resultsContainer: null,
    jobStatus: null,
    jobId: null,
    jobProgress: null,
    autoRestore: null,
    
    init() {
        this.status = document.getElementById('tme-ai-status');
        this.progressContainer = document.getElementById('tmeProgressContainer');
        this.progressFill = document.getElementById('tmeProgressFill');
        this.progressText = document.getElementById('tmeProgressText');
        this.progressDetail = document.getElementById('tmeProgressDetail');
        this.resultsContainer = document.getElementById('tme-results-container');
        this.jobStatus = document.getElementById('tme-job-status');
        this.jobId = document.getElementById('tme-job-id');
        this.jobProgress = document.getElementById('tme-job-progress');
        this.autoRestore = document.getElementById('tmeAutoRestore');
    }
};

/**
 * Initialize TME Segmentation Module
 */
function initTMESegmentation() {
    console.log('Initializing TME Segmentation module...');
    TME_DOM.init();
    
    // Find viewer
    TMESegmentation.viewer = findTMEViewer();
    
    if (!TMESegmentation.viewer) {
        updateTMEStatus('⚠️ Waiting for viewer...');
        setTimeout(initTMESegmentation, 2000);
        return;
    }
    
    // Check service health
    checkTMEServiceHealth();
    
    // ✅ NEW: Try to restore previous results
    restorePreviousResults();
    
    console.log('TME Segmentation ready with viewer:', TMESegmentation.viewer.id);
}

/**
 * Restore previous TME results from storage - UPDATED FOR VPS
 */
async function restorePreviousResults() {
    // Check if storage module is available
    if (typeof TME_STORAGE === 'undefined') {
        console.warn('TME_STORAGE not available, skipping restore');
        return;
    }
    
    console.log('🔄 Checking for previous TME results...');
    
    // Get current slide path
    const slidePath = await getCurrentSlidePath();
    if (!slidePath) {
        console.warn('Could not determine slide path for results check');
        return;
    }
    
    // ✅ NEW: Try to load from VPS first, then localStorage
    const saved = await TME_STORAGE.loadResultsFromAnySource(slidePath);
    
    if (!saved) {
        console.log('No previous TME results found');
        return;
    }
    
    console.log(`✅ Found previous results from: ${saved.source}`);
    
    // Calculate age if available
    let ageText = '';
    if (saved.timestamp) {
        const savedDate = new Date(saved.timestamp);
        const now = new Date();
        const ageHours = (now - savedDate) / (1000 * 60 * 60);
        ageText = `${ageHours.toFixed(1)} hours ago`;
    } else if (saved.jobInfo && saved.jobInfo.timestamp) {
        const savedDate = new Date(saved.jobInfo.timestamp);
        const now = new Date();
        const ageHours = (now - savedDate) / (1000 * 60 * 60);
        ageText = `${ageHours.toFixed(1)} hours ago`;
    }
    
    // Check if auto-restore is enabled
    const autoRestore = TME_DOM.autoRestore?.checked ?? true;
    
    let shouldRestore = autoRestore;
    
    // If not auto-restore, ask user
    if (!autoRestore) {
        const jobId = saved.jobId || (saved.jobInfo && saved.jobInfo.job_id) || 'unknown';
        shouldRestore = confirm(
            `Previous TME analysis found!\n\n` +
            `Source: ${saved.source === 'vps' ? 'VPS Server' : 'Browser Cache'}\n` +
            `Age: ${ageText}\n` +
            `Job ID: ${jobId}\n\n` +
            `Would you like to restore these results?`
        );
    }
    
    if (shouldRestore) {
        // Restore the data
        TMESegmentation.resultsData = saved.results;
        TMESegmentation.currentJobId = saved.jobId || (saved.jobInfo && saved.jobInfo.job_id);
        
        // Display the results
        displayTMEResults(saved.results);
        
        // Update status
        const sourceText = saved.source === 'vps' ? 'VPS Server' : 'Browser Cache';
        updateTMEStatus(`✅ Results restored from ${sourceText}`);
        
        // Show notification
        if (typeof TME_NOTIFICATIONS !== 'undefined') {
            TME_NOTIFICATIONS.success(
                '📂 Results Restored',
                `Analysis loaded from ${sourceText} ${ageText ? '(' + ageText + ')' : ''}`
            );
        }
        
        console.log('✅ TME results restored successfully');
    } else {
        // Clear if user doesn't want to restore
        TME_STORAGE.clearResults();
        console.log('Previous results cleared by user choice');
    }
}

/**
 * Find available OpenSeadragon viewer - NO HARDCODING
 */
function findTMEViewer() {
    // Search for any OpenSeadragon viewer in window
    for (let key in window) {
        try {
            const obj = window[key];
            if (obj && typeof obj === 'object' && obj.viewport && 
                typeof obj.isOpen === 'function' && 
                typeof obj.addHandler === 'function' &&
                typeof obj.world === 'object') {
                console.log('✅ Found OpenSeadragon viewer:', key);
                return obj;
            }
        } catch (e) { continue; }
    }
    
    console.warn('No OpenSeadragon viewer found');
    return null;
}

/**
 * Check TME service health
 */
async function checkTMEServiceHealth() {
    try {
        const response = await fetch('../ai_proxy.php?endpoint=health_tme');
        const data = await response.json();
        
        console.log('TME Service Status:', data);
        
        if (data.status === 'healthy') {
            updateTMEStatus(`✅ TME AI Ready (GPU: ${data.gpu_available ? 'Yes' : 'No'})`);
        } else {
            updateTMEStatus('⚠️ TME AI Service Issues');
        }
    } catch (error) {
        console.error('TME Service connection failed:', error);
        updateTMEStatus('❌ TME AI Service Disconnected');
    }
}

/**
 * Start TME Analysis - UPDATED FOR ASYNC PATH
 */
async function startTMEAnalysis() {
    console.log('Starting TME Segmentation Analysis...');
    
    if (!TMESegmentation.viewer) {
        alert('No viewer available for TME analysis');
        return;
    }
    
    if (TMESegmentation.isProcessing) {
        alert('TME analysis already in progress');
        return;
    }
    
    // Get current slide file path (NOW ASYNC)
    const slidePath = await getCurrentSlidePath();
    if (!slidePath) {
        alert('Could not determine slide file path');
        return;
    }
    
    console.log('Using slide path:', slidePath);
    
    // Get parameters from UI
    TMESegmentation.patchSize = parseInt(document.getElementById('tmePatchSize')?.value || '512');
    TMESegmentation.scaleFactor = parseFloat(document.getElementById('tmeScaleFactor')?.value || '0.0625');
    TMESegmentation.colorNorm = document.getElementById('tmeColorNorm')?.checked || false;
    
    TMESegmentation.isProcessing = true;
    showTMEProgress();
    updateTMEStatus('🚀 Submitting TME job...');
    
    try {
        // Submit job to TME service
        const jobId = await submitTMEJob(slidePath);
        TMESegmentation.currentJobId = jobId;
        
        // Show job info
        showJobInfo(jobId);
        
        // Start polling for status
        startStatusPolling(jobId);
        
    } catch (error) {
        console.error('Failed to start TME analysis:', error);
        updateTMEStatus('❌ Failed to start: ' + error.message);
        TMESegmentation.isProcessing = false;
        hideTMEProgress();
        
        if (typeof TME_NOTIFICATIONS !== 'undefined') {
            TME_NOTIFICATIONS.error('Analysis Failed', error.message);
        }
    }
}

/**
 * Get current slide file path - using RELATIVE path from ai_proxy.php location
 */
/**
 * Load slide metadata from JSON file - CONSISTENT LOCATION
 */
async function loadSlideMetadata() {
    const viewer = TMESegmentation.viewer;
    if (!viewer) {
        console.warn('Viewer not available for metadata loading');
        return null;
    }
    
    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage || !tiledImage.source) {
        console.warn('No tiled image source for metadata loading');
        return null;
    }
    
    const tilesUrl = tiledImage.source.tilesUrl;
    console.log('Tiles URL for metadata:', tilesUrl);
    
    // Tiles URL: ./_UNKNOWNCHANNEL0001/MS009_UNKNOWNCHANNEL0001_MS009_HE.svsdeepzoom_files/
    // Metadata: ./_UNKNOWNCHANNEL0001/MS009_UNKNOWNCHANNEL0001_MS009_HE.svsdeepzoom_metadata.json
    
    // Replace _files/ with _metadata.json
    const metadataUrl = tilesUrl.replace('_files/', '_metadata.json');
    
    console.log('Trying metadata URL:', metadataUrl);
    
    try {
        const response = await fetch(metadataUrl);
        
        if (!response.ok) {
            console.warn('Metadata not found at:', metadataUrl);
            return null;
        }
        
        const metadata = await response.json();
        console.log('✅ Loaded metadata:', metadata);
        return metadata;
        
    } catch (error) {
        console.error('Error loading metadata:', error);
        return null;
    }
}

/**
 * Get current slide file path - FIXED FOR AI_PROXY.PHP PERSPECTIVE
 */
async function getCurrentSlidePath() {
    console.log('=== Getting slide path ===');
    
    // Try to load metadata first
    const metadata = await loadSlideMetadata();
    
    if (metadata && metadata.filename) {
        console.log('✅ Got filename from metadata:', metadata.filename);
        
        // IMPORTANT: Path must be relative to ai_proxy.php, not the current page!
        // ai_proxy.php is at: page/ai_proxy.php
        // SVS file is at: root/filename.svs
        // So from ai_proxy.php: ../filename.svs
        const relativePath = '../' + metadata.filename;
        console.log('Constructed path from metadata (relative to ai_proxy.php):', relativePath);
        
        return relativePath;
    }
    
    // Fallback: try to construct from tiles URL
    console.warn('⚠️ Metadata not available, using fallback method');
    
    const viewer = TMESegmentation.viewer;
    if (!viewer) {
        console.error('No viewer available');
        return null;
    }
    
    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage || !tiledImage.source) {
        console.error('No tiled image source found');
        return null;
    }
    
    const tilesUrl = tiledImage.source.tilesUrl;
    console.log('Tiles URL:', tilesUrl);
    
    // Extract filename from tiles URL
    // Pattern: ./_UNKNOWNCHANNEL0001/MS009_UNKNOWNCHANNEL0001_MS009_HE.svsdeepzoom_files/
    const match = tilesUrl.match(/\/([^\/]+)\.svsdeepzoom_files\//);
    if (match) {
        const filename = match[1] + '.svs';
        // Path relative to ai_proxy.php (not current page!)
        const relativePath = '../' + filename;
        console.log('Fallback path from tiles URL (relative to ai_proxy.php):', relativePath);
        return relativePath;
    }
    
    console.error('❌ Could not determine slide path');
    return null;
}

/**
 * Submit TME job to the service
 */
async function submitTMEJob(filePath) {
    const formData = new FormData();
    
    formData.append('file_path', filePath);
    formData.append('patch_size', TMESegmentation.patchSize.toString());
    formData.append('input_size', TMESegmentation.inputSize.toString());
    formData.append('color_norm', TMESegmentation.colorNorm.toString());
    formData.append('scale_factor', TMESegmentation.scaleFactor.toString());
    
    const response = await fetch('../ai_proxy.php?endpoint=process_tme', {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TME service error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('TME Job submitted:', data);
    
    if (!data.job_id) {
        throw new Error('No job ID returned from service');
    }
    
    return data.job_id;
}

/**
 * Start polling for job status
 */
function startStatusPolling(jobId) {
    console.log('Starting status polling for job:', jobId);
    
    if (TMESegmentation.pollTimer) {
        clearInterval(TMESegmentation.pollTimer);
    }
    
    pollJobStatus(jobId);
    
    TMESegmentation.pollTimer = setInterval(() => {
        pollJobStatus(jobId);
    }, TME_CONFIG.pollInterval);
}

/**
 * Poll job status from TME service
 */
async function pollJobStatus(jobId) {
    try {
        const response = await fetch(`../ai_proxy.php?endpoint=status_tme/${jobId}`);
        
        if (!response.ok) {
            throw new Error(`Status check failed: ${response.status}`);
        }
        
        const status = await response.json();
        console.log('TME Job status:', status);
        
        handleStatusUpdate(status);
        
    } catch (error) {
        console.error('Failed to poll status:', error);
        updateTMEStatus('⚠️ Status check failed: ' + error.message);
    }
}

/**
 * Handle status update from TME service
 */
function handleStatusUpdate(status) {
    const { status: jobStatus, progress, message } = status;
    
    if (typeof progress === 'number') {
        updateTMEProgress(progress, message || jobStatus);
    }
    
    if (TME_DOM.jobProgress) {
        TME_DOM.jobProgress.textContent = `Status: ${jobStatus} - ${message || ''}`;
    }
    
    if (jobStatus === 'completed') {
        console.log('TME job completed!');
        stopStatusPolling();
        fetchTMEResults(TMESegmentation.currentJobId);
        
    } else if (jobStatus === 'failed' || jobStatus === 'error') {
        console.error('TME job failed:', message);
        stopStatusPolling();
        updateTMEStatus('❌ TME Analysis Failed: ' + message);
        TMESegmentation.isProcessing = false;
        hideTMEProgress();
        
        if (typeof TME_NOTIFICATIONS !== 'undefined') {
            TME_NOTIFICATIONS.error('Analysis Failed', message || 'Unknown error');
        }
    }
}

/**
 * Stop status polling
 */
function stopStatusPolling() {
    if (TMESegmentation.pollTimer) {
        clearInterval(TMESegmentation.pollTimer);
        TMESegmentation.pollTimer = null;
    }
}

/**
 * Fetch TME results from service
 */
async function fetchTMEResults(jobId) {
    console.log('Fetching TME results for job:', jobId);
    updateTMEStatus('📊 Loading results...');
    
    try {
        const response = await fetch(`../ai_proxy.php?endpoint=result_tme/${jobId}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch results: ${response.status}`);
        }
        
        const results = await response.json();
        console.log('TME Results:', results);
        
        // Store results in memory
        TMESegmentation.resultsData = results;
        
        // ✅ NEW: Save to localStorage
        if (typeof TME_STORAGE !== 'undefined') {
            TME_STORAGE.saveResults(results, jobId);
        }
        
        // Display results
        displayTMEResults(results);
        
        updateTMEStatus('✅ TME Analysis Complete');
        
        if (typeof TME_NOTIFICATIONS !== 'undefined') {
            TME_NOTIFICATIONS.success(
                '✅ Analysis Complete',
                'TME segmentation finished successfully'
            );
        }
        
    } catch (error) {
        console.error('Failed to fetch results:', error);
        updateTMEStatus('❌ Failed to load results: ' + error.message);
        
        if (typeof TME_NOTIFICATIONS !== 'undefined') {
            TME_NOTIFICATIONS.error('Results Failed', error.message);
        }
    } finally {
        TMESegmentation.isProcessing = false;
        hideTMEProgress();
        hideJobInfo();
    }
}

/**
 * Display TME results in the UI
 */
function displayTMEResults(results) {
    if (!TME_DOM.resultsContainer) return;
    
    const stats = results['whole slide percentages'] || {};
    const areas = results['whole slide pixel areas'] || {};  // ✅ Correct key name
    const parameters = results.parameters || {};
    const tmeStats = results.tme_statistics || {};
    
    let resultsHTML = `
    <div class="tme-results-summary">
        <h4><i class="fas fa-chart-pie"></i> TME Segmentation Results</h4>
        
        <div class="tme-metadata" style="margin-bottom: 12px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-size: 10px;">
            <div><strong>File:</strong> ${results.filename ? results.filename.split('/').pop() : 'Unknown'}</div>
            <div><strong>Model:</strong> ${parameters.model_name || 'Unknown'}</div>
            <div><strong>Patch Size:</strong> ${parameters.patch_size || 'Unknown'}</div>
            <div><strong>Completed:</strong> ${results.processing_completed_at ? new Date(results.processing_completed_at).toLocaleString() : 'Unknown'}</div>
        </div>
            
            <div class="tme-tissue-stats" style="margin-bottom: 12px;">
                <h5 style="font-size: 11px; font-weight: 600; margin-bottom: 8px;">
                    <i class="fas fa-layer-group"></i> Tissue Composition
                </h5>
    `;
    
    const tissueTypes = [
        { key: 'Tumor', label: 'Tumor', color: '#8B0000' },
        { key: 'Non-inflamed stroma', label: 'Non-inflamed stroma', color: '#FFFF00' },
        { key: 'Inflamed stroma', label: 'Inflamed stroma', color: '#FF0000' },
        { key: 'Necrosis/Hemorrhage', label: 'Necrosis/Hemorrhage', color: '#FF00FF' },
        { key: 'Adipose tissue', label: 'Adipose tissue', color: '#808000' },
        { key: 'Bronchial epithelium', label: 'Bronchial epithelium', color: '#00FFFF' },
        { key: 'Microvessel', label: 'Microvessel', color: '#0000FF' },
        { key: 'Foam-like macrophages', label: 'Foam-like macrophages', color: '#800080' },
        { key: 'Alveoli', label: 'Alveoli', color: '#008000' },
        { key: 'Muscle tissue', label: 'Muscle tissue', color: '#000080' }
    ];
    
    tissueTypes.forEach(tissue => {
        const percentage = stats[`perc_${tissue.key}`] || 0;  // ✅ Now uses full key names
        
        if (percentage > 0) {
            resultsHTML += `
                <div style="display: flex; align-items: center; margin-bottom: 6px; font-size: 11px;">
                    <div style="width: 16px; height: 16px; background: ${tissue.color}; border: 1px solid #ccc; margin-right: 8px; border-radius: 2px;"></div>
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between;">
                            <span style="font-weight: 600;">${tissue.label}</span>
                            <span style="font-weight: bold; color: ${tissue.color};">${percentage.toFixed(2)}%</span>
                        </div>
                        <div style="background: #e9ecef; height: 4px; border-radius: 2px; margin-top: 2px;">
                            <div style="background: ${tissue.color}; height: 100%; width: ${percentage}%; border-radius: 2px;"></div>
                        </div>
                    </div>
                </div>
            `;
        }
    });
    
    resultsHTML += `
            </div>
            
            <div class="tme-actions" style="display: flex; gap: 6px; margin-top: 12px;">
                <button class="action-btn primary" onclick="showTMEOverlay()" style="flex: 1; font-size: 10px; padding: 6px 10px;">
                    <i class="fas fa-eye"></i> Show Overlay
                </button>
                <button class="action-btn secondary" onclick="exportTMEResults()" style="flex: 1; font-size: 10px; padding: 6px 10px;">
                    <i class="fas fa-download"></i> Export
                </button>
                <button class="action-btn danger" onclick="clearTMEResults()" style="flex: 1; font-size: 10px; padding: 6px 10px;">
                    <i class="fas fa-trash"></i> Clear
                </button>
            </div>
        </div>
    `;
    
    TME_DOM.resultsContainer.innerHTML = resultsHTML;
}

/**
 * Show TME overlay on viewer - FIXED VERSION
 */
/**
 * Show TME overlay on viewer - FIXED for OpenSeadragon compatibility
 */
/**
 * Show TME overlay on viewer - UPDATED FOR VPS
 */
async function showTMEOverlay() {
    console.log('Showing TME overlay...');
    
    if (!TMESegmentation.resultsData) {
        alert('No TME results available');
        return;
    }
    
    const viewer = TMESegmentation.viewer;
    if (!viewer) {
        alert('Viewer not available');
        return;
    }
    
    try {
        updateTMEStatus('📥 Loading overlay image...');
        
        // ✅ NEW: Try to load from VPS filesystem first
        let overlayUrl;
        const slidePath = await getCurrentSlidePath();
        
        if (slidePath && typeof TME_STORAGE !== 'undefined') {
            // Check if VPS has the overlay
            const vpsCheck = await TME_STORAGE.checkVPSResults(slidePath);
            
            if (vpsCheck && vpsCheck.exists && vpsCheck.has_overlay) {
                console.log('✅ Using overlay from VPS filesystem');
                overlayUrl = TME_STORAGE.getVPSOverlayURL(slidePath);
            }
        }
        
        // Fallback to job-based overlay if VPS not available
        if (!overlayUrl && TMESegmentation.currentJobId) {
            console.log('ℹ️ Using overlay from job temp directory');
            overlayUrl = `../ai_proxy.php?endpoint=overlay_tme/${TMESegmentation.currentJobId}`;
        }
        
        if (!overlayUrl) {
            throw new Error('No overlay source available');
        }
        
        console.log('Loading overlay from:', overlayUrl);
        
        // Test if the overlay endpoint is accessible
        const testResponse = await fetch(overlayUrl, { method: 'HEAD' });
        if (!testResponse.ok) {
            throw new Error(`Overlay endpoint returned ${testResponse.status}`);
        }
        
        // Get the viewer's current image bounds
        const tiledImage = viewer.world.getItemAt(0);
        if (!tiledImage) {
            throw new Error('No base image found in viewer');
        }
        
        const imageBounds = tiledImage.getBounds();
        console.log('Image bounds:', imageBounds);
        
        // Remove existing overlay first
        removeTMEOverlay();
        
        // Create overlay container div
        const overlayDiv = document.createElement('div');
        overlayDiv.id = 'tme-overlay-container';
        overlayDiv.style.cssText = `
            width: 100%;
            height: 100%;
            position: absolute;
            top: 0;
            left: 0;
            pointer-events: none;
        `;
        
        // Create the image element
        const overlayImg = document.createElement('img');
        overlayImg.id = 'tme-overlay-image';
        overlayImg.style.cssText = `
            width: 100%;
            height: 100%;
            opacity: 0.5;
            object-fit: fill;
            pointer-events: none;
        `;
        
        // Add timestamp to prevent caching issues
        overlayImg.src = overlayUrl + (overlayUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
        
        overlayDiv.appendChild(overlayImg);
        
        // Wait for image to load
        await new Promise((resolve, reject) => {
            overlayImg.onload = function() {
                console.log('✅ Overlay image loaded successfully');
                console.log('Image dimensions:', overlayImg.naturalWidth, 'x', overlayImg.naturalHeight);
                resolve();
            };
            
            overlayImg.onerror = function(error) {
                console.error('❌ Failed to load overlay image:', error);
                reject(new Error('Failed to load overlay image'));
            };
            
            // Timeout after 30 seconds
            setTimeout(() => reject(new Error('Image load timeout')), 30000);
        });
        
        // Use basic overlay method compatible with all OpenSeadragon versions
        try {
            // Method 1: Try using Rect-based overlay (most compatible)
            viewer.addOverlay({
                element: overlayDiv,
                location: imageBounds
            });
            console.log('✅ Overlay added using Rect-based method');
        } catch (e1) {
            console.warn('Rect-based overlay failed, trying alternate method:', e1);
            
            try {
                // Method 2: Try using x, y, width, height directly
                viewer.addOverlay({
                    element: overlayDiv,
                    x: imageBounds.x,
                    y: imageBounds.y,
                    width: imageBounds.width,
                    height: imageBounds.height
                });
                console.log('✅ Overlay added using x,y,width,height method');
            } catch (e2) {
                console.warn('x,y,width,height overlay failed, trying Point-based method:', e2);
                
                // Method 3: Use simple point overlay (fallback)
                viewer.addOverlay({
                    element: overlayDiv,
                    location: new OpenSeadragon.Point(imageBounds.x, imageBounds.y)
                });
                console.log('✅ Overlay added using Point-based method');
            }
        }
        
        // Store reference
        window.currentTMEOverlay = overlayDiv;
        TMESegmentation.overlays.push(overlayDiv);
        
        updateTMEStatus('✅ Overlay displayed (50% opacity)');
        
        // Add opacity control
        addOverlayControls(overlayImg);
        
        if (typeof TME_NOTIFICATIONS !== 'undefined') {
            TME_NOTIFICATIONS.success('Overlay Loaded', 'TME segmentation overlay is now visible');
        }
        
        console.log('✅ Overlay added successfully');
        
    } catch (error) {
        console.error('Failed to show overlay:', error);
        updateTMEStatus('❌ Failed to show overlay: ' + error.message);
        
        if (typeof TME_NOTIFICATIONS !== 'undefined') {
            TME_NOTIFICATIONS.error('Overlay Failed', error.message);
        } else {
            alert('Failed to load overlay: ' + error.message);
        }
    }
}

/**
 * Add overlay opacity controls to the UI
 */
/**
 * Add overlay opacity controls to the UI - FIXED
 */
function addOverlayControls(overlayElement) {
    // Check if controls already exist
    if (document.getElementById('tme-overlay-controls')) {
        return;
    }
    
    const controlsHTML = `
        <div id="tme-overlay-controls" style="margin-top: 12px; padding: 10px; background: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;">
            <h5 style="font-size: 11px; font-weight: 600; margin: 0 0 8px 0; color: #495057;">
                <i class="fas fa-layer-group"></i> Overlay Controls
            </h5>
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <label style="font-size: 10px; color: #495057; min-width: 60px;">Opacity:</label>
                <input type="range" id="tme-overlay-opacity" min="0" max="100" value="50" 
                       style="flex: 1;" oninput="updateTMEOverlayOpacity(this.value)">
                <span id="tme-opacity-value" style="font-size: 10px; color: #495057; min-width: 35px;">50%</span>
            </div>
            <div style="display: flex; gap: 4px;">
                <button class="action-btn secondary" onclick="toggleTMEOverlayVisibility()" id="tme-overlay-toggle"
                        style="flex: 1; font-size: 10px; padding: 4px 8px;">
                    <i class="fas fa-eye-slash"></i> Hide
                </button>
                <button class="action-btn danger" onclick="removeTMEOverlay()" 
                        style="flex: 1; font-size: 10px; padding: 4px 8px;">
                    <i class="fas fa-times"></i> Remove
                </button>
            </div>
        </div>
    `;
    
    if (TME_DOM.resultsContainer) {
        const controlsDiv = document.createElement('div');
        controlsDiv.innerHTML = controlsHTML;
        // ✅ FIX: Use children[0] instead of firstChild to avoid text nodes
        TME_DOM.resultsContainer.appendChild(controlsDiv.children[0]);
    }
}

/**
 * Update overlay opacity
 */
function updateTMEOverlayOpacity(value) {
    const opacity = value / 100;
    
    if (window.currentTMEOverlay) {
        const imgElement = window.currentTMEOverlay.querySelector('img');
        if (imgElement) {
            imgElement.style.opacity = opacity;
            const valueLabel = document.getElementById('tme-opacity-value');
            if (valueLabel) {
                valueLabel.textContent = value + '%';
            }
        }
    }
}

/**
 * Toggle overlay visibility
 */
function toggleTMEOverlayVisibility() {
    if (window.currentTMEOverlay) {
        const imgElement = window.currentTMEOverlay.querySelector('img');
        if (imgElement) {
            const currentOpacity = parseFloat(imgElement.style.opacity);
            const newOpacity = currentOpacity > 0 ? 0 : 0.5;
            imgElement.style.opacity = newOpacity;
            
            const btn = document.getElementById('tme-overlay-toggle');
            if (btn) {
                if (newOpacity === 0) {
                    btn.innerHTML = '<i class="fas fa-eye"></i> Show';
                } else {
                    btn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide';
                }
            }
        }
    }
}

/**
 * Remove overlay completely
 */
function removeTMEOverlay() {
    console.log('Removing TME overlay...');
    
    if (window.currentTMEOverlay && TMESegmentation.viewer) {
        try {
            TMESegmentation.viewer.removeOverlay(window.currentTMEOverlay);
            console.log('✅ Overlay removed from viewer');
        } catch (e) {
            console.warn('Failed to remove overlay from viewer:', e);
        }
        
        // Also remove from DOM if still present
        if (window.currentTMEOverlay.parentNode) {
            window.currentTMEOverlay.parentNode.removeChild(window.currentTMEOverlay);
        }
        
        window.currentTMEOverlay = null;
    }
    
    // Remove controls
    const controls = document.getElementById('tme-overlay-controls');
    if (controls) {
        controls.remove();
    }
    
    // Clear from array
    TMESegmentation.overlays = [];
    
    updateTMEStatus('✅ Overlay removed');
}

/**
 * Export TME results
 */
function exportTMEResults() {
    if (!TMESegmentation.resultsData) {
        alert('No results to export');
        return;
    }
    
    // Export as JSON
    const dataStr = JSON.stringify(TMESegmentation.resultsData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tme_results_${TMESegmentation.currentJobId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('TME results exported');
    
    if (typeof TME_NOTIFICATIONS !== 'undefined') {
        TME_NOTIFICATIONS.success('Export Complete', 'Results saved as JSON file');
    }
}

/**
 * Stop TME Analysis
 */
function stopTMEAnalysis() {
    if (!TMESegmentation.isProcessing) {
        return;
    }
    
    console.log('Stopping TME analysis...');
    
    stopStatusPolling();
    TMESegmentation.isProcessing = false;
    hideTMEProgress();
    hideJobInfo();
    
    updateTMEStatus('⏹️ TME Analysis Stopped');
    
    if (typeof TME_NOTIFICATIONS !== 'undefined') {
        TME_NOTIFICATIONS.warning('Analysis Stopped', 'TME processing was cancelled');
    }
}

/**
 * Clear TME results and overlays
 */
function clearTMEResults() {
    console.log('Clearing TME results...');
    
    // Confirm before clearing
    const confirmClear = confirm(
        'Are you sure you want to clear TME results?\n\n' +
        'This will remove all stored analysis data.'
    );
    
    if (!confirmClear) {
        return;
    }
    
    // Stop any processing
    stopTMEAnalysis();
    
    // Clear overlays
    clearTMEOverlays();
    
    // Clear results
    TMESegmentation.resultsData = null;
    TMESegmentation.currentJobId = null;
    
    // ✅ NEW: Clear from localStorage
    if (typeof TME_STORAGE !== 'undefined') {
        TME_STORAGE.clearResults();
    }
    
    // Reset UI
    if (TME_DOM.resultsContainer) {
        TME_DOM.resultsContainer.innerHTML = `
            <div class="no-selection-message">
                <i class="fas fa-layer-group"></i>
                <p>Click "Start TME Analysis" to segment tissue types across the whole slide</p>
            </div>
        `;
    }
    
    updateTMEStatus('✅ Ready for TME Analysis');
    
    if (typeof TME_NOTIFICATIONS !== 'undefined') {
        TME_NOTIFICATIONS.info('Results Cleared', 'All TME analysis data has been removed');
    }
}

/**
 * Clear TME overlays from viewer
 */
function clearTMEOverlays() {
    const viewer = TMESegmentation.viewer;
    if (!viewer) return;
    
    TMESegmentation.overlays.forEach(overlay => {
        try {
            viewer.removeOverlay(overlay);
        } catch (e) {
            console.warn('Failed to remove overlay:', e);
        }
    });
    
    TMESegmentation.overlays = [];
}

/**
 * Get storage information (for debugging)
 */
function getTMEStorageInfo() {
    if (typeof TME_STORAGE === 'undefined') {
        return { available: false };
    }
    
    return {
        available: true,
        ...TME_STORAGE.getStorageInfo()
    };
}

/**
 * UI Helper Functions
 */

function showTMEProgress() {
    if (TME_DOM.progressContainer) {
        TME_DOM.progressContainer.style.display = 'block';
    }
}

function hideTMEProgress() {
    if (TME_DOM.progressContainer) {
        TME_DOM.progressContainer.style.display = 'none';
    }
}

function updateTMEProgress(percent, detail) {
    const safePercent = Math.max(0, Math.min(percent || 0, 100));
    
    if (TME_DOM.progressFill) {
        TME_DOM.progressFill.style.width = safePercent + '%';
        TME_DOM.progressFill.style.backgroundColor = safePercent === 100 ? '#28a745' : '#007bff';
    }
    
    if (TME_DOM.progressText) {
        TME_DOM.progressText.textContent = `${safePercent}% complete`;
    }
    
    if (TME_DOM.progressDetail && detail) {
        TME_DOM.progressDetail.textContent = detail;
    }
}

function updateTMEStatus(message) {
    if (TME_DOM.status) {
        TME_DOM.status.textContent = message;
        
        // Update status color based on message
        TME_DOM.status.className = 'ai-status';
        if (message.includes('✅') || message.includes('Ready')) {
            TME_DOM.status.classList.add('ai-status-success');
        } else if (message.includes('⚠️') || message.includes('Waiting')) {
            TME_DOM.status.classList.add('ai-status-warning');
        } else if (message.includes('❌') || message.includes('Failed')) {
            TME_DOM.status.classList.add('ai-status-error');
        } else {
            TME_DOM.status.classList.add('ai-status-warning');
        }
    }
    console.log('TME Status:', message);
}

function showJobInfo(jobId) {
    if (TME_DOM.jobStatus) {
        TME_DOM.jobStatus.style.display = 'block';
    }
    if (TME_DOM.jobId) {
        TME_DOM.jobId.textContent = `Job ID: ${jobId}`;
    }
}

function hideJobInfo() {
    if (TME_DOM.jobStatus) {
        TME_DOM.jobStatus.style.display = 'none';
    }
}
/**
 * Export TME files from VPS - UPDATED
 */
/**
 * Export all TME results as a ZIP file
 */
async function exportTMEResults() {
    if (!TMESegmentation.resultsData) {
        alert('No TME results to export');
        return;
    }
    
    // Show loading notification
    if (typeof TME_NOTIFICATIONS !== 'undefined') {
        TME_NOTIFICATIONS.info('Preparing Export', 'Downloading TME files...');
    }
    
    try {
        const slidePath = await getCurrentSlidePath();
        if (!slidePath) {
            throw new Error('Could not determine slide path');
        }
        
        const slideBasename = slidePath.split('/').pop().replace('.svs', '');
        
        // Check if JSZip is available
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library not loaded. Please refresh the page.');
        }
        
        // Create new ZIP file
        const zip = new JSZip();
        
        // 1. Add results.json
        console.log('Adding results.json to ZIP...');
        const resultsResponse = await fetch(
            `../ai_proxy.php?endpoint=load_results`, 
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `file_path=${encodeURIComponent(slidePath)}`
            }
        );
        
        if (resultsResponse.ok) {
            const resultsJson = await resultsResponse.text();
            zip.file(`${slideBasename}_tme_results.json`, resultsJson);
        } else {
            console.warn('Could not fetch results.json');
        }
        
        // 2. Add job_info.json (if exists)
        console.log('Adding job_info.json to ZIP...');
        try {
            const slideDir = slidePath.substring(0, slidePath.lastIndexOf('/'));
            const jobInfoResponse = await fetch(`${slideDir}/${slideBasename}_tme_results/job_info.json`);
            
            if (jobInfoResponse.ok) {
                const jobInfoJson = await jobInfoResponse.text();
                zip.file(`${slideBasename}_tme_job_info.json`, jobInfoJson);
            }
        } catch (e) {
            console.warn('Could not fetch job_info.json:', e);
        }
        
        // 3. Add overlay.png
        console.log('Adding overlay.png to ZIP...');
        const overlayUrl = TME_STORAGE.getVPSOverlayURL(slidePath);
        const overlayResponse = await fetch(overlayUrl);
        
        if (overlayResponse.ok) {
            const overlayBlob = await overlayResponse.blob();
            zip.file(`${slideBasename}_tme_overlay.png`, overlayBlob);
        } else {
            console.warn('Could not fetch overlay.png');
        }
        
        // Generate ZIP file
        console.log('Generating ZIP file...');
        const zipBlob = await zip.generateAsync({ 
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        
        // Download ZIP
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${slideBasename}_tme_results.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('✅ TME results exported as ZIP');
        
        if (typeof TME_NOTIFICATIONS !== 'undefined') {
            TME_NOTIFICATIONS.success(
                'Export Complete', 
                `Downloaded ${slideBasename}_tme_results.zip`
            );
        }
        
    } catch (error) {
        console.error('Failed to export TME results:', error);
        
        if (typeof TME_NOTIFICATIONS !== 'undefined') {
            TME_NOTIFICATIONS.error('Export Failed', error.message);
        } else {
            alert('Failed to export: ' + error.message);
        }
    }
}

/**
 * Helper function to download files
 */
function downloadFile(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    if (typeof TME_NOTIFICATIONS !== 'undefined') {
        TME_NOTIFICATIONS.success('Download Started', `Downloading ${filename}`);
    }
}

/**
 * Show/hide export options based on TME results availability
 */
function updateExportMenu() {
    const hasTMEResults = TMESegmentation.resultsData !== null;
    
    const exportJSON = document.getElementById('exportTMEJSON');
    const exportJobInfo = document.getElementById('exportTMEJobInfo');
    const exportOverlay = document.getElementById('exportTMEOverlay');
    
    if (exportJSON) exportJSON.style.display = hasTMEResults ? 'flex' : 'none';
    if (exportJobInfo) exportJobInfo.style.display = hasTMEResults ? 'flex' : 'none';
    if (exportOverlay) exportOverlay.style.display = hasTMEResults ? 'flex' : 'none';
}
/**
 * Export functions to global scope
 */
Object.assign(window, {
    startTMEAnalysis,
    stopTMEAnalysis,
    clearTMEResults,
    showTMEOverlay,
    exportTMEResults,           // ✅ Keep this one - it's the new ZIP export
    // ❌ REMOVE these:
    // exportTMEResultsJSON,
    // exportTMEJobInfo,
    // exportTMEOverlay,
    checkTMEServiceHealth,
    updateTMEOverlayOpacity,
    toggleTMEOverlayVisibility,
    removeTMEOverlay,
    getTMEStorageInfo
});

/**
 * Auto-initialize when DOM is ready
 */
$(document).ready(() => {
    console.log('TME Segmentation: Initializing...');
    
    setTimeout(() => {
        initTMESegmentation();
    }, 2000);
});