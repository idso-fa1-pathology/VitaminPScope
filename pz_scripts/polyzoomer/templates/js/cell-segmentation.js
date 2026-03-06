/**
 * Cell Segmentation Module for Polyscope
 * Author: AI Integration Team
 * Description: Handles AI-powered cell segmentation with region selection
 * Dependencies: OpenSeadragon, jQuery
 */

// AI Service Configuration
const AI_SERVICE_CONFIG = {
    baseUrl: 'http://rapuplabgpu04:8000',
    endpoints: {
        health: '/health',
        predict: '/predict',
        configs: '/configs'
    },
    defaultConfig: {
        seg_threshold: 0.5,
        magnification: 40,
        config_name: 'Default'
    }
};

// Global state for cell segmentation
window.CellSegmentation = {
    isSelectionMode: false,
    currentSelection: null,
    selectionOverlay: null,
    resultsOverlay: null,
    activeViewer: null,
    selectionBox: null,
    startPoint: null,
    isDrawing: false,
    cellMarkers: []
};

/**
 * Initialize cell segmentation functionality
 */
function initializeCellSegmentation() {
    console.log('Initializing Cell Segmentation module...');
    
    // Check if AI service is available
    checkAIServiceHealth();
    
    // Wait for viewers to be ready
    setTimeout(function() {
        setupViewerIntegration();
    }, 1000);
}

/**
 * Check AI service health status
 */
async function checkAIServiceHealth() {
    try {
        const response = await fetch('../ai_proxy.php?endpoint=health');
        const data = await response.json();
        
        console.log('AI Service Status:', data);
        
        if (data.status === 'healthy') {
            updateAIServiceStatus('Connected', 'success');
        } else {
            updateAIServiceStatus('Service Issues', 'warning');
        }
    } catch (error) {
        console.error('AI Service connection failed:', error);
        updateAIServiceStatus('Disconnected', 'error');
    }
}

/**
 * Update AI service status in the UI
 */
function updateAIServiceStatus(status, type) {
    const statusIndicator = document.getElementById('aiServiceStatus');
    if (statusIndicator) {
        statusIndicator.textContent = status;
        statusIndicator.className = `ai-status ai-status-${type}`;
    }
}

/**
 * Setup integration with existing OpenSeadragon viewers
 */
function setupViewerIntegration() {
    const viewers = [];
    
    // Look for any object that has a viewport property (OpenSeadragon viewers)
    for (let key in window) {
        if (window[key] && 
            typeof window[key] === 'object' && 
            window[key].viewport &&
            typeof window[key].isOpen === 'function') {
            viewers.push({
                name: key,
                viewer: window[key]
            });
        }
    }
    
    console.log('Found viewers:', viewers.map(v => v.name));
    
    if (viewers.length > 0) {
        // Use the first viewer as the active one
        CellSegmentation.activeViewer = viewers[0].viewer;
        console.log('Set active viewer:', viewers[0].name);
    } else {
        // If no viewers found, try again in 1 second
        console.log('No viewers found, retrying in 1 second...');
        setTimeout(setupViewerIntegration, 1000);
    }
}

/**
 * Enable cell segmentation selection mode
 */
function enableCellSegmentation() {
    if (!CellSegmentation.activeViewer) {
        alert('No viewer available for cell segmentation');
        return;
    }
    
    const btn = document.getElementById('cellSegmentationBtn');
    
    if (CellSegmentation.isSelectionMode) {
        // Disable selection mode
        disableCellSegmentation();
        return;
    }
    
    // Enable selection mode
    CellSegmentation.isSelectionMode = true;
    btn.innerHTML = '<i class="fas fa-times"></i> Cancel Selection';
    btn.classList.remove('primary');
    btn.classList.add('danger');
    
    // Add selection instructions
    showSelectionInstructions();
    
    // Setup mouse handlers for region selection
    setupRegionSelection();
    
    console.log('Cell segmentation selection mode enabled');
}

/**
 * Disable cell segmentation selection mode
 */
