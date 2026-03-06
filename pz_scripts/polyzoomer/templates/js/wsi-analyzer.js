/**
 * WSI Analyzer - SMOOTH BOUNDARIES VERSION v4.1
 * - Fast parallel processing (12 tiles at once)
 * - Empty tile detection and skipping
 * - Seamless individual cell boundary visualization
 * - Beautiful cell density heatmap overlay
 * - Full slide analysis with smooth overlaps
 */

// Final WSI state
window.WSIAnalyzer = {
    isActive: false,
    viewer: null,
    overlays: [],
    
    // Processing state
    isProcessing: false,
    shouldStop: false,
    processedTiles: 0,
    totalTiles: 0,
    skippedEmptyTiles: 0,
    
    // OPTIMIZATION SETTINGS
    batchSize: 12,              // Process 12 tiles simultaneously
    emptyTileThreshold: 10,     // Skip tiles with <10% tissue
    
    // Settings
    tileSize: 512,
    segThreshold: 0.5,
    watershedThreshold: 0.35,
    minCellSize: 5,
    overlapRatio: 0.1,
    
    // Visualization modes
    visualizationMode: 'both',   // 'boundaries', 'density', or 'both'
    showBoundaries: true,
    showDensityHeatmap: true,
    boundaryOpacity: 0.8,
    heatmapOpacity: 0.6,
    boundaryColor: '#ff0000',
    
    // Results storage
    tileResults: new Map(),
    aggregatedResults: null,
    heatmapData: null,
    boundaryOverlays: [],
    heatmapOverlays: []
};

// DOM elements
const WSI_DOM = {
    status: null,
    progressContainer: null,
    progressFill: null,
    progressText: null,
    progressDetail: null,
    resultsContainer: null,
    
    
    init() {
        this.status = document.getElementById('wsi-ai-status');
        this.progressContainer = document.getElementById('wsiProgressContainer');
        this.progressFill = document.getElementById('wsiProgressFill');
        this.progressText = document.getElementById('wsiProgressText');
        this.progressDetail = document.getElementById('wsiProgressDetail');
        this.resultsContainer = document.getElementById('wsi-results-container');
    }
};

/**
 * Initialize WSI Analyzer
 */
function initWSIAnalyzer() {
    console.log('🔄 Initializing CENTER TEST Smooth WSI Analyzer...');
    WSI_DOM.init();
    
    WSIAnalyzer.viewer = findWSIViewer();
    
    if (!WSIAnalyzer.viewer) {
        updateWSIStatus('⚠️ Waiting for viewer...');
        return false;
    }
    
    console.log('✅ CENTER TEST Analyzer ready with viewer:', WSIAnalyzer.viewer.id);
    updateWSIStatus('✅ Ready for CENTER smooth boundary test (10x10 tiles)');
    return true;
}

function findWSIViewer() {
    if (window.SimpleExtractor?.viewer) return window.SimpleExtractor.viewer;
    if (window.MS014_UNKNOWNCHANNEL0001) return window.MS014_UNKNOWNCHANNEL0001;
    
    for (let key in window) {
        try {
            const obj = window[key];
            if (obj && typeof obj === 'object' && obj.viewport && 
                typeof obj.isOpen === 'function' && typeof obj.addHandler === 'function') {
                return obj;
            }
        } catch (e) { continue; }
    }
    return null;
}

/**
 * Start Full WSI Analysis
 */
async function startWSIAnalysis() {
    console.log('🧪 Starting CENTER REGION Smooth Boundary Test...');
    
    if (!WSIAnalyzer.viewer && !initWSIAnalyzer()) {
        alert('No viewer found!');
        return;
    }
    
    if (WSIAnalyzer.isProcessing) {
        alert('WSI analysis already running!');
        return;
    }
    
    // Reset counters
    WSIAnalyzer.isProcessing = true;
    WSIAnalyzer.shouldStop = false;
    WSIAnalyzer.processedTiles = 0;
    WSIAnalyzer.skippedEmptyTiles = 0;
    WSIAnalyzer.tileResults.clear();
    
    const tileSize = parseInt(document.getElementById('wsiTileSize')?.value || '1024');
    WSIAnalyzer.tileSize = tileSize;
    
    showWSIProgress();
    updateWSIStatus('🧪 Testing smooth boundaries on center region (10x10 tiles max)...');
    
    try {
        // Step 1: Get DZI info and calculate center test grid
        const dziInfo = await getDZIInfo();
        const tileGrid = calculateTileGrid(dziInfo);
        
        WSIAnalyzer.totalTiles = tileGrid.tiles.length;
        
        console.log(`🧪 CENTER TEST: Processing ${WSIAnalyzer.totalTiles} tiles in center region`);
        updateWSIProgress(0, `Testing smooth boundaries on ${WSIAnalyzer.totalTiles} center tiles...`);
        
        // Step 2: Process center tiles
        await processOptimizedTiles(tileGrid.tiles, dziInfo);
        
        if (!WSIAnalyzer.shouldStop) {
            await aggregateAndCreateVisualizations();
            updateWSIStatus(`✅ CENTER TEST Complete! Check boundary smoothness (${WSIAnalyzer.skippedEmptyTiles} empty skipped)`);
        }
        
    } catch (error) {
        console.error('❌ Center test failed:', error);
        updateWSIStatus('❌ Center test failed: ' + error.message);
    } finally {
        WSIAnalyzer.isProcessing = false;
        hideWSIProgress();
    }
}

async function getDZIInfo() {
    const viewer = WSIAnalyzer.viewer;
    const tiledImage = viewer.world.getItemAt(0);
    const source = tiledImage.source;
    
    const sampleUrl = source.getTileUrl(0, 0, 0);
    const match = sampleUrl.match(/^(.+)\/\d+\/\d+_\d+\.jpeg$/);
    const dziPath = match ? match[1] : './_UNKNOWNCHANNEL0001/MS014_UNKNOWNCHANNEL0001_MS014_HE.svsdeepzoom_files';
    
    const width = source.dimensions?.x || 19920;
    const height = source.dimensions?.y || 22356;
    const maxLevel = source.maxLevel || 15;
    
    return {
        basePath: dziPath,
        width: width,
        height: height,
        tileSize: 254,
        maxLevel: maxLevel,
        targetLevel: maxLevel,
        format: 'jpeg'
    };
}

function calculateTileGrid(dziInfo) {
    const tileSize = WSIAnalyzer.tileSize;
    const stepSize = tileSize * (1 - WSIAnalyzer.overlapRatio);
    
    // FULL WSI ANALYSIS: Process entire slide instead of center region
    const numTilesX = Math.ceil(dziInfo.width / stepSize);
    const numTilesY = Math.ceil(dziInfo.height / stepSize);
    
    const tiles = [];
    for (let y = 0; y < numTilesY; y++) {
        for (let x = 0; x < numTilesX; x++) {
            const tileX = x * stepSize;
            const tileY = y * stepSize;
            const actualWidth = Math.min(tileSize, dziInfo.width - tileX);
            const actualHeight = Math.min(tileSize, dziInfo.height - tileY);
            
            // Only include tiles that have meaningful size
            if (actualWidth > tileSize * 0.5 && actualHeight > tileSize * 0.5) {
                tiles.push({
                    id: `wsi_tile_${x}_${y}`,
                    x: tileX, y: tileY,
                    width: actualWidth, height: actualHeight,
                    gridX: x, gridY: y  // Essential for smooth overlaps
                });
            }
        }
    }
    
    console.log(`🔬 FULL WSI: Created ${tiles.length} tiles for complete slide (${numTilesX}x${numTilesY})`);
    console.log(`📐 Full slide area: ${dziInfo.width}x${dziInfo.height} pixels`);
    
    return { tiles, dziInfo };
}

/**
 * Process tiles with high parallelism and empty detection
 */
async function processOptimizedTiles(tiles, dziInfo) {
    const batches = [];
    
    for (let i = 0; i < tiles.length; i += WSIAnalyzer.batchSize) {
        batches.push(tiles.slice(i, i + WSIAnalyzer.batchSize));
    }
    
    console.log(`📦 Processing ${batches.length} batches of ${WSIAnalyzer.batchSize} tiles each...`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        if (WSIAnalyzer.shouldStop) break;
        
        const batch = batches[batchIndex];
        console.log(`⚡ Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} tiles)`);
        
        const batchPromises = batch.map(tile => processOptimizedTile(tile, dziInfo));
        await Promise.all(batchPromises);
        
        const progressPercent = Math.round((WSIAnalyzer.processedTiles / WSIAnalyzer.totalTiles) * 100);
        updateWSIProgress(progressPercent, `Batch ${batchIndex + 1}/${batches.length} (${WSIAnalyzer.skippedEmptyTiles} empty skipped)`);
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

async function processOptimizedTile(tile, dziInfo) {
    if (WSIAnalyzer.shouldStop) return;
    
    try {
        const tileBlob = await extractDZITile(tile, dziInfo);
        const tissuePercentage = await estimateTissuePercentage(tileBlob);
        
        if (tissuePercentage < WSIAnalyzer.emptyTileThreshold) {
            console.log(`⚪ Skipping empty tile ${tile.id} (${tissuePercentage.toFixed(1)}% tissue)`);
            WSIAnalyzer.skippedEmptyTiles++;
            WSIAnalyzer.processedTiles++;
            return;
        }
        
        console.log(`🔍 Processing tissue tile ${tile.id} (${tissuePercentage.toFixed(1)}% tissue)...`);
        
        const aiResult = await sendTileToAI(tileBlob, tile);
        
        WSIAnalyzer.tileResults.set(tile.id, {
            tile: tile,
            result: aiResult,
            tissuePercentage: tissuePercentage
        });
        
        WSIAnalyzer.processedTiles++;
        console.log(`✅ Tile ${tile.id}: ${aiResult.cell_count || 0} cells`);
        
    } catch (error) {
        console.error(`❌ Tile ${tile.id} failed:`, error);
        WSIAnalyzer.processedTiles++;
    }
}

async function estimateTissuePercentage(imageBlob) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            const ctx = canvas.getContext('2d');
            
            ctx.drawImage(img, 0, 0, 100, 100);
            const imageData = ctx.getImageData(0, 0, 100, 100);
            const data = imageData.data;
            
            let tissuePixels = 0;
            const totalPixels = 100 * 100;
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i + 1], b = data[i + 2];
                if (r < 230 || g < 230 || b < 230) {
                    tissuePixels++;
                }
            }
            
            resolve((tissuePixels / totalPixels) * 100);
        };
        
        img.onerror = () => resolve(0);
        img.src = URL.createObjectURL(imageBlob);
    });
}

