/**
 * Optimized AI-Powered Region Analysis - v2.0
 * Reduced code size, added overlay controls
 */

// Global state - simplified
window.SimpleExtractor = {
    isActive: false,
    viewer: null,
    startPoint: null,
    isDrawing: false,
    overlay: null,
    aiResults: null,
    currentSelection: null,
    currentAIOverlays: [],
    maxZoom: 0,
    zoomThreshold: 0.8,
    
    // New overlay controls
    overlayOpacity: 0.8,
    overlayColor: '#ff0000',
    showOverlays: true,
    fillCells: false,  // New: fill cells with color
    fillOpacity: 0.3,  // New: separate opacity for fills
    
    // AI Parameters
    segThreshold: 0.5,     // NEW: Segmentation threshold (0.1-0.9)
    watershedThreshold: 0.3, // NEW: Watershed threshold
    minCellSize: 5         // NEW: Minimum cell size
};

// Simplified AI Models Config
const AI_MODELS = {
    'vitaminp-resnet34-he': {
        name: 'VitaminP-ResNet34 (H&E)',
        version: 'v1.0.0',
        threshold: 0.3,
        available: true
    }
    // Add more models as needed
};

// Cached DOM elements
const DOM = {
    status: null,
    zoomProgress: null,
    zoomText: null,
    zoomIndicator: null,
    zoomWarning: null,
    imageContainer: null,
    infoContainer: null,
    
    init() {
        this.status = document.getElementById('simple-region-status');
        this.zoomProgress = document.getElementById('zoomProgress');
        this.zoomText = document.getElementById('zoomText');
        this.zoomIndicator = document.getElementById('zoomIndicator');
        this.zoomWarning = document.getElementById('zoomWarning');
        this.imageContainer = document.getElementById('simple-region-image');
        this.infoContainer = document.getElementById('simple-region-info');
    }
};

/**
 * Main initialization - enhanced for your setup
 */
function initSimpleExtractor() {
    console.log('🔄 Initializing AI extractor...');
    DOM.init();
    
    // Enhanced viewer detection with retries
    const viewer = findViewer();
    if (!viewer) {
        console.warn('⚠️ No viewer found on first attempt, will retry...');
        updateStatus('⚠️ Waiting for viewer to load...');
        return false;
    }
    
    console.log('✅ Viewer found:', viewer.id || 'unknown-id');
    SimpleExtractor.viewer = viewer;
    
    // Setup with consolidated handlers
    if (viewer.isOpen && viewer.isOpen()) {
        console.log('✅ Viewer is already open, setting up immediately');
        setupViewer();
    } else {
        console.log('⏳ Viewer not open yet, waiting for open event');
        viewer.addHandler('open', () => {
            console.log('✅ Viewer opened, setting up now');
            setupViewer();
        });
    }
    
    checkAIServiceHealth();
    return true;
}

/**
 * Find viewer - dynamic detection like original code
 */
function findViewer() {
    console.log('🔍 Starting dynamic viewer detection...');
    
    // Method 1: Look for global viewer variables (dynamic approach from original)
    for (let key in window) {
        try {
            const obj = window[key];
            if (obj && typeof obj === 'object' && 
                obj.viewport && 
                typeof obj.isOpen === 'function' &&
                typeof obj.addHandler === 'function') {
                
                console.log('✅ Found viewer via global scope:', key);
                return obj;
            }
        } catch (e) {
            // Skip objects that throw errors on property access
            continue;
        }
    }
    
    // Method 2: Check OpenSeadragon viewers array
    if (window.OpenSeadragon && window.OpenSeadragon.viewers) {
        for (let viewer of window.OpenSeadragon.viewers) {
            if (viewer && viewer.viewport) {
                console.log('✅ Found viewer via OpenSeadragon.viewers');
                return viewer;
            }
        }
    }
    
    // Method 3: Look for DOM elements with openseadragon class or channel pattern
    const osdElements = document.querySelectorAll('.openseadragon, [id*="CHANNEL"], [id*="MS0"], [id*="_UNKNOWN"]');
    for (let element of osdElements) {
        const viewerId = element.id;
        if (viewerId && window[viewerId]) {
            const viewer = window[viewerId];
            if (viewer.viewport && typeof viewer.isOpen === 'function') {
                console.log('✅ Found viewer via DOM element ID:', viewerId);
                return viewer;
            }
        }
    }
    
    console.warn('❌ No viewer found with any method');
    return null;
}

/**
 * Setup viewer - consolidated
 */
function setupViewer() {
    const viewer = SimpleExtractor.viewer;
    
    // Get max zoom
    SimpleExtractor.maxZoom = getMaxZoom();
    
    // Add zoom handlers
    ['zoom', 'animation', 'animation-finish'].forEach(event => {
        viewer.addHandler(event, checkZoomLevel);
    });
    
    setTimeout(checkZoomLevel, 500);
    console.log('✅ Viewer setup complete');
}

/**
 * Get max zoom - simplified
 */
function getMaxZoom() {
    const viewer = SimpleExtractor.viewer;
    
    try {
        const maxZoom = viewer.viewport.getMaxZoom();
        if (maxZoom > 1) return maxZoom;
    } catch (e) {}
    
    // Fallback
    try {
        const tiledImage = viewer.world.getItemAt(0);
        if (tiledImage?.source?.dimensions) {
            const maxDim = Math.max(
                tiledImage.source.dimensions.x,
                tiledImage.source.dimensions.y
            );
            return Math.log2(maxDim / 256);
        }
    } catch (e) {}
    
    return 10; // Default fallback
}

/**
 * Check zoom level - optimized
 */
function checkZoomLevel() {
    if (!SimpleExtractor.viewer?.viewport) return;
    
    const currentZoom = SimpleExtractor.viewer.viewport.getZoom();
    const maxZoom = SimpleExtractor.maxZoom;
    const requiredZoom = maxZoom * SimpleExtractor.zoomThreshold;
    
    if (!currentZoom || !maxZoom || currentZoom <= 0 || maxZoom <= 0) {
        updateStatus('⚠️ Zoom detection issue');
        return;
    }
    
    const isReady = currentZoom >= requiredZoom;
    const zoomPercent = Math.round((currentZoom / maxZoom) * 100);
    
    updateZoomUI(zoomPercent, isReady);
    updateControls(isReady, zoomPercent);
}

/**
 * Update zoom UI - consolidated
 */
function updateZoomUI(zoomPercent, isReady) {
    const safePercent = Math.max(0, Math.min(zoomPercent || 0, 100));
    
    if (DOM.zoomProgress) {
        DOM.zoomProgress.style.width = safePercent + '%';
        DOM.zoomProgress.style.backgroundColor = isReady ? '#28a745' : '#ffc107';
    }
    
    if (DOM.zoomText) {
        DOM.zoomText.textContent = `${safePercent}% of maximum${isReady ? ' ✓' : ''}`;
        DOM.zoomText.style.color = isReady ? '#28a745' : '#856404';
    }
    
    if (DOM.zoomIndicator) {
        DOM.zoomIndicator.className = isReady ? 'zoom-indicator ready' : 'zoom-indicator';
    }
}

/**
 * Update controls - consolidated
 */
function updateControls(isReady, zoomPercent) {
    const startBtn = document.querySelector('[onclick="startRegionSelection()"]');
    
    if (startBtn) {
        startBtn.disabled = !isReady;
        startBtn.style.opacity = isReady ? '1' : '0.5';
    }
    
    // Update status and warning
    if (isReady) {
        updateStatus(`✅ Ready for AI analysis (${zoomPercent}% zoom)`);
        hideElement(DOM.zoomWarning);
    } else {
        const requiredPercent = Math.round(SimpleExtractor.zoomThreshold * 100);
        updateStatus(`⚠️ Zoom to ${requiredPercent}%+ for AI (currently ${zoomPercent}%)`);
        showElement(DOM.zoomWarning);
        
        if (SimpleExtractor.isActive) {
            stopRegionSelection();
        }
    }
}

/**
 * Utility functions
 */