function disableCellSegmentation() {
    CellSegmentation.isSelectionMode = false;
    CellSegmentation.isDrawing = false;
    
    const btn = document.getElementById('cellSegmentationBtn');
    btn.innerHTML = '<i class="fas fa-square-dashed"></i> Select Region';
    btn.classList.remove('danger');
    btn.classList.add('primary');
    
    // Remove selection overlay if exists
    if (CellSegmentation.selectionOverlay) {
        CellSegmentation.activeViewer.removeOverlay(CellSegmentation.selectionOverlay);
        CellSegmentation.selectionOverlay = null;
    }
    
    // Remove mouse handlers
    removeRegionSelectionHandlers();
    
    // Hide instructions
    hideSelectionInstructions();
    
    console.log('Cell segmentation selection mode disabled');
}

/**
 * Show selection instructions to user
 */
function showSelectionInstructions() {
    const resultsDiv = document.getElementById('segmentationResults');
    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = `
        <div class="ai-instructions">
            <i class="fas fa-info-circle"></i>
            <span>Click and drag to select a region for cell analysis</span>
        </div>
    `;
}

/**
 * Hide selection instructions
 */
function hideSelectionInstructions() {
    const resultsDiv = document.getElementById('segmentationResults');
    resultsDiv.style.display = 'none';
}

/**
 * Setup region selection mouse handlers
 */
function setupRegionSelection() {
    const viewer = CellSegmentation.activeViewer;
    
    // Store original states
    CellSegmentation.originalMouseNavEnabled = viewer.mouseNavEnabled;
    CellSegmentation.originalKeyboardShortcuts = viewer.keyboardShortcuts;
    CellSegmentation.originalPanHorizontal = viewer.panHorizontal;
    CellSegmentation.originalPanVertical = viewer.panVertical;
    
    // Disable ALL navigation and interaction
    viewer.setMouseNavEnabled(false);
    viewer.keyboardShortcuts = false;
    viewer.panHorizontal = false;
    viewer.panVertical = false;
    viewer.zoomInButton = false;
    viewer.zoomOutButton = false;
    
    // Add visual indicator
    const viewerElement = document.getElementById(viewer.id);
    if (viewerElement) {
        viewerElement.classList.add('selection-mode');
        viewerElement.style.cursor = 'crosshair';
    }
    
    // Add direct DOM event listeners
    const canvas = viewer.canvas;
    if (canvas) {
        canvas.addEventListener('mousedown', onDirectMouseDown, true);
        canvas.addEventListener('mousemove', onDirectMouseMove, true);
        canvas.addEventListener('mouseup', onDirectMouseUp, true);
        
        // Store references for cleanup
        CellSegmentation.directHandlers = {
            mousedown: onDirectMouseDown,
            mousemove: onDirectMouseMove,
            mouseup: onDirectMouseUp
        };
    }
    
    console.log('Region selection handlers set up');
}

/**
 * Mouse event handlers
 */