async function extractDZITile(tile, dziInfo) {
    try {
        const startCol = Math.floor(tile.x / dziInfo.tileSize);
        const endCol = Math.floor((tile.x + tile.width - 1) / dziInfo.tileSize);
        const startRow = Math.floor(tile.y / dziInfo.tileSize);
        const endRow = Math.floor((tile.y + tile.height - 1) / dziInfo.tileSize);
        
        const canvas = document.createElement('canvas');
        canvas.width = WSIAnalyzer.tileSize;
        canvas.height = WSIAnalyzer.tileSize;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, WSIAnalyzer.tileSize, WSIAnalyzer.tileSize);
        
        const dziTilePromises = [];
        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const url = `${dziInfo.basePath}/${dziInfo.targetLevel}/${col}_${row}.${dziInfo.format}`;
                dziTilePromises.push(loadDZITileWithCoords(url, col, row));
            }
        }
        
        const loadedDZITiles = await Promise.all(dziTilePromises);
        
        loadedDZITiles.forEach(dziTileData => {
            if (!dziTileData?.image) return;
            
            const { image, col, row } = dziTileData;
            const dziX = col * dziInfo.tileSize;
            const dziY = row * dziInfo.tileSize;
            
            const overlapLeft = Math.max(dziX, tile.x);
            const overlapTop = Math.max(dziY, tile.y);
            const overlapRight = Math.min(dziX + dziInfo.tileSize, tile.x + tile.width);
            const overlapBottom = Math.min(dziY + dziInfo.tileSize, tile.y + tile.height);
            
            const overlapWidth = overlapRight - overlapLeft;
            const overlapHeight = overlapBottom - overlapTop;
            
            if (overlapWidth > 0 && overlapHeight > 0) {
                const srcX = overlapLeft - dziX;
                const srcY = overlapTop - dziY;
                const destX = (overlapLeft - tile.x) * (WSIAnalyzer.tileSize / tile.width);
                const destY = (overlapTop - tile.y) * (WSIAnalyzer.tileSize / tile.height);
                const destWidth = overlapWidth * (WSIAnalyzer.tileSize / tile.width);
                const destHeight = overlapHeight * (WSIAnalyzer.tileSize / tile.height);
                
                ctx.drawImage(image, srcX, srcY, overlapWidth, overlapHeight,
                            destX, destY, destWidth, destHeight);
            }
        });
        
        return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        
    } catch (error) {
        throw error;
    }
}

function loadDZITileWithCoords(url, col, row) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve({ image: img, col, row });
        img.onerror = () => resolve(null);
        img.crossOrigin = 'anonymous';
        img.src = url;
        setTimeout(() => { if (!img.complete) resolve(null); }, 3000);
    });
}

async function sendTileToAI(imageBlob, tile) {
    const formData = new FormData();
    formData.append('file', imageBlob, `${tile.id}.png`);
    formData.append('seg_threshold', WSIAnalyzer.segThreshold.toString());
    formData.append('watershed_threshold', WSIAnalyzer.watershedThreshold.toString());
    formData.append('object_size', WSIAnalyzer.minCellSize.toString());
    formData.append('magnification', '40');
    formData.append('config_name', 'Better_Separation');
    formData.append('ksize', '15');
    formData.append('morph_kernel_size', '3');
    formData.append('min_object_initial', WSIAnalyzer.minCellSize.toString());
    formData.append('wsi_mode', 'true');
    formData.append('tile_id', tile.id);
    
    const response = await fetch('../ai_proxy.php?endpoint=predict', {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error(`AI service error: ${response.status}`);
    }
    
    return await response.json();
}

/**
 * Aggregate and create BOTH boundary and heatmap visualizations
 */
async function aggregateAndCreateVisualizations() {
    console.log('📊 Creating smooth cell boundaries AND density heatmap overlays...');
    updateWSIProgress(95, 'Creating smooth dual visualization overlays...');
    
    const results = Array.from(WSIAnalyzer.tileResults.values());
    
    // Calculate stats and heatmap data
    let totalCells = 0, totalConfidence = 0, validTiles = 0;
    const heatmapData = [];
    
    results.forEach(({ tile, result }) => {
        if (result?.cell_count !== undefined) {
            totalCells += result.cell_count || 0;
            totalConfidence += result.seg_confidence || 0;
            validTiles++;
            
            heatmapData.push({
                tile: tile,
                cellCount: result.cell_count || 0,
                confidence: result.seg_confidence || 0,
                cellDensity: (result.cell_count || 0) / (tile.width * tile.height) * 1000000
            });
        }
    });
    
    WSIAnalyzer.aggregatedResults = {
        totalCells: totalCells,
        averageConfidence: validTiles > 0 ? totalConfidence / validTiles : 0,
        processedTiles: validTiles,
        totalTiles: WSIAnalyzer.totalTiles,
        skippedEmpty: WSIAnalyzer.skippedEmptyTiles,
        coverage: (validTiles / WSIAnalyzer.totalTiles) * 100
    };
    
    WSIAnalyzer.heatmapData = heatmapData;
    
    // Display results
    displayFinalResults();
    
    // Create BOTH visualizations
    if (WSIAnalyzer.showDensityHeatmap) {
        await createDensityHeatmapOverlays();
    }
    
    if (WSIAnalyzer.showBoundaries) {
        await createUnifiedBoundaryOverlay(); // DEFAULT to ultra-smooth mode
    }
}

/**
 * Create beautiful density heatmap overlays
 */
async function createDensityHeatmapOverlays() {
    console.log('🔥 Creating density heatmap overlays...');
    
    if (!WSIAnalyzer.heatmapData || WSIAnalyzer.heatmapData.length === 0) return;
    
    const viewer = WSIAnalyzer.viewer;
    const dziInfo = { width: 19920, height: 22356 };
    const imageBounds = viewer.world.getItemAt(0).getBounds();
    
    // Find density range for color normalization
    const maxDensity = Math.max(...WSIAnalyzer.heatmapData.map(d => d.cellDensity));
    const minDensity = Math.min(...WSIAnalyzer.heatmapData.filter(d => d.cellDensity > 0).map(d => d.cellDensity));
    
    console.log(`🎨 Creating heatmap for density range: ${minDensity.toFixed(1)} - ${maxDensity.toFixed(1)} cells/mm²`);
    
    let heatmapCount = 0;
    WSIAnalyzer.heatmapData.forEach(dataPoint => {
        if (dataPoint.cellCount > 0) {
            createHeatmapTileOverlay(dataPoint, minDensity, maxDensity, dziInfo, imageBounds, viewer);
            heatmapCount++;
        }
    });
    
    console.log(`✅ Created ${heatmapCount} density heatmap tiles`);
}

function createHeatmapTileOverlay(dataPoint, minDensity, maxDensity, dziInfo, imageBounds, viewer) {
    const tile = dataPoint.tile;
    
    // Normalize density for color mapping
    const normalizedDensity = maxDensity > minDensity ? 
        (dataPoint.cellDensity - minDensity) / (maxDensity - minDensity) : 0.5;
    
    // Beautiful color gradient (blue = low, red = high)
    const hue = (1 - normalizedDensity) * 240; // 240=blue, 0=red
    const saturation = 70 + (normalizedDensity * 30);
    const lightness = 50;
    const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    
    // Create heatmap overlay element
    const heatmapOverlay = document.createElement('div');
    heatmapOverlay.style.cssText = `
        background-color: ${color};
        opacity: ${WSIAnalyzer.heatmapOpacity};
        pointer-events: none;
        border: 1px solid rgba(255,255,255,0.3);
        box-sizing: border-box;
        display: ${WSIAnalyzer.showDensityHeatmap ? 'block' : 'none'};
    `;
    
    heatmapOverlay.title = `Density: ${dataPoint.cellDensity.toFixed(1)} cells/mm²`;
    
    // Convert to viewport coordinates
    const viewportX = imageBounds.x + (tile.x / dziInfo.width) * imageBounds.width;
    const viewportY = imageBounds.y + (tile.y / dziInfo.height) * imageBounds.height;
    const viewportWidth = (tile.width / dziInfo.width) * imageBounds.width;
    const viewportHeight = (tile.height / dziInfo.height) * imageBounds.height;
    
    viewer.addOverlay({
        element: heatmapOverlay,
        location: new OpenSeadragon.Rect(viewportX, viewportY, viewportWidth, viewportHeight),
        checkResize: false
    });
    
    WSIAnalyzer.heatmapOverlays.push(heatmapOverlay);
}

/**
 * FIXED: Create cell boundary overlays (fallback to original + smooth improvements)
 */
async function createSmoothCellBoundaryOverlays() {
    console.log('🎨 Creating cell boundary overlays with smooth improvements...');
    
    const viewer = WSIAnalyzer.viewer;
    const dziInfo = { width: 19920, height: 22356 };
    const imageBounds = viewer.world.getItemAt(0).getBounds();
    
    let totalBoundariesCreated = 0;
    
    for (const [tileId, tileData] of WSIAnalyzer.tileResults) {
        const { tile, result } = tileData;
        
        if (!result?.instance_map || !result?.cell_count || result.cell_count === 0) {
            console.log(`⚪ Skipping tile ${tileId} - no boundaries to create`);
            continue;
        }
        
        console.log(`🎨 Creating boundaries for tile ${tileId} with ${result.cell_count} cells`);
        
        // Use improved boundary creation with fallback
        const boundariesCreated = await createImprovedTileBoundaryOverlay(
            tile, result, dziInfo, imageBounds, viewer
        );
        totalBoundariesCreated += boundariesCreated;
    }
    
    console.log(`✅ Total boundaries created: ${totalBoundariesCreated}`);
    
    if (totalBoundariesCreated === 0) {
        console.warn('⚠️ No boundaries were created! Check if tiles have cell data.');
        updateWSIStatus('⚠️ No boundaries created - check tile data');
    }
}

function groupTilesByGrid() {
    const tileGrid = new Map();
    
    for (const [tileId, tileData] of WSIAnalyzer.tileResults) {
        const { tile } = tileData;
        const gridKey = `${tile.gridX}_${tile.gridY}`;
        tileGrid.set(gridKey, { tileId, tile, data: tileData });
    }
    
    return tileGrid;
}

function getNeighboringTiles(currentTile, tileGrid) {
    const neighbors = {};
    const { gridX, gridY } = currentTile;
    
    // Get 8 neighboring tiles
    const positions = [
        { key: 'top', x: gridX, y: gridY - 1 },
        { key: 'bottom', x: gridX, y: gridY + 1 },
        { key: 'left', x: gridX - 1, y: gridY },
        { key: 'right', x: gridX + 1, y: gridY },
        { key: 'topLeft', x: gridX - 1, y: gridY - 1 },
        { key: 'topRight', x: gridX + 1, y: gridY - 1 },
        { key: 'bottomLeft', x: gridX - 1, y: gridY + 1 },
        { key: 'bottomRight', x: gridX + 1, y: gridY + 1 }
    ];
    
    positions.forEach(pos => {
        const neighborKey = `${pos.x}_${pos.y}`;
        const neighbor = tileGrid.get(neighborKey);
        if (neighbor) {
            neighbors[pos.key] = neighbor;
        }
    });
    
    return neighbors;
}

/**
 * MINIMAL FIXES for overlap boundary issues
 * Replace these functions in your existing code
 */

// FIXED: Better boundary detection with precise overlap exclusion
function findBoundariesJS(map2D, tile, globalTileMap = null) {
    const height = map2D.length;
    const width = map2D[0].length;
    const boundaries = [];
    const overlapSize = Math.floor(WSIAnalyzer.tileSize * WSIAnalyzer.overlapRatio);
    
    // Initialize boundary array
    for (let y = 0; y < height; y++) {
        boundaries[y] = new Array(width).fill(false);
    }
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const currentCell = map2D[y][x];
            if (currentCell === 0) continue;
            
            // Check if this pixel should be drawn by this tile
            if (!shouldThisTileDrawPixel(x, y, width, height, tile, overlapSize)) {
                continue; // Skip - let another tile handle this pixel
            }
            
            // Normal boundary detection
            const neighbors = [
                map2D[y-1][x-1], map2D[y-1][x], map2D[y-1][x+1],
                map2D[y][x-1],                   map2D[y][x+1],
                map2D[y+1][x-1], map2D[y+1][x], map2D[y+1][x+1]
            ];
            
            const isBoundary = neighbors.some(neighbor => neighbor !== currentCell);
            boundaries[y][x] = isBoundary;
        }
    }
    
    return boundaries;
}

