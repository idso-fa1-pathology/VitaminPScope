/**
 * Screenshot Functions - screenshot.js
 * Advanced screenshot functionality with region selection and quality options
 */

// Screenshot module state
window.ScreenshotModule = {
    isActive: false,
    selectionOverlay: null,
    startPoint: null,
    isDrawing: false,
    currentSelection: null,
    quality: 0.9,
    format: 'png'
};

/**
 * Main screenshot function - shows options modal
 */
function takeScreenshot() {
    console.log('Opening screenshot options');
    showScreenshotModal();
}

/**
 * Show screenshot options modal
 */
function showScreenshotModal() {
    // Remove existing modal if present
    const existingModal = document.getElementById('screenshotModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'screenshotModal';
    modal.className = 'screenshot-modal-overlay';
    
    modal.innerHTML = `
        <div class="screenshot-modal">
            <div class="screenshot-modal-header">
                <h3><i class="fas fa-camera"></i> Screenshot Options</h3>
                <button class="close-btn" onclick="closeScreenshotModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="screenshot-modal-content">
                <div class="screenshot-section">
                    <h4><i class="fas fa-crop"></i> Capture Area</h4>
                    <div class="screenshot-options">
                        <label class="screenshot-option">
                            <input type="radio" name="captureType" value="fullpage" checked>
                            <div class="option-content">
                                <div class="option-header">
                                    <i class="fas fa-globe"></i>
                                    <span>Full Page</span>
                                </div>
                                <small>Capture entire viewer area</small>
                            </div>
                        </label>
                        
                        <label class="screenshot-option">
                            <input type="radio" name="captureType" value="viewer">
                            <div class="option-content">
                                <div class="option-header">
                                    <i class="fas fa-image"></i>
                                    <span>Viewer Only</span>
                                </div>
                                <small>Capture just the image viewer</small>
                            </div>
                        </label>
                        
                        <label class="screenshot-option">
                            <input type="radio" name="captureType" value="region">
                            <div class="option-content">
                                <div class="option-header">
                                    <i class="fas fa-crop-alt"></i>
                                    <span>Select Region</span>
                                </div>
                                <small>Draw rectangle to select area</small>
                            </div>
                        </label>
                    </div>
                </div>
                
                <div class="screenshot-section">
                    <h4><i class="fas fa-cog"></i> Quality Settings</h4>
                    <div class="quality-controls">
                        <div class="control-group">
                            <label>Format:</label>
                            <select id="screenshotFormat" onchange="updateScreenshotFormat(this.value)">
                                <option value="png">PNG (Lossless)</option>
                                <option value="jpeg">JPEG (Smaller file)</option>
                                <option value="webp">WebP (Best compression)</option>
                            </select>
                        </div>
                        
                        <div class="control-group" id="qualityGroup" style="display: none;">
                            <label>Quality: <span id="qualityValue">90%</span></label>
                            <input type="range" id="screenshotQuality" min="0.1" max="1" step="0.05" value="0.9" 
                                   oninput="updateQualityDisplay(this.value)">
                        </div>
                        
                        <div class="control-group">
                            <label>Scale:</label>
                            <select id="screenshotScale">
                                <option value="1">1x (Original)</option>
                                <option value="2" selected>2x (High DPI)</option>
                                <option value="3">3x (Ultra High)</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="screenshot-section">
                    <h4><i class="fas fa-palette"></i> Enhancement</h4>
                    <div class="enhancement-controls">
                        <label class="checkbox-option">
                            <input type="checkbox" id="includeUI" checked>
                            <span>Include UI Elements</span>
                        </label>
                        
                        <label class="checkbox-option">
                            <input type="checkbox" id="addWatermark">
                            <span>Add Timestamp</span>
                        </label>
                        
                        <label class="checkbox-option">
                            <input type="checkbox" id="addMetadata">
                            <span>Embed Metadata</span>
                        </label>
                    </div>
                </div>
            </div>
            
            <div class="screenshot-modal-footer">
                <button class="btn btn-secondary" onclick="closeScreenshotModal()">
                    Cancel
                </button>
                <button class="btn btn-primary" onclick="executeScreenshot()">
                    <i class="fas fa-camera"></i> Take Screenshot
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners for radio buttons
    const radioButtons = modal.querySelectorAll('input[name="captureType"]');
    radioButtons.forEach(radio => {
        radio.addEventListener('change', handleCaptureTypeChange);
    });
}

/**
 * Handle capture type change
 */
function handleCaptureTypeChange(event) {
    const selectedType = event.target.value;
    console.log('Capture type changed to:', selectedType);
    
    if (selectedType === 'region') {
        // Show hint about region selection
        const modal = document.getElementById('screenshotModal');
        if (modal && !modal.querySelector('.region-hint')) {
            const hint = document.createElement('div');
            hint.className = 'region-hint';
            hint.innerHTML = '<i class="fas fa-info-circle"></i> Click "Take Screenshot" then draw a rectangle on the image';
            modal.querySelector('.screenshot-modal-footer').insertBefore(hint, modal.querySelector('.btn'));
        }
    } else {
        // Remove hint
        const hint = document.querySelector('.region-hint');
        if (hint) hint.remove();
    }
}

/**
 * Execute screenshot based on selected options
 */
async function executeScreenshot() {
    const captureType = document.querySelector('input[name="captureType"]:checked').value;
    const format = document.getElementById('screenshotFormat').value;
    const quality = parseFloat(document.getElementById('screenshotQuality').value);
    const scale = parseInt(document.getElementById('screenshotScale').value);
    const includeUI = document.getElementById('includeUI').checked;
    const addWatermark = document.getElementById('addWatermark').checked;
    const addMetadata = document.getElementById('addMetadata').checked;
    
    console.log('Screenshot settings:', {
        captureType, format, quality, scale, includeUI, addWatermark, addMetadata
    });
    
    closeScreenshotModal();
    
    try {
        switch (captureType) {
            case 'fullpage':
                await captureFullPage({ format, quality, scale, includeUI, addWatermark, addMetadata });
                break;
            case 'viewer':
                await captureViewer({ format, quality, scale, includeUI, addWatermark, addMetadata });
                break;
            case 'region':
                await startRegionCapture({ format, quality, scale, includeUI, addWatermark, addMetadata });
                break;
        }
    } catch (error) {
        console.error('Screenshot failed:', error);
        showScreenshotError(error.message);
    }
}

/**
 * Capture full page
 */
async function captureFullPage(options) {
    // Do not show progress to be included in the image
    // showScreenshotProgress('Capturing full page...');
    
    try {
        // Use html2canvas for full page capture
        if (typeof html2canvas === 'undefined') {
            throw new Error('html2canvas library is required but not loaded');
        }
        
        const canvas = await html2canvas(document.body, {
            useCORS: true,
            scale: options.scale,
            backgroundColor: '#ffffff',
            logging: false
        });
        
        await processAndDownloadScreenshot(canvas, 'fullpage', options);
        
    } catch (error) {
        hideScreenshotProgress();
        throw error;
    }
}

/**
 * Capture viewer only
 */
async function captureViewer(options) {
    showScreenshotProgress('Capturing viewer...');
    
    try {
        const viewerElement = document.querySelector('.openseadragon, #MS010_UNKNOWNCHANNEL0001');
        if (!viewerElement) {
            throw new Error('Viewer element not found');
        }
        
        // Try to get the canvas directly from OpenSeadragon
        const canvas = getViewerCanvas();
        if (canvas) {
            // Direct canvas capture
            const screenshotCanvas = document.createElement('canvas');
            const ctx = screenshotCanvas.getContext('2d');
            
            screenshotCanvas.width = canvas.width * options.scale;
            screenshotCanvas.height = canvas.height * options.scale;
            
            ctx.scale(options.scale, options.scale);
            ctx.drawImage(canvas, 0, 0);
            
            await processAndDownloadScreenshot(screenshotCanvas, 'viewer', options);
        } else {
            // Fallback to html2canvas
            if (typeof html2canvas === 'undefined') {
                throw new Error('Cannot capture viewer - html2canvas library required');
            }
            
            const canvas = await html2canvas(viewerElement, {
                useCORS: true,
                scale: options.scale,
                backgroundColor: null,
                logging: false
            });
            
            await processAndDownloadScreenshot(canvas, 'viewer', options);
        }
        
    } catch (error) {
        hideScreenshotProgress();
        throw error;
    }
}

/**
 * Start region capture mode
 */
/**
 * REPLACE the startRegionCapture function in screenshot.js with this fixed version
 */
async function startRegionCapture(options) {
    showScreenshotStatus('Click and drag to select region for screenshot');
    
    // Store options for later use
    ScreenshotModule.captureOptions = options;
    ScreenshotModule.isActive = true;
    
    // Find the viewer element and the actual OpenSeadragon viewer
    const viewerElement = document.querySelector('.openseadragon, #MS010_UNKNOWNCHANNEL0001');
    if (!viewerElement) {
        throw new Error('Viewer element not found');
    }
    
    // Get the OpenSeadragon viewer instance - try different methods
    let osViewer = null;
    
    // Method 1: Try the global variable
    if (window.MS010_UNKNOWNCHANNEL0001) {
        osViewer = window.MS010_UNKNOWNCHANNEL0001;
    }
    
    // Method 2: Try to find it in the SimpleExtractor
    if (!osViewer && window.SimpleExtractor && window.SimpleExtractor.viewer) {
        osViewer = window.SimpleExtractor.viewer;
    }
    
    // Method 3: Look for any OpenSeadragon viewer
    if (!osViewer && window.OpenSeadragon && window.OpenSeadragon.viewers) {
        for (let viewer of window.OpenSeadragon.viewers) {
            if (viewer && viewer.viewport) {
                osViewer = viewer;
                break;
            }
        }
    }
    
    console.log('Found OpenSeadragon viewer:', osViewer ? osViewer.id || 'unnamed' : 'none');
    
    // CRITICAL: Disable OpenSeadragon mouse navigation
    if (osViewer) {
        console.log('Disabling OpenSeadragon mouse navigation for screenshot');
        osViewer.setMouseNavEnabled(false);
        ScreenshotModule.osViewer = osViewer; // Store for cleanup
    }
    
    // Add event listeners for region selection
    viewerElement.addEventListener('mousedown', handleScreenshotMouseDown, true);
    viewerElement.addEventListener('mousemove', handleScreenshotMouseMove, true);
    viewerElement.addEventListener('mouseup', handleScreenshotMouseUp, true);
    
    // Change cursor
    viewerElement.style.cursor = 'crosshair';
    
    // Add escape key listener
    document.addEventListener('keydown', handleScreenshotEscape);
    
    // Show instruction overlay
    showScreenshotInstructions();
}

/**
 * Handle mouse down for region selection
 */
function handleScreenshotMouseDown(event) {
    if (!ScreenshotModule.isActive) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const rect = event.currentTarget.getBoundingClientRect();
    ScreenshotModule.startPoint = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
    
    ScreenshotModule.isDrawing = true;
    showScreenshotStatus('Drawing selection...');
}

/**
 * Handle mouse move for region selection
 */
function handleScreenshotMouseMove(event) {
    if (!ScreenshotModule.isActive || !ScreenshotModule.isDrawing) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const rect = event.currentTarget.getBoundingClientRect();
    const currentPoint = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
    
    updateScreenshotSelectionOverlay(ScreenshotModule.startPoint, currentPoint, rect);
}

/**
 * Handle mouse up for region selection
 */
async function handleScreenshotMouseUp(event) {
    if (!ScreenshotModule.isActive || !ScreenshotModule.isDrawing) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    ScreenshotModule.isDrawing = false;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const endPoint = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
    
    const selection = {
        x: Math.min(ScreenshotModule.startPoint.x, endPoint.x),
        y: Math.min(ScreenshotModule.startPoint.y, endPoint.y),
        width: Math.abs(endPoint.x - ScreenshotModule.startPoint.x),
        height: Math.abs(endPoint.y - ScreenshotModule.startPoint.y)
    };
    
    // Clean up
    cleanupRegionCapture();
    
    if (selection.width < 10 || selection.height < 10) {
        showScreenshotError('Selection too small. Please select a larger area.');
        return;
    }
    
    try {
        await captureRegion(selection, ScreenshotModule.captureOptions);
    } catch (error) {
        showScreenshotError(error.message);
    }
}

/**
 * Update selection overlay for region capture
 */
function updateScreenshotSelectionOverlay(startPoint, currentPoint, containerRect) {
    // Remove existing overlay
    const existingOverlay = document.getElementById('screenshotSelectionOverlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }
    
    const overlay = document.createElement('div');
    overlay.id = 'screenshotSelectionOverlay';
    overlay.style.cssText = `
        position: fixed;
        border: 2px dashed #00ff00;
        background: rgba(0, 255, 0, 0.1);
        pointer-events: none;
        z-index: 9999;
        left: ${containerRect.left + Math.min(startPoint.x, currentPoint.x)}px;
        top: ${containerRect.top + Math.min(startPoint.y, currentPoint.y)}px;
        width: ${Math.abs(currentPoint.x - startPoint.x)}px;
        height: ${Math.abs(currentPoint.y - startPoint.y)}px;
    `;
    
    document.body.appendChild(overlay);
}

/**
 * Capture selected region
 */
async function captureRegion(selection, options) {
    showScreenshotProgress('Capturing selected region...');
    
    try {
        const viewerElement = document.querySelector('.openseadragon, #MS010_UNKNOWNCHANNEL0001');
        
        if (typeof html2canvas === 'undefined') {
            throw new Error('html2canvas library is required but not loaded');
        }
        
        const canvas = await html2canvas(viewerElement, {
            useCORS: true,
            scale: options.scale,
            backgroundColor: null,
            logging: false,
            x: selection.x,
            y: selection.y,
            width: selection.width,
            height: selection.height
        });
        
        await processAndDownloadScreenshot(canvas, 'region', options);
        
    } catch (error) {
        hideScreenshotProgress();
        throw error;
    }
}

/**
 * Process and download screenshot
 */
async function processAndDownloadScreenshot(canvas, type, options) {
    try {
        // Add enhancements if requested
        if (options.addWatermark) {
            addTimestampWatermark(canvas);
        }
        
        // Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `polyscope-screenshot-${type}-${timestamp}.${options.format}`;
        
        // Convert to blob
        const mimeType = `image/${options.format === 'jpg' ? 'jpeg' : options.format}`;
        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, mimeType, options.quality);
        });
        
        // Add metadata if requested
        if (options.addMetadata) {
            // This would require a library like exif-js for JPEG
            console.log('Metadata embedding requested but not implemented for', options.format);
        }
        
        // Download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        hideScreenshotProgress();
        showScreenshotSuccess(`Screenshot saved as ${filename}`);
        
    } catch (error) {
        hideScreenshotProgress();
        throw error;
    }
}

/**
 * Add timestamp watermark to canvas
 */
function addTimestampWatermark(canvas) {
    const ctx = canvas.getContext('2d');
    const timestamp = new Date().toLocaleString();
    
    // Save current context
    ctx.save();
    
    // Set font
    const fontSize = Math.max(12, canvas.width / 80);
    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    
    // Position at bottom right
    const padding = fontSize;
    const x = canvas.width - ctx.measureText(timestamp).width - padding;
    const y = canvas.height - padding;
    
    // Draw text with outline
    ctx.strokeText(timestamp, x, y);
    ctx.fillText(timestamp, x, y);
    
    // Restore context
    ctx.restore();
}

/**
 * Utility functions
 */
function closeScreenshotModal() {
    const modal = document.getElementById('screenshotModal');
    if (modal) modal.remove();
}

function updateScreenshotFormat(format) {
    ScreenshotModule.format = format;
    const qualityGroup = document.getElementById('qualityGroup');
    if (qualityGroup) {
        qualityGroup.style.display = (format === 'jpeg' || format === 'webp') ? 'block' : 'none';
    }
}

function updateQualityDisplay(value) {
    ScreenshotModule.quality = parseFloat(value);
    const display = document.getElementById('qualityValue');
    if (display) {
        display.textContent = Math.round(value * 100) + '%';
    }
}

function showScreenshotProgress(message) {
    hideScreenshotProgress(); // Remove any existing
    
    const progress = document.createElement('div');
    progress.id = 'screenshotProgress';
    progress.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        z-index: 10000;
        font-family: Arial, sans-serif;
    `;
    progress.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <div style="border: 2px solid #f3f3f3; border-top: 2px solid #3498db; border-radius: 50%; width: 16px; height: 16px; animation: spin 1s linear infinite;"></div>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(progress);
}

function hideScreenshotProgress() {
    const progress = document.getElementById('screenshotProgress');
    if (progress) progress.remove();
}

function showScreenshotStatus(message) {
    // Update existing AI status or create new one
    const statusElement = document.getElementById('simple-region-status');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = 'ai-status ai-status-info';
    } else {
        console.log('Screenshot status:', message);
    }
}