function onDirectMouseDown(e) {
    if (!CellSegmentation.isSelectionMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    const viewer = CellSegmentation.activeViewer;
    const rect = viewer.canvas.getBoundingClientRect();
    const pixelPoint = new OpenSeadragon.Point(
        e.clientX - rect.left,
        e.clientY - rect.top
    );
    
    const viewportPoint = viewer.viewport.pointFromPixel(pixelPoint);
    CellSegmentation.startPoint = viewportPoint;
    CellSegmentation.isDrawing = true;
    
    // Remove existing selection
    if (CellSegmentation.selectionOverlay) {
        viewer.removeOverlay(CellSegmentation.selectionOverlay);
        CellSegmentation.selectionOverlay = null;
    }
    
    return false;
}

function onDirectMouseMove(e) {
    if (!CellSegmentation.isSelectionMode || !CellSegmentation.isDrawing) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    const viewer = CellSegmentation.activeViewer;
    const rect = viewer.canvas.getBoundingClientRect();
    const pixelPoint = new OpenSeadragon.Point(
        e.clientX - rect.left,
        e.clientY - rect.top
    );
    
    const currentPoint = viewer.viewport.pointFromPixel(pixelPoint);
    updateSelectionBox(CellSegmentation.startPoint, currentPoint);
    
    return false;
}

function onDirectMouseUp(e) {
    if (!CellSegmentation.isSelectionMode || !CellSegmentation.isDrawing) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    CellSegmentation.isDrawing = false;
    
    const viewer = CellSegmentation.activeViewer;
    const rect = viewer.canvas.getBoundingClientRect();
    const pixelPoint = new OpenSeadragon.Point(
        e.clientX - rect.left,
        e.clientY - rect.top
    );
    
    const endPoint = viewer.viewport.pointFromPixel(pixelPoint);
    
    // Calculate selection rectangle
    const selectionRect = {
        x: Math.min(CellSegmentation.startPoint.x, endPoint.x),
        y: Math.min(CellSegmentation.startPoint.y, endPoint.y),
        width: Math.abs(endPoint.x - CellSegmentation.startPoint.x),
        height: Math.abs(endPoint.y - CellSegmentation.startPoint.y)
    };
    
    // Check minimum size
    if (selectionRect.width < 0.0001 || selectionRect.height < 0.0001) {
        console.log('Selection too small, ignoring');
        disableCellSegmentation();
        return false;
    }
    
    CellSegmentation.currentSelection = selectionRect;
    console.log('Selection completed:', selectionRect);
    
    // Process the selection
    processSelectedRegion(selectionRect);
    
    return false;
}

/**
 * Remove region selection mouse handlers
 */
function removeRegionSelectionHandlers() {
    const viewer = CellSegmentation.activeViewer;
    
    if (viewer) {
        // Remove direct DOM handlers
        const canvas = viewer.canvas;
        if (canvas && CellSegmentation.directHandlers) {
            canvas.removeEventListener('mousedown', CellSegmentation.directHandlers.mousedown, true);
            canvas.removeEventListener('mousemove', CellSegmentation.directHandlers.mousemove, true);
            canvas.removeEventListener('mouseup', CellSegmentation.directHandlers.mouseup, true);
        }
        
        // Restore original settings
        viewer.setMouseNavEnabled(CellSegmentation.originalMouseNavEnabled !== false);
        viewer.keyboardShortcuts = CellSegmentation.originalKeyboardShortcuts !== false;
        viewer.panHorizontal = CellSegmentation.originalPanHorizontal !== false;
        viewer.panVertical = CellSegmentation.originalPanVertical !== false;
        viewer.zoomInButton = true;
        viewer.zoomOutButton = true;
        
        // Remove visual indicator
        const viewerElement = document.getElementById(viewer.id);
        if (viewerElement) {
            viewerElement.classList.remove('selection-mode');
            viewerElement.style.cursor = '';
        }
        
        console.log('Selection handlers removed, navigation restored');
    }
}

/**
 * Update selection box visualization during drag
 */
function updateSelectionBox(startPoint, currentPoint) {
    const rect = {
        x: Math.min(startPoint.x, currentPoint.x),
        y: Math.min(startPoint.y, currentPoint.y),
        width: Math.abs(currentPoint.x - startPoint.x),
        height: Math.abs(currentPoint.y - startPoint.y)
    };
    
    // Remove existing overlay
    if (CellSegmentation.selectionOverlay) {
        CellSegmentation.activeViewer.removeOverlay(CellSegmentation.selectionOverlay);
    }
    
    // Create new selection box if we don't have one
    if (!CellSegmentation.selectionBox) {
        CellSegmentation.selectionBox = document.createElement('div');
        CellSegmentation.selectionBox.className = 'selection-box';
    }
    
    // Add overlay with current rectangle
    CellSegmentation.selectionOverlay = CellSegmentation.selectionBox;
    CellSegmentation.activeViewer.addOverlay({
        element: CellSegmentation.selectionBox,
        location: new OpenSeadragon.Rect(rect.x, rect.y, rect.width, rect.height)
    });
}

/**
 * Process the selected region for AI analysis
 */
async function processSelectedRegion(selectionRect) {
    console.log('Processing selected region:', selectionRect);
    
    showAnalysisProgress('Extracting region...');
    
    try {
        // Extract REAL image data from the selected region
        const imageBlob = await extractRegionImage(selectionRect);
        
        // Send to AI service
        showAnalysisProgress('Analyzing cells...');
        const results = await sendToAIService(imageBlob);
        
        // Display results
        displaySegmentationResults(results, selectionRect);
        
    } catch (error) {
        console.error('Error processing region:', error);
        showAnalysisError('Failed to analyze region: ' + error.message);
    }
}

/**
 * Extract REAL image data from selected region using working method
 */
async function extractRegionImage(selectionRect) {
    const viewer = CellSegmentation.activeViewer;
    
    console.log('Extracting real image data from selection');
    
    return new Promise((resolve, reject) => {
        // Create extraction canvas
        const canvas = document.createElement('canvas');
        const targetSize = 1000; // AI service expects ~1000x1000 regions
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        
        // Get the actual drawing canvas from OpenSeadragon
        let viewerCanvas = null;
        
        // Use the working method we perfected
        if (viewer.drawer && viewer.drawer.canvas) {
            viewerCanvas = viewer.drawer.canvas;
        } else {
            // Fallback to DOM search
            const viewerElement = document.getElementById(viewer.id);
            if (viewerElement) {
                const canvases = viewerElement.getElementsByTagName('canvas');
                if (canvases.length > 0) {
                    viewerCanvas = canvases[0];
                }
            }
        }
        
        if (!viewerCanvas || viewerCanvas.tagName !== 'CANVAS') {
            reject(new Error('Could not find viewer canvas'));
            return;
        }
        
        try {
            // Calculate screen coordinates using OpenSeadragon's method
            const topLeft = viewer.viewport.viewportToViewerElementCoordinates(
                new OpenSeadragon.Point(selectionRect.x, selectionRect.y)
            );
            
            const bottomRight = viewer.viewport.viewportToViewerElementCoordinates(
                new OpenSeadragon.Point(
                    selectionRect.x + selectionRect.width,
                    selectionRect.y + selectionRect.height
                )
            );
            
            const screenCoords = {
                x: topLeft.x,
                y: topLeft.y,
                width: bottomRight.x - topLeft.x,
                height: bottomRight.y - topLeft.y
            };
            
            // Ensure coordinates are within canvas bounds
            const srcX = Math.max(0, Math.min(screenCoords.x, viewerCanvas.width));
            const srcY = Math.max(0, Math.min(screenCoords.y, viewerCanvas.height));
            const srcW = Math.min(screenCoords.width, viewerCanvas.width - srcX);
            const srcH = Math.min(screenCoords.height, viewerCanvas.height - srcY);
            
            if (srcW > 0 && srcH > 0) {
                // Extract the region and scale to target size
                ctx.drawImage(
                    viewerCanvas,
                    srcX, srcY, srcW, srcH,
                    0, 0, targetSize, targetSize
                );
                
                console.log('Successfully extracted region from viewer canvas');
                
                // Convert to blob
                canvas.toBlob(blob => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create blob from canvas'));
                    }
                }, 'image/png');
                
            } else {
                reject(new Error('Invalid extraction dimensions'));
            }
            
        } catch (coordError) {
            console.error('Coordinate calculation failed:', coordError);
            reject(coordError);
        }
    });
}