// FIXED: Clear priority system for pixel ownership
function shouldThisTileDrawPixel(x, y, width, height, tile, overlapSize) {
    // Calculate distances from edges
    const distFromLeft = x;
    const distFromRight = width - 1 - x;
    const distFromTop = y;
    const distFromBottom = height - 1 - y;
    
    // If not in overlap region, always draw
    if (distFromLeft >= overlapSize && distFromRight >= overlapSize && 
        distFromTop >= overlapSize && distFromBottom >= overlapSize) {
        return true;
    }
    
    // FIXED: More inclusive overlap handling to prevent gaps
    
    // For RIGHT edge overlap: Only skip if we're very close to the right edge
    if (distFromRight < Math.floor(overlapSize * 0.3)) {
        return false; // Let right neighbor handle the very edge
    }
    
    // For BOTTOM edge overlap: Only skip if we're very close to the bottom edge  
    if (distFromBottom < Math.floor(overlapSize * 0.3)) {
        return false; // Let bottom neighbor handle the very edge
    }
    
    // For CORNER overlaps: More nuanced handling
    if (distFromRight < overlapSize && distFromBottom < overlapSize) {
        // In bottom-right corner overlap
        const cornerThreshold = Math.floor(overlapSize * 0.5);
        if (distFromRight < cornerThreshold && distFromBottom < cornerThreshold) {
            return false; // Let corner neighbor handle
        }
    }
    
    // For all other cases in overlap regions, this tile draws the pixel
    return true;
}

// FIXED: Update the tile boundary creation to use improved detection

