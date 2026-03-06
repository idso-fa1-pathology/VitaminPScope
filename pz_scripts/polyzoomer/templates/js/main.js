// Global variables
var viewer = null;
OpenSeadragon.Utils = OpenSeadragon;

// Configuration variables that should be set by the template system
var ANNOTATIONS_PATH = null;
var PATIENT_ID = null;
var CHANNEL_ID = null;
var CONTENT_ID = null;
var VIEWER_VARNAME = null;

// Annotation type mappings
var annotationTypes = {
    0: "Line",
    1: "Arrow", 
    2: "Rectangle",
    3: "Ellipse",
    4: "Free Hand Drawing",
    5: "Text",
    6: "Dot"
};

// Image synchronization functions
function SyncImage(viewer, viewerToSyncWith) {
    console.log('Syncing');
    viewer.viewport.panTo(viewerToSyncWith.viewport.getCenter());
    viewer.viewport.zoomTo(viewerToSyncWith.viewport.getZoom());
}

var hFuncHandler = function myHandler(inViewer) {
    var SourceViewer = inViewer.eventSource;
    var viewersToSync = [];
    
    for (var key in ViewerHash) {
        if (ViewerHash.hasOwnProperty(key)) {
            if(key != SourceViewer.id) {
                if(ViewerHash[key].id == SourceViewer.id) {
                    viewersToSync.push(key);
                }
            }
        }
    }
    
    for(var viewer = 0; viewer < viewersToSync.length; ++viewer) {
        TargetViewer = window[viewersToSync[viewer]];   
        
        if (!TargetViewer.isOpen()) {
            console.log('TargetViewer is not open');
        }
        console.log('Starting live sync...', SourceViewer.id, ' with ', TargetViewer.id);
        SyncImage(TargetViewer,SourceViewer)      
    }
}

function LiveSync(SourceViewer) {
    SourceViewer.addHandler("animation",hFuncHandler);
}

function UnLiveSync(SourceViewer) {
    SourceViewer.removeHandler("animation",hFuncHandler)
}

function SyncThemAll() {
    // Placeholder for future sync functionality
}

// Mouse tracking
var currentMousePos = { x: -1, y: -1 };
$(document).mousemove(function(event) {
    currentMousePos.x = event.pageX;
    currentMousePos.y = event.pageY;
});

// Utility functions
function rgbStringToHex(color) {
    var colorArray = color.split("(")[1].split(")")[0];
    colorArray = colorArray.split(",");
    var b = colorArray.map(function(x){
        x = parseInt(x).toString(16);
        return (x.length==1) ? "0"+x : x;
    })
    return "#"+b.join("");
}

// Function to get annotation data from enhanced annotation manager
function getAnnotationData() {
    // Try to get annotations from the enhanced annotation manager first
    if (window.enhancedAnnotationManager && window.enhancedAnnotationManager.annotations) {
        return window.enhancedAnnotationManager.annotations;
    }
    
    // Fallback: return empty array if no annotations found
    return [];
}

// Function to load raw annotation data from file
function loadRawAnnotationData() {
    return new Promise(function(resolve, reject) {
        var annotationPath = getAnnotationPath();
        if (!annotationPath) {
            reject(new Error('Could not find annotations file path'));
            return;
        }
        
        // First try to get from enhanced annotation manager
        if (window.enhancedAnnotationManager && window.enhancedAnnotationManager.annotations) {
            resolve(window.enhancedAnnotationManager.annotations);
            return;
        }
        
        // Fallback: load from file
        fetch(annotationPath)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('Annotations file not found');
                }
                return response.text();
            })
            .then(function(data) {
                // Parse the raw annotation data
                var annotations = parseRawAnnotationData(data);
                resolve(annotations);
            })
            .catch(function(error) {
                reject(error);
            });
    });
}