function showElement(element) {
    if (element) element.style.display = 'block';
}

function hideElement(element) {
    if (element) element.style.display = 'none';
}

function updateStatus(message) {
    if (DOM.status) DOM.status.textContent = message;
    console.log('📊', message);
}

/**
 * Region selection - simplified
 */
function startRegionSelection() {
    if (!SimpleExtractor.viewer && !initSimpleExtractor()) {
        alert('No viewer found!');
        return;
    }
    
    // Zoom check
    const currentZoom = SimpleExtractor.viewer.viewport.getZoom();
    const requiredZoom = SimpleExtractor.maxZoom * SimpleExtractor.zoomThreshold;
    
    if (currentZoom < requiredZoom) {
        alert('Please zoom in more for accurate AI analysis.');
        return;
    }
    
    // Setup selection
    const viewer = SimpleExtractor.viewer;
    const canvas = viewer.canvas;
    
    SimpleExtractor.isActive = true;
    viewer.setMouseNavEnabled(false);
    
    // Add mouse handlers
    canvas.addEventListener('mousedown', handleMouseDown, true);
    canvas.addEventListener('mousemove', handleMouseMove, true);
    canvas.addEventListener('mouseup', handleMouseUp, true);
    
    canvas.style.cursor = 'crosshair';
    updateStatus('Click and drag to select a region');
    
    clearResults();
}

function stopRegionSelection() {
    if (!SimpleExtractor.viewer) return;
    
    const viewer = SimpleExtractor.viewer;
    const canvas = viewer.canvas;
    
    // Remove handlers
    canvas.removeEventListener('mousedown', handleMouseDown, true);
    canvas.removeEventListener('mousemove', handleMouseMove, true);
    canvas.removeEventListener('mouseup', handleMouseUp, true);
    
    // Restore viewer
    viewer.setMouseNavEnabled(true);
    canvas.style.cursor = '';
    
    // Remove overlay
    if (SimpleExtractor.overlay) {
        viewer.removeOverlay(SimpleExtractor.overlay);
        SimpleExtractor.overlay = null;
    }
    
    SimpleExtractor.isActive = false;
    SimpleExtractor.isDrawing = false;
    checkZoomLevel();
}

/**
 * Mouse handlers - consolidated
 */
/**
 * Enhanced mouse handlers with better coordinate tracking - FIXED
 */
function handleMouseDown(e) {
    if (!SimpleExtractor.isActive) return;
    e.preventDefault();
    e.stopPropagation();
    
    const viewer = SimpleExtractor.viewer;
    const canvas = getViewerCanvas();
    
    if (!canvas) {
        console.error('Cannot find canvas for mouse interaction');
        return;
    }
    
    // Get canvas bounding rect accounting for current monitor
    const rect = canvas.getBoundingClientRect();
    
    console.log('🖱️ Mouse down event:', {
        clientX: e.clientX,
        clientY: e.clientY,
        canvasRect: rect,
        devicePixelRatio: window.devicePixelRatio
    });
    
    // Calculate pixel coordinates relative to canvas display
    const pixelPoint = new OpenSeadragon.Point(
        e.clientX - rect.left,
        e.clientY - rect.top
    );
    
    console.log('🖱️ Canvas pixel point:', pixelPoint);
    
    // Convert to viewport coordinates
    SimpleExtractor.startPoint = viewer.viewport.pointFromPixel(pixelPoint);
    SimpleExtractor.isDrawing = true;
    
    console.log('🖱️ Viewport start point:', SimpleExtractor.startPoint);
    updateStatus('Drawing selection...');
}

function handleMouseMove(e) {
    if (!SimpleExtractor.isActive || !SimpleExtractor.isDrawing) return;
    e.preventDefault();
    e.stopPropagation();
    
    const viewer = SimpleExtractor.viewer;
    const canvas = getViewerCanvas();
    
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const pixelPoint = new OpenSeadragon.Point(
        e.clientX - rect.left,
        e.clientY - rect.top
    );
    
    const currentPoint = viewer.viewport.pointFromPixel(pixelPoint);
    updateSelectionOverlay(SimpleExtractor.startPoint, currentPoint);
}

function handleMouseUp(e) {
    if (!SimpleExtractor.isActive || !SimpleExtractor.isDrawing) return;
    e.preventDefault();
    e.stopPropagation();
    
    SimpleExtractor.isDrawing = false;
    
    const viewer = SimpleExtractor.viewer;
    const canvas = getViewerCanvas();
    
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const pixelPoint = new OpenSeadragon.Point(
        e.clientX - rect.left,
        e.clientY - rect.top
    );
    
    const endPoint = viewer.viewport.pointFromPixel(pixelPoint);
    
    console.log('🖱️ Selection complete:', {
        start: SimpleExtractor.startPoint,
        end: endPoint
    });
    
    const selection = {
        x: Math.min(SimpleExtractor.startPoint.x, endPoint.x),
        y: Math.min(SimpleExtractor.startPoint.y, endPoint.y),
        width: Math.abs(endPoint.x - SimpleExtractor.startPoint.x),
        height: Math.abs(endPoint.y - SimpleExtractor.startPoint.y)
    };
    
    console.log('🖱️ Final selection rect:', selection);
    
    if (selection.width < 0.001 || selection.height < 0.001) {
        updateStatus('Selection too small, try again');
        return;
    }
    
    SimpleExtractor.currentSelection = selection;
    processSelection(selection);
}

/**
 * Update selection overlay
 */
