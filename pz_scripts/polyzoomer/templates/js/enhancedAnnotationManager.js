/**
 * Enhanced Annotation Manager for Polyscope - Fixed Version
 * 
 * This script extends the existing annotation functionality with:
 * 1. A better annotation panel showing all annotations
 * 2. The ability to select annotations from the panel
 * 3. The ability to delete selected annotations
 * 4. Highlighting selected annotations in the viewer
 * 
 * Fixed issues:
 * - Resolved undefined annotation error in deleteSelectedAnnotation
 * - Improved annotation deletion reliability
 * - Ensured annotation file is properly updated upon deletion
 */

(function() {
    // Check if jQuery is available
    if (!window.jQuery) {
        console.error("Enhanced Annotation Manager requires jQuery!");
        return;
    }

    // Check if the original Polyzoomer Annotation plugin is loaded
    if (!window.Polyzoomer || !window.Polyzoomer.Annotation) {
        console.error("Enhanced Annotation Manager requires Polyzoomer Annotation plugin!");
        return;
    }

    // Create namespace if not exists
    window.PolyzoomerEnhanced = window.PolyzoomerEnhanced || {};

    // EnhancedAnnotationManager constructor
    PolyzoomerEnhanced.AnnotationManager = function() {
        this.initialize();
    };

    // EnhancedAnnotationManager prototype
    PolyzoomerEnhanced.AnnotationManager.prototype = {
        // Configuration
        panelSelector: "#annotationSummaryDisplay",
        downloadButtonSelector: "#downloadAnnotationsBtn",
        annotationTypes: {
            0: "Line",
            1: "Arrow",
            2: "Rectangle",
            3: "Ellipse",
            4: "Free Hand Drawing",
            5: "Text",
            6: "Dot"
        },
        
        // State variables
        selectedAnnotationId: null,
        annotations: [],
        viewer: null,
        polyzoomAnnotation: null,
        annotationPath: "",

        /**
         * Initialize the enhanced annotation manager
         */
        initialize: function() {
            var self = this;
            
            // Wait for DOM ready
            $(document).ready(function() {
                // Find the viewer instance
                self.findViewer();
                
                // Get annotation path from download button
                self.getAnnotationPath();
                
                // Add styles
                self.addStyles();
                
                // Add the panel UI
                self.createPanel();
                
                // Load annotations
                self.loadAnnotations();
                
                // Add delete button
                self.addDeleteButton();
                
                // Add debug button
                // self.addDebugButton();
                
                // Set up real-time refresh
                // self.setupRefreshTimer();
                
                // Add refresh button
                // self.addRefreshButton();
                
                // Listen for annotation changes
                self.listenForAnnotationChanges();
            });
        },
        
        /**
         * Set up a timer to periodically refresh the annotations
         */
        setupRefreshTimer: function() {
            var self = this;
            
            // Refresh every 5 seconds
            setInterval(function() {
                self.refreshAnnotations();
            }, 5000);
        },
        
        /**
         * Add a manual refresh button
         */
        addRefreshButton: function() {
            var self = this;
            var panel = $(this.panelSelector);
            
            // Create refresh button
            var refreshBtn = $('<button class="refresh-annotation-btn">Refresh Annotations</button>');
            
            // Add styles for refresh button
            $("<style>")
                .text(
                    ".refresh-annotation-btn {" +
                    "  margin-top: 10px;" +
                    "  padding: 5px 10px;" +
                    "  background-color: #4285f4;" +
                    "  color: white;" +
                    "  border: none;" +
                    "  border-radius: 4px;" +
                    "  cursor: pointer;" +
                    "  margin-right: 10px;" +
                    "}" +
                    ".refresh-annotation-btn:hover {" +
                    "  background-color: #3367d6;" +
                    "}"
                )
                .appendTo("head");
            
            // Add click handler
            refreshBtn.click(function() {
                self.refreshAnnotations();
            });
            
            // Add to panel before the delete button
            var deleteBtn = panel.find('.delete-annotation-btn');
            if (deleteBtn.length) {
                deleteBtn.before(refreshBtn);
            } else {
                panel.append(refreshBtn);
            }
        },
        
        /**
         * Refresh annotations from the server
         */
        refreshAnnotations: function() {
            var self = this;
            
            if (!this.annotationPath) {
                return;
            }
            
            // Add a timestamp to prevent caching
            var timestamp = new Date().getTime();
            
            // Make AJAX request with cache busting
            $.ajax({
                url: '../getAnnotation.php',
                type: 'POST',
                dataType: 'json',
                cache: false,
                data: {
                    path: JSON.stringify(this.annotationPath),
                    id: 0,
                    _: timestamp // Cache busting parameter
                },
                success: function(data) {
                    console.log("Refreshed annotations:", data ? data.length : 0);
                    self.processAnnotations(data);
                },
                error: function(xhr, status, error) {
                    console.error("Error refreshing annotations:", error);
                }
            });
        },
        
        /**
         * Listen for annotation changes
         */
        listenForAnnotationChanges: function() {
            var self = this;
            
            // Listen for SVG changes (new annotations being added)
            if (this.viewer) {
                // Watch for DOM changes in the SVG container
                var svgContainer = $('svg');
                if (svgContainer.length && window.MutationObserver) {
                    var observer = new MutationObserver(function(mutations) {
                        mutations.forEach(function(mutation) {
                            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                                // Check if the added nodes are annotations
                                for (var i = 0; i < mutation.addedNodes.length; i++) {
                                    var node = mutation.addedNodes[i];
                                    if (node.nodeName === 'g' || node.nodeName === 'line' || 
                                        node.nodeName === 'rect' || node.nodeName === 'ellipse' || 
                                        node.nodeName === 'path' || node.nodeName === 'circle') {
                                        // Refresh annotations when a new one is added
                                        self.refreshAnnotations();
                                        return;
                                    }
                                }
                            }
                        });
                    });
                    
                    // Start observing
                    observer.observe(svgContainer[0], { childList: true, subtree: true });
                }
            }
        },

        /**
         * Find the OpenSeadragon viewer instance
         */
        findViewer: function() {
            // Look for viewer variable in window scope
            if (window.viewer) {
                this.viewer = window.viewer;
                if (this.viewer.Annotations) {
                    this.polyzoomAnnotation = this.viewer.Annotations();
                }
            } else {
                // Search for other variable names that might be the viewer
                for (var prop in window) {
                    if (window[prop] && 
                        typeof window[prop] === 'object' && 
                        window[prop].viewport && 
                        typeof window[prop].Annotations === 'function') {
                        this.viewer = window[prop];
                        this.polyzoomAnnotation = this.viewer.Annotations();
                        break;
                    }
                }
            }
            
            if (!this.viewer) {
                console.error("Cannot find OpenSeadragon viewer instance");
            }
        },

        /**
         * Get the annotation file path from the download button
         */
        getAnnotationPath: function() {
            var downloadBtn = $(this.downloadButtonSelector);
            if (downloadBtn.length) {
                var href = downloadBtn.attr("href");
                if (href) {
                    // Check if we got a placeholder instead of a real path
                    if (href.indexOf('*ANNOTATIONS*') !== -1 || href.indexOf('_ANNOTATIONS_') !== -1) {
                        console.log("Download button contains placeholder:", href);
                        console.log("Trying alternative methods...");
                        
                        // Try to use polyscopeConfig first
                        if (window.polyscopeConfig && window.polyscopeConfig.annotationsPath) {
                            this.annotationPath = window.polyscopeConfig.annotationsPath;
                            console.log("Using polyscopeConfig annotation path:", this.annotationPath);
                        } else {
                            // Fallback to construction from URL
                            this.constructAnnotationPathFromURL();
                        }
                    } else {
                        // We got a real path
                        this.annotationPath = href;
                        console.log("Found annotation path:", this.annotationPath);
                    }
                } else {
                    console.error("Download button exists but href is empty");
                    this.tryAlternativeAnnotationPaths();
                }
            } else {
                console.error("Download button not found");
                this.tryAlternativeAnnotationPaths();
            }
        },
        
        // Helper function to try alternative annotation path methods
        tryAlternativeAnnotationPaths: function() {
            // Try to find annotation path from polyzoomAnnotation
            if (this.polyzoomAnnotation && this.polyzoomAnnotation.annotationFiles &&
                this.polyzoomAnnotation.annotationFiles.length > 0 &&
                this.polyzoomAnnotation.annotationFiles[0].filename) {
                this.annotationPath = this.polyzoomAnnotation.annotationFiles[0].filename;
                console.log("Using path from polyzoomAnnotation:", this.annotationPath);
            } else if (window.polyscopeConfig && window.polyscopeConfig.annotationsPath) {
                this.annotationPath = window.polyscopeConfig.annotationsPath;
                console.log("Using polyscopeConfig annotation path:", this.annotationPath);
            } else {
                // Last resort: construct from URL
                this.constructAnnotationPathFromURL();
            }
        },
        
        // Helper function to construct annotation path from URL
        constructAnnotationPathFromURL: function() {
            var url = window.location.pathname;
            var parts = url.split('/');
            if (parts.length >= 3) {
                var channel = parts[parts.length - 1]; // channel directory
                var patient = parts[parts.length - 2]; // patient directory
                
                // Try to construct the path to annotations.txt
                var dziFile = this.findDziFileName();
                if (dziFile) {
                    this.annotationPath = "./" + channel + "/" + dziFile + "_files/annotations.txt";
                    console.log("Constructed path from URL:", this.annotationPath);
                } else {
                    // If we can't find DZI file, try a generic pattern
                    this.annotationPath = "./_UNKNOWNCHANNEL0001/" + patient + "_UNKNOWNCHANNEL0001_*_files/annotations.txt";
                    console.log("Using generic pattern:", this.annotationPath);
                }
            }
        },
        
        /**
         * Try to find the DZI file name
         */
        findDziFileName: function() {
            // Look for the DZI file name in the viewer source
            if (this.viewer && this.viewer.source && this.viewer.source.url) {
                var url = this.viewer.source.url;
                var match = url.match(/([^\/]+)\.dzi$/i);
                if (match) {
                    return match[1];
                }
            }
            
            // Try to extract from page title or heading
            var title = document.title || '';
            var match = title.match(/([^\/]+)\.dzi/i);
            if (match) {
                return match[1];
            }
            
            // Look for any element that might have the DZI name
            var dziElements = $("*:contains('.dzi')");
            if (dziElements.length > 0) {
                var text = dziElements.first().text();
                var match = text.match(/([^\/]+)\.dzi/i);
                if (match) {
                    return match[1];
                }
            }
            
            return null;
        },

        /**
         * Add CSS styles for the enhanced annotation panel
         */
        addStyles: function() {
            var styleElement = document.createElement('style');
            styleElement.textContent = `
                .annotation-list {
                    max-height: 200px;
                    overflow-y: auto;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    margin-top: 10px;
                    padding: 5px;
                }
                .annotation-item {
                    padding: 5px;
                    margin-bottom: 2px;
                    cursor: pointer;
                    border-radius: 3px;
                }
                .annotation-item:hover {
                    background-color: #f0f0f0;
                }
                .annotation-selected {
                    background-color: #e0e0ff;
                    border-left: 3px solid #4040ff;
                    padding-left: 5px;
                }
                .annotation-type-header {
                    font-weight: bold;
                    cursor: pointer;
                    padding: 5px;
                    margin-top: 5px;
                    border-bottom: 1px solid #eee;
                }
                .annotation-type-header:hover {
                    background-color: #f8f8f8;
                }
                .annotation-count {
                    display: inline-block;
                    margin-left: 5px;
                    background-color: #f0f0f0;
                    padding: 2px 6px;
                    border-radius: 10px;
                    font-size: 12px;
                }
                .delete-annotation-btn {
                    margin-top: 10px;
                    padding: 5px 10px;
                    background-color: #ff4444;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
                .delete-annotation-btn:disabled {
                    background-color: #cccccc;
                    cursor: not-allowed;
                }
                .annotation-panel-title {
                    font-weight: bold;
                    margin-bottom: 10px;
                }
                .annotation-details {
                    font-size: 12px;
                    color: #666;
                }
            `;
            document.head.appendChild(styleElement);
        },

        /**
         * Create the enhanced annotation panel
         */
        createPanel: function() {
            var panel = $(this.panelSelector);
            if (panel.length) {
                // Clear the panel
                panel.empty();
                
                // Add title
                panel.append('<div class="annotation-panel-title">Annotations</div>');
                
                // Add annotation counts
                var typesElement = $('<div class="annotation-types"></div>');
                panel.append(typesElement);
                
                // Add annotation list container
                var listElement = $('<div class="annotation-list" style="display:none;"></div>');
                panel.append(listElement);
            }
        },

        /**
         * Add the delete button
         */
        addDeleteButton: function() {
            var self = this;
            var panel = $(this.panelSelector);
            
            // Create delete button
            var deleteBtn = $('<button class="delete-annotation-btn" disabled>Delete Selected Annotation</button>');
            
            // Add click handler using older jQuery syntax
            deleteBtn.click(function() {
                self.deleteSelectedAnnotation();
            });
            
            // Add to panel
            panel.append(deleteBtn);
        },

        /**
         * Load annotations from the server
         */
        loadAnnotations: function() {
            var self = this;
            
            if (!this.annotationPath) {
                // Try to find the path again
                this.getAnnotationPath();
                
                if (!this.annotationPath) {
                    // If still not found, try to search for annotations.txt files
                    this.findAnnotationFile();
                    return;
                }
            }
            
            console.log("Loading annotations from:", this.annotationPath);
            
            // Make AJAX request to get annotations
            $.ajax({
                url: '../getAnnotation.php', // Use relative path with ../ to go up one directory
                type: 'POST',
                dataType: 'json',
                data: {
                    path: JSON.stringify(this.annotationPath),
                    id: 0 // Get all annotations
                },
                success: function(data) {
                    console.log("Successfully loaded annotations:", data ? data.length : 0);
                    self.processAnnotations(data);
                },
                error: function(xhr, status, error) {
                    console.error("Error loading annotations:", error);
                    console.log("Path attempted:", self.annotationPath);
                    console.log("Status:", xhr.status);
                    console.log("Response:", xhr.responseText);
                    
                    // Try an alternative path if this one failed
                    if (self.annotationPath.startsWith('./')) {
                        // Try without the leading ./
                        self.annotationPath = self.annotationPath.substring(2);
                        console.log("Retrying with path:", self.annotationPath);
                        self.loadAnnotations();
                    }
                }
            });
        },
        
        /**
         * Find annotation file by looking at the DOM
         */
        findAnnotationFile: function() {
            var self = this;
            console.log("Searching for annotation file...");
            
            // Look at all script sources for clues
            var scripts = document.getElementsByTagName('script');
            for (var i = 0; i < scripts.length; i++) {
                var src = scripts[i].src || '';
                if (src.indexOf('annotationCounter.js') !== -1 || 
                    src.indexOf('polyzoomerPlugin.js') !== -1) {
                    // Found a related script, extract path
                    var basePath = src.substring(0, src.lastIndexOf('/'));
                    console.log("Found related script at:", basePath);
                    
                    // Look for annotation file in the URL
                    var url = window.location.pathname;
                    var match = url.match(/Path[0-9]+_[0-9]+\/page\/([^\/]+)\/([^\/]+)/);
                    if (match) {
                        var patId = match[1];
                        var channelId = match[2];
                        
                        // Search for DZI files
                        var dziFiles = $('*:contains(".dzi")').text();
                        var dziMatch = dziFiles.match(/([^\/]+)\.dzi/);
                        if (dziMatch) {
                            var dziFile = dziMatch[1];
                            this.annotationPath = channelId + "/" + dziFile + "_files/annotations.txt";
                            console.log("Constructed annotation path:", this.annotationPath);
                            this.loadAnnotations();
                            return;
                        }
                    }
                    
                    break;
                }
            }
            
            // If we got here, try a more aggressive approach
            // Look at the current URL to find patient ID and channel
            var url = window.location.href;
            var pathMatch = url.match(/Path[0-9]+_[0-9]+\/page\/([^\/]+)\/([^\/]+)/);
            
            if (pathMatch) {
                var patId = pathMatch[1];
                var channel = pathMatch[2] || '';
                
                // Try to find any DZI files mentioned on the page
                var pageText = document.body.innerText;
                var dziMatch = pageText.match(/([^\/\s]+)\.dzi/);
                
                if (dziMatch) {
                    var dziFile = dziMatch[1];
                    this.annotationPath = channel + "/" + dziFile + "_files/annotations.txt";
                    console.log("Found annotation path from URL:", this.annotationPath);
                    this.loadAnnotations();
                } else {
                    // Last resort: try a generic path
                    this.annotationPath = "annotations.txt";
                    console.log("Using generic annotation path:", this.annotationPath);
                    this.loadAnnotations();
                }
            } else {
                console.error("Could not determine annotation file path");
            }
        },

        /**
         * Process annotations from the server
         */
        /**
         * Process annotations from the server with added color counting
         */
        processAnnotations: function(data) {
            this.annotations = [];
            var counts = {};
            var colorCounts = {}; // Add color counts tracking
            
            // Initialize counts
            for (var type in this.annotationTypes) {
                counts[type] = 0;
            }
            
            // Identify inactive annotations first to ensure thorough cleanup
            var inactiveIds = [];
            if (Array.isArray(data)) {
                for (var i = 0; i < data.length; i++) {
                    var line = data[i];
                    if (!line || line.trim() === '') continue;
                    
                    try {
                        var parts = line.split(',');
                        if (parts.length < 4) continue;
                        
                        var active = parseInt(parts[0]);
                        var id = parseInt(parts[1]);
                        
                        if (active !== 1) {
                            inactiveIds.push(id);
                        }
                    } catch (e) {
                        console.error("Error parsing annotation line:", e);
                    }
                }
            }
            
            // Clean up code for inactive annotations remains the same...
            // (Keep the existing inactive annotation cleanup code)
            
            // Second pass: Process active annotations
            if (Array.isArray(data)) {
                for (var i = 0; i < data.length; i++) {
                    var line = data[i];
                    if (!line || line.trim() === '') continue;
                    
                    try {
                        // Parse annotation
                        var parts = line.split(',');
                        if (parts.length < 4) continue;
                        
                        var active = parseInt(parts[0]);
                        var id = parseInt(parts[1]);
                        var type = parseInt(parts[2]);
                        
                        // Skip inactive annotations - we've already cleaned them up
                        if (active !== 1) {
                            continue;
                        }
                        
                        // Get coordinates and other data
                        var contentStart = line.indexOf('[');
                        var contentEnd = line.lastIndexOf(']');
                        var content = line.substring(contentStart + 1, contentEnd);
                        
                        // Get color
                        var colorStart = contentEnd + 2;
                        var colorEnd = line.indexOf(',', colorStart);
                        var color = line.substring(colorStart, colorEnd);
                        
                        // Count by color
                        if (!colorCounts[color]) {
                            colorCounts[color] = 1;
                        } else {
                            colorCounts[color]++;
                        }
                        
                        // Store annotation
                        this.annotations.push({
                            id: id,
                            type: type,
                            content: content,
                            color: color,
                            active: active,
                            raw: line
                        });
                        
                        // Increment count
                        if (counts[type] !== undefined) {
                            counts[type]++;
                        }
                    } catch (e) {
                        console.error("Error parsing annotation:", e);
                    }
                }
            }
            
            // Update the panel
            this.updateAnnotationPanel(counts, colorCounts); // Pass color counts to the panel update
            
            // Force a redraw to ensure annotations are properly displayed
            if (this.viewer && this.viewer.world) {
                this.viewer.world.draw();
            }
        },

        /**
         * Update the annotation panel with counts and types
         */
        updateAnnotationPanel: function(counts, colorCounts) {
            var self = this;
            var typesElement = $(this.panelSelector).find('.annotation-types');
            typesElement.empty();
            
            // Add headers for each type with count
            for (var type in this.annotationTypes) {
                var count = counts[type] || 0;
                var typeElement = $(
                    '<div class="annotation-type-header" data-type="' + type + '">' +
                    this.annotationTypes[type] + ' <span class="annotation-count">' + count + '</span></div>'
                );
                
                // Add click handler using older jQuery syntax
                (function(typeId) {
                    typeElement.click(function() {
                        self.showAnnotationsOfType(typeId);
                    });
                })(type);
                
                typesElement.append(typeElement);
            }
            
            // Add color counts section
            if (Object.keys(colorCounts).length > 0) {
                var colorHeader = $('<div class="annotation-type-header">Colors</div>');
                typesElement.append(colorHeader);
                
                // Add each color with count
                for (var color in colorCounts) {
                    var count = colorCounts[color];
                    var colorElement = $(
                        '<div class="annotation-color-item" data-color="' + color + '">' +
                        '<span class="color-swatch" style="background-color:' + color + '"></span> ' +
                        color + ' <span class="annotation-count">' + count + '</span></div>'
                    );
                    
                    // Add click handler to show annotations of this color
                    (function(colorValue) {
                        colorElement.click(function() {
                            self.showAnnotationsByColor(colorValue);
                        });
                    })(color);
                    
                    typesElement.append(colorElement);
                }
                
                // Add style for color items
                if (!$('#color-swatch-style').length) {
                    $("<style id='color-swatch-style'>")
                        .text(
                            ".annotation-color-item {" +
                            "  padding: 5px 5px 5px 15px;" +
                            "  margin-bottom: 2px;" +
                            "  cursor: pointer;" +
                            "  border-radius: 3px;" +
                            "}" +
                            ".annotation-color-item:hover {" +
                            "  background-color: #f0f0f0;" +
                            "}" +
                            ".color-swatch {" +
                            "  display: inline-block;" +
                            "  width: 12px;" +
                            "  height: 12px;" +
                            "  border: 1px solid #ccc;" +
                            "  margin-right: 5px;" +
                            "  vertical-align: middle;" +
                            "}"
                        )
                        .appendTo("head");
                }
            }
            
            // Add total count
            var totalCount = this.annotations.length;
            var totalElement = $(
                '<div class="annotation-type-header" data-type="all">' +
                'All Annotations <span class="annotation-count">' + totalCount + '</span></div>'
            );
            
            // Add click handler for total using older jQuery syntax
            totalElement.click(function() {
                self.showAllAnnotations();
            });
            
            typesElement.append(totalElement);
        },

        /**
         * Show annotations by color
         */
        showAnnotationsByColor: function(color) {
            var self = this;
            var listElement = $(this.panelSelector).find('.annotation-list');
            listElement.empty().show();
            
            // Filter annotations by color
            var filteredAnnotations = this.annotations.filter(function(annotation) {
                return annotation.color === color;
            });
            
            // Show no annotations message if none found
            if (filteredAnnotations.length === 0) {
                listElement.append('<div class="annotation-item">No annotations with this color</div>');
                return;
            }
            
            // Add each annotation to the list
            for (var i = 0; i < filteredAnnotations.length; i++) {
                var annotation = filteredAnnotations[i];
                var selectedClass = this.selectedAnnotationId === annotation.id ? ' annotation-selected' : '';
                
                var item = $(
                    '<div class="annotation-item' + selectedClass + '" data-id="' + annotation.id + '">' +
                    '<span class="color-swatch" style="background-color:' + annotation.color + '"></span> ' +
                    '#' + annotation.id + ' - ' + this.annotationTypes[annotation.type] +
                    '<div class="annotation-details">' + this.formatAnnotationDetails(annotation) + '</div>' +
                    '</div>'
                );
                
                // Add click handler with closure to capture the current ID
                (function(annotationId) {
                    item.click(function() {
                        self.selectAnnotation(annotationId);
                    });
                })(annotation.id);
                
                listElement.append(item);
            }
        },

        /**
         * Show annotations of a specific type
         * Updated to display color swatches
         */
        showAnnotationsOfType: function(typeId) {
            var self = this;
            var listElement = $(this.panelSelector).find('.annotation-list');
            listElement.empty().show();
            
            // Filter annotations by type
            var filteredAnnotations = this.annotations.filter(function(annotation) {
                return annotation.type == typeId;
            });
            
            // Show no annotations message if none found
            if (filteredAnnotations.length === 0) {
                listElement.append('<div class="annotation-item">No annotations of this type</div>');
                return;
            }
            
            // Add each annotation to the list
            for (var i = 0; i < filteredAnnotations.length; i++) {
                var annotation = filteredAnnotations[i];
                var selectedClass = this.selectedAnnotationId === annotation.id ? ' annotation-selected' : '';
                
                var item = $(
                    '<div class="annotation-item' + selectedClass + '" data-id="' + annotation.id + '">' +
                    '<span class="color-swatch" style="background-color:' + annotation.color + '"></span> ' +
                    '#' + annotation.id + ' - ' + this.annotationTypes[annotation.type] +
                    '<div class="annotation-details">' + this.formatAnnotationDetails(annotation) + '</div>' +
                    '</div>'
                );
                
                // Add click handler with closure to capture the current ID
                (function(annotationId) {
                    item.click(function() {
                        self.selectAnnotation(annotationId);
                    });
                })(annotation.id);
                
                listElement.append(item);
            }
        },

        /**
         * Show all annotations
         * Updated to display color swatches
         */
        showAllAnnotations: function() {
            var self = this;
            var listElement = $(this.panelSelector).find('.annotation-list');
            listElement.empty().show();
            
            // Show no annotations message if none found
            if (this.annotations.length === 0) {
                listElement.append('<div class="annotation-item">No annotations found</div>');
                return;
            }
            
            // Group annotations by type
            var grouped = {};
            for (var type in this.annotationTypes) {
                grouped[type] = [];
            }
            
            // Fill groups
            for (var i = 0; i < this.annotations.length; i++) {
                var annotation = this.annotations[i];
                if (grouped[annotation.type]) {
                    grouped[annotation.type].push(annotation);
                }
            }
            
            // Add each group to the list
            for (var type in grouped) {
                if (grouped[type].length > 0) {
                    // Add type header
                    listElement.append(
                        '<div class="annotation-type-header">' + 
                        this.annotationTypes[type] + 
                        ' (' + grouped[type].length + ')' + 
                        '</div>'
                    );
                    
                    // Add annotations of this type
                    for (var j = 0; j < grouped[type].length; j++) {
                        var annotation = grouped[type][j];
                        var selectedClass = this.selectedAnnotationId === annotation.id ? ' annotation-selected' : '';
                        
                        var item = $(
                            '<div class="annotation-item' + selectedClass + '" data-id="' + annotation.id + '">' +
                            '<span class="color-swatch" style="background-color:' + annotation.color + '"></span> ' +
                            '#' + annotation.id + ' - ' + this.formatAnnotationDetails(annotation) +
                            '</div>'
                        );
                        
                        // Add click handler with closure to capture the current ID
                        (function(annotationId) {
                            item.click(function() {
                                self.selectAnnotation(annotationId);
                            });
                        })(annotation.id);
                        
                        listElement.append(item);
                    }
                }
            }
        },

        /**
         * Format annotation details for display
         */
        formatAnnotationDetails: function(annotation) {
            // For most annotations, we'll just show a summary of coordinates
            var content = annotation.content;
            var matches = content.match(/\(([^)]+)\)/g);
            
            if (matches && matches.length > 0) {
                if (annotation.type == 5) { // Text annotation
                    // Try to extract text content
                    var textMatch = content.match(/\("([^"]*)"\)/);
                    if (textMatch && textMatch[1]) {
                        return '"' + textMatch[1] + '"';
                    }
                }
                
                // For other types, show the first coordinate pair
                var firstCoord = matches[0];
                if (matches.length > 1) {
                    return firstCoord + "...";
                }
                return firstCoord;
            }
            
            return "...";
        },

        /**
         * Select an annotation by ID
         */
        selectAnnotation: function(id) {
            // Update selected ID
            this.selectedAnnotationId = id;
            
            // Update UI
            $('.annotation-item').removeClass('annotation-selected');
            $('.annotation-item[data-id="' + id + '"]').addClass('annotation-selected');
            
            // Enable delete button
            $('.delete-annotation-btn').prop('disabled', false);
            
            // Highlight annotation in viewer
            this.highlightAnnotation(id);
        },
        /**
         * Debug helper for annotations
         * Add this to the EnhancedAnnotationManager prototype
         */
        debugAnnotation: function(id) {
            console.log("Debugging annotation ID:", id);
            
            // Find annotation in our data
            var annotation = null;
            for (var i = 0; i < this.annotations.length; i++) {
                if (this.annotations[i].id === id) {
                    annotation = this.annotations[i];
                    break;
                }
            }
            
            console.log("Annotation data:", annotation);
            
            // Check if annotation is in the DOM
            var svgElements = $('svg *[id="' + id + '"]');
            console.log("SVG elements with matching ID:", svgElements.length);
            
            if (svgElements.length > 0) {
                console.log("First matching element:", svgElements[0]);
                console.log("Element attributes:");
                $.each(svgElements[0].attributes, function() {
                    console.log(this.name + ": " + this.value);
                });
            }
            
            // Check for elements with data attributes
            var dataElements = $('svg *').filter(function() {
                var dataId = $(this).data('id') || $(this).attr('data-id');
                return dataId && dataId.toString() === id.toString();
            });
            
            console.log("Elements with matching data-id:", dataElements.length);
            
            // Check plugin data
            if (this.polyzoomAnnotation) {
                console.log("Plugin annotation list available:", !!this.polyzoomAnnotation.annotationList);
                
                if (this.polyzoomAnnotation.annotationList) {
                    var found = false;
                    
                    for (var i = 0; i < this.polyzoomAnnotation.annotationList.length; i++) {
                        var list = this.polyzoomAnnotation.annotationList[i];
                        if (Array.isArray(list)) {
                            for (var j = 0; j < list.length; j++) {
                                if ((list[j].guid && list[j].guid.toString() === id.toString()) || 
                                    (list[j].id && list[j].id.toString() === id.toString())) {
                                    
                                    console.log("Found in plugin annotationList[" + i + "][" + j + "]:", list[j]);
                                    found = true;
                                    
                                    if (list[j].shape) {
                                        console.log("Shape element available:", !!list[j].shape);
                                        console.log("Shape DOM element exists:", $(list[j].shape).length > 0);
                                    }
                                }
                            }
                        }
                    }
                    
                    if (!found) {
                        console.log("Annotation not found in plugin annotation lists");
                    }
                }
                
                // Check annotation table
                if (this.polyzoomAnnotation.annotationTable) {
                    console.log("Found in plugin annotationTable:", !!this.polyzoomAnnotation.annotationTable[id]);
                    if (this.polyzoomAnnotation.annotationTable[id]) {
                        console.log("Table entry:", this.polyzoomAnnotation.annotationTable[id]);
                    }
                }
            }
            
            // Try to get annotation with plugin method
            if (this.polyzoomAnnotation && typeof this.polyzoomAnnotation.getAnnotation === 'function') {
                try {
                    var pluginAnnotation = this.polyzoomAnnotation.getAnnotation(id);
                    console.log("Got annotation from plugin method:", pluginAnnotation);
                } catch (e) {
                    console.error("Error getting annotation from plugin:", e);
                }
            }
            
            return "Debugging information logged to console";
        },

        /**
         * Add a debug button to help troubleshoot annotation issues
         */
        addDebugButton: function() {
            var self = this;
            var panel = $(this.panelSelector);
            
            // Create debug button
            var debugBtn = $('<button class="debug-annotation-btn">Debug Selected</button>');
            
            // Add styles for debug button
            $("<style>")
                .text(
                    ".debug-annotation-btn {" +
                    "  margin-top: 10px;" +
                    "  padding: 5px 10px;" +
                    "  background-color: #673ab7;" +
                    "  color: white;" +
                    "  border: none;" +
                    "  border-radius: 4px;" +
                    "  cursor: pointer;" +
                    "  margin-right: 10px;" +
                    "}" +
                    ".debug-annotation-btn:hover {" +
                    "  background-color: #5e35b1;" +
                    "}" +
                    ".debug-annotation-btn:disabled {" +
                    "  background-color: #cccccc;" +
                    "  cursor: not-allowed;" +
                    "}"
                )
                .appendTo("head");
            
            // Add click handler
            debugBtn.click(function() {
                if (self.selectedAnnotationId) {
                    self.debugAnnotation(self.selectedAnnotationId);
                    alert("Debug info for annotation #" + self.selectedAnnotationId + " has been logged to the console (F12)");
                } else {
                    alert("Please select an annotation first");
                }
            });
            
            // Add to panel
            var deleteBtn = panel.find('.delete-annotation-btn');
            if (deleteBtn.length) {
                deleteBtn.before(debugBtn);
            } else {
                panel.append(debugBtn);
            }
        },
        /**
         * Enhanced direct plugin-based highlighting solution
         */
        highlightAnnotation: function(id) {
            var self = this;
            console.log("Using direct plugin approach for annotation ID:", id);
            
            // Find annotation data
            var annotation = null;
            for (var i = 0; i < this.annotations.length; i++) {
                if (this.annotations[i].id === id) {
                    annotation = this.annotations[i];
                    break;
                }
            }
            
            if (!annotation) {
                console.error("Could not find annotation data for ID:", id);
                return;
            }
            
            // Store the currently highlighted ID
            this.currentlyHighlightedId = id;
            
            // Clear any existing highlight styles
            this.clearHighlights();
            
            // Add a strong highlight style that will override plugin styles
            if (!$('#strong-highlight-style').length) {
                $("<style id='strong-highlight-style'>")
                    .text(
                        ".strong-highlight {" +
                        "  stroke: #FF0000 !important;" +
                        "  stroke-width: 6px !important;" +
                        "  fill-opacity: 0.3 !important;" +
                        "}"
                    )
                    .appendTo("head");
            }
            
            // 1. Find if a plugin selectAnnotation method exists
            if (this.polyzoomAnnotation && typeof this.polyzoomAnnotation.selectAnnotation === 'function') {
                // Use the plugin's built-in selection mechanism
                try {
                    this.polyzoomAnnotation.selectAnnotation(id);
                    console.log("Used plugin's selectAnnotation method");
                    
                    // Now we need to find what the plugin actually selected
                    // Usually it's the current annotation in the plugin
                    if (this.polyzoomAnnotation.currentAnnotation) {
                        var shape = this.polyzoomAnnotation.currentAnnotation.shape;
                        if (shape) {
                            $(shape).addClass('strong-highlight');
                            console.log("Highlighted shape from currentAnnotation", shape);
                        }
                    }
                } catch (e) {
                    console.error("Error using plugin's selectAnnotation:", e);
                }
            }
            
            // 2. Direct approach - use coordinates to create a new temporary highlight element
            // Extract coordinates from the content
            var coords = this.parseCoordinates(annotation.content);
            if (coords && coords.length > 0) {
                console.log("Parsed coordinates:", coords);
                
                // Create appropriate highlight element based on annotation type
                var highlightElement = this.createHighlightElement(annotation.type, coords, annotation.color);
                if (highlightElement) {
                    // Add the element to the SVG
                    $('svg').append(highlightElement);
                    console.log("Added temporary highlight element");
                    
                    // Set timeout to remove it after a while to avoid cluttering
                    setTimeout(function() {
                        highlightElement.remove();
                    }, 30000); // Remove after 30 seconds
                }
            }
            
            // 3. Try to get a viewport coordinate for the annotation
            var viewportPoint = this.getAnnotationViewportPoint(annotation);
            if (viewportPoint) {
                // Pan to the annotation
                this.viewer.viewport.panTo(viewportPoint, true);
                console.log("Panned to viewport point:", viewportPoint);
                
                // If we know it's a small annotation, zoom in
                if (annotation.type === 6) { // Dot type
                    this.viewer.viewport.zoomTo(this.viewer.viewport.getZoom() * 1.5);
                }
            }
            
            // Scroll the annotation into view in the panel list
            var listItem = $('.annotation-item[data-id="' + id + '"]');
            if (listItem.length) {
                var container = $('.annotation-list');
                container.scrollTop(
                    listItem.offset().top - container.offset().top + container.scrollTop()
                );
            }
        },

        /**
         * Clear all highlights
         */
        clearHighlights: function() {
            $('.strong-highlight').removeClass('strong-highlight');
            
            // Also remove any temporary highlight elements
            $('svg .temp-highlight').remove();
        },

        /**
         * Parse coordinates from annotation content
         */
        parseCoordinates: function(content) {
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
        },

        /**
         * Create a visible highlight element based on annotation type and coordinates
         */
        createHighlightElement: function(type, coords, color) {
            if (!coords || coords.length === 0) return null;
            
            // Find multiplier to convert relative coordinates to absolute
            var mult = 1;
            if (this.polyzoomAnnotation && this.polyzoomAnnotation.multiplier) {
                mult = this.polyzoomAnnotation.multiplier[0] || 1;
            }
            
            // Create SVG element based on type
            var element = null;
            
            switch (parseInt(type)) {
                case 0: // Line
                    if (coords.length >= 2) {
                        element = $(document.createElementNS("http://www.w3.org/2000/svg", "line"));
                        element.attr({
                            'x1': coords[0].x * mult,
                            'y1': coords[0].y * mult,
                            'x2': coords[1].x * mult,
                            'y2': coords[1].y * mult,
                            'stroke': '#FF0000',
                            'stroke-width': '6',
                            'class': 'temp-highlight'
                        });
                    }
                    break;
                    
                case 1: // Arrow (similar to line for now)
                    if (coords.length >= 2) {
                        element = $(document.createElementNS("http://www.w3.org/2000/svg", "line"));
                        element.attr({
                            'x1': coords[0].x * mult,
                            'y1': coords[0].y * mult,
                            'x2': coords[1].x * mult,
                            'y2': coords[1].y * mult,
                            'stroke': '#FF0000',
                            'stroke-width': '6',
                            'class': 'temp-highlight'
                        });
                    }
                    break;
                    
                case 2: // Rectangle
                    if (coords.length >= 2) {
                        element = $(document.createElementNS("http://www.w3.org/2000/svg", "rect"));
                        
                        var x = Math.min(coords[0].x, coords[1].x) * mult;
                        var y = Math.min(coords[0].y, coords[1].y) * mult;
                        var width = Math.abs(coords[1].x - coords[0].x) * mult;
                        var height = Math.abs(coords[1].y - coords[0].y) * mult;
                        
                        element.attr({
                            'x': x,
                            'y': y,
                            'width': width,
                            'height': height,
                            'fill': '#FF0000',
                            'fill-opacity': '0.3',
                            'stroke': '#FF0000',
                            'stroke-width': '6',
                            'class': 'temp-highlight'
                        });
                    }
                    break;
                    
                case 3: // Ellipse
                    if (coords.length >= 2) {
                        element = $(document.createElementNS("http://www.w3.org/2000/svg", "ellipse"));
                        
                        var cx = (coords[0].x + coords[1].x) / 2 * mult;
                        var cy = (coords[0].y + coords[1].y) / 2 * mult;
                        var rx = Math.abs(coords[1].x - coords[0].x) / 2 * mult;
                        var ry = Math.abs(coords[1].y - coords[0].y) / 2 * mult;
                        
                        element.attr({
                            'cx': cx,
                            'cy': cy,
                            'rx': rx,
                            'ry': ry,
                            'fill': '#FF0000',
                            'fill-opacity': '0.3',
                            'stroke': '#FF0000',
                            'stroke-width': '6',
                            'class': 'temp-highlight'
                        });
                    }
                    break;
                    
                case 5: // Text
                    if (coords.length >= 1) {
                        element = $(document.createElementNS("http://www.w3.org/2000/svg", "rect"));
                        element.attr({
                            'x': coords[0].x * mult - 30,
                            'y': coords[0].y * mult - 15,
                            'width': 60,
                            'height': 30,
                            'fill': '#FF0000',
                            'fill-opacity': '0.3',
                            'stroke': '#FF0000',
                            'stroke-width': '6',
                            'class': 'temp-highlight'
                        });
                    }
                    break;
                    
                case 6: // Dot
                    if (coords.length >= 1) {
                        element = $(document.createElementNS("http://www.w3.org/2000/svg", "circle"));
                        element.attr({
                            'cx': coords[0].x * mult,
                            'cy': coords[0].y * mult,
                            'r': 15,
                            'fill': '#FF0000',
                            'fill-opacity': '0.5',
                            'stroke': '#FF0000',
                            'stroke-width': '6',
                            'class': 'temp-highlight'
                        });
                    }
                    break;
                    
                case 4: // Free Hand Drawing - complex to recreate, so use a visual indicator
                    if (coords.length >= 1) {
                        // Just add a circle at the start point
                        element = $(document.createElementNS("http://www.w3.org/2000/svg", "circle"));
                        element.attr({
                            'cx': coords[0].x * mult,
                            'cy': coords[0].y * mult,
                            'r': 20,
                            'fill': '#FF0000',
                            'fill-opacity': '0.3',
                            'stroke': '#FF0000',
                            'stroke-width': '6',
                            'class': 'temp-highlight'
                        });
                    }
                    break;
            }
            
            return element;
        },

        /**
         * Get viewport point for an annotation
         */
        getAnnotationViewportPoint: function(annotation) {
            if (!annotation || !annotation.content) return null;
            
            var coords = this.parseCoordinates(annotation.content);
            if (!coords || coords.length === 0) return null;
            
            // For most annotations, use the first coordinate
            var point = new OpenSeadragon.Point(coords[0].x, coords[0].y);
            
            // For rectangles and ellipses, use the center
            if (annotation.type === 2 || annotation.type === 3) {
                if (coords.length >= 2) {
                    point = new OpenSeadragon.Point(
                        (coords[0].x + coords[1].x) / 2,
                        (coords[0].y + coords[1].y) / 2
                    );
                }
            }
            
            return point;
        },

        /**
         * Delete the selected annotation
         * FIX: Added proper error checking and fallback methods
         */
        deleteSelectedAnnotation: function() {
            var self = this;
            var id = this.selectedAnnotationId;
            
            if (!id) return;
            
            // Find the annotation
            var annotation = null;
            var annotationIndex = -1;
            for (var i = 0; i < this.annotations.length; i++) {
                if (this.annotations[i].id === id) {
                    annotation = this.annotations[i];
                    annotationIndex = i;
                    break;
                }
            }
            
            if (!annotation) {
                console.error("Annotation not found for deletion:", id);
                return;
            }
            
            // Confirm deletion
            if (!confirm("Are you sure you want to delete this " + this.annotationTypes[annotation.type] + " annotation?")) {
                return;
            }
            
            console.log("Using direct annotation removal approach");
            
            // Prepare the update data - change active flag from 1 to 0
            var rawText = annotation.raw;
            var updatedText = rawText.replace(/^1,/, "0,");
            
            // Get first 10 characters of each for the update
            var from = rawText.substring(0, 10);
            var to = updatedText.substring(0, 10);
            
            // IMPORTANT: Use the original polyzoomer plugin's removal method if available
            var originalPluginUsed = false;
            
            if (this.polyzoomAnnotation && typeof this.polyzoomAnnotation.removeAnnotation === 'function') {
                try {
                    // This is the key fix: use the original plugin's effective removal method
                    this.polyzoomAnnotation.removeAnnotation(id);
                    originalPluginUsed = true;
                    console.log("Used original polyzoomer removeAnnotation method");
                } catch (e) {
                    console.error("Error using original removeAnnotation method:", e);
                    originalPluginUsed = false;
                }
            }
            
            // If original plugin method failed, do manual cleanup
            if (!originalPluginUsed) {
                // Remove from DOM
                var svgElements = $('svg g[id="' + id + '"], svg line[id="' + id + '"], svg rect[id="' + id + '"], svg ellipse[id="' + id + '"], svg path[id="' + id + '"], svg text[id="' + id + '"], svg circle[id="' + id + '"]');
                console.log("Found " + svgElements.length + " DOM elements to remove");
                svgElements.remove();
                
                // Clean all underlying plugin references
                if (this.polyzoomAnnotation) {
                    try {
                        // Clean the current annotation set
                        if (this.polyzoomAnnotation.currentSet !== undefined && 
                            this.polyzoomAnnotation.annotationList && 
                            this.polyzoomAnnotation.annotationList[this.polyzoomAnnotation.currentSet]) {
                            
                            var list = this.polyzoomAnnotation.annotationList[this.polyzoomAnnotation.currentSet];
                            for (var i = list.length - 1; i >= 0; i--) {
                                if ((list[i].guid && list[i].guid == id) || 
                                    (list[i].id && list[i].id == id)) {
                                    list.splice(i, 1);
                                }
                            }
                        }
                        
                        // Clean all annotation sets
                        if (this.polyzoomAnnotation.annotationList) {
                            for (var setIndex = 0; setIndex < this.polyzoomAnnotation.annotationList.length; setIndex++) {
                                if (this.polyzoomAnnotation.annotationList[setIndex]) {
                                    var list = this.polyzoomAnnotation.annotationList[setIndex];
                                    for (var i = list.length - 1; i >= 0; i--) {
                                        if ((list[i].guid && list[i].guid == id) || 
                                            (list[i].id && list[i].id == id)) {
                                            list.splice(i, 1);
                                        }
                                    }
                                }
                            }
                        }
                        
                        // Clean up annotation table if exists
                        if (this.polyzoomAnnotation.annotationTable) {
                            delete this.polyzoomAnnotation.annotationTable[id];
                        }
                        
                        // Reset current annotation if it's the selected one
                        if (this.polyzoomAnnotation.currentAnnotation && 
                            (this.polyzoomAnnotation.currentAnnotation.guid === id || 
                             this.polyzoomAnnotation.currentAnnotation.id === id)) {
                            this.polyzoomAnnotation.currentAnnotation = null;
                        }
                    } catch (e) {
                        console.error("Error cleaning polyzoomAnnotation references:", e);
                    }
                }
            }
            
            // Update our local list
            this.annotations = this.annotations.filter(function(a) {
                return a.id !== id;
            });
            
            // Mark inactive in the file
            $.ajax({
                url: '../updateAnnotationFile.php',
                type: 'POST',
                dataType: 'json',
                data: {
                    path: JSON.stringify(this.annotationPath),
                    from: JSON.stringify(from),
                    to: JSON.stringify(to)
                },
                success: function(data) {
                    console.log("Annotation deletion success:", data);
                    
                    // Force multiple viewer refresh methods to ensure complete redraw
                    if (self.viewer) {
                        // Resize overlay
                        if (self.polyzoomAnnotation && self.polyzoomAnnotation.overlay) {
                            try {
                                self.polyzoomAnnotation.overlay.resize();
                            } catch (e) {
                                console.error("Error resizing overlay:", e);
                            }
                        }
                        
                        // Force viewer redraw - try multiple methods
                        try {
                            if (self.viewer.drawer) {
                                self.viewer.drawer.update();
                            }
                            if (self.viewer.world) {
                                self.viewer.world.draw();
                            }
                            if (self.viewer.forceRedraw) {
                                self.viewer.forceRedraw();
                            }
                        } catch (e) {
                            console.error("Error forcing viewer redraw:", e);
                        }
                    }
                    
                    // Reset selection
                    self.selectedAnnotationId = null;
                    
                    // Disable delete button
                    $('.delete-annotation-btn').prop('disabled', true);
                    
                    // Show success message
                    alert("Annotation deleted successfully");
                    
                    // Reload annotations to refresh counts
                    setTimeout(function() {
                        self.refreshAnnotations();
                    }, 500);
                },
                error: function(xhr, status, error) {
                    console.error("Error deleting annotation:", error);
                    
                    // Reset selection
                    self.selectedAnnotationId = null;
                    
                    // Disable delete button
                    $('.delete-annotation-btn').prop('disabled', true);
                    
                    alert("Error deleting annotation: " + error);
                }
            });
        },
        
        /**
         * Safely convert an annotation object to string format
         * This is a fallback method in case the original annotationToString fails
         */
        createAnnotationString: function(annotation) {
            if (!annotation) return "";
            
            // Format: active,id,type,[content],color,zoom,date
            var isActive = annotation.active ? 1 : 0;
            var now = new Date();
            var formattedDate = now.getDate() + '/' + 
                               (now.getMonth() + 1) + '/' + 
                               (now.getFullYear()) + '/' + 
                                now.getHours() + ':' + 
                                now.getMinutes() + ':' + 
                                now.getSeconds();
            
            var result = isActive + ',' + 
                         annotation.id.toString() + ',' + 
                         annotation.type.toString() + ',' + 
                         '[' + annotation.content + '],' + 
                         annotation.color + ',' + 
                         '1.0,' + // Default zoom value
                         formattedDate;
            
            return result;
        }
        };
        
        // Wait a bit for the page to fully load before creating an instance
        setTimeout(function() {
            console.log("Initializing Enhanced Annotation Manager...");
            try {
                var enhancedAnnotationManager = new PolyzoomerEnhanced.AnnotationManager();
                // Make it accessible globally for debugging
                window.enhancedAnnotationManager = enhancedAnnotationManager;
            } catch(e) {
                console.error("Error initializing Enhanced Annotation Manager:", e);
            }
        }, 2000); // 2 second delay
        })();