/**
 * Send image data to AI service
 */
async function sendToAIService(imageBlob) {
    const formData = new FormData();
    formData.append('file', imageBlob, 'region.png');
    formData.append('seg_threshold', AI_SERVICE_CONFIG.defaultConfig.seg_threshold);
    formData.append('magnification', AI_SERVICE_CONFIG.defaultConfig.magnification);
    formData.append('config_name', AI_SERVICE_CONFIG.defaultConfig.config_name);
    
    const response = await fetch('../ai_proxy.php?endpoint=predict', {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error(`AI service error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
}

/**
 * Display segmentation results in the sidebar and as overlay
 */
function displaySegmentationResults(results, selectionRect) {
    console.log('AI Results:', results);
    
    // Update sidebar with results
    const resultsDiv = document.getElementById('segmentationResults');
    resultsDiv.innerHTML = `
        <div class="ai-results-summary">
            <div class="ai-result-header">
                <i class="fas fa-brain"></i>
                <span>Analysis Complete</span>
            </div>
            
            <div class="ai-metrics">
                <div class="ai-metric">
                    <span class="metric-label">Cells Detected:</span>
                    <span class="metric-value">${results.cell_count}</span>
                </div>
                <div class="ai-metric">
                    <span class="metric-label">Confidence:</span>
                    <span class="metric-value">${(results.seg_confidence * 100).toFixed(1)}%</span>
                </div>
                <div class="ai-metric">
                    <span class="metric-label">Avg Cell Size:</span>
                    <span class="metric-value">${results.avg_cell_size} px²</span>
                </div>
                <div class="ai-metric">
                    <span class="metric-label">Configuration:</span>
                    <span class="metric-value">${results.config_used || 'Default'}</span>
                </div>
            </div>
            
            <div class="ai-actions">
                <button class="action-btn secondary" onclick="showCellDetails()">
                    <i class="fas fa-list"></i> Cell Details
                </button>
                <button class="action-btn secondary" onclick="exportResults()">
                    <i class="fas fa-download"></i> Export
                </button>
                <button class="action-btn danger" onclick="clearResults()">
                    <i class="fas fa-trash"></i> Clear
                </button>
            </div>
        </div>
    `;
    
    // Add overlay with cell markers
    addCellOverlay(results, selectionRect);
    
    // Exit selection mode
    disableCellSegmentation();
}

/**
 * Add cell overlay markers to the viewer
 */
function addCellOverlay(results, selectionRect) {
    const viewer = CellSegmentation.activeViewer;
    
    console.log('Adding cell overlays for', results.instance_info?.length || 0, 'cells');
    
    // Remove existing overlays
    clearCellOverlays();
    
    // Add individual cell markers
    if (results.instance_info && results.instance_info.length > 0) {
        // Calculate marker size based on selection size
        const baseMarkerSize = Math.max(selectionRect.width * 0.025, selectionRect.height * 0.025);
        const minMarkerSize = 0.002;
        const maxMarkerSize = 0.015;
        const markerSize = Math.max(minMarkerSize, Math.min(maxMarkerSize, baseMarkerSize));
        
        results.instance_info.forEach((cell, index) => {
            // Create marker element
            const marker = document.createElement('div');
            marker.className = 'cell-marker';
            marker.style.cssText = `
                width: 100%;
                height: 100%;
                background-color: #ff4444;
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                cursor: pointer;
                z-index: 1001;
                pointer-events: auto;
                box-sizing: border-box;
            `;
            
            // Add cell ID label
            const label = document.createElement('span');
            label.style.cssText = `
                position: absolute;
                top: -25px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(255,255,255,0.95);
                padding: 2px 4px;
                font-size: 10px;
                border-radius: 3px;
                white-space: nowrap;
                border: 1px solid #ccc;
                font-weight: bold;
                min-width: 20px;
                text-align: center;
            `;
            label.textContent = `${cell.id}`;
            marker.appendChild(label);
            
            // Calculate position
            const relativeX = cell.centroid[0] / results.input_size[0];
            const relativeY = cell.centroid[1] / results.input_size[1];
            
            const absoluteX = selectionRect.x + (relativeX * selectionRect.width);
            const absoluteY = selectionRect.y + (relativeY * selectionRect.height);
            
            // Create marker rectangle, centered on position
            const markerRect = new OpenSeadragon.Rect(
                absoluteX - markerSize/2,
                absoluteY - markerSize/2,
                markerSize,
                markerSize
            );
            
            // Add tooltip
            marker.title = `Cell ${cell.id}\nArea: ${cell.area} px²\nCentroid: (${cell.centroid[0].toFixed(1)}, ${cell.centroid[1].toFixed(1)})\nRelative: (${(relativeX*100).toFixed(1)}%, ${(relativeY*100).toFixed(1)}%)`;
            
            // Add click handler
            marker.onclick = function(e) {
                e.stopPropagation();
                showCellPopup(cell, index);
            };
            
            // Add overlay
            viewer.addOverlay({
                element: marker,
                location: markerRect,
                checkResize: false
            });
            
            // Store reference
            CellSegmentation.cellMarkers.push({
                element: marker,
                location: markerRect,
                cellData: cell
            });
        });
        
        console.log(`Added ${results.instance_info.length} cell markers`);
    }
    
    // Add region indicator
    const regionIndicator = document.createElement('div');
    regionIndicator.style.cssText = `
        border: 2px solid #007bff;
        background-color: rgba(0, 123, 255, 0.1);
        pointer-events: none;
        z-index: 999;
        box-sizing: border-box;
    `;
    
    // Add region info label
    const regionLabel = document.createElement('div');
    regionLabel.style.cssText = `
        position: absolute;
        top: 5px;
        left: 5px;
        background: rgba(0, 123, 255, 0.9);
        color: white;
        padding: 4px 8px;
        font-size: 12px;
        border-radius: 4px;
        font-weight: bold;
    `;
    regionLabel.textContent = `${results.cell_count || results.instance_info.length} cells detected`;
    regionIndicator.appendChild(regionLabel);
    
    viewer.addOverlay({
        element: regionIndicator,
        location: new OpenSeadragon.Rect(
            selectionRect.x,
            selectionRect.y,
            selectionRect.width,
            selectionRect.height
        ),
        checkResize: false
    });
    
    CellSegmentation.resultsOverlay = regionIndicator;
}

/**
 * Show cell details popup
 */
function showCellPopup(cell, index) {
    const popup = document.createElement('div');
    popup.className = 'cell-popup';
    popup.innerHTML = `
        <div class="cell-popup-header">
            <span>Cell ${cell.id}</span>
            <button onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="cell-popup-content">
            <div><strong>Area:</strong> ${cell.area} px²</div>
            <div><strong>Centroid:</strong> (${cell.centroid[0].toFixed(1)}, ${cell.centroid[1].toFixed(1)})</div>
            <div><strong>Bounding Box:</strong> ${cell.bbox.join(', ')}</div>
        </div>
    `;
    
    popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 0;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        min-width: 250px;
    `;
    
    document.body.appendChild(popup);
}

/**
 * Show analysis progress
 */
function showAnalysisProgress(message) {
    const resultsDiv = document.getElementById('segmentationResults');
    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = `
        <div class="ai-progress">
            <div class="ai-spinner"></div>
            <span>${message}</span>
        </div>
    `;
}

/**
 * Show analysis error
 */
function showAnalysisError(message) {
    const resultsDiv = document.getElementById('segmentationResults');
    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = `
        <div class="ai-error">
            <i class="fas fa-exclamation-triangle"></i>
            <span>${message}</span>
            <button class="action-btn secondary" onclick="retryAnalysis()" style="margin-top: 8px;">
                <i class="fas fa-redo"></i> Retry
            </button>
        </div>
    `;
}

/**
 * Clear all cell overlays
 */
function clearCellOverlays() {
    const viewer = CellSegmentation.activeViewer;
    if (!viewer) return;
    
    if (CellSegmentation.resultsOverlay) {
        viewer.removeOverlay(CellSegmentation.resultsOverlay);
        CellSegmentation.resultsOverlay = null;
    }
    
    if (CellSegmentation.cellMarkers) {
        CellSegmentation.cellMarkers.forEach(marker => {
            viewer.removeOverlay(marker.element);
        });
        CellSegmentation.cellMarkers = [];
    }
}

/**
 * Show detailed cell information
 */
function showCellDetails() {
    console.log('Showing cell details...');
    // Implementation for detailed cell view would go here
}

/**
 * Export segmentation results
 */
function exportResults() {
    console.log('Exporting results...');
    // Implementation for exporting results would go here
}

/**
 * Clear all segmentation results
 */
function clearResults() {
    const resultsDiv = document.getElementById('segmentationResults');
    resultsDiv.style.display = 'none';
    
    clearCellOverlays();
    
    // Remove selection overlay
    if (CellSegmentation.selectionOverlay) {
        CellSegmentation.activeViewer.removeOverlay(CellSegmentation.selectionOverlay);
        CellSegmentation.selectionOverlay = null;
    }
    
    CellSegmentation.currentSelection = null;
    console.log('All results and overlays cleared');
}

/**
 * Retry analysis with current selection
 */
function retryAnalysis() {
    if (CellSegmentation.currentSelection) {
        processSelectedRegion(CellSegmentation.currentSelection);
    }
}

// Initialize when DOM is ready
$(document).ready(function() {
    setTimeout(initializeCellSegmentation, 2000);
});

// Export functions for global access
window.enableCellSegmentation = enableCellSegmentation;
window.disableCellSegmentation = disableCellSegmentation;
window.showCellDetails = showCellDetails;
window.exportResults = exportResults;
window.clearResults = clearResults;
window.retryAnalysis = retryAnalysis;