function updateSelectionOverlay(start, current) {
    const viewer = SimpleExtractor.viewer;
    
    if (SimpleExtractor.overlay) {
        viewer.removeOverlay(SimpleExtractor.overlay);
    }
    
    const rect = {
        x: Math.min(start.x, current.x),
        y: Math.min(start.y, current.y),
        width: Math.abs(current.x - start.x),
        height: Math.abs(current.y - start.y)
    };
    
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        border: 3px dashed #ff6b6b;
        background: rgba(255, 107, 107, 0.2);
        pointer-events: none;
        box-sizing: border-box;
    `;
    
    viewer.addOverlay({
        element: overlay,
        location: new OpenSeadragon.Rect(rect.x, rect.y, rect.width, rect.height)
    });
    
    SimpleExtractor.overlay = overlay;
}

/**
 * Process selection - simplified
 */
async function processSelection(selection) {
    updateStatus('🔍 Processing selection...');
    
    try {
        // Extract image for AI
        const aiImageBlob = await extractRegionForAI(selection);
        
        // Create preview
        const imagePreview = await createImagePreview(selection);
        displayResults(imagePreview, selection);
        
        // Send to AI
        updateStatus('🤖 Analyzing with AI...');
        const aiResults = await sendToAIService(aiImageBlob);
        
        // Display results
        displayAIResults(aiResults);
        updateStatus('✅ Analysis complete!');
        
    } catch (error) {
        console.error('❌ Processing error:', error);
        updateStatus('❌ Error: ' + error.message);
    }
}

/**
 * Extract region for AI - optimized
 */
/**
 * Extract region for AI - FIXED for multi-monitor setups
 */
async function extractRegionForAI(selectionRect) {
    const viewer = SimpleExtractor.viewer;
    
    return new Promise((resolve, reject) => {
        try {
            console.log('🖼️ Starting region extraction...');
            console.log('Device pixel ratio:', window.devicePixelRatio);
            
            // Get viewer canvas with proper scaling detection
            const viewerCanvas = getViewerCanvas();
            if (!viewerCanvas) {
                reject(new Error('Canvas not found'));
                return;
            }
            
            // Calculate coordinates with pixel ratio correction
            const coords = calculateScreenCoords(selectionRect);
            console.log('📐 Calculated coords:', coords);
            console.log('📐 Canvas actual size:', viewerCanvas.width, 'x', viewerCanvas.height);
            console.log('📐 Canvas display size:', viewerCanvas.clientWidth, 'x', viewerCanvas.clientHeight);
            
            // Validate coordinates are within canvas bounds
            const safeCoords = validateAndClampCoords(coords, viewerCanvas);
            console.log('✅ Safe coords:', safeCoords);
            
            // Create extraction canvas with proper scaling
            const canvas = document.createElement('canvas');
            canvas.width = safeCoords.width;
            canvas.height = safeCoords.height;
            const ctx = canvas.getContext('2d');
            
            // Set high quality scaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Extract region with proper pixel ratio handling
            ctx.drawImage(
                viewerCanvas,
                safeCoords.x, safeCoords.y, safeCoords.width, safeCoords.height,
                0, 0, safeCoords.width, safeCoords.height
            );
            
            console.log('✅ Region extracted successfully');
            
            // Convert to blob
            canvas.toBlob(resolve, 'image/png');
            
        } catch (error) {
            console.error('❌ Region extraction failed:', error);
            reject(error);
        }
    });
}

/**
 * Get viewer canvas - FIXED with proper scaling detection
 */
function getViewerCanvas() {
    const viewer = SimpleExtractor.viewer;
    
    console.log('🔍 Looking for viewer canvas...');
    
    // Method 1: Direct drawer canvas
    if (viewer.drawer?.canvas) {
        console.log('✅ Found canvas via drawer');
        return viewer.drawer.canvas;
    }
    
    // Method 2: Look in viewer DOM element
    const viewerElement = document.getElementById(viewer.id);
    if (viewerElement) {
        const canvases = viewerElement.getElementsByTagName('canvas');
        if (canvases.length > 0) {
            console.log(`✅ Found ${canvases.length} canvas(es) in viewer DOM`);
            
            // Find the main drawing canvas (usually the largest or first visible one)
            let bestCanvas = null;
            let maxArea = 0;
            
            for (let canvas of canvases) {
                if (canvas.width > 0 && canvas.height > 0) {
                    const area = canvas.width * canvas.height;
                    if (area > maxArea) {
                        maxArea = area;
                        bestCanvas = canvas;
                    }
                }
            }
            
            if (bestCanvas) {
                console.log('✅ Selected best canvas:', bestCanvas.width + 'x' + bestCanvas.height);
                return bestCanvas;
            }
            
            return canvases[0]; // Fallback to first canvas
        }
    }
    
    console.warn('❌ No canvas found');
    return null;
}

/**
 * Calculate screen coordinates - utility
 */
/**
 * Calculate screen coordinates - FIXED for multi-monitor
 */
function calculateScreenCoords(selectionRect) {
    const viewer = SimpleExtractor.viewer;
    const viewport = viewer.viewport;
    
    console.log('📐 Input selection rect:', selectionRect);
    
    // Convert viewport coordinates to viewer element coordinates
    const topLeft = viewport.viewportToViewerElementCoordinates(
        new OpenSeadragon.Point(selectionRect.x, selectionRect.y)
    );
    
    const bottomRight = viewport.viewportToViewerElementCoordinates(
        new OpenSeadragon.Point(
            selectionRect.x + selectionRect.width,
            selectionRect.y + selectionRect.height
        )
    );
    
    console.log('📐 Viewport to element coords:', { topLeft, bottomRight });
    
    // Get the actual canvas and its scaling factors
    const canvas = getViewerCanvas();
    if (!canvas) {
        throw new Error('Cannot find viewer canvas for coordinate calculation');
    }
    
    // Calculate scaling factors
    const canvasRect = canvas.getBoundingClientRect();
    const displayWidth = canvasRect.width;
    const displayHeight = canvasRect.height;
    const actualWidth = canvas.width;
    const actualHeight = canvas.height;
    
    // Calculate scale factors (account for device pixel ratio)
    const scaleX = actualWidth / displayWidth;
    const scaleY = actualHeight / displayHeight;
    
    console.log('📐 Canvas scaling factors:', {
        displaySize: { width: displayWidth, height: displayHeight },
        actualSize: { width: actualWidth, height: actualHeight },
        scaleX: scaleX,
        scaleY: scaleY,
        devicePixelRatio: window.devicePixelRatio
    });
    
    // Apply scaling to coordinates
    const scaledCoords = {
        x: Math.round(topLeft.x * scaleX),
        y: Math.round(topLeft.y * scaleY),
        width: Math.round((bottomRight.x - topLeft.x) * scaleX),
        height: Math.round((bottomRight.y - topLeft.y) * scaleY)
    };
    
    console.log('📐 Scaled coordinates:', scaledCoords);
    
    return scaledCoords;
}

/**
 * Validate and clamp coordinates to canvas bounds - NEW FUNCTION TO ADD
 */
function validateAndClampCoords(coords, canvas) {
    const maxWidth = canvas.width;
    const maxHeight = canvas.height;
    
    // Clamp coordinates to canvas bounds
    const safeCoords = {
        x: Math.max(0, Math.min(coords.x, maxWidth - 1)),
        y: Math.max(0, Math.min(coords.y, maxHeight - 1)),
        width: Math.max(1, Math.min(coords.width, maxWidth - coords.x)),
        height: Math.max(1, Math.min(coords.height, maxHeight - coords.y))
    };
    
    // Ensure we don't go out of bounds with width/height
    if (safeCoords.x + safeCoords.width > maxWidth) {
        safeCoords.width = maxWidth - safeCoords.x;
    }
    if (safeCoords.y + safeCoords.height > maxHeight) {
        safeCoords.height = maxHeight - safeCoords.y;
    }
    
    // Log any clamping that occurred
    if (safeCoords.x !== coords.x || safeCoords.y !== coords.y || 
        safeCoords.width !== coords.width || safeCoords.height !== coords.height) {
        console.log('⚠️ Coordinates were clamped to canvas bounds');
        console.log('Original:', coords);
        console.log('Clamped:', safeCoords);
        console.log('Canvas bounds:', { width: maxWidth, height: maxHeight });
    }
    
    return safeCoords;
}

/**
 * Create image preview - simplified
 */
async function createImagePreview(selectionRect) {
    return new Promise((resolve) => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 400;
            canvas.height = 300;
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 400, 300);
            
            // Add title
            ctx.fillStyle = '#28a745';
            ctx.font = 'bold 16px Arial';
            ctx.fillText('Extracted Region for AI', 20, 25);
            
            resolve({ dataUrl: canvas.toDataURL('image/png'), success: true });
            
        } catch (error) {
            resolve({ error: error.message, success: false });
        }
    });
}

/**
 * Send to AI service - enhanced with custom parameters
 */
/**
 * Send to AI service - Fixed version with cache-busting and proper parameter handling
 */
/**
 * Send to AI service - FIXED VERSION with proper parameter handling
 */
async function sendToAIService(imageBlob) {
    const formData = new FormData();
    
    // Add the file
    formData.append('file', imageBlob, 'region.png');
    
    // Add parameters as STRINGS (FastAPI expects strings from FormData)
    formData.append('seg_threshold', SimpleExtractor.segThreshold.toString());
    formData.append('watershed_threshold', SimpleExtractor.watershedThreshold.toString());
    formData.append('object_size', SimpleExtractor.minCellSize.toString());
    formData.append('magnification', '40');
    formData.append('config_name', 'Better_Separation');
    formData.append('ksize', '15');
    formData.append('morph_kernel_size', '3');
    formData.append('min_object_initial', SimpleExtractor.minCellSize.toString());
    
    console.log('📤 Sending to AI service with parameters:', {
        seg_threshold: SimpleExtractor.segThreshold,
        watershed_threshold: SimpleExtractor.watershedThreshold,
        object_size: SimpleExtractor.minCellSize
    });
    
    // Debug: Log all FormData entries
    console.log('📤 FormData contents being sent:');
    for (let [key, value] of formData.entries()) {
        if (key === 'file') {
            console.log(`  ${key}: File blob (${value.size} bytes)`);
        } else {
            console.log(`  ${key}: "${value}" (type: ${typeof value})`);
        }
    }
    
    const response = await fetch('../ai_proxy.php?endpoint=predict', {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error(`AI service error: ${response.status} - ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Log debug info from PHP proxy and backend
    if (result.php_proxy_debug) {
        console.log('📥 PHP Proxy Debug Info:', result.php_proxy_debug);
    }
    
    if (result.parameters_received) {
        console.log('📥 Backend received parameters:', result.parameters_received);
    }
    
    if (result.parameters_used) {
        console.log('📥 Backend used parameters:', result.parameters_used);
    }
    
    console.log('📥 AI Result Summary:', {
        cell_count: result.cell_count,
        config_used: result.config_used
    });
    
    return result;
}
/**
 * Debug function to test parameter transmission
 */