async function createImprovedTileBoundaryOverlay(tile, result, dziInfo, imageBounds, viewer) {
    if (!result.instance_map) {
        console.warn(`❌ No instance map for tile ${tile.id}`);
        return 0;
    }
    
    const aiWidth = result.input_size[0];
    const aiHeight = result.input_size[1];
    
    console.log(`🔍 Processing tile ${tile.id}: ${aiWidth}x${aiHeight}, ${result.cell_count} cells`);
    
    // Convert instance map to 2D array
    let map2D;
    if (Array.isArray(result.instance_map[0])) {
        map2D = result.instance_map;
    } else {
        map2D = [];
        for (let y = 0; y < aiHeight; y++) {
            map2D[y] = result.instance_map.slice(y * aiWidth, (y + 1) * aiWidth);
        }
    }
    
    // FIXED: Use improved boundary detection with gap filling
    let boundaries = findBoundariesJS(map2D, tile);
    
    // ADD: Fill any remaining gaps
    boundaries = fillBoundaryGaps(boundaries, aiWidth, aiHeight);
    
    // Create canvas for boundary visualization
    const canvas = document.createElement('canvas');
    canvas.width = aiWidth;
    canvas.height = aiHeight;
    const ctx = canvas.getContext('2d');
    
    // Enable maximum anti-aliasing for smoothness
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    const imageData = ctx.createImageData(aiWidth, aiHeight);
    const data = imageData.data;
    
    // Convert boundary color to RGB
    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 0, b: 0 };
    };
    
    const rgbColor = hexToRgb(WSIAnalyzer.boundaryColor);
    
    // FIXED: Create boundary pixels with gap prevention
    let boundaryCount = 0;
    
    for (let y = 0; y < aiHeight; y++) {
        for (let x = 0; x < aiWidth; x++) {
            const idx = (y * aiWidth + x) * 4;
            if (boundaries[y] && boundaries[y][x]) {
                data[idx] = rgbColor.r;
                data[idx + 1] = rgbColor.g;
                data[idx + 2] = rgbColor.b;
                data[idx + 3] = 255; // Full opacity
                boundaryCount++;
            } else {
                data[idx + 3] = 0; // Transparent
            }
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    console.log(`✅ Created ${boundaryCount} gap-free boundary pixels for tile ${tile.id}`);
    
    // Create boundary overlay element with improved CSS
    const boundaryOverlay = document.createElement('div');
    boundaryOverlay.style.cssText = `
        position: relative;
        width: 100%;
        height: 100%;
        pointer-events: none;
        opacity: ${WSIAnalyzer.boundaryOpacity};
        display: ${WSIAnalyzer.showBoundaries ? 'block' : 'none'};
        background-image: url(${canvas.toDataURL()});
        background-size: 100% 100%;
        background-repeat: no-repeat;
        image-rendering: -webkit-optimize-contrast;
        image-rendering: crisp-edges;
        image-rendering: pixelated;
    `;
    
    // Add cell count label
    const cellLabel = document.createElement('div');
    cellLabel.style.cssText = `
        position: absolute;
        top: 5px;
        left: 5px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: bold;
    `;
    cellLabel.textContent = `${result.cell_count} cells`;
    boundaryOverlay.appendChild(cellLabel);
    
    // Convert to viewport coordinates
    const viewportX = imageBounds.x + (tile.x / dziInfo.width) * imageBounds.width;
    const viewportY = imageBounds.y + (tile.y / dziInfo.height) * imageBounds.height;
    const viewportWidth = (tile.width / dziInfo.width) * imageBounds.width;
    const viewportHeight = (tile.height / dziInfo.height) * imageBounds.height;
    
    console.log(`📍 Adding gap-free overlay at viewport: (${viewportX.toFixed(3)}, ${viewportY.toFixed(3)}) size: ${viewportWidth.toFixed(3)}x${viewportHeight.toFixed(3)}`);
    
    viewer.addOverlay({
        element: boundaryOverlay,
        location: new OpenSeadragon.Rect(viewportX, viewportY, viewportWidth, viewportHeight),
        checkResize: false,
        rotationMode: OpenSeadragon.OverlayRotationMode.NO_ROTATION
    });
    
    WSIAnalyzer.boundaryOverlays.push(boundaryOverlay);
    return boundaryCount;
}
/**
 * OPTIONAL: Enhanced unified boundary creation with better gap handling
 */
async function createUnifiedBoundaryOverlayGapFree() {
    console.log('🎨 Creating ultra-smooth gap-free unified boundary overlay...');
    
    const viewer = WSIAnalyzer.viewer;
    const dziInfo = { width: 19920, height: 22356 };
    const imageBounds = viewer.world.getItemAt(0).getBounds();
    
    // Create a single large canvas for the entire analyzed area
    const { minX, minY, maxX, maxY } = calculateAnalyzedBounds();
    const unifiedWidth = maxX - minX;
    const unifiedHeight = maxY - minY;
    
    // Use higher resolution for better quality
    const scaleFactor = Math.min(4096 / unifiedWidth, 4096 / unifiedHeight, 1);
    const canvasWidth = Math.floor(unifiedWidth * scaleFactor);
    const canvasHeight = Math.floor(unifiedHeight * scaleFactor);
    
    console.log(`📐 Gap-free unified canvas: ${canvasWidth}x${canvasHeight} (scale: ${scaleFactor.toFixed(3)})`);
    
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    
    // Enhanced rendering settings
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Clear with transparent background
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Create a 2D array to track coverage and prevent gaps
    const globalCoverageMap = Array(canvasHeight).fill(null).map(() => Array(canvasWidth).fill(false));
    
    // Process tiles in priority order (top-left to bottom-right)
    const sortedTiles = Array.from(WSIAnalyzer.tileResults.entries())
        .sort(([, a], [, b]) => {
            if (a.tile.gridY !== b.tile.gridY) {
                return a.tile.gridY - b.tile.gridY;
            }
            return a.tile.gridX - b.tile.gridX;
        });
    
    for (const [tileId, tileData] of sortedTiles) {
        const { tile, result } = tileData;
        
        if (!result?.instance_map || !result?.cell_count || result.cell_count === 0) continue;
        
        await collectTileBoundariesGapFree(tile, result, globalCoverageMap, minX, minY, scaleFactor, ctx);
    }
    
    // Final gap-filling pass
    fillGlobalBoundaryGaps(globalCoverageMap, ctx, canvasWidth, canvasHeight);
    
    // Create single overlay
    const unifiedOverlay = document.createElement('div');
    unifiedOverlay.style.cssText = `
        position: relative;
        width: 100%;
        height: 100%;
        pointer-events: none;
        opacity: ${WSIAnalyzer.boundaryOpacity};
        display: ${WSIAnalyzer.showBoundaries ? 'block' : 'none'};
        background-image: url(${canvas.toDataURL()});
        background-size: 100% 100%;
        background-repeat: no-repeat;
        image-rendering: -webkit-optimize-contrast;
    `;
    
    // Add to viewer
    const viewportX = imageBounds.x + (minX / dziInfo.width) * imageBounds.width;
    const viewportY = imageBounds.y + (minY / dziInfo.height) * imageBounds.height;
    const viewportWidth = (unifiedWidth / dziInfo.width) * imageBounds.width;
    const viewportHeight = (unifiedHeight / dziInfo.height) * imageBounds.height;
    
    viewer.addOverlay({
        element: unifiedOverlay,
        location: new OpenSeadragon.Rect(viewportX, viewportY, viewportWidth, viewportHeight),
        checkResize: false
    });
    
    // Clear individual overlays and use unified one
    clearBoundaryOverlays();
    WSIAnalyzer.boundaryOverlays = [unifiedOverlay];
    
    console.log(`✅ Ultra-smooth gap-free unified boundary overlay created!`);
}

async function collectTileBoundariesGapFree(tile, result, globalCoverageMap, offsetX, offsetY, scaleFactor, ctx) {
    const aiWidth = result.input_size[0];
    const aiHeight = result.input_size[1];
    
    // Convert instance map and find boundaries with gap filling
    const map2D = convertInstanceMapTo2D(result.instance_map, aiWidth, aiHeight);
    let boundaries = findBoundariesJS(map2D, tile);
    boundaries = fillBoundaryGaps(boundaries, aiWidth, aiHeight);
    
    // Calculate position in global space
    const globalX = Math.floor((tile.x - offsetX) * scaleFactor);
    const globalY = Math.floor((tile.y - offsetY) * scaleFactor);
    const scaleX = (tile.width * scaleFactor) / aiWidth;
    const scaleY = (tile.height * scaleFactor) / aiHeight;
    
    // Draw boundaries directly to context and mark coverage
    ctx.fillStyle = WSIAnalyzer.boundaryColor;
    
    for (let y = 0; y < aiHeight; y++) {
        for (let x = 0; x < aiWidth; x++) {
            if (boundaries[y] && boundaries[y][x]) {
                const globalPixelX = Math.floor(globalX + x * scaleX);
                const globalPixelY = Math.floor(globalY + y * scaleY);
                
                if (globalPixelX >= 0 && globalPixelX < globalCoverageMap[0].length && 
                    globalPixelY >= 0 && globalPixelY < globalCoverageMap.length) {
                    
                    if (!globalCoverageMap[globalPixelY][globalPixelX]) {
                        ctx.fillRect(globalPixelX, globalPixelY, 1, 1);
                        globalCoverageMap[globalPixelY][globalPixelX] = true;
                    }
                }
            }
        }
    }
}

function fillGlobalBoundaryGaps(coverageMap, ctx, width, height) {
    ctx.fillStyle = WSIAnalyzer.boundaryColor;
    let gapsFilled = 0;
    
    // Fill isolated gaps
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            if (!coverageMap[y][x]) {
                const neighbors = [
                    coverageMap[y-1][x-1], coverageMap[y-1][x], coverageMap[y-1][x+1],
                    coverageMap[y][x-1],                        coverageMap[y][x+1],
                    coverageMap[y+1][x-1], coverageMap[y+1][x], coverageMap[y+1][x+1]
                ].filter(Boolean).length;
                
                if (neighbors >= 4) {
                    ctx.fillRect(x, y, 1, 1);
                    coverageMap[y][x] = true;
                    gapsFilled++;
                }
            }
        }
    }
    
    console.log(`🔧 Filled ${gapsFilled} boundary gaps in unified overlay`);
}

function convertInstanceMapTo2D(instanceMap, width, height) {
    if (Array.isArray(instanceMap[0])) {
        return instanceMap;
    }
    
    const map2D = [];
    for (let y = 0; y < height; y++) {
        map2D[y] = instanceMap.slice(y * width, (y + 1) * width);
    }
    return map2D;
}

function findSeamlessBoundariesJS(map2D, currentTile, neighbors, width, height) {
    const boundaries = [];
    const overlapSize = Math.floor(WSIAnalyzer.tileSize * WSIAnalyzer.overlapRatio);
    
    // Initialize boundary array
    for (let y = 0; y < height; y++) {
        boundaries[y] = new Array(width).fill(false);
    }
    
    let boundaryCount = 0;
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const currentCell = map2D[y][x];
            if (currentCell === 0) continue;
            
            // Check if we're in an overlap region
            const isInOverlap = isPixelInOverlapRegion(x, y, width, height, overlapSize);
            
            if (isInOverlap) {
                // In overlap regions, only draw boundaries for dominant cells
                // or use fade-out approach to prevent double-drawing
                const shouldDrawBoundary = shouldDrawBoundaryInOverlap(
                    x, y, currentCell, map2D, currentTile, neighbors, width, height
                );
                
                if (shouldDrawBoundary) {
                    boundaries[y][x] = true;
                    boundaryCount++;
                }
            } else {
                // Normal boundary detection for non-overlap areas
                const neighbors8 = [
                    map2D[y-1][x-1], map2D[y-1][x], map2D[y-1][x+1],
                    map2D[y][x-1],                   map2D[y][x+1],
                    map2D[y+1][x-1], map2D[y+1][x], map2D[y+1][x+1]
                ];
                
                const isBoundary = neighbors8.some(neighbor => neighbor !== currentCell);
                if (isBoundary) {
                    boundaries[y][x] = true;
                    boundaryCount++;
                }
            }
        }
    }
    
    return { boundaries, boundaryCount };
}

function isPixelInOverlapRegion(x, y, width, height, overlapSize) {
    // Check if pixel is within overlap margins
    const nearLeft = x < overlapSize;
    const nearRight = x >= width - overlapSize;
    const nearTop = y < overlapSize;
    const nearBottom = y >= height - overlapSize;
    
    return nearLeft || nearRight || nearTop || nearBottom;
}