// Function to parse raw annotation text data
function parseRawAnnotationData(rawData) {
    var annotations = [];
    var lines = rawData.split('\n');
    
    lines.forEach(function(line, index) {
        if (!line || line.trim() === '') return;
        
        try {
            var parts = line.split(',');
            if (parts.length < 4) return;
            
            var active = parseInt(parts[0]);
            var id = parseInt(parts[1]);
            var type = parseInt(parts[2]);
            
            // Skip inactive annotations
            if (active !== 1) return;
            
            // Get coordinates and other data
            var contentStart = line.indexOf('[');
            var contentEnd = line.lastIndexOf(']');
            var content = line.substring(contentStart + 1, contentEnd);
            
            // Get color
            var colorStart = contentEnd + 2;
            var colorEnd = line.indexOf(',', colorStart);
            var color = line.substring(colorStart, colorEnd);
            
            // Get remaining parts (zoom, date)
            var remainingParts = line.substring(colorEnd + 1).split(',');
            var zoom = remainingParts[0] || '1.0';
            var dateStr = remainingParts.slice(1).join(',') || '';
            
            annotations.push({
                id: id,
                type: type,
                typeName: annotationTypes[type] || 'Unknown',
                content: content,
                color: color,
                zoom: zoom,
                date: dateStr,
                active: active,
                raw: line
            });
        } catch (e) {
            console.error("Error parsing annotation line:", e);
        }
    });
    
    return annotations;
}

// Function to detect and construct annotation path
function getAnnotationPath() {
    // Try to get from global variables first
    if (ANNOTATIONS_PATH && ANNOTATIONS_PATH !== '_ANNOTATIONS_LINK_') {
        return ANNOTATIONS_PATH;
    }
    
    // Try to get from polyscopeConfig
    if (window.polyscopeConfig && window.polyscopeConfig.annotationsPath) {
        return window.polyscopeConfig.annotationsPath;
    }
    
    // Try to get from enhanced annotation manager
    if (window.enhancedAnnotationManager && window.enhancedAnnotationManager.annotationPath) {
        return window.enhancedAnnotationManager.annotationPath;
    }
    
    console.error('Could not determine annotation path');
    return null;
}

// UI Controls
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const toggleBtn = document.querySelector('.sidebar-toggle');
    
    if (sidebar.classList.contains('collapsed')) {
        sidebar.classList.remove('collapsed');
        mainContent.classList.remove('expanded');
        toggleBtn.classList.remove('collapsed');
        toggleBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    } else {
        sidebar.classList.add('collapsed');
        mainContent.classList.add('expanded');
        toggleBtn.classList.add('collapsed');
        toggleBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    }
}