async function debugParameterTransmission() {
    console.log('🔍 Debug: Testing parameter transmission...');
    
    // Create a small test image
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 100, 100);
    
    const testBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    
    // Test with extreme parameters that should be easy to see
    const testParams = {
        segThreshold: 0.99,
        watershedThreshold: 0.77,
        minCellSize: 99
    };
    
    // Temporarily set extreme parameters
    const originalParams = {
        segThreshold: SimpleExtractor.segThreshold,
        watershedThreshold: SimpleExtractor.watershedThreshold,
        minCellSize: SimpleExtractor.minCellSize
    };
    
    SimpleExtractor.segThreshold = testParams.segThreshold;
    SimpleExtractor.watershedThreshold = testParams.watershedThreshold;
    SimpleExtractor.minCellSize = testParams.minCellSize;
    
    console.log('🔍 Test parameters set:', testParams);
    
    try {
        const result = await sendToAIService(testBlob);
        
        console.log('🔍 Backend response analysis:');
        console.log('  Parameters received by backend:', result.parameters_received);
        console.log('  Parameters used by backend:', result.parameters_used);
        console.log('  Expected seg_threshold:', testParams.segThreshold, 'Got:', result.parameters_received?.seg_threshold);
        console.log('  Expected watershed_threshold:', testParams.watershedThreshold, 'Got:', result.parameters_received?.watershed_threshold);
        console.log('  Expected object_size:', testParams.minCellSize, 'Got:', result.parameters_received?.object_size);
        
        // Check if parameters made it through
        if (result.parameters_received?.seg_threshold == testParams.segThreshold) {
            console.log('✅ seg_threshold transmitted correctly');
        } else {
            console.log('❌ seg_threshold NOT transmitted correctly');
        }
        
        if (result.parameters_received?.watershed_threshold == testParams.watershedThreshold) {
            console.log('✅ watershed_threshold transmitted correctly');
        } else {
            console.log('❌ watershed_threshold NOT transmitted correctly');
        }
        
        if (result.parameters_received?.object_size == testParams.minCellSize) {
            console.log('✅ object_size transmitted correctly');
        } else {
            console.log('❌ object_size NOT transmitted correctly');
        }
        
    } catch (error) {
        console.error('🔍 Debug test failed:', error);
    } finally {
        // Restore original parameters
        SimpleExtractor.segThreshold = originalParams.segThreshold;
        SimpleExtractor.watershedThreshold = originalParams.watershedThreshold;
        SimpleExtractor.minCellSize = originalParams.minCellSize;
        
        console.log('🔍 Original parameters restored');
    }
}

// Add to global scope
window.debugParameterTransmission = debugParameterTransmission;

/**
 * Display results - simplified
 */
function displayResults(preview, selection) {
    if (!DOM.imageContainer) return;
    
    DOM.imageContainer.innerHTML = `
        <div class="results-container">
            <h4><i class="fas fa-camera"></i> Extracted Region</h4>
            ${preview.success ? `<img src="${preview.dataUrl}" style="max-width: 100%; border-radius: 4px;">` : '<p>Preview failed</p>'}
        </div>
    `;
}

/**
 * Display AI results with overlay controls
 */
function displayAIResults(aiResults) {
    SimpleExtractor.aiResults = aiResults;
    
    if (!DOM.imageContainer) return;
    
    DOM.imageContainer.innerHTML = `
        <div class="ai-results-container">
            <div class="ai-results-header">
                <h4><i class="fas fa-brain"></i> AI Analysis Results</h4>
            </div>
            
            <div class="ai-metrics-grid">
                <div class="ai-metric-card">
                    <div class="metric-value">${aiResults.cell_count || 0}</div>
                    <div class="metric-label">Cells Detected</div>
                </div>
                <div class="ai-metric-card">
                    <div class="metric-value">${((aiResults.seg_confidence || 0) * 100).toFixed(1)}%</div>
                    <div class="metric-label">Confidence</div>
                </div>
            </div>
            
            <!-- AI Parameter Controls - NEW -->
            <div class="ai-parameters">
                <h5><i class="fas fa-cogs"></i> AI Parameters</h5>
                
                <div class="param-row">
                    <label>Segmentation Threshold:</label>
                    <input type="range" id="segThreshold" min="0.1" max="0.9" step="0.05" value="${SimpleExtractor.segThreshold}" 
                           oninput="updateSegThreshold(this.value)">
                    <span id="segThresholdValue">${SimpleExtractor.segThreshold}</span>
                </div>
                
                <div class="param-row">
                    <label>Watershed Threshold:</label>
                    <input type="range" id="watershedThreshold" min="0.1" max="0.8" step="0.05" value="${SimpleExtractor.watershedThreshold}" 
                           oninput="updateWatershedThreshold(this.value)">
                    <span id="watershedThresholdValue">${SimpleExtractor.watershedThreshold}</span>
                </div>
                
                <div class="param-row">
                    <label>Min Cell Size (pixels):</label>
                    <input type="range" id="minCellSize" min="1" max="20" step="1" value="${SimpleExtractor.minCellSize}" 
                           oninput="updateMinCellSize(this.value)">
                    <span id="minCellSizeValue">${SimpleExtractor.minCellSize}</span>
                </div>
                
                <div class="param-actions">
                    <button class="action-btn secondary" onclick="resetAIParameters()" style="width: 48%; margin-right: 4%;">
                        <i class="fas fa-undo"></i> Reset
                    </button>
                    <button class="action-btn primary" onclick="reprocessWithNewParams()" style="width: 48%;">
                        <i class="fas fa-sync"></i> Reprocess
                    </button>
                </div>
            </div>
            
            <!-- Overlay Controls -->
            <div class="overlay-controls">
                <h5><i class="fas fa-layer-group"></i> Overlay Controls</h5>
                
                <div class="control-row">
                    <label>Opacity:</label>
                    <input type="range" id="overlayOpacity" min="0.1" max="1" step="0.1" value="${SimpleExtractor.overlayOpacity}" 
                           oninput="updateOverlayOpacity(this.value)">
                    <span id="opacityValue">${Math.round(SimpleExtractor.overlayOpacity * 100)}%</span>
                </div>
                
                <div class="control-row">
                    <label>Color:</label>
                    <input type="color" id="overlayColor" value="${SimpleExtractor.overlayColor}" 
                           onchange="updateOverlayColor(this.value)">
                </div>
                
                <div class="control-row">
                    <label>
                        <input type="checkbox" id="showOverlays" ${SimpleExtractor.showOverlays ? 'checked' : ''} 
                               onchange="toggleOverlays(this.checked)">
                        Show Overlays
                    </label>
                </div>
                
                <!-- NEW: Fill Controls -->
                <div class="control-row">
                    <label>
                        <input type="checkbox" id="fillCells" ${SimpleExtractor.fillCells ? 'checked' : ''} 
                               onchange="toggleCellFill(this.checked)">
                        Fill Cell Areas
                    </label>
                </div>
                
                <div class="control-row" id="fillOpacityRow" style="display: ${SimpleExtractor.fillCells ? 'flex' : 'none'};">
                    <label>Fill Opacity:</label>
                    <input type="range" id="fillOpacity" min="0.1" max="0.8" step="0.1" value="${SimpleExtractor.fillOpacity}" 
                           oninput="updateFillOpacity(this.value)">
                    <span id="fillOpacityValue">${Math.round(SimpleExtractor.fillOpacity * 100)}%</span>
                </div>
            </div>
            
            <div class="ai-actions">
                <button class="action-btn primary" onclick="showAIResultsOnViewer()">
                    <i class="fas fa-eye"></i> Show Results
                </button>
                <button class="action-btn secondary" onclick="exportAIResults()">
                    <i class="fas fa-download"></i> Export
                </button>
                <button class="action-btn secondary" onclick="retryAIAnalysis()">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        </div>
    `;
}