function shouldDrawBoundaryInOverlap(x, y, currentCell, map2D, currentTile, neighbors, width, height) {
    // Strategy: Priority-based drawing to prevent double-drawing in overlap regions
    // Higher grid coordinates take priority to handle boundary drawing
    
    const overlapSize = Math.floor(WSIAnalyzer.tileSize * WSIAnalyzer.overlapRatio);
    
    // Determine which overlap region we're in
    const nearLeft = x < overlapSize;
    const nearRight = x >= width - overlapSize;
    const nearTop = y < overlapSize;
    const nearBottom = y >= height - overlapSize;
    
    // Apply priority rules to avoid double-drawing
    if (nearRight && neighbors.right) {
        // Right edge: let the right neighbor handle it
        return false;
    }
    
    if (nearBottom && neighbors.bottom) {
        // Bottom edge: let the bottom neighbor handle it
        return false;
    }
    
    if (nearRight && nearBottom && neighbors.bottomRight) {
        // Bottom-right corner: let the bottom-right neighbor handle it
        return false;
    }
    
    // For left, top, and other edges, this tile handles the boundary
    return true;
}

function renderSmoothBoundaries(ctx, boundaries, width, height) {
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    // Convert boundary color to RGB
    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 0, b: 0 };
    };
    
    const rgbColor = hexToRgb(WSIAnalyzer.boundaryColor);
    const overlapSize = Math.floor(WSIAnalyzer.tileSize * WSIAnalyzer.overlapRatio);
    
    // Render boundaries with edge fading
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            
            if (boundaries.boundaries[y] && boundaries.boundaries[y][x]) {
                // Calculate fade factor based on distance from tile edges
                const fadeFactor = calculateEdgeFade(x, y, width, height, overlapSize);
                
                data[idx] = rgbColor.r;
                data[idx + 1] = rgbColor.g;
                data[idx + 2] = rgbColor.b;
                data[idx + 3] = Math.round(255 * fadeFactor); // Apply fade
            } else {
                data[idx + 3] = 0; // Transparent
            }
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
}

function calculateEdgeFade(x, y, width, height, overlapSize) {
    // Calculate distance from edges
    const distFromLeft = x;
    const distFromRight = width - 1 - x;
    const distFromTop = y;
    const distFromBottom = height - 1 - y;
    
    // Find minimum distance to any edge
    const minDistToEdge = Math.min(distFromLeft, distFromRight, distFromTop, distFromBottom);
    
    // If we're not in overlap region, full opacity
    if (minDistToEdge >= overlapSize) {
        return 1.0;
    }
    
    // In overlap region, fade out towards edges
    const fadeDistance = Math.min(overlapSize, 20); // Max fade distance
    const fadeFactor = Math.min(minDistToEdge / fadeDistance, 1.0);
    
    // Ensure minimum opacity for visibility
    return Math.max(fadeFactor, 0.3);
}

function createFadeEdgeOverlay(canvas, cellCount, tile) {
    const boundaryOverlay = document.createElement('div');
    
    boundaryOverlay.style.cssText = `
        position: relative;
        width: 100%;
        height: 100%;
        pointer-events: none;
        opacity: ${WSIAnalyzer.boundaryOpacity};
        display: ${WSIAnalyzer.showBoundaries ? 'block' : 'none'};
        background-image: url(${canvas.toDataURL()});
        background-size: 100% 100%;
        background-repeat: no-repeat;
        image-rendering: -webkit-optimize-contrast;
        image-rendering: crisp-edges;
    `;
    
    // Add subtle cell count label with fade
    const cellLabel = document.createElement('div');
    cellLabel.style.cssText = `
        position: absolute;
        top: 5px;
        left: 5px;
        background: rgba(0, 0, 0, 0.6);
        color: white;
        padding: 1px 4px;
        border-radius: 2px;
        font-size: 9px;
        font-weight: bold;
        opacity: 0.8;
        transition: opacity 0.3s ease;
    `;
    cellLabel.textContent = `${cellCount}`;
    
    // Hide label on zoom out to reduce clutter
    const hideLabelsOnZoom = () => {
        const zoom = WSIAnalyzer.viewer.viewport.getZoom();
        cellLabel.style.opacity = zoom > 1 ? '0.8' : '0';
    };
    
    if (WSIAnalyzer.viewer) {
        WSIAnalyzer.viewer.addHandler('zoom', hideLabelsOnZoom);
    }
    
    boundaryOverlay.appendChild(cellLabel);
    return boundaryOverlay;
}

function addOverlayToViewer(boundaryOverlay, tile, dziInfo, imageBounds, viewer) {
    // Convert to viewport coordinates
    const viewportX = imageBounds.x + (tile.x / dziInfo.width) * imageBounds.width;
    const viewportY = imageBounds.y + (tile.y / dziInfo.height) * imageBounds.height;
    const viewportWidth = (tile.width / dziInfo.width) * imageBounds.width;
    const viewportHeight = (tile.height / dziInfo.height) * imageBounds.height;
    
    viewer.addOverlay({
        element: boundaryOverlay,
        location: new OpenSeadragon.Rect(viewportX, viewportY, viewportWidth, viewportHeight),
        checkResize: false,
        rotationMode: OpenSeadragon.OverlayRotationMode.NO_ROTATION
    });
}

/**
 * IMPROVED: Unified Boundary Overlay - Ultra smooth with better edge handling
 */
// FIXED: Updated unified boundary creation with better deduplication
/**
 * FIXED: Create unified boundary overlay with adaptive canvas sizing to prevent blur
 */
async function createUnifiedBoundaryOverlay() {
    console.log('🎨 Creating ultra-smooth unified boundary overlay...');
    
    const viewer = WSIAnalyzer.viewer;
    const dziInfo = { width: 19920, height: 22356 };
    const imageBounds = viewer.world.getItemAt(0).getBounds();
    
    // Create a single large canvas for the entire analyzed area
    const { minX, minY, maxX, maxY } = calculateAnalyzedBounds();
    const unifiedWidth = maxX - minX;
    const unifiedHeight = maxY - minY;
    
    // FIXED: Better scaling to maintain crispness - use higher resolution for large areas
    const maxDimension = Math.max(unifiedWidth, unifiedHeight);
    const minCanvasSize = 2048; // Minimum for small regions
    const maxCanvasSize = 8192; // Increased maximum for large regions
    
    // Scale factor calculation - maintain higher resolution for large areas
    let scaleFactor;
    if (maxDimension <= minCanvasSize) {
        scaleFactor = 1; // No scaling for small regions
    } else if (maxDimension <= maxCanvasSize) {
        scaleFactor = maxCanvasSize / maxDimension; // Scale to fit within max
    } else {
        // For very large regions, use chunked approach or maintain minimum quality
        scaleFactor = Math.max(0.5, maxCanvasSize / maxDimension); // Don't go below 0.5x
    }
    
    const canvasWidth = Math.floor(unifiedWidth * scaleFactor);
    const canvasHeight = Math.floor(unifiedHeight * scaleFactor);
    
    console.log(`📐 Unified canvas: ${canvasWidth}x${canvasHeight} (scale: ${scaleFactor.toFixed(3)}, original: ${unifiedWidth}x${unifiedHeight})`);
    
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    
    // Enhanced rendering settings for crisp boundaries
    ctx.imageSmoothingEnabled = false; // FIXED: Disable smoothing to maintain crisp pixels
    ctx.webkitImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
    
    // Clear with transparent background
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // FIXED: Create a precise global coordinate system
    const globalPixelMap = new Set(); // Use Set for faster lookup
    
    // Process tiles in priority order (top-left to bottom-right)
    const sortedTiles = Array.from(WSIAnalyzer.tileResults.entries())
        .sort(([, a], [, b]) => {
            // Sort by gridY first, then gridX (top-left priority)
            if (a.tile.gridY !== b.tile.gridY) {
                return a.tile.gridY - b.tile.gridY;
            }
            return a.tile.gridX - b.tile.gridX;
        });
    
    for (const [tileId, tileData] of sortedTiles) {
        const { tile, result } = tileData;
        
        if (!result?.instance_map || !result?.cell_count || result.cell_count === 0) continue;
        
        await collectTileBoundariesForUnifiedFixed(tile, result, globalPixelMap, minX, minY, scaleFactor);
    }
    
    // Render all unique boundaries
    renderGlobalBoundariesOnCanvasFixed(ctx, globalPixelMap, canvasWidth, canvasHeight);
    
    // Create single overlay with crisp rendering CSS
    const unifiedOverlay = document.createElement('div');
    unifiedOverlay.style.cssText = `
        position: relative;
        width: 100%;
        height: 100%;
        pointer-events: none;
        opacity: ${WSIAnalyzer.boundaryOpacity};
        display: ${WSIAnalyzer.showBoundaries ? 'block' : 'none'};
        background-image: url(${canvas.toDataURL()});
        background-size: 100% 100%;
        background-repeat: no-repeat;
        image-rendering: -webkit-optimize-contrast;
        image-rendering: -moz-crisp-edges;
        image-rendering: pixelated;
    `;
    
    // Add to viewer
    const viewportX = imageBounds.x + (minX / dziInfo.width) * imageBounds.width;
    const viewportY = imageBounds.y + (minY / dziInfo.height) * imageBounds.height;
    const viewportWidth = (unifiedWidth / dziInfo.width) * imageBounds.width;
    const viewportHeight = (unifiedHeight / dziInfo.height) * imageBounds.height;
    
    viewer.addOverlay({
        element: unifiedOverlay,
        location: new OpenSeadragon.Rect(viewportX, viewportY, viewportWidth, viewportHeight),
        checkResize: false
    });
    
    // Clear individual overlays and use unified one
    clearBoundaryOverlays();
    WSIAnalyzer.boundaryOverlays = [unifiedOverlay];
    
    console.log(`✅ Ultra-smooth unified boundary overlay created - ${globalPixelMap.size} unique pixels, scale: ${scaleFactor.toFixed(3)}!`);
}

// FIXED: Efficient rendering from Set
function renderGlobalBoundariesOnCanvasFixed(ctx, globalPixelMap, canvasWidth, canvasHeight) {
    const imageData = ctx.createImageData(canvasWidth, canvasHeight);
    const data = imageData.data;
    
    // Red boundaries
    const boundaryColor = { r: 255, g: 0, b: 0 };
    
    // Convert Set back to coordinates and render
    for (const pixelKey of globalPixelMap) {
        const [x, y] = pixelKey.split(',').map(Number);
        
        if (x >= 0 && x < canvasWidth && y >= 0 && y < canvasHeight) {
            const idx = (y * canvasWidth + x) * 4;
            data[idx] = boundaryColor.r;
            data[idx + 1] = boundaryColor.g;
            data[idx + 2] = boundaryColor.b;
            data[idx + 3] = 255; // Full opacity
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    console.log(`✅ Rendered ${globalPixelMap.size} unique boundary pixels`);
}

// FIXED: Better global coordinate collection
async function collectTileBoundariesForUnifiedFixed(tile, result, globalPixelMap, offsetX, offsetY, scaleFactor) {
    const aiWidth = result.input_size[0];
    const aiHeight = result.input_size[1];
    
    // Convert instance map and find boundaries with tile priority
    const map2D = convertInstanceMapTo2D(result.instance_map, aiWidth, aiHeight);
    const boundaries = findBoundariesJS(map2D, tile); // Pass tile for priority
    
    // Calculate position in global space
    const globalX = Math.floor((tile.x - offsetX) * scaleFactor);
    const globalY = Math.floor((tile.y - offsetY) * scaleFactor);
    const scaleX = (tile.width * scaleFactor) / aiWidth;
    const scaleY = (tile.height * scaleFactor) / aiHeight;
    
    // Add boundaries to global set with precise coordinates
    for (let y = 0; y < aiHeight; y++) {
        for (let x = 0; x < aiWidth; x++) {
            if (boundaries[y] && boundaries[y][x]) {
                const globalPixelX = Math.floor(globalX + x * scaleX);
                const globalPixelY = Math.floor(globalY + y * scaleY);
                
                // Use string key for Set (faster than object comparison)
                const pixelKey = `${globalPixelX},${globalPixelY}`;
                globalPixelMap.add(pixelKey);
            }
        }
    }
}

function calculateAnalyzedBounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const [tileId, tileData] of WSIAnalyzer.tileResults) {
        const { tile } = tileData;
        minX = Math.min(minX, tile.x);
        minY = Math.min(minY, tile.y);
        maxX = Math.max(maxX, tile.x + tile.width);
        maxY = Math.max(maxY, tile.y + tile.height);
    }
    
    return { minX, minY, maxX, maxY };
}

async function collectTileBoundariesForUnified(tile, result, globalBoundaryMap, offsetX, offsetY, scaleFactor) {
    const aiWidth = result.input_size[0];
    const aiHeight = result.input_size[1];
    
    // Convert instance map and find boundaries
    const map2D = convertInstanceMapTo2D(result.instance_map, aiWidth, aiHeight);
    const boundaries = findBoundariesJS(map2D);
    
    // Calculate position in global space
    const globalX = Math.floor((tile.x - offsetX) * scaleFactor);
    const globalY = Math.floor((tile.y - offsetY) * scaleFactor);
    const scaleX = (tile.width * scaleFactor) / aiWidth;
    const scaleY = (tile.height * scaleFactor) / aiHeight;
    
    // Add boundaries to global map with deduplication
    for (let y = 0; y < aiHeight; y++) {
        for (let x = 0; x < aiWidth; x++) {
            if (boundaries[y] && boundaries[y][x]) {
                const globalPixelX = Math.floor(globalX + x * scaleX);
                const globalPixelY = Math.floor(globalY + y * scaleY);
                const key = `${globalPixelX},${globalPixelY}`;
                
                // Only add if not already present (prevents overlaps)
                if (!globalBoundaryMap.has(key)) {
                    globalBoundaryMap.set(key, { x: globalPixelX, y: globalPixelY });
                }
            }
        }
    }
}

function renderGlobalBoundariesOnCanvas(ctx, globalBoundaryMap, canvasWidth, canvasHeight) {
    const imageData = ctx.createImageData(canvasWidth, canvasHeight);
    const data = imageData.data;
    
    // Red boundaries
    const boundaryColor = { r: 255, g: 0, b: 0 };
    
    // Render each unique boundary pixel
    for (const [key, pixel] of globalBoundaryMap) {
        const { x, y } = pixel;
        
        if (x >= 0 && x < canvasWidth && y >= 0 && y < canvasHeight) {
            const idx = (y * canvasWidth + x) * 4;
            data[idx] = boundaryColor.r;
            data[idx + 1] = boundaryColor.g;
            data[idx + 2] = boundaryColor.b;
            data[idx + 3] = 255; // Full opacity
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    console.log(`✅ Rendered ${globalBoundaryMap.size} unique boundary pixels`);
}

// Keep original boundary detection for unified overlay
/**
 * REPLACE the findBoundariesJS function with this gap-free version
 */
function findBoundariesJS(map2D, tile, globalTileMap = null) {
    const height = map2D.length;
    const width = map2D[0].length;
    const boundaries = [];
    const overlapSize = Math.floor(WSIAnalyzer.tileSize * WSIAnalyzer.overlapRatio);
    
    // Initialize boundary array
    for (let y = 0; y < height; y++) {
        boundaries[y] = new Array(width).fill(false);
    }
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const currentCell = map2D[y][x];
            if (currentCell === 0) continue;
            
            // FIXED: More permissive pixel drawing to eliminate gaps
            if (!shouldThisTileDrawPixel(x, y, width, height, tile, overlapSize)) {
                continue;
            }
            
            // Enhanced boundary detection with gap filling
            const neighbors = [
                map2D[y-1][x-1], map2D[y-1][x], map2D[y-1][x+1],
                map2D[y][x-1],                   map2D[y][x+1],
                map2D[y+1][x-1], map2D[y+1][x], map2D[y+1][x+1]
            ];
            
            const isBoundary = neighbors.some(neighbor => neighbor !== currentCell);
            
            // ADDITIONAL: Fill potential gaps by being more inclusive near edges
            let shouldFillGap = false;
            if (!isBoundary) {
                // Check if we're near an overlap edge and should fill a potential gap
                const nearRightEdge = (width - x) <= overlapSize;
                const nearBottomEdge = (height - y) <= overlapSize;
                
                if (nearRightEdge || nearBottomEdge) {
                    // Look for any zero neighbors (background) near edges
                    shouldFillGap = neighbors.some(neighbor => neighbor === 0);
                }
            }
            
            boundaries[y][x] = isBoundary || shouldFillGap;
        }
    }
    
    return boundaries;
}
/**
 * ADD this new gap-filling post-processing function
 */
function fillBoundaryGaps(boundaries, width, height) {
    const filled = boundaries.map(row => [...row]); // Deep copy
    
    // Fill single-pixel gaps (isolated missing pixels)
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            if (!filled[y][x]) {
                // Count boundary neighbors
                const boundaryNeighbors = [
                    filled[y-1][x-1], filled[y-1][x], filled[y-1][x+1],
                    filled[y][x-1],                   filled[y][x+1],
                    filled[y+1][x-1], filled[y+1][x], filled[y+1][x+1]
                ].filter(Boolean).length;
                
                // If surrounded by boundaries, fill the gap
                if (boundaryNeighbors >= 5) {
                    filled[y][x] = true;
                }
            }
        }
    }
    
    return filled;
}
// FIXED: Clear priority system for pixel ownership
function shouldThisTileDrawPixel(x, y, width, height, tile, overlapSize) {
    // Calculate distances from edges
    const distFromLeft = x;
    const distFromRight = width - 1 - x;
    const distFromTop = y;
    const distFromBottom = height - 1 - y;
    
    // If not in overlap region, always draw
    if (distFromLeft >= overlapSize && distFromRight >= overlapSize && 
        distFromTop >= overlapSize && distFromBottom >= overlapSize) {
        return true;
    }
    
    // In overlap regions: only tiles with higher priority draw
    // Priority order: top-left has highest priority
    
    // Right edge overlap - only draw if no tile to the right
    if (distFromRight < overlapSize) {
        return false; // Right neighbor will handle
    }
    
    // Bottom edge overlap - only draw if no tile below
    if (distFromBottom < overlapSize) {
        return false; // Bottom neighbor will handle
    }
    
    // Left and top edges - this tile handles
    return true;
}

function displayFinalResults() {
    if (!WSI_DOM.resultsContainer || !WSIAnalyzer.aggregatedResults) return;
    
    const results = WSIAnalyzer.aggregatedResults;
    
    WSI_DOM.resultsContainer.innerHTML = `
        <div class="wsi-results-summary">
            <h4><i class="fas fa-chart-bar"></i> CENTER TEST - Smooth Boundary Results</h4>
            
            <div class="wsi-metrics-grid">
                <div class="wsi-metric-card">
                    <div class="metric-value">${results.totalCells.toLocaleString()}</div>
                    <div class="metric-label">Total Cells</div>
                </div>
                <div class="wsi-metric-card">
                    <div class="metric-value">${(results.averageConfidence * 100).toFixed(1)}%</div>
                    <div class="metric-label">Avg Confidence</div>
                </div>
                <div class="wsi-metric-card">
                    <div class="metric-value">${results.processedTiles}</div>
                    <div class="metric-label">Analyzed</div>
                </div>
                <div class="wsi-metric-card">
                    <div class="metric-value">${results.skippedEmpty}</div>
                    <div class="metric-label">Empty Skipped</div>
                </div>
            </div>
            
            <div class="optimization-stats">
                <h5><i class="fas fa-tachometer-alt"></i> Performance Stats</h5>
                <p><strong>Processing:</strong> ${WSIAnalyzer.batchSize} tiles simultaneously</p>
                <p><strong>Efficiency:</strong> ${results.skippedEmpty} empty tiles skipped</p>
                <p><strong>Coverage:</strong> ${results.coverage.toFixed(1)}% of slide analyzed</p>
                <p><strong>Visualization:</strong> Smooth density heatmap + seamless cell boundaries</p>
            </div>
            
            <div class="wsi-dual-controls">
                <h5><i class="fas fa-palette"></i> Smooth Visualization Controls</h5>
                
                <!-- Density Heatmap Controls -->
                <div class="viz-section">
                    <h6><i class="fas fa-fire"></i> Density Heatmap</h6>
                    <div class="control-row">
                        <label>
                            <input type="checkbox" id="showDensityHeatmap" ${WSIAnalyzer.showDensityHeatmap ? 'checked' : ''} 
                                   onchange="toggleDensityHeatmap(this.checked)">
                            Show Cell Density Heatmap
                        </label>
                    </div>
                    <div class="control-row">
                        <label>Heatmap Opacity:</label>
                        <input type="range" id="heatmapOpacity" min="0.1" max="1" step="0.1" value="${WSIAnalyzer.heatmapOpacity}" 
                               oninput="updateHeatmapOpacity(this.value)">
                        <span id="heatmapOpacityDisplay">${Math.round(WSIAnalyzer.heatmapOpacity * 100)}%</span>
                    </div>
                </div>
                
                <!-- Cell Boundary Controls -->
                <div class="viz-section">
                    <h6><i class="fas fa-vector-square"></i> Ultra-Smooth Cell Boundaries</h6>
                    <div class="control-row">
                        <label>
                            <input type="checkbox" id="showBoundaries" ${WSIAnalyzer.showBoundaries ? 'checked' : ''} 
                                   onchange="toggleBoundaries(this.checked)">
                            Show Ultra-Smooth Cell Boundaries
                        </label>
                    </div>
                    <div class="control-row">
                        <label>Boundary Opacity:</label>
                        <input type="range" id="boundaryOpacity" min="0.1" max="1" step="0.1" value="${WSIAnalyzer.boundaryOpacity}" 
                               oninput="updateBoundaryOpacity(this.value)">
                        <span id="boundaryOpacityDisplay">${Math.round(WSIAnalyzer.boundaryOpacity * 100)}%</span>
                    </div>
                </div>
            </div>
            
            <div class="wsi-actions">
                <button class="action-btn primary" onclick="refreshAllOverlays()">
                    <i class="fas fa-sync"></i> Refresh All Overlays
                </button>
                <button class="action-btn secondary" onclick="exportWSIResults()">
                    <i class="fas fa-download"></i> Export Results
                </button>
                <button class="action-btn secondary" onclick="clearAllWSIOverlays()">
                    <i class="fas fa-eye-slash"></i> Clear All Overlays
                </button>
            </div>
        </div>
    `;
}

/**
 * Dual Visualization Control Functions
 */
function toggleDensityHeatmap(show) {
    WSIAnalyzer.showDensityHeatmap = show;
    WSIAnalyzer.heatmapOverlays.forEach(overlay => {
        overlay.style.display = show ? 'block' : 'none';
    });
    console.log(`🔥 Density heatmap: ${show ? 'ON' : 'OFF'}`);
}

function toggleBoundaries(show) {
    WSIAnalyzer.showBoundaries = show;
    WSIAnalyzer.boundaryOverlays.forEach(overlay => {
        overlay.style.display = show ? 'block' : 'none';
    });
    console.log(`🎨 Smooth boundaries: ${show ? 'ON' : 'OFF'}`);
}

function updateHeatmapOpacity(value) {
    WSIAnalyzer.heatmapOpacity = parseFloat(value);
    document.getElementById('heatmapOpacityDisplay').textContent = Math.round(value * 100) + '%';
    
    WSIAnalyzer.heatmapOverlays.forEach(overlay => {
        overlay.style.opacity = value;
    });
}

function updateBoundaryOpacity(value) {
    WSIAnalyzer.boundaryOpacity = parseFloat(value);
    document.getElementById('boundaryOpacityDisplay').textContent = Math.round(value * 100) + '%';
    
    WSIAnalyzer.boundaryOverlays.forEach(overlay => {
        overlay.style.opacity = value;
    });
}

function switchToUnifiedBoundaries() {
    console.log('🔄 Switching to ultra-smooth unified boundary mode...');
    clearBoundaryOverlays();
    createUnifiedBoundaryOverlay();
    updateWSIStatus('✅ Ultra-smooth unified boundaries activated!');
}

function refreshAllOverlays() {
    clearAllWSIOverlays();
    
    if (WSIAnalyzer.showDensityHeatmap) {
        createDensityHeatmapOverlays();
    }
    
    if (WSIAnalyzer.showBoundaries) {
        createUnifiedBoundaryOverlay(); // DEFAULT to ultra-smooth
    }
    
    updateWSIStatus('✅ All ultra-smooth overlays refreshed');
}

function clearAllWSIOverlays() {
    clearDensityHeatmapOverlays();
    clearBoundaryOverlays();
    console.log('🧹 All WSI overlays cleared');
}

function clearDensityHeatmapOverlays() {
    const viewer = WSIAnalyzer.viewer;
    if (!viewer) return;
    
    WSIAnalyzer.heatmapOverlays.forEach(overlay => {
        try {
            viewer.removeOverlay(overlay);
        } catch (e) {
            console.warn('Failed to remove heatmap overlay:', e);
        }
    });
    
    WSIAnalyzer.heatmapOverlays = [];
}

function clearBoundaryOverlays() {
    const viewer = WSIAnalyzer.viewer;
    if (!viewer) return;
    
    WSIAnalyzer.boundaryOverlays.forEach(overlay => {
        try {
            viewer.removeOverlay(overlay);
        } catch (e) {
            console.warn('Failed to remove boundary overlay:', e);
        }
    });
    
    WSIAnalyzer.boundaryOverlays = [];
}

function clearWSIResults() {
    clearAllWSIOverlays();
    WSIAnalyzer.aggregatedResults = null;
    WSIAnalyzer.heatmapData = null;
    WSIAnalyzer.tileResults.clear();
    WSIAnalyzer.processedTiles = 0;
    WSIAnalyzer.totalTiles = 0;
    WSIAnalyzer.skippedEmptyTiles = 0;
    
    if (WSI_DOM.resultsContainer) {
        WSI_DOM.resultsContainer.innerHTML = `
            <div class="no-selection-message">
                <i class="fas fa-microscope"></i>
                <p>Click "Start WSI Analysis" to test smooth boundaries on center region (10x10 tiles)</p>
            </div>
        `;
    }
    
    updateWSIStatus('✅ WSI ready - smooth boundaries & heatmap');
}

function stopWSIAnalysis() {
    if (WSIAnalyzer.isProcessing) {
        WSIAnalyzer.shouldStop = true;
        updateWSIStatus('⏹️ Stopping smooth WSI analysis...');
    }
}

/**
 * Export comprehensive results
 */