function showScreenshotSuccess(message) {
    const success = document.createElement('div');
    success.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        z-index: 10000;
        font-family: Arial, sans-serif;
    `;
    success.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(success);
    
    setTimeout(() => success.remove(), 5000);
}

function showScreenshotError(message) {
    const error = document.createElement('div');
    error.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #dc3545;
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        z-index: 10000;
        font-family: Arial, sans-serif;
    `;
    error.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-exclamation-triangle"></i>
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; font-size: 16px; cursor: pointer; margin-left: 10px;">×</button>
        </div>
    `;
    
    document.body.appendChild(error);
}

/**
 * REPLACE the cleanupRegionCapture function in screenshot.js with this fixed version
 */
function cleanupRegionCapture() {
    console.log('Cleaning up screenshot region capture');
    
    ScreenshotModule.isActive = false;
    ScreenshotModule.isDrawing = false;
    
    // Remove event listeners
    const viewerElement = document.querySelector('.openseadragon, #MS010_UNKNOWNCHANNEL0001');
    if (viewerElement) {
        viewerElement.removeEventListener('mousedown', handleScreenshotMouseDown, true);
        viewerElement.removeEventListener('mousemove', handleScreenshotMouseMove, true);
        viewerElement.removeEventListener('mouseup', handleScreenshotMouseUp, true);
        viewerElement.style.cursor = '';
    }
    
    document.removeEventListener('keydown', handleScreenshotEscape);
    
    // CRITICAL: Re-enable OpenSeadragon mouse navigation
    if (ScreenshotModule.osViewer) {
        console.log('Re-enabling OpenSeadragon mouse navigation');
        ScreenshotModule.osViewer.setMouseNavEnabled(true);
        ScreenshotModule.osViewer = null;
    }
    
    // Remove overlay and instructions
    const overlay = document.getElementById('screenshotSelectionOverlay');
    if (overlay) overlay.remove();
    
    const instructions = document.getElementById('screenshotInstructions');
    if (instructions) instructions.remove();
    
    // Clear status
    showScreenshotStatus('Screenshot region selection cancelled');
}
/**
 * ADD this new function to screenshot.js - shows helpful instructions
 */
function showScreenshotInstructions() {
    // Remove existing instructions
    const existingInstructions = document.getElementById('screenshotInstructions');
    if (existingInstructions) {
        existingInstructions.remove();
    }
    
    const instructions = document.createElement('div');
    instructions.id = 'screenshotInstructions';
    instructions.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        z-index: 10001;
        font-family: Arial, sans-serif;
        text-align: center;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
        animation: slideDown 0.3s ease;
    `;
    
    instructions.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; justify-content: center;">
            <i class="fas fa-mouse-pointer"></i>
            <span><strong>Click and drag</strong> to select screenshot area</span>
            <span style="margin: 0 10px; color: #888;">|</span>
            <span style="font-size: 12px; color: #ccc;">Press ESC to cancel</span>
        </div>
    `;
    
    document.body.appendChild(instructions);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (instructions.parentNode) {
            instructions.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => instructions.remove(), 300);
        }
    }, 5000);
}

/**
 * REPLACE the handleScreenshotEscape function in screenshot.js with this version
 */
function handleScreenshotEscape(event) {
    if (event.key === 'Escape' && ScreenshotModule.isActive) {
        console.log('Screenshot cancelled by user (ESC key)');
        cleanupRegionCapture();
    }
}

// Export functions for global use
window.takeScreenshot = takeScreenshot;
window.closeScreenshotModal = closeScreenshotModal;
window.executeScreenshot = executeScreenshot;
window.updateScreenshotFormat = updateScreenshotFormat;
window.updateQualityDisplay = updateQualityDisplay;