/**
 * Overlay control functions - Enhanced with fill support
 */
function updateOverlayOpacity(value) {
    SimpleExtractor.overlayOpacity = parseFloat(value);
    document.getElementById('opacityValue').textContent = Math.round(value * 100) + '%';
    
    // Update existing overlays
    SimpleExtractor.currentAIOverlays.forEach(overlay => {
        overlay.style.opacity = value;
    });
}

function updateOverlayColor(color) {
    SimpleExtractor.overlayColor = color;
    
    // Regenerate visualization with new color
    if (SimpleExtractor.currentAIOverlays.length > 0) {
        regenerateVisualization();
    }
}

function toggleOverlays(show) {
    SimpleExtractor.showOverlays = show;
    
    SimpleExtractor.currentAIOverlays.forEach(overlay => {
        overlay.style.display = show ? 'block' : 'none';
    });
}

// NEW: Fill control functions
function toggleCellFill(fill) {
    SimpleExtractor.fillCells = fill;
    
    // Show/hide fill opacity control
    const fillOpacityRow = document.getElementById('fillOpacityRow');
    if (fillOpacityRow) {
        fillOpacityRow.style.display = fill ? 'flex' : 'none';
    }
    
    // Regenerate visualization
    if (SimpleExtractor.currentAIOverlays.length > 0) {
        regenerateVisualization();
    }
}

function updateFillOpacity(value) {
    SimpleExtractor.fillOpacity = parseFloat(value);
    document.getElementById('fillOpacityValue').textContent = Math.round(value * 100) + '%';
    
    // Regenerate visualization with new fill opacity
    if (SimpleExtractor.fillCells && SimpleExtractor.currentAIOverlays.length > 0) {
        regenerateVisualization();
    }
}

/**
 * AI Parameter control functions - NEW
 */
function updateSegThreshold(value) {
    SimpleExtractor.segThreshold = parseFloat(value);
    document.getElementById('segThresholdValue').textContent = value;
    console.log('🎛️ Updated segmentation threshold:', value);
}

function updateWatershedThreshold(value) {
    SimpleExtractor.watershedThreshold = parseFloat(value);
    document.getElementById('watershedThresholdValue').textContent = value;
    console.log('🎛️ Updated watershed threshold:', value);
}

function updateMinCellSize(value) {
    SimpleExtractor.minCellSize = parseInt(value);
    document.getElementById('minCellSizeValue').textContent = value;
    console.log('🎛️ Updated min cell size:', value);
}

function resetAIParameters() {
    // Reset to default values
    SimpleExtractor.segThreshold = 0.5;
    SimpleExtractor.watershedThreshold = 0.3;
    SimpleExtractor.minCellSize = 5;
    
    // Update UI
    const segSlider = document.getElementById('segThreshold');
    const watershedSlider = document.getElementById('watershedThreshold');
    const minSizeSlider = document.getElementById('minCellSize');
    
    if (segSlider) {
        segSlider.value = SimpleExtractor.segThreshold;
        updateSegThreshold(SimpleExtractor.segThreshold);
    }
    
    if (watershedSlider) {
        watershedSlider.value = SimpleExtractor.watershedThreshold;
        updateWatershedThreshold(SimpleExtractor.watershedThreshold);
    }
    
    if (minSizeSlider) {
        minSizeSlider.value = SimpleExtractor.minCellSize;
        updateMinCellSize(SimpleExtractor.minCellSize);
    }
    
    console.log('🔄 AI parameters reset to defaults');
    updateStatus('🔄 Parameters reset to defaults');
}

function reprocessWithNewParams() {
    if (!SimpleExtractor.currentSelection) {
        alert('No selection to reprocess. Please select a region first.');
        return;
    }
    
    console.log('🔄 Reprocessing with new parameters...');
    updateStatus('🔄 Reprocessing with new AI parameters...');
    
    // Clear current overlays and results
    clearAIOverlays();
    
    // Reprocess with new parameters
    processSelection(SimpleExtractor.currentSelection);
}

// Helper function to regenerate visualization
function regenerateVisualization() {
    console.log('🎨 Regenerating visualization with new settings...');
    
    // Clear current overlays
    clearAIOverlays();
    
    // Recreate with current settings
    createBoundaryVisualization();
}

/**
 * Show AI results on viewer - optimized with controls
 */
function showAIResultsOnViewer() {
    if (!SimpleExtractor.aiResults || !SimpleExtractor.currentSelection) {
        alert('No AI results to display');
        return;
    }
    
    clearAIOverlays();
    createBoundaryVisualization();
}

/**
 * Create boundary visualization - Enhanced with fill support
 */
function createBoundaryVisualization() {
    const viewer = SimpleExtractor.viewer;
    const results = SimpleExtractor.aiResults;
    const selection = SimpleExtractor.currentSelection;
    
    if (!results.instance_map) {
        console.warn('No instance map available for boundary detection');
        createSimpleCellVisualization();
        return;
    }
    
    const aiWidth = results.input_size[0];
    const aiHeight = results.input_size[1];
    
    console.log('🎨 Creating visualization from instance map...');
    console.log('Fill mode:', SimpleExtractor.fillCells ? 'ON' : 'OFF');
    
    // Convert instance map to 2D array if needed
    let map2D;
    if (Array.isArray(results.instance_map[0])) {
        map2D = results.instance_map;
    } else {
        map2D = [];
        for (let y = 0; y < aiHeight; y++) {
            map2D[y] = results.instance_map.slice(y * aiWidth, (y + 1) * aiWidth);
        }
    }
    
    // Check for actual segmentation data
    let maxValue = 0;
    let nonZeroCount = 0;
    for (let y = 0; y < aiHeight; y++) {
        for (let x = 0; x < aiWidth; x++) {
            const value = map2D[y][x];
            if (value > 0) {
                nonZeroCount++;
                maxValue = Math.max(maxValue, value);
            }
        }
    }
    
    if (nonZeroCount === 0) {
        console.warn('No segmented pixels found');
        updateStatus('⚠️ No segmented regions found');
        return;
    }
    
    // Create canvas for visualization
    const canvas = document.createElement('canvas');
    canvas.width = aiWidth;
    canvas.height = aiHeight;
    const ctx = canvas.getContext('2d');
    
    const imageData = ctx.createImageData(aiWidth, aiHeight);
    const data = imageData.data;
    
    // Convert hex color to RGB
    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 0, b: 0 };
    };
    
    const rgbColor = hexToRgb(SimpleExtractor.overlayColor);
    
    if (SimpleExtractor.fillCells) {
        // FILL MODE: Color entire cell areas
        console.log('🎨 Creating filled cell areas...');
        
        // Generate random colors for each cell ID
        const cellColors = new Map();
        for (let cellId = 1; cellId <= maxValue; cellId++) {
            // Create variation of base color for each cell
            const hue = ((cellId * 137.508) % 360); // Golden angle for good distribution
            const color = hslToRgb(hue / 360, 0.7, 0.5);
            cellColors.set(cellId, color);
        }
        
        let filledPixels = 0;
        for (let y = 0; y < aiHeight; y++) {
            for (let x = 0; x < aiWidth; x++) {
                const idx = (y * aiWidth + x) * 4;
                const cellId = map2D[y][x];
                
                if (cellId > 0) {
                    const color = cellColors.get(cellId) || rgbColor;
                    data[idx] = color.r;
                    data[idx + 1] = color.g;
                    data[idx + 2] = color.b;
                    data[idx + 3] = Math.round(SimpleExtractor.fillOpacity * 255);
                    filledPixels++;
                } else {
                    data[idx + 3] = 0; // Transparent background
                }
            }
        }
        
        console.log(`✅ Filled ${filledPixels} pixels across ${maxValue} cells`);
        
    } else {
        // BOUNDARY MODE: Show only boundaries
        console.log('🎨 Creating boundary lines...');
        
        const boundaryPixels = findBoundariesJS(map2D);
        
        let boundaryCount = 0;
        for (let y = 0; y < aiHeight; y++) {
            for (let x = 0; x < aiWidth; x++) {
                const idx = (y * aiWidth + x) * 4;
                if (boundaryPixels[y] && boundaryPixels[y][x]) {
                    data[idx] = rgbColor.r;
                    data[idx + 1] = rgbColor.g;
                    data[idx + 2] = rgbColor.b;
                    data[idx + 3] = 255;
                    boundaryCount++;
                } else {
                    data[idx + 3] = 0;
                }
            }
        }
        
        console.log(`✅ Created ${boundaryCount} boundary pixels`);
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Create overlay element
    const boundaryOverlay = document.createElement('div');
    boundaryOverlay.style.cssText = `
        position: relative;
        width: 100%;
        height: 100%;
        pointer-events: none;
        opacity: ${SimpleExtractor.overlayOpacity};
        display: ${SimpleExtractor.showOverlays ? 'block' : 'none'};
        background-image: url(${canvas.toDataURL()});
        background-size: 100% 100%;
        background-repeat: no-repeat;
    `;
    
    // Add info label
    const infoLabel = document.createElement('div');
    infoLabel.style.cssText = `
        position: absolute;
        top: 10px;
        left: 10px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
    `;
    
    const modeText = SimpleExtractor.fillCells ? 'filled areas' : 'boundaries';
    infoLabel.textContent = `${maxValue} cells (${modeText})`;
    boundaryOverlay.appendChild(infoLabel);
    
    // Add the overlay to viewer
    viewer.addOverlay({
        element: boundaryOverlay,
        location: new OpenSeadragon.Rect(
            selection.x,
            selection.y,
            selection.width,
            selection.height
        ),
        checkResize: false
    });
    
    SimpleExtractor.currentAIOverlays.push(boundaryOverlay);
    
    const statusText = SimpleExtractor.fillCells ? 
        `✅ Showing ${maxValue} cells with colored fills` :
        `✅ Showing ${maxValue} cells with precise boundaries`;
    updateStatus(statusText);
}