async function exportWSIResults() {
    if (!WSIAnalyzer.aggregatedResults) {
        alert('No WSI results to export');
        return;
    }
    
    updateWSIStatus('📦 Creating comprehensive smooth export...');
    
    try {
        if (typeof JSZip === 'undefined') {
            alert('JSZip library required');
            return;
        }
        
        const zip = new JSZip();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const baseName = `smooth_wsi_analysis_${timestamp}`;
        
        // Comprehensive export data
        const exportData = {
            metadata: {
                timestamp: new Date().toISOString(),
                type: 'Smooth_WSI_Analysis',
                version: '4.1',
                analysisMode: 'full_slide_smooth_boundaries'
            },
            parameters: {
                tileSize: WSIAnalyzer.tileSize,
                batchSize: WSIAnalyzer.batchSize,
                emptyTileThreshold: WSIAnalyzer.emptyTileThreshold,
                segThreshold: WSIAnalyzer.segThreshold,
                watershedThreshold: WSIAnalyzer.watershedThreshold,
                minCellSize: WSIAnalyzer.minCellSize,
                overlapRatio: WSIAnalyzer.overlapRatio
            },
            performance: {
                totalTilesAnalyzed: WSIAnalyzer.aggregatedResults.processedTiles,
                emptyTilesSkipped: WSIAnalyzer.aggregatedResults.skippedEmpty,
                parallelProcessing: WSIAnalyzer.batchSize,
                coveragePercentage: WSIAnalyzer.aggregatedResults.coverage
            },
            visualizations: {
                smoothBoundariesEnabled: WSIAnalyzer.showBoundaries,
                densityHeatmapEnabled: WSIAnalyzer.showDensityHeatmap,
                heatmapOpacity: WSIAnalyzer.heatmapOpacity,
                boundaryOpacity: WSIAnalyzer.boundaryOpacity,
                boundarySmoothing: 'enabled',
                overlapHandling: 'priority_based'
            },
            results: WSIAnalyzer.aggregatedResults,
            cellDensityData: WSIAnalyzer.heatmapData?.map(d => ({
                tileId: d.tile.id,
                x: d.tile.x, y: d.tile.y,
                width: d.tile.width, height: d.tile.height,
                cellCount: d.cellCount,
                confidence: d.confidence,
                cellDensity: d.cellDensity
            })) || [],
            detailedTileData: Array.from(WSIAnalyzer.tileResults.entries()).map(([tileId, data]) => ({
                tileId: tileId,
                coordinates: { x: data.tile.x, y: data.tile.y, width: data.tile.width, height: data.tile.height },
                gridPosition: { gridX: data.tile.gridX, gridY: data.tile.gridY },
                cellCount: data.result.cell_count || 0,
                confidence: data.result.seg_confidence || 0,
                tissuePercentage: data.tissuePercentage || 0,
                hasBoundaryData: !!data.result.instance_map
            }))
        };
        
        zip.file(`${baseName}.json`, JSON.stringify(exportData, null, 2));
        
        // Detailed CSV for analysis
        const csvHeaders = ['Tile_ID', 'Grid_X', 'Grid_Y', 'X', 'Y', 'Width', 'Height', 'Cell_Count', 'Confidence', 'Cell_Density_per_mm2', 'Tissue_Percentage', 'Has_Boundaries'];
        const csvRows = exportData.detailedTileData.map(d => [
            d.tileId,
            d.gridPosition.gridX, d.gridPosition.gridY,
            d.coordinates.x, d.coordinates.y, d.coordinates.width, d.coordinates.height,
            d.cellCount, d.confidence.toFixed(4),
            exportData.cellDensityData.find(c => c.tileId === d.tileId)?.cellDensity.toFixed(2) || '0',
            d.tissuePercentage.toFixed(1),
            d.hasBoundaryData ? 'Yes' : 'No'
        ]);
        const csvContent = [csvHeaders.join(','), ...csvRows.map(row => row.join(','))].join('\n');
        zip.file(`${baseName}.csv`, csvContent);
        
        // Comprehensive report
        const report = `Smooth WSI Analysis Report
Generated: ${new Date().toLocaleString()}
Analysis Type: Complete Whole Slide Image Analysis with Smooth Boundaries

=== SLIDE OVERVIEW ===
Total Cells Detected: ${exportData.results.totalCells.toLocaleString()}
Average AI Confidence: ${(exportData.results.averageConfidence * 100).toFixed(1)}%
Slide Coverage: ${exportData.performance.coveragePercentage.toFixed(1)}%

=== PERFORMANCE METRICS ===
Tiles Analyzed: ${exportData.performance.totalTilesAnalyzed}
Empty Tiles Skipped: ${exportData.performance.emptyTilesSkipped}
Parallel Processing: ${exportData.performance.parallelProcessing} tiles simultaneously
Efficiency Gain: ${Math.round((exportData.performance.emptyTilesSkipped / (exportData.performance.totalTilesAnalyzed + exportData.performance.emptyTilesSkipped)) * 100)}% tiles skipped

=== SMOOTH VISUALIZATION FEATURES ===
✅ Seamless Cell Boundaries: Priority-based overlap handling prevents double-drawing
✅ Edge Fade Effect: Boundaries fade at tile edges for smooth transitions
✅ Anti-aliasing: High-quality rendering for crisp boundaries
✅ Density Heatmap: ${exportData.visualizations.densityHeatmapEnabled ? 'Enabled' : 'Disabled'} (${Math.round(exportData.visualizations.heatmapOpacity * 100)}% opacity)
✅ Unified Overlay Option: Available for ultra-smooth results

=== TECHNICAL PARAMETERS ===
Tile Size: ${exportData.parameters.tileSize}x${exportData.parameters.tileSize} pixels
Overlap Ratio: ${exportData.parameters.overlapRatio * 100}% for seamless blending
Segmentation Threshold: ${exportData.parameters.segThreshold}
Watershed Threshold: ${exportData.parameters.watershedThreshold}
Minimum Cell Size: ${exportData.parameters.minCellSize} pixels

=== SMOOTH BOUNDARY IMPROVEMENTS ===
- Priority-based drawing in overlap regions eliminates double boundaries
- Edge fade effects create seamless tile transitions
- Anti-aliasing ensures crisp, professional-quality boundaries
- Grid coordinate system enables precise overlap handling
- Unified overlay option provides ultimate smoothness

=== FILE CONTENTS ===
1. ${baseName}.json - Complete smooth analysis data in JSON format
2. ${baseName}.csv - Tile-by-tile results with grid positions for analysis
3. ${baseName}_report.txt - This comprehensive smooth boundary report

=== VISUALIZATION NOTES ===
- Smooth boundaries eliminate visible tile seams through advanced overlap processing
- Density heatmap shows cell concentration with seamless tile blending
- Both overlays use priority-based rendering to prevent artifacts
- Ultra-smooth mode available via unified overlay for maximum quality
- Grid-based coordinate system ensures perfect alignment

Generated by Smooth WSI Analysis System v4.1
Optimized for seamless boundaries, speed, and professional visualization
`;
        
        zip.file(`${baseName}_report.txt`, report);
        
        // Generate and download
        const zipBlob = await zip.generateAsync({ 
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        updateWSIStatus('✅ Smooth analysis export completed!');
        
    } catch (error) {
        updateWSIStatus('❌ Export failed: ' + error.message);
    }
}

/**
 * Progress and status functions
 */
function showWSIProgress() {
    if (WSI_DOM.progressContainer) {
        WSI_DOM.progressContainer.style.display = 'block';
    }
}

function hideWSIProgress() {
    if (WSI_DOM.progressContainer) {
        WSI_DOM.progressContainer.style.display = 'none';
    }
}

function updateWSIProgress(percent, detail) {
    const safePercent = Math.max(0, Math.min(percent || 0, 100));
    
    if (WSI_DOM.progressFill) {
        WSI_DOM.progressFill.style.width = safePercent + '%';
        WSI_DOM.progressFill.style.backgroundColor = safePercent === 100 ? '#28a745' : '#007bff';
    }
    
    if (WSI_DOM.progressText) {
        WSI_DOM.progressText.textContent = `${safePercent}% complete`;
    }
    
    if (WSI_DOM.progressDetail && detail) {
        WSI_DOM.progressDetail.textContent = detail;
    }
}

function updateWSIStatus(message) {
    if (WSI_DOM.status) {
        WSI_DOM.status.textContent = message;
    }
    console.log('📊 Smooth WSI:', message);
}

async function checkWSIServiceHealth() {
    try {
        const response = await fetch('../ai_proxy.php?endpoint=health');
        const data = await response.json();
        updateWSIStatus(data.status === 'healthy' ? 
            '✅ Smooth WSI AI Ready - seamless boundary analysis' : 
            '⚠️ WSI AI Service: Issues');
    } catch (error) {
        updateWSIStatus('❌ WSI AI Service: Disconnected');
    }
}

// Export all functions to global scope
Object.assign(window, {
    // Main functions
    startWSIAnalysis,
    stopWSIAnalysis,
    clearWSIResults,
    
    // Visualization controls
    toggleDensityHeatmap,
    toggleBoundaries,
    updateHeatmapOpacity,
    updateBoundaryOpacity,
    refreshAllOverlays,
    clearAllWSIOverlays,
    clearDensityHeatmapOverlays,
    clearBoundaryOverlays,
    
    // Boundary creation (fixed)
    createSmoothCellBoundaryOverlays,
    createImprovedTileBoundaryOverlay,
    createDensityHeatmapOverlays,
    createUnifiedBoundaryOverlay,
    switchToUnifiedBoundaries,
    
    // Export and utility
    exportWSIResults,
    initWSIAnalyzer,
    checkWSIServiceHealth,
    
    // Helper functions
    groupTilesByGrid,
    getNeighboringTiles,
    findBoundariesJS,
    convertInstanceMapTo2D
});

// Auto-initialize
$(document).ready(() => {
    console.log('🚀 SMOOTH WSI: Initializing seamless boundary analyzer...');
    
    setTimeout(() => {
        if (initWSIAnalyzer()) {
            console.log('✅ SMOOTH WSI: Ready for seamless slide analysis');
        } else {
            // Retry logic
            let retryCount = 0;
            const retryInterval = setInterval(() => {
                retryCount++;
                if (retryCount > 10) {
                    console.error('❌ SMOOTH WSI: Failed to initialize');
                    clearInterval(retryInterval);
                    return;
                }
                
                if (initWSIAnalyzer()) {
                    console.log(`✅ SMOOTH WSI: Initialized on retry ${retryCount}`);
                    clearInterval(retryInterval);
                }
            }, 2000);
        }
    }, 1500);
});