function toggleExportDropdown() {
    const dropdown = document.getElementById('exportDropdown');
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

function toggleNavigator() {
    const nav = viewer.navigator;
    // nav.setVisible(!nav.isVisible());
    nav.element.style.display = navigatorCheckbox.checked ? 'block' : 'none';
}

// Enhanced export functions with proper annotation parsing
function exportAnnotationsTXT() {
    console.log('Exporting annotations as TXT...');
    
    loadRawAnnotationData()
        .then(function(annotations) {
            if (!annotations || annotations.length === 0) {
                alert('No annotations found to export.');
                return;
            }
            
            // Convert to TXT format (original format)
            var txtData = convertAnnotationsToTXT(annotations);
            
            // Generate filename with timestamp
            var patientId = PATIENT_ID || 'Patient';
            var timestamp = getTimestamp();
            var filename = 'Annotations_' + patientId + '_' + timestamp + '.txt';
            
            downloadAsFile(txtData, filename, 'text/plain');
            console.log('TXT export completed:', annotations.length, 'annotations');
        })
        .catch(function(error) {
            console.error('Error exporting TXT:', error);
            alert('Could not export annotations as TXT: ' + error.message);
        });
    
    document.getElementById('exportDropdown').style.display = 'none';
}

function exportAnnotationsCSV() {
    console.log('Exporting annotations as CSV...');
    
    loadRawAnnotationData()
        .then(function(annotations) {
            if (!annotations || annotations.length === 0) {
                alert('No annotations found to export.');
                return;
            }
            
            // Convert to CSV format
            var csvData = convertAnnotationsToCSV(annotations);
            
            // Generate filename with timestamp
            var patientId = PATIENT_ID || 'Patient';
            var timestamp = getTimestamp();
            var filename = 'Annotations_' + patientId + '_' + timestamp + '.csv';
            
            downloadAsFile(csvData, filename, 'text/csv');
            console.log('CSV export completed:', annotations.length, 'annotations');
        })
        .catch(function(error) {
            console.error('Error exporting CSV:', error);
            alert('Could not export annotations as CSV: ' + error.message);
        });
    
    document.getElementById('exportDropdown').style.display = 'none';
}

function exportAnnotationsGeoJSON() {
    console.log('Exporting annotations as GeoJSON for QuPath...');
    
    loadRawAnnotationData()
        .then(function(annotations) {
            if (!annotations || annotations.length === 0) {
                alert('No annotations found to export.');
                return;
            }
            
            // Debug image info if viewer is ready
            if (viewer && viewer.world && viewer.world.getItemCount() > 0) {
                debugImageInfo();
            }
            
            // Convert to GeoJSON format
            var geoJsonData = convertAnnotationsToGeoJSON(annotations);
            
            // Generate filename with timestamp
            var patientId = PATIENT_ID || 'Patient';
            var timestamp = getTimestamp();
            var filename = 'Annotations_' + patientId + '_' + timestamp + '.geojson';
            
            downloadAsFile(JSON.stringify(geoJsonData, null, 2), filename, 'application/geo+json');
            console.log('GeoJSON export completed:', annotations.length, 'annotations');
        })
        .catch(function(error) {
            console.error('Error exporting GeoJSON:', error);
            alert('Could not export annotations as GeoJSON: ' + error.message);
        });
    
    document.getElementById('exportDropdown').style.display = 'none';
}

// Conversion functions
function convertAnnotationsToTXT(annotations) {
    // Convert back to original TXT format
    var txtLines = [];
    
    annotations.forEach(function(annotation) {
        if (annotation.raw) {
            // Use original raw format if available
            txtLines.push(annotation.raw);
        } else {
            // Reconstruct the format: active,id,type,[content],color,zoom,date
            var line = annotation.active + ',' + 
                      annotation.id + ',' + 
                      annotation.type + ',' + 
                      '[' + annotation.content + '],' + 
                      annotation.color + ',' + 
                      (annotation.zoom || '1.0') + ',' + 
                      (annotation.date || '');
            txtLines.push(line);
        }
    });
    
    return txtLines.join('\n');
}

function convertAnnotationsToCSV(annotations) {
    // Create CSV with comprehensive annotation data
    var csvRows = [];
    
    // Header row
    csvRows.push('ID,Type,TypeName,Color,Coordinates,Zoom,Date,Details');
    
    annotations.forEach(function(annotation) {
        // Parse coordinates for better display
        var coordinates = parseCoordinatesFromContent(annotation.content);
        var coordStr = coordinates.map(function(coord) {
            return '(' + coord.x + ',' + coord.y + ')';
        }).join(';');
        
        // Extract additional details based on type
        var details = extractAnnotationDetails(annotation);
        
        // Escape quotes and commas for CSV
        var row = [
            annotation.id,
            annotation.type,
            '"' + (annotation.typeName || annotationTypes[annotation.type] || 'Unknown') + '"',
            annotation.color,
            '"' + coordStr + '"',
            annotation.zoom || '1.0',
            '"' + (annotation.date || '') + '"',
            '"' + details + '"'
        ];
        
        csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
}

function convertAnnotationsToGeoJSON(annotations) {
    // Get image dimensions - you'll need to implement these
    var imageWidth = getImageWidth();
    var imageHeight = getImageHeight();
    
    var features = annotations.map(function(annotation) {
        var coordinates = parseCoordinatesFromContent(annotation.content);
        var geometry = convertToGeoJSONGeometry(annotation.type, coordinates, imageWidth, imageHeight);
        
        return {
            type: "Feature",
            geometry: geometry,
            properties: {
                objectType: "annotation",
                classification: {
                    name: annotation.typeName || annotationTypes[annotation.type] || 'Unknown',
                    colorRGB: hexToRGB(annotation.color)
                },
                id: annotation.id,
                polyscope_type: annotation.type,
                zoom: parseFloat(annotation.zoom || '1.0'),
                date: annotation.date || '',
                details: extractAnnotationDetails(annotation),
                active: annotation.active === 1
            }
        };
    });
    
    return {
        type: "FeatureCollection",
        features: features
    };
}

function convertToGeoJSONGeometry(annotationType, coordinates, imageWidth, imageHeight) {
    // Convert normalized coordinates to pixels
    // Both X and Y are normalized to imageWidth
    var pixelCoords = coordinates.map(function(coord) {
        // Convert normalized coordinates to pixels (both use imageWidth as base)
        var pixelX = coord.x * imageWidth;
        var pixelY = coord.y * imageWidth;
        
        // Return pixel coordinates (let QuPath handle the μm conversion)
        return [
            pixelX,
            pixelY
        ];
    });
    
    switch(annotationType) {
        case 6: // Dot/Point
            return {
                type: "Point",
                coordinates: pixelCoords[0]
            };
            
        case 2: // Rectangle
            if (pixelCoords.length >= 2) {
                var x1 = pixelCoords[0][0], y1 = pixelCoords[0][1];
                var x2 = pixelCoords[1][0], y2 = pixelCoords[1][1];
                
                return {
                    type: "Polygon",
                    coordinates: [[
                        [x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]
                    ]]
                };
            }
            break;
            
        case 4: // Free Hand Drawing
            if (pixelCoords.length > 2) {
                var lastCoord = pixelCoords[pixelCoords.length - 1];
                var firstCoord = pixelCoords[0];
                if (lastCoord[0] !== firstCoord[0] || lastCoord[1] !== firstCoord[1]) {
                    pixelCoords.push(firstCoord);
                }
                return {
                    type: "Polygon",
                    coordinates: [pixelCoords]
                };
            }
            break;
            
        default:
            return {
                type: "LineString",
                coordinates: pixelCoords
            };
    }
    
    return {
        type: "Point",
        coordinates: pixelCoords[0] || [0, 0]
    };
}

function hexToRGB(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        var r = parseInt(result[1], 16);
        var g = parseInt(result[2], 16);
        var b = parseInt(result[3], 16);
        return (r << 16) | (g << 8) | b;
    }
    return 0;
}

function getNormalizationWidth() {
    // Get the width used for normalization (both x and y are normalized to this)
    if (viewer && viewer.world && viewer.world.getItemAt(0)) {
        return viewer.world.getItemAt(0).getContentSize().x;
    }
    return getImageWidth(); // Use dynamic image width as fallback
}

function getImageWidth() {
    // Try multiple ways to get actual image width
    if (viewer && viewer.world && viewer.world.getItemAt(0)) {
        var tiledImage = viewer.world.getItemAt(0);
        var contentSize = tiledImage.getContentSize();
        if (contentSize && contentSize.x) {
            return contentSize.x;
        }
        
        // Try getting from source
        var source = tiledImage.source;
        if (source && source.width) {
            return source.width;
        }
        
        // Try getting from dimensions
        if (source && source.dimensions && source.dimensions.x) {
            return source.dimensions.x;
        }
    }
    
    // Try to get from global viewer variable if available
    if (window[VIEWER_VARNAME] && window[VIEWER_VARNAME].world && window[VIEWER_VARNAME].world.getItemAt(0)) {
        var contentSize = window[VIEWER_VARNAME].world.getItemAt(0).getContentSize();
        if (contentSize && contentSize.x) {
            return contentSize.x;
        }
    }
    
    console.warn('Could not get image width - using fallback value of 1');
    return 1; // Fallback that won't break calculations
}

function getImageHeight() {
    if (viewer && viewer.world && viewer.world.getItemAt(0)) {
        var tiledImage = viewer.world.getItemAt(0);
        var contentSize = tiledImage.getContentSize();
        if (contentSize && contentSize.y) {
            return contentSize.y;
        }
        
        var source = tiledImage.source;
        if (source && source.height) {
            return source.height;
        }
        
        if (source && source.dimensions && source.dimensions.y) {
            return source.dimensions.y;
        }
    }
    
    if (window[VIEWER_VARNAME] && window[VIEWER_VARNAME].world && window[VIEWER_VARNAME].world.getItemAt(0)) {
        var contentSize = window[VIEWER_VARNAME].world.getItemAt(0).getContentSize();
        if (contentSize && contentSize.y) {
            return contentSize.y;
        }
    }
    
    console.warn('Could not get image height - using fallback value of 1');
    return 1; // Fallback that won't break calculations
}

function debugImageInfo() {
    var imageWidth = getImageWidth();
    var imageHeight = getImageHeight();
    var pixelSize = getPixelSizeFromMetadata();
    
    console.log('=== Image Debug Info ===');
    console.log('Image width (pixels):', imageWidth);
    console.log('Image height (pixels):', imageHeight);
    console.log('Pixel size:', pixelSize);
    console.log('Physical width (μm):', imageWidth * pixelSize.x);
    console.log('Physical height (μm):', imageHeight * pixelSize.y);
    console.log('Expected QuPath width: 11983.08 μm');
    console.log('Expected QuPath height: 6474.79 μm');
}

// Call this to check if dimensions match QuPath
debugImageInfo();

function getPixelSizeFromMetadata() {
    if (!viewer || !viewer.world || !viewer.world.getItemAt(0)) {
        return { x: 0.5013, y: 0.5013 }; // Use QuPath's actual pixel size as fallback
    }
    
    var tiledImage = viewer.world.getItemAt(0);
    var source = tiledImage.source;
    
    if (source) {
        // Check for pixel size in metadata
        if (source.pixelSizeInMicrometers) {
            return { x: source.pixelSizeInMicrometers, y: source.pixelSizeInMicrometers };
        }
        if (source.micronsPerPixel) {
            return { x: source.micronsPerPixel, y: source.micronsPerPixel };
        }
        
        // Check DZI metadata
        if (source.xmlDoc) {
            var metaElements = source.xmlDoc.getElementsByTagName('Metadata');
            for (var i = 0; i < metaElements.length; i++) {
                var meta = metaElements[i];
                if (meta.getAttribute('name') === 'PixelSizeX') {
                    var pixelSizeX = parseFloat(meta.getAttribute('value'));
                    if (pixelSizeX > 0) {
                        return { x: pixelSizeX, y: pixelSizeX };
                    }
                }
            }
        }
    }
    
    // Use the actual pixel size from QuPath info: 0.5013 μm/pixel
    console.warn('Using default pixel size: 1.0 μm/pixel');
    return { x: 1.0, y: 1.0 };
}
// Helper functions for parsing annotation data
function parseCoordinatesFromContent(content) {
    var coordinates = [];
    var regex = /\(([^)]+)\)/g;
    var match;
    
    while ((match = regex.exec(content)) !== null) {
        var coordPair = match[1].split(',');
        if (coordPair.length >= 2) {
            coordinates.push({
                x: parseFloat(coordPair[0]),
                y: parseFloat(coordPair[1])
            });
        }
    }
    
    return coordinates;
}

function extractAnnotationDetails(annotation) {
    var details = '';
    
    switch (parseInt(annotation.type)) {
        case 5: // Text annotation
            var textMatch = annotation.content.match(/\("([^"]*)"\)/);
            if (textMatch && textMatch[1]) {
                details = 'Text: ' + textMatch[1];
            }
            break;
        case 0: // Line
        case 1: // Arrow
            var coords = parseCoordinatesFromContent(annotation.content);
            if (coords.length >= 2) {
                var length = Math.sqrt(
                    Math.pow(coords[1].x - coords[0].x, 2) + 
                    Math.pow(coords[1].y - coords[0].y, 2)
                );
                details = 'Length: ' + length.toFixed(2);
            }
            break;
        case 2: // Rectangle
            var coords = parseCoordinatesFromContent(annotation.content);
            if (coords.length >= 2) {
                var width = Math.abs(coords[1].x - coords[0].x);
                var height = Math.abs(coords[1].y - coords[0].y);
                var area = width * height;
                details = 'Width: ' + width.toFixed(2) + ', Height: ' + height.toFixed(2) + ', Area: ' + area.toFixed(2);
            }
            break;
        case 3: // Ellipse
            var coords = parseCoordinatesFromContent(annotation.content);
            if (coords.length >= 2) {
                var rx = Math.abs(coords[1].x - coords[0].x) / 2;
                var ry = Math.abs(coords[1].y - coords[0].y) / 2;
                var area = Math.PI * rx * ry;
                details = 'Radii: ' + rx.toFixed(2) + 'x' + ry.toFixed(2) + ', Area: ' + area.toFixed(2);
            }
            break;
        case 4: // Free Hand Drawing
            var coords = parseCoordinatesFromContent(annotation.content);
            details = 'Points: ' + coords.length;
            break;
        case 6: // Dot
            var coords = parseCoordinatesFromContent(annotation.content);
            if (coords.length >= 1) {
                details = 'Position: (' + coords[0].x.toFixed(2) + ', ' + coords[0].y.toFixed(2) + ')';
            }
            break;
        default:
            details = 'Type: ' + (annotationTypes[annotation.type] || 'Unknown');
    }
    
    return details;
}

// Helper function to generate timestamp for unique filenames
function getTimestamp() {
    var now = new Date();
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    var hours = String(now.getHours()).padStart(2, '0');
    var minutes = String(now.getMinutes()).padStart(2, '0');
    var seconds = String(now.getSeconds()).padStart(2, '0');
    
    return year + month + day + '_' + hours + minutes + seconds;
}

function downloadAsFile(content, filename, mimeType) {
    var blob = new Blob([content], { type: mimeType });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    
    console.log('Downloaded file:', filename);
}

function toggleSection(header) {
    const content = header.nextElementSibling;
    const icon = header.querySelector('i:last-child');
    
    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        header.classList.remove('active');
        if (icon) {
            icon.style.transform = 'rotate(0deg)';
        }
    } else {
        content.classList.add('expanded');
        header.classList.add('active');
        if (icon) {
            icon.style.transform = 'rotate(180deg)';
        }
    }
}

function toggleFullscreen() {
    viewer.setFullScreen(true);
}

// Image Control Functions
function updateImageControl(slider) {
    const value = slider.value;
    const valueSpan = slider.parentNode.querySelector('.slider-value');
    valueSpan.textContent = value + '%';
    
    // Apply image filters
    applyImageFilters();
}

// Add this function to your main.js file
// This function updates the sidebar with metadata from the JSON file

function updateMetadataDisplay(metadata, viewerVarName) {
    console.log("Updating metadata display with:", metadata);
    
    // Update filename
    var filenameEl = document.getElementById('metadata-filename');
    if (filenameEl && metadata.filename) {
        filenameEl.textContent = metadata.filename;
    }
    
    // Update format
    var formatEl = document.getElementById('metadata-format');
    if (formatEl && metadata.format) {
        formatEl.textContent = metadata.format.toUpperCase() + ' - Deep Zoom Image';
    }
    
    // Display and update dimensions
    if (metadata.imageWidth && metadata.imageHeight) {
        var dimensionsContainer = document.getElementById('metadata-dimensions');
        var dimensionsValue = document.getElementById('metadata-dimensions-value');
        if (dimensionsContainer && dimensionsValue) {
            dimensionsContainer.style.display = 'flex';
            dimensionsValue.textContent = metadata.imageWidth.toLocaleString() + ' × ' + 
                                         metadata.imageHeight.toLocaleString() + ' pixels';
        }
    }
    
    // Display physical dimensions if available
    if (metadata.physicalWidthMM && metadata.physicalHeightMM) {
        var physicalContainer = document.getElementById('metadata-physical');
        var physicalValue = document.getElementById('metadata-physical-value');
        if (physicalContainer && physicalValue) {
            physicalContainer.style.display = 'flex';
            physicalValue.textContent = metadata.physicalWidthMM + ' × ' + 
                                       metadata.physicalHeightMM + ' mm';
        }
    }
    
    // Display resolution (MPP) if available
    if (metadata.hasScale && metadata.mppX && metadata.mppY) {
        var resolutionContainer = document.getElementById('metadata-resolution');
        var resolutionValue = document.getElementById('metadata-resolution-value');
        if (resolutionContainer && resolutionValue) {
            resolutionContainer.style.display = 'flex';
            var avgMpp = ((parseFloat(metadata.mppX) + parseFloat(metadata.mppY)) / 2).toFixed(4);
            resolutionValue.textContent = avgMpp + ' μm/pixel';
        }
    }
    
    // Display magnification if available
    if (metadata.magnification) {
        var magContainer = document.getElementById('metadata-magnification');
        var magValue = document.getElementById('metadata-magnification-value');
        if (magContainer && magValue) {
            magContainer.style.display = 'flex';
            magValue.textContent = metadata.magnification + 'x';
        }
    }
    
    // Display scan date if available
    if (metadata.scanDate) {
        var dateContainer = document.getElementById('metadata-scandate');
        var dateValue = document.getElementById('metadata-scandate-value');
        if (dateContainer && dateValue) {
            dateContainer.style.display = 'flex';
            var dateStr = metadata.scanDate;
            if (metadata.scanTime) {
                dateStr += ' ' + metadata.scanTime;
            }
            dateValue.textContent = dateStr;
        }
    }
    
    // Display scanner info if available
    if (metadata.scannerId || metadata.vendor) {
        var scannerContainer = document.getElementById('metadata-scanner');
        var scannerValue = document.getElementById('metadata-scanner-value');
        if (scannerContainer && scannerValue) {
            scannerContainer.style.display = 'flex';
            var scannerStr = '';
            if (metadata.vendor) {
                scannerStr = metadata.vendor.charAt(0).toUpperCase() + metadata.vendor.slice(1);
            }
            if (metadata.scannerId) {
                scannerStr += (scannerStr ? ' - ' : '') + metadata.scannerId;
            }
            scannerValue.textContent = scannerStr;
        }
    }
    
    // Display file size if available
    if (metadata.fileSizeBytes) {
        var sizeContainer = document.getElementById('metadata-filesize');
        var sizeValue = document.getElementById('metadata-filesize-value');
        if (sizeContainer && sizeValue) {
            sizeContainer.style.display = 'flex';
            var sizeMB = (metadata.fileSizeBytes / (1024 * 1024)).toFixed(2);
            sizeValue.textContent = sizeMB + ' MB';
        }
    }
    
    console.log("Metadata display updated successfully");
}

// Also add this helper function to format file sizes nicely
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    var k = 1024;
    var sizes = ['Bytes', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function applyImageFilters() {
    const brightness = document.getElementById('brightness').value;
    const contrast = document.getElementById('contrast').value;
    const saturation = document.getElementById('saturation').value;
    
    const filterString = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    
    // Apply to all OpenSeadragon canvas elements
    var contentId = CONTENT_ID || '_CONTENTID_';
    const canvases = document.querySelectorAll('#' + contentId + ' canvas');
    canvases.forEach(canvas => {
        canvas.style.filter = filterString;
    });
    
    // Also apply to any tile images that might load later
    const tileImages = document.querySelectorAll('#' + contentId + ' img');
    tileImages.forEach(img => {
        img.style.filter = filterString;
    });
    
    console.log('Applied filters:', filterString);
}

function resetImageControls() {
    // Reset sliders to default values
    document.getElementById('brightness').value = 100;
    document.getElementById('contrast').value = 100;
    document.getElementById('saturation').value = 100;
    
    // Update display values
    document.querySelectorAll('.slider-value').forEach(span => {
        span.textContent = '100%';
    });
    
    // Apply the reset filters
    applyImageFilters();
    
    console.log('Image controls reset to default');
}

// Initialize ViewerHash
var ViewerHash = new Object();

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const exportBtn = document.querySelector('.export-btn-container');
    const dropdown = document.getElementById('exportDropdown');
    if (exportBtn && dropdown && !exportBtn.contains(event.target)) {
        dropdown.style.display = 'none';
    }
});

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    SyncThemAll();
    
    // Initialize configuration from page context if available
    if (typeof window.polyscopeConfig !== 'undefined') {
        ANNOTATIONS_PATH = window.polyscopeConfig.annotationsPath;
        PATIENT_ID = window.polyscopeConfig.patientId;
        CHANNEL_ID = window.polyscopeConfig.channelId;
        CONTENT_ID = window.polyscopeConfig.contentId;
        VIEWER_VARNAME = window.polyscopeConfig.viewerVarName;
    }
    
    console.log('Main.js initialized with config:', {
        ANNOTATIONS_PATH: ANNOTATIONS_PATH,
        PATIENT_ID: PATIENT_ID,
        CHANNEL_ID: CHANNEL_ID,
        CONTENT_ID: CONTENT_ID,
        VIEWER_VARNAME: VIEWER_VARNAME
    });

    if (VIEWER_VARNAME && window[VIEWER_VARNAME]) {
        viewer = window[VIEWER_VARNAME];
    }
});

// Annotation
function showDeleteModal(name, onConfirm) {
    // Remove existing modal if one is already open
    const existing = document.getElementById('annotation-delete-modal');
    if (existing) existing.remove();

    // Build modal HTML
    const modalHTML = `
        <div class="annotation-delete-modal show" id="annotation-delete-modal">
            <div class="annotation-delete-modal-content">
                <div class="annotation-delete-modal-header">
                    <h3>Delete Annotation</h3>
                    <button class="annotation-delete-modal-close" onclick="document.getElementById('annotation-delete-modal').remove()">&times;</button>
                </div>
                <div class="annotation-delete-modal-body">
                    <p>Are you sure you want to delete <strong>${name}</strong>?</p>
                </div>
                <div class="annotation-delete-modal-actions">
                    <button class="annotation-delete-modal-confirm">Yes</button>
                    <button class="annotation-delete-modal-cancel">No</button>
                </div>
            </div>
        </div>
    `;

    // Add to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.getElementById('annotation-delete-modal');

    // Wire up buttons
    modal.querySelector('.annotation-delete-modal-cancel')
        .addEventListener('click', () => modal.remove());
    modal.querySelector('.annotation-delete-modal-close')
        .addEventListener('click', () => modal.remove());
    modal.querySelector('.annotation-delete-modal-confirm')
        .addEventListener('click', () => {
            if (typeof onConfirm === 'function') onConfirm();
            modal.remove();
        });
}