// Helper function to convert HSL to RGB for varied cell colors
function hslToRgb(h, s, l) {
    let r, g, b;
    
    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

/**
 * Find boundaries in 2D array (from original code)
 */
function findBoundariesJS(map2D) {
    const height = map2D.length;
    const width = map2D[0].length;
    const boundaries = [];
    
    // Initialize boundary array
    for (let y = 0; y < height; y++) {
        boundaries[y] = new Array(width).fill(false);
    }
    
    // Find boundary pixels (where different cell IDs meet or meet background)
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const currentCell = map2D[y][x];
            if (currentCell === 0) continue; // Skip background
            
            // Check 8-connected neighbors for boundaries
            const neighbors = [
                map2D[y-1][x-1], map2D[y-1][x], map2D[y-1][x+1],
                map2D[y][x-1],                   map2D[y][x+1],
                map2D[y+1][x-1], map2D[y+1][x], map2D[y+1][x+1]
            ];
            
            // If any neighbor is different (including background), it's a boundary
            const isBoundary = neighbors.some(neighbor => neighbor !== currentCell);
            boundaries[y][x] = isBoundary;
        }
    }
    
    return boundaries;
}

/**
 * Fallback visualization for when instance map is not available
 */
function createSimpleCellVisualization() {
    const viewer = SimpleExtractor.viewer;
    const results = SimpleExtractor.aiResults;
    const selection = SimpleExtractor.currentSelection;
    
    if (!results.instance_info || results.instance_info.length === 0) {
        updateStatus('No cell data available for visualization');
        return;
    }
    
    const aiWidth = results.input_size[0];
    const aiHeight = results.input_size[1];
    
    console.log('Creating simple cell markers (fallback)...');
    
    // Create SVG overlay for drawing simple markers
    const boundaryOverlay = document.createElement('div');
    boundaryOverlay.style.cssText = `
        position: relative;
        width: 100%;
        height: 100%;
        pointer-events: none;
        opacity: ${SimpleExtractor.overlayOpacity};
        display: ${SimpleExtractor.showOverlays ? 'block' : 'none'};
    `;
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.cssText = 'position: absolute; top: 0; left: 0;';
    
    // Add each cell as a small marker
    let cellsAdded = 0;
    results.instance_info.forEach((cell) => {
        if (!cell.centroid || cell.centroid.length < 2) return;
        
        // Convert AI coordinates to percentage
        const relativeX = (cell.centroid[0] / aiWidth) * 100;
        const relativeY = (cell.centroid[1] / aiHeight) * 100;
        
        // Very small marker based on actual area
        const pixelRadius = Math.sqrt(cell.area / Math.PI);
        const displayRadius = (pixelRadius / Math.min(aiWidth, aiHeight)) * 100;
        const finalRadius = Math.max(0.2, Math.min(2, displayRadius));
        
        // Draw boundary outline
        const cellBoundary = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        cellBoundary.setAttribute('cx', `${relativeX}%`);
        cellBoundary.setAttribute('cy', `${relativeY}%`);
        cellBoundary.setAttribute('r', `${finalRadius}%`);
        cellBoundary.setAttribute('fill', 'none');
        cellBoundary.setAttribute('stroke', SimpleExtractor.overlayColor);
        cellBoundary.setAttribute('stroke-width', '2');
        svg.appendChild(cellBoundary);
        
        cellsAdded++;
    });
    
    // Add info label
    const infoLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    infoLabel.setAttribute('x', '2%');
    infoLabel.setAttribute('y', '6%');
    infoLabel.setAttribute('font-family', 'Arial, sans-serif');
    infoLabel.setAttribute('font-size', '14px');
    infoLabel.setAttribute('font-weight', 'bold');
    infoLabel.setAttribute('fill', 'white');
    infoLabel.setAttribute('stroke', 'black');
    infoLabel.setAttribute('stroke-width', '1');
    infoLabel.textContent = `${cellsAdded} cells (approx. markers)`;
    svg.appendChild(infoLabel);
    
    boundaryOverlay.appendChild(svg);
    
    // Add the boundary overlay to viewer
    viewer.addOverlay({
        element: boundaryOverlay,
        location: new OpenSeadragon.Rect(
            selection.x,
            selection.y,
            selection.width,
            selection.height
        ),
        checkResize: false
    });
    
    // Track this overlay for cleanup
    SimpleExtractor.currentAIOverlays.push(boundaryOverlay);
    
    console.log(`✅ Added simple cell markers for ${cellsAdded} cells`);
    updateStatus(`✅ Showing ${cellsAdded} cell markers (fallback mode)`);
}

/**
 * Utility functions
 */
function clearAIOverlays() {
    const viewer = SimpleExtractor.viewer;
    if (!viewer) return;
    
    SimpleExtractor.currentAIOverlays.forEach(overlay => {
        try {
            viewer.removeOverlay(overlay);
        } catch (e) {}
    });
    
    SimpleExtractor.currentAIOverlays = [];
}

function clearResults() {
    if (DOM.imageContainer) {
        DOM.imageContainer.innerHTML = '<p style="margin: 0; color: #6c757d;">Select a region to begin analysis</p>';
    }
    clearAIOverlays();
    SimpleExtractor.aiResults = null;
    SimpleExtractor.currentSelection = null;
}

/**
 * Enhanced export function - Creates comprehensive zip file
 */
async function exportAIResults() {
    if (!SimpleExtractor.aiResults || !SimpleExtractor.currentSelection) {
        alert('No results to export');
        return;
    }
    
    updateStatus('📦 Creating export package...');
    
    try {
        // Check if JSZip is available
        if (typeof JSZip === 'undefined') {
            console.error('JSZip library not found');
            alert('JSZip library is required for export. Please add:\n<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>\nto your HTML head section.');
            return;
        }
        
        const zip = new JSZip();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const baseName = `ai_analysis_${timestamp}`;
        
        // 1. Export original selected area image
        updateStatus('📦 Extracting original area...');
        const originalImageBlob = await extractRegionForAI(SimpleExtractor.currentSelection);
        zip.file(`${baseName}_original_area.png`, originalImageBlob);
        
        // 2. Export area with cell overlay (boundaries)
        updateStatus('📦 Creating boundary overlay image...');
        const boundaryImageBlob = await createOverlayImage('boundaries');
        if (boundaryImageBlob) {
            zip.file(`${baseName}_with_boundaries.png`, boundaryImageBlob);
        }
        
        // 3. Export area with cell overlay (filled areas if available)
        if (SimpleExtractor.fillCells) {
            updateStatus('📦 Creating filled overlay image...');
            const filledImageBlob = await createOverlayImage('filled');
            if (filledImageBlob) {
                zip.file(`${baseName}_with_filled_areas.png`, filledImageBlob);
            }
        }
        
        // 4. Export JSON prediction results
        updateStatus('📦 Preparing analysis data...');
        const analysisData = {
            metadata: {
                timestamp: new Date().toISOString(),
                exportVersion: '2.0',
                viewerInfo: {
                    id: SimpleExtractor.viewer.id || 'unknown',
                    zoom: SimpleExtractor.viewer.viewport.getZoom(),
                    center: SimpleExtractor.viewer.viewport.getCenter()
                }
            },
            selection: {
                viewport: SimpleExtractor.currentSelection,
                imageCoords: calculateScreenCoords(SimpleExtractor.currentSelection)
            },
            aiResults: SimpleExtractor.aiResults,
            overlaySettings: {
                opacity: SimpleExtractor.overlayOpacity,
                color: SimpleExtractor.overlayColor,
                fillMode: SimpleExtractor.fillCells,
                fillOpacity: SimpleExtractor.fillOpacity
            },
            summary: {
                cellCount: SimpleExtractor.aiResults.cell_count || 0,
                confidence: SimpleExtractor.aiResults.seg_confidence,
                avgCellSize: SimpleExtractor.aiResults.avg_cell_size,
                inputSize: SimpleExtractor.aiResults.input_size,
                processingDevice: SimpleExtractor.aiResults.device,
                modelUsed: getCurrentModelConfig().model_name
            }
        };
        
        zip.file(`${baseName}_analysis_data.json`, JSON.stringify(analysisData, null, 2));
        
        // 5. Create README file
        updateStatus('📦 Creating documentation...');
        const readmeContent = createReadmeContent(analysisData);
        zip.file(`${baseName}_README.txt`, readmeContent);
        
        // 6. Generate and download zip file
        updateStatus('📦 Generating zip file...');
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        
        // Download the zip file
        const url = URL.createObjectURL(zipBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `${baseName}.zip`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
        
        updateStatus('✅ Export package created successfully!');
        console.log('✅ Export completed:', baseName + '.zip');
        
    } catch (error) {
        console.error('❌ Export failed:', error);
        updateStatus('❌ Export failed: ' + error.message);
        alert('Export failed: ' + error.message);
    }
}

/**
 * Create overlay image with boundaries or fills
 */
async function createOverlayImage(mode = 'boundaries') {
    return new Promise((resolve) => {
        try {
            const results = SimpleExtractor.aiResults;
            const selection = SimpleExtractor.currentSelection;
            
            if (!results.instance_map) {
                console.warn('No instance map available for overlay image');
                resolve(null);
                return;
            }
            
            const aiWidth = results.input_size[0];
            const aiHeight = results.input_size[1];
            
            // Convert instance map to 2D
            let map2D;
            if (Array.isArray(results.instance_map[0])) {
                map2D = results.instance_map;
            } else {
                map2D = [];
                for (let y = 0; y < aiHeight; y++) {
                    map2D[y] = results.instance_map.slice(y * aiWidth, (y + 1) * aiWidth);
                }
            }
            
            // Get original area as base
            extractRegionForAI(selection).then(originalBlob => {
                const img = new Image();
                img.onload = () => {
                    // Create canvas for composite image
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    
                    // Draw original image as background
                    ctx.drawImage(img, 0, 0);
                    
                    // Create overlay canvas
                    const overlayCanvas = document.createElement('canvas');
                    overlayCanvas.width = aiWidth;
                    overlayCanvas.height = aiHeight;
                    const overlayCtx = overlayCanvas.getContext('2d');
                    
                    const imageData = overlayCtx.createImageData(aiWidth, aiHeight);
                    const data = imageData.data;
                    
                    // Convert hex color to RGB
                    const hexToRgb = (hex) => {
                        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                        return result ? {
                            r: parseInt(result[1], 16),
                            g: parseInt(result[2], 16),
                            b: parseInt(result[3], 16)
                        } : { r: 255, g: 0, b: 0 };
                    };
                    
                    const rgbColor = hexToRgb(SimpleExtractor.overlayColor);
                    
                    if (mode === 'filled') {
                        // Create filled areas with different colors per cell
                        const cellColors = new Map();
                        let maxValue = 0;
                        
                        // Find max cell ID
                        for (let y = 0; y < aiHeight; y++) {
                            for (let x = 0; x < aiWidth; x++) {
                                maxValue = Math.max(maxValue, map2D[y][x]);
                            }
                        }
                        
                        // Generate colors for each cell
                        for (let cellId = 1; cellId <= maxValue; cellId++) {
                            const hue = ((cellId * 137.508) % 360);
                            const color = hslToRgb(hue / 360, 0.7, 0.5);
                            cellColors.set(cellId, color);
                        }
                        
                        // Fill pixels
                        for (let y = 0; y < aiHeight; y++) {
                            for (let x = 0; x < aiWidth; x++) {
                                const idx = (y * aiWidth + x) * 4;
                                const cellId = map2D[y][x];
                                
                                if (cellId > 0) {
                                    const color = cellColors.get(cellId) || rgbColor;
                                    data[idx] = color.r;
                                    data[idx + 1] = color.g;
                                    data[idx + 2] = color.b;
                                    data[idx + 3] = Math.round(SimpleExtractor.fillOpacity * 255);
                                } else {
                                    data[idx + 3] = 0;
                                }
                            }
                        }
                    } else {
                        // Create boundary lines
                        const boundaryPixels = findBoundariesJS(map2D);
                        
                        for (let y = 0; y < aiHeight; y++) {
                            for (let x = 0; x < aiWidth; x++) {
                                const idx = (y * aiWidth + x) * 4;
                                if (boundaryPixels[y] && boundaryPixels[y][x]) {
                                    data[idx] = rgbColor.r;
                                    data[idx + 1] = rgbColor.g;
                                    data[idx + 2] = rgbColor.b;
                                    data[idx + 3] = 255;
                                } else {
                                    data[idx + 3] = 0;
                                }
                            }
                        }
                    }
                    
                    overlayCtx.putImageData(imageData, 0, 0);
                    
                    // Composite the overlay onto the original image
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.globalAlpha = SimpleExtractor.overlayOpacity;
                    ctx.drawImage(overlayCanvas, 0, 0, canvas.width, canvas.height);
                    
                    // Convert to blob
                    canvas.toBlob(resolve, 'image/png');
                };
                
                img.src = URL.createObjectURL(originalBlob);
            });
            
        } catch (error) {
            console.error('Error creating overlay image:', error);
            resolve(null);
        }
    });
}

/**
 * Create README content for the export package
 */
function createReadmeContent(analysisData) {
    const date = new Date().toLocaleString();
    
    return `AI Cell Analysis Export Package
Generated: ${date}
Export Version: ${analysisData.metadata.exportVersion}

=== PACKAGE CONTENTS ===

1. ${analysisData.metadata.timestamp.replace(/[:.]/g, '-')}_original_area.png
   - Original selected tissue area
   - Dimensions: ${analysisData.aiResults.input_size[0]} x ${analysisData.aiResults.input_size[1]} pixels

2. ${analysisData.metadata.timestamp.replace(/[:.]/g, '-')}_with_boundaries.png
   - Selected area with AI-detected cell boundaries overlay
   - Boundary color: ${analysisData.overlaySettings.color}
   - Overlay opacity: ${(analysisData.overlaySettings.opacity * 100).toFixed(0)}%

${analysisData.overlaySettings.fillMode ? `
3. ${analysisData.metadata.timestamp.replace(/[:.]/g, '-')}_with_filled_areas.png
   - Selected area with filled cell areas (each cell in different color)
   - Fill opacity: ${(analysisData.overlaySettings.fillOpacity * 100).toFixed(0)}%
` : ''}

${analysisData.overlaySettings.fillMode ? '4' : '3'}. ${analysisData.metadata.timestamp.replace(/[:.]/g, '-')}_analysis_data.json
   - Complete AI analysis results and metadata
   - Machine-readable format for further processing

=== ANALYSIS SUMMARY ===

Total Cells Detected: ${analysisData.summary.cellCount}
AI Confidence: ${((analysisData.summary.confidence || 0) * 100).toFixed(1)}%
Average Cell Size: ${analysisData.summary.avgCellSize || 'N/A'} pixels²
Model Used: ${analysisData.summary.modelUsed}
Processing Device: ${analysisData.summary.processingDevice || 'Unknown'}

=== VIEWER INFO ===

Viewer ID: ${analysisData.metadata.viewerInfo.id}
Zoom Level: ${analysisData.metadata.viewerInfo.zoom.toFixed(2)}x
Center Position: (${analysisData.metadata.viewerInfo.center.x.toFixed(4)}, ${analysisData.metadata.viewerInfo.center.y.toFixed(4)})

=== SELECTION COORDINATES ===

Viewport Coordinates:
  X: ${analysisData.selection.viewport.x.toFixed(6)}
  Y: ${analysisData.selection.viewport.y.toFixed(6)}
  Width: ${analysisData.selection.viewport.width.toFixed(6)}
  Height: ${analysisData.selection.viewport.height.toFixed(6)}

Screen Coordinates:
  X: ${analysisData.selection.imageCoords.x}px
  Y: ${analysisData.selection.imageCoords.y}px
  Width: ${analysisData.selection.imageCoords.width}px
  Height: ${analysisData.selection.imageCoords.height}px

=== USAGE NOTES ===

- All images are in PNG format with transparency support
- JSON file contains complete analysis data for programmatic access
- Coordinates are provided in both viewport and screen pixel formats
- Cell boundaries represent actual AI-detected cell shapes
- Colors in filled areas are automatically generated per cell for distinction

For questions about this analysis, please refer to the AI model documentation
or contact your system administrator.

Generated by Polyscope AI Analysis System v2.0`;
}

/**
 * Get current model configuration for export
 */
function getCurrentModelConfig() {
    const modelSelect = document.getElementById('aiModelSelect');
    const configSelect = document.getElementById('aiConfigSelect');
    
    const modelKey = modelSelect ? modelSelect.value : 'vitaminp-resnet34-he';
    const modelConfig = AI_MODELS[modelKey] || AI_MODELS['vitaminp-resnet34-he'];
    
    return {
        model_name: modelKey,
        config_name: configSelect ? configSelect.value : 'Better_Separation',
        seg_threshold: modelConfig.threshold,
        magnification: 40
    };
}

function retryAIAnalysis() {
    if (SimpleExtractor.currentSelection) {
        clearAIOverlays();
        processSelection(SimpleExtractor.currentSelection);
    }
}

async function checkAIServiceHealth() {
    try {
        const response = await fetch('../ai_proxy.php?endpoint=health');
        const data = await response.json();
        updateStatus(data.status === 'healthy' ? 'AI Service: Connected' : 'AI Service: Issues');
    } catch (error) {
        updateStatus('AI Service: Disconnected');
    }
}

// Export functions to global scope
Object.assign(window, {
    startRegionSelection,
    stopRegionSelection,
    clearResults,
    exportAIResults,
    showAIResultsOnViewer,
    retryAIAnalysis,
    updateOverlayOpacity,
    updateOverlayColor,
    toggleOverlays,
    toggleCellFill,        // NEW
    updateFillOpacity,     // NEW
    updateSegThreshold,    // NEW
    updateWatershedThreshold, // NEW
    updateMinCellSize,     // NEW
    resetAIParameters,     // NEW
    reprocessWithNewParams // NEW
});

// Auto-initialize with dynamic viewer detection
$(document).ready(() => {
    console.log('🔄 Document ready, starting dynamic AI extractor initialization...');
    
    // Try immediate initialization
    setTimeout(() => {
        console.log('🔄 First initialization attempt...');
        if (initSimpleExtractor()) {
            updateStatus('✅ AI system ready');
            return;
        }
        
        // Retry after 1 second
        setTimeout(() => {
            console.log('🔄 Second initialization attempt...');
            if (initSimpleExtractor()) {
                updateStatus('✅ AI system ready');
                return;
            }
            
            // Retry after 3 seconds
            setTimeout(() => {
                console.log('🔄 Third initialization attempt...');
                if (initSimpleExtractor()) {
                    updateStatus('✅ AI system ready');
                    return;
                }
                
                // Final retry after 5 seconds
                setTimeout(() => {
                    console.log('🔄 Final initialization attempt...');
                    if (initSimpleExtractor()) {
                        updateStatus('✅ AI system ready');
                    } else {
                        console.error('❌ All initialization attempts failed');
                        updateStatus('❌ Failed to initialize - check console');
                        
                        // Show debugging info for any sample
                        console.log('🔍 DEBUG INFO:');
                        console.log('  - OpenSeadragon available:', !!window.OpenSeadragon);
                        console.log('  - OSD viewers array:', window.OpenSeadragon?.viewers);
                        console.log('  - Potential viewer variables found:');
                        
                        // Look for any variables that might be viewers
                        for (let key in window) {
                            try {
                                const obj = window[key];
                                if (obj && typeof obj === 'object' && obj.viewport) {
                                    console.log(`    - ${key}: has viewport, isOpen=${typeof obj.isOpen === 'function'}`);
                                }
                                // Also check for channel-like patterns
                                if (key.includes('CHANNEL') || key.includes('MS0') || key.includes('viewer')) {
                                    console.log(`    - ${key}:`, typeof obj, obj?.viewport ? 'has viewport' : 'no viewport');
                                }
                            } catch (e) {
                                // Skip problematic objects
                            }
                        }
                        
                        // Check DOM for OpenSeadragon elements
                        const osdElements = document.querySelectorAll('.openseadragon, [id*="CHANNEL"], [id*="MS0"]');
                        console.log('  - DOM elements with OpenSeadragon or sample patterns:', osdElements.length);
                        osdElements.forEach(el => {
                            console.log(`    - Element ID: ${el.id}, has window var: ${!!window[el.id]}`);
                        });
                    }
                }, 5000);
            }, 3000);
        }, 1000);
    }, 500);
    
    // Also set up periodic checks for dynamic samples
    let checkCount = 0;
    const periodicCheck = setInterval(() => {
        checkCount++;
        
        // Stop after 30 attempts (30 seconds)
        if (checkCount > 30) {
            clearInterval(periodicCheck);
            return;
        }
        
        // If we don't have a viewer yet, try again
        if (!SimpleExtractor.viewer) {
            const viewer = findViewer();
            if (viewer) {
                console.log('✅ Viewer found via periodic check at attempt', checkCount, 'ID:', viewer.id);
                SimpleExtractor.viewer = viewer;
                
                if (viewer.isOpen && viewer.isOpen()) {
                    setupViewer();
                    updateStatus('✅ AI system ready');
                } else {
                    viewer.addHandler('open', () => {
                        setupViewer();
                        updateStatus('✅ AI system ready');
                    });
                }
                
                clearInterval(periodicCheck);
            }
        } else {
            // We have a viewer, stop checking
            clearInterval(periodicCheck);
        }
    }, 1000);
});
