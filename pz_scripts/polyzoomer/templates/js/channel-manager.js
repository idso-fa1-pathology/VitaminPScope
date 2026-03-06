/**
 * Channel Manager for Polyscope - FIXED WITH DEBUG
 * 
 * Handles multi-channel image detection, visibility control, and opacity management
 * Integrates with OpenSeadragon and the existing annotation system
 */

(function() {
    'use strict';

    // Create namespace
    window.PolyChannelManager = window.PolyChannelManager || {};

    /**
     * Channel Manager Constructor
     */
    PolyChannelManager.Manager = function(viewer, options) {
        this.viewer = viewer;
        this.options = options || {};
        this.channels = [];
        this.channelElements = {};
        this.overlayCanvases = {};
        this.isInitialized = false;
        
        this.initialize();
    };

    PolyChannelManager.Manager.prototype = {
        
        /**
         * Initialize the channel manager
         */
        initialize: function() {
            var self = this;
            
            console.log('🎨 Initializing Channel Manager...');
            
            // Wait for viewer to be ready
            if (this.viewer && this.viewer.isOpen && this.viewer.isOpen()) {
                this.detectChannels();
                this.createChannelUI();
                this.isInitialized = true;
            } else if (this.viewer) {
                this.viewer.addHandler('open', function() {
                    self.detectChannels();
                    self.createChannelUI();
                    self.isInitialized = true;
                });
            }
        },

        /**
         * Auto-detect available channels from the image source
         */
        detectChannels: function() {
            console.log('🔍 Detecting image channels...');
            
            // Get the current tile source
            var tileSource = this.viewer.source;
            
            // Method 1: Try to detect from DZI file structure
            this.detectFromDZI(tileSource);
            
            // Method 2: Try to detect from file naming patterns
            this.detectFromFileNaming();
            
            // Method 3: Try to detect from metadata
            this.detectFromMetadata();
            
            // Method 4: Fallback - create default channels based on common patterns
            if (this.channels.length === 0) {
                this.createDefaultChannels();
            }
            
            console.log('📊 Detected', this.channels.length, 'channels:', this.channels);
        },

        /**
         * Detect channels from DZI file structure
         */
        detectFromDZI: function(tileSource) {
            if (!tileSource || !tileSource.url) return;
            
            var dziUrl = tileSource.url;
            console.log('🔍 Analyzing DZI URL:', dziUrl);
            
            // Extract base path and filename
            var basePath = dziUrl.substring(0, dziUrl.lastIndexOf('/'));
            var dziName = dziUrl.substring(dziUrl.lastIndexOf('/') + 1, dziUrl.lastIndexOf('.dzi'));
            
            // Look for channel indicators in the filename
            var channelPatterns = [
                /_C(\d+)/g,           // _C1, _C2, etc.
                /_ch(\d+)/gi,         // _ch1, _CH2, etc.
                /_channel(\d+)/gi,    // _channel1, etc.
                /_(DAPI|GFP|TRITC|Cy5|Texas|Alexa)/gi,  // Named channels
                /_(488|555|647|405|561)/g,              // Wavelengths
            ];
            
            for (var i = 0; i < channelPatterns.length; i++) {
                var matches = dziName.match(channelPatterns[i]);
                if (matches) {
                    console.log('📍 Found channel pattern:', matches);
                    this.parseChannelMatches(matches, basePath, dziName);
                    return;
                }
            }
        },

        /**
         * Parse channel matches and create channel objects
         */
        parseChannelMatches: function(matches, basePath, dziName) {
            var self = this;
            var channelColors = {
                'DAPI': '#0080ff',
                'GFP': '#00ff00', 
                'TRITC': '#ff8000',
                'Texas': '#ff0000',
                'Cy5': '#ff00ff',
                'Alexa': '#ffff00',
                '488': '#00ff00',
                '555': '#ffff00',
                '647': '#ff0000',
                '405': '#0080ff',
                '561': '#ff8000'
            };
            
            matches.forEach(function(match, index) {
                var channelName = match.replace(/^_/, '');
                var channelId = 'channel_' + (index + 1);
                
                // Determine color
                var color = channelColors[channelName.toUpperCase()] || self.generateChannelColor(index);
                
                self.channels.push({
                    id: channelId,
                    name: channelName,
                    color: color,
                    visible: true,
                    opacity: 100,
                    dziPath: basePath + '/' + dziName + '_' + channelName + '.dzi',
                    index: index
                });
            });
        },

        /**
         * Detect channels from file naming patterns in the current directory
         */
        detectFromFileNaming: function() {
            // This would require server-side directory listing
            // For now, we'll analyze the current URL structure
            
            var currentUrl = window.location.href;
            var pathParts = currentUrl.split('/');
            
            // Look for channel indicators in the URL path
            for (var i = 0; i < pathParts.length; i++) {
                var part = pathParts[i];
                if (part.match(/^(DAPI|GFP|TRITC|Cy5|Texas|Alexa|488|555|647|405|561)$/i)) {
                    console.log('📍 Found channel in URL path:', part);
                    // This suggests we're viewing a specific channel
                    this.addChannelFromPath(part);
                }
            }
        },

        /**
         * Add a channel based on URL path analysis
         */
        addChannelFromPath: function(channelName) {
            var channelColors = {
                'DAPI': '#0080ff',
                'GFP': '#00ff00',
                'TRITC': '#ff8000', 
                'Texas': '#ff0000',
                'Cy5': '#ff00ff',
                'Alexa': '#ffff00'
            };
            
            var existingChannel = this.channels.find(function(ch) {
                return ch.name.toLowerCase() === channelName.toLowerCase();
            });
            
            if (!existingChannel) {
                this.channels.push({
                    id: 'channel_' + channelName.toLowerCase(),
                    name: channelName,
                    color: channelColors[channelName.toUpperCase()] || this.generateChannelColor(this.channels.length),
                    visible: true,
                    opacity: 100,
                    index: this.channels.length,
                    isCurrent: true
                });
            }
        },

        /**
         * Detect channels from image metadata (if available)
         */
        detectFromMetadata: function() {
            // This would integrate with any available metadata APIs
            // For now, placeholder for future implementation
            console.log('🔍 Checking for image metadata...');
            
            // Could check for:
            // - OME-XML metadata
            // - TIFF tags
            // - Custom metadata files
        },

        /**
         * Create default channels for common microscopy setups
         */
        createDefaultChannels: function() {
            console.log('🎨 Creating default channels...');
            
            // Common fluorescence microscopy channels
            var defaultChannels = [
                { name: 'DAPI', color: '#0080ff', description: 'Nuclear stain' },
                { name: 'FITC/GFP', color: '#00ff00', description: 'Green fluorescence' },
                { name: 'TRITC', color: '#ff8000', description: 'Red fluorescence' },
                { name: 'Cy5', color: '#ff00ff', description: 'Far-red fluorescence' }
            ];
            
            for (var i = 0; i < defaultChannels.length; i++) {
                var ch = defaultChannels[i];
                this.channels.push({
                    id: 'channel_' + (i + 1),
                    name: ch.name,
                    color: ch.color,
                    visible: i < 2, // Only show first 2 by default
                    opacity: 100,
                    index: i,
                    description: ch.description,
                    isDefault: true
                });
            }
        },

        /**
         * Generate a color for a channel based on its index
         */
        generateChannelColor: function(index) {
            var colors = [
                '#0080ff', // Blue
                '#00ff00', // Green  
                '#ff0000', // Red
                '#ff00ff', // Magenta
                '#ffff00', // Yellow
                '#ff8000', // Orange
                '#8000ff', // Purple
                '#00ffff'  // Cyan
            ];
            
            return colors[index % colors.length];
        },

        /**
         * Create the channel control UI
         */
        createChannelUI: function() {
            console.log('🎨 Creating channel control UI...');
            
            var self = this;
            var channelControlsHTML = this.generateChannelControlsHTML();
            
            // Find the sidebar content area
            var sidebarContent = $('.sidebar-content');
            if (sidebarContent.length === 0) {
                console.error('❌ Could not find sidebar content area');
                return;
            }
            
            // Insert channel controls after image controls
            var imageControlsSection = sidebarContent.find('.section').first();
            if (imageControlsSection.length > 0) {
                imageControlsSection.after(channelControlsHTML);
            } else {
                sidebarContent.prepend(channelControlsHTML);
            }
            
            console.log('✅ Channel controls UI created');
        },

        /**
         * Generate HTML for channel controls
         */
        generateChannelControlsHTML: function() {
            var self = this;
            
            var channelItems = this.channels.map(function(channel) {
                return `
                    <div class="channel-item" data-channel-id="${channel.id}">
                        <div class="channel-info">
                            <div class="channel-color" style="background-color: ${channel.color}"></div>
                            <span class="channel-name">${channel.name}</span>
                            ${channel.description ? '<div class="channel-description">' + channel.description + '</div>' : ''}
                        </div>
                        <div class="channel-controls-right">
                            <div class="channel-toggle ${channel.visible ? 'active' : ''}" 
                                 onclick="channelManager.toggleChannel('${channel.id}', this)">
                            </div>
                            <input type="range" class="channel-opacity" 
                                   min="0" max="100" value="${channel.opacity}"
                                   oninput="channelManager.updateChannelOpacity('${channel.id}', this.value)"
                                   ${!channel.visible ? 'disabled' : ''}>
                        </div>
                    </div>
                `;
            }).join('');
            
            return `
                <div class="section">
                    <div class="section-header" onclick="toggleSection(this)">
                        <span><i class="fas fa-layer-group"></i> Channel Controls</span>
                        <i class="fas fa-chevron-down"></i>
                    </div>
                    <div class="section-content">
                        <div class="channel-controls" id="channelControls">
                            ${channelItems}
                        </div>
                        <div class="control-buttons">
                            <button class="action-btn secondary" onclick="channelManager.showAllChannels()">
                                <i class="fas fa-eye"></i> Show All
                            </button>
                            <button class="action-btn secondary" onclick="channelManager.hideAllChannels()">
                                <i class="fas fa-eye-slash"></i> Hide All
                            </button>
                            <button class="action-btn secondary" onclick="channelManager.resetChannels()">
                                <i class="fas fa-undo"></i> Reset
                            </button>
                        </div>
                    </div>
                </div>
            `;
        },

        /**
         * Toggle channel visibility
         */
        toggleChannel: function(channelId, toggleElement) {
            var channel = this.getChannel(channelId);
            if (!channel) return;
            
            var isActive = toggleElement.classList.contains('active');
            var channelItem = toggleElement.closest('.channel-item');
            var opacitySlider = channelItem.querySelector('.channel-opacity');
            
            if (isActive) {
                // Hide channel
                toggleElement.classList.remove('active');
                opacitySlider.disabled = true;
                channel.visible = false;
                console.log('🙈 Hiding channel:', channel.name);
            } else {
                // Show channel
                toggleElement.classList.add('active');
                opacitySlider.disabled = false;
                channel.visible = true;
                console.log('👁️ Showing channel:', channel.name);
            }
            
            this.applyChannelVisibility(channelId);
        },

        /**
         * Update channel opacity
         */
        updateChannelOpacity: function(channelId, opacity) {
            var channel = this.getChannel(channelId);
            if (!channel) return;
            
            channel.opacity = parseInt(opacity);
            console.log('🎨 Updating channel opacity:', channel.name, opacity + '%');
            
            this.applyChannelOpacity(channelId);
        },

        /**
         * Apply channel visibility changes to the viewer
         */
        applyChannelVisibility: function(channelId) {
            var channel = this.getChannel(channelId);
            if (!channel) return;
            
            console.log('🎨 Applying visibility for channel:', channel.name, 'visible:', channel.visible);
            
            // For composite images, we need to use CSS filters to simulate individual channel control
            this.updateCompositeChannelDisplay();
        },

        /**
         * Apply channel opacity changes
         */
        applyChannelOpacity: function(channelId) {
            var channel = this.getChannel(channelId);
            if (!channel) return;
            
            console.log('🎨 Applying opacity for channel:', channel.name, 'opacity:', channel.opacity + '%');
            
            // For composite images, update the combined display
            this.updateCompositeChannelDisplay();
        },

        /**
         * Update composite channel display using CSS filters - COMPLETELY REWRITTEN
         */
        updateCompositeChannelDisplay: function() {
            var viewerId = this.viewer.id || '_CONTENTID_';
            var viewerContainer = document.getElementById(viewerId);
            
            if (!viewerContainer) {
                console.error('❌ Viewer container not found:', viewerId);
                return;
            }
            
            // Calculate combined effects for all channels
            var combinedOpacity = this.calculateCombinedOpacity();
            var combinedFilters = this.calculateCombinedFilters();
            
            console.log('🎨 Applying combined opacity:', combinedOpacity);
            console.log('🎨 Applying combined filters:', combinedFilters);
            
            // Find all canvas elements using multiple methods
            var canvases = [];
            
            // Method 1: Direct query
            var directCanvases = viewerContainer.querySelectorAll('canvas');
            for (var i = 0; i < directCanvases.length; i++) {
                canvases.push(directCanvases[i]);
            }
            
            // Method 2: Check nested divs
            var nestedDivs = viewerContainer.querySelectorAll('div');
            for (var j = 0; j < nestedDivs.length; j++) {
                var nestedCanvases = nestedDivs[j].querySelectorAll('canvas');
                for (var k = 0; k < nestedCanvases.length; k++) {
                    if (canvases.indexOf(nestedCanvases[k]) === -1) {
                        canvases.push(nestedCanvases[k]);
                    }
                }
            }
            
            console.log('🔍 Found', canvases.length, 'canvas elements to modify');
            
            // Apply styles to each canvas using traditional for loop
            for (var c = 0; c < canvases.length; c++) {
                var canvas = canvases[c];
                console.log('🎨 Applying styles to canvas', c, '- current style:', canvas.style.cssText);
                
                // Apply opacity
                canvas.style.opacity = combinedOpacity.toString();
                
                // Apply filters
                if (combinedFilters && combinedFilters !== 'none') {
                    canvas.style.filter = combinedFilters;
                } else {
                    canvas.style.filter = '';
                }
                
                console.log('✅ Updated canvas', c, '- new style:', canvas.style.cssText);
            }
            
            // Also apply to the viewer container as a fallback
            if (combinedOpacity < 1 || combinedFilters) {
                console.log('🎨 Applying fallback styles to viewer container');
                viewerContainer.style.opacity = combinedOpacity.toString();
                if (combinedFilters && combinedFilters !== 'none') {
                    viewerContainer.style.filter = combinedFilters;
                }
            }
            
            // Force a repaint
            this.forceRepaint(viewerContainer);
        },

        /**
         * Force a repaint of the viewer
         */
        forceRepaint: function(element) {
            if (!element) return;
            
            // Force browser repaint by temporarily changing a style
            element.style.display = 'none';
            element.offsetHeight; // Trigger reflow
            element.style.display = '';
            
            console.log('🔄 Forced repaint of viewer');
        },

        /**
         * Calculate combined opacity from all visible channels
         */
        calculateCombinedOpacity: function() {
            var visibleChannels = this.channels.filter(function(ch) { return ch.visible; });
            
            if (visibleChannels.length === 0) {
                console.log('📊 No visible channels - returning opacity 0');
                return 0; // Hide completely if no channels visible
            }
            
            // For composite images, use the average opacity of visible channels
            var totalOpacity = visibleChannels.reduce(function(sum, ch) {
                return sum + ch.opacity;
            }, 0);
            
            var result = Math.min(1, (totalOpacity / visibleChannels.length) / 100);
            console.log('📊 Calculated opacity:', result, 'from', visibleChannels.length, 'visible channels');
            return result;
        },

        /**
         * Calculate combined CSS filters - SIMPLIFIED AND FIXED
         */
        calculateCombinedFilters: function() {
            var visibleChannels = this.channels.filter(function(ch) { return ch.visible; });
            
            if (visibleChannels.length === 0) {
                console.log('📊 No visible channels - returning hide filters');
                return 'brightness(0) contrast(0)'; // Completely hide the image
            }
            
            // Simple approach: adjust overall image based on channel selection
            var filters = [];
            
            // Count channel types
            var hasBlue = visibleChannels.some(function(ch) { 
                return ch.name.toLowerCase().includes('dapi') || ch.color.toLowerCase().includes('0080ff'); 
            });
            var hasGreen = visibleChannels.some(function(ch) { 
                return ch.name.toLowerCase().includes('gfp') || ch.name.toLowerCase().includes('fitc') || ch.color.toLowerCase().includes('00ff00'); 
            });
            var hasRed = visibleChannels.some(function(ch) { 
                return ch.name.toLowerCase().includes('tritc') || ch.name.toLowerCase().includes('texas') || ch.color.toLowerCase().includes('ff0000'); 
            });
            var hasMagenta = visibleChannels.some(function(ch) { 
                return ch.name.toLowerCase().includes('cy5') || ch.color.toLowerCase().includes('ff00ff'); 
            });
            
            console.log('📊 Channel analysis - Blue:', hasBlue, 'Green:', hasGreen, 'Red:', hasRed, 'Magenta:', hasMagenta);
            
            // Apply single, non-conflicting filter based on dominant channel
            if (visibleChannels.length === 1) {
                var channel = visibleChannels[0];
                console.log('📊 Single channel mode:', channel.name);
                if (hasBlue) {
                    filters.push('hue-rotate(210deg)', 'saturate(1.2)'); // Enhance blue
                } else if (hasGreen) {
                    filters.push('hue-rotate(90deg)', 'saturate(1.2)'); // Enhance green
                } else if (hasRed) {
                    filters.push('saturate(1.2)'); // Keep original red, just enhance
                } else if (hasMagenta) {
                    filters.push('hue-rotate(300deg)', 'saturate(1.2)'); // Enhance magenta
                }
            } else {
                // Multiple channels visible - use neutral enhancement
                console.log('📊 Multiple channel mode');
                filters.push('contrast(1.1)', 'saturate(1.1)');
            }
            
            var result = filters.join(' ');
            console.log('📊 Calculated filters:', result);
            return result;
        },

        /**
         * Show all channels
         */
        showAllChannels: function() {
            console.log('👁️ Showing all channels');
            
            var self = this;
            this.channels.forEach(function(channel) {
                channel.visible = true;
                channel.opacity = 100;
            });
            
            // Update UI
            var toggles = document.querySelectorAll('.channel-toggle');
            for (var i = 0; i < toggles.length; i++) {
                toggles[i].classList.add('active');
            }
            
            var sliders = document.querySelectorAll('.channel-opacity');
            for (var j = 0; j < sliders.length; j++) {
                sliders[j].disabled = false;
                sliders[j].value = 100;
            }
            
            // Apply changes
            this.updateCompositeChannelDisplay();
        },

        /**
         * Hide all channels
         */
        hideAllChannels: function() {
            console.log('🙈 Hiding all channels');
            
            var self = this;
            this.channels.forEach(function(channel) {
                channel.visible = false;
            });
            
            // Update UI
            var toggles = document.querySelectorAll('.channel-toggle');
            for (var i = 0; i < toggles.length; i++) {
                toggles[i].classList.remove('active');
            }
            
            var sliders = document.querySelectorAll('.channel-opacity');
            for (var j = 0; j < sliders.length; j++) {
                sliders[j].disabled = true;
            }
            
            // Apply changes
            this.updateCompositeChannelDisplay();
        },

        /**
         * Reset all channels to default state
         */
        resetChannels: function() {
            console.log('🔄 Resetting channels to default state');
            
            var self = this;
            this.channels.forEach(function(channel) {
                channel.visible = channel.index < 2; // Show first 2 by default
                channel.opacity = 100;
            });
            
            // Recreate UI
            this.removeChannelUI();
            this.createChannelUI();
        },

        /**
         * Remove channel UI (for reset)
         */
        removeChannelUI: function() {
            var existingSection = document.querySelector('.section .fa-layer-group');
            if (existingSection) {
                var section = existingSection.closest('.section');
                if (section) {
                    section.remove();
                }
            }
        },

        /**
         * Get channel by ID
         */
        getChannel: function(channelId) {
            return this.channels.find(function(channel) {
                return channel.id === channelId;
            });
        },

        /**
         * Get all channels
         */
        getChannels: function() {
            return this.channels;
        },

        /**
         * Add a new channel dynamically
         */
        addChannel: function(channelData) {
            var newChannel = {
                id: channelData.id || 'channel_' + (this.channels.length + 1),
                name: channelData.name || 'Channel ' + (this.channels.length + 1),
                color: channelData.color || this.generateChannelColor(this.channels.length),
                visible: channelData.visible !== undefined ? channelData.visible : true,
                opacity: channelData.opacity || 100,
                index: this.channels.length
            };
            
            this.channels.push(newChannel);
            
            // Recreate UI if already initialized
            if (this.isInitialized) {
                this.removeChannelUI();
                this.createChannelUI();
            }
            
            return newChannel;
        }
    };

    // Auto-initialize when viewer is available
    document.addEventListener('DOMContentLoaded', function() {
        console.log('🚀 Channel Manager: DOM loaded, looking for viewer...');
        
        // Wait for the viewer to be ready with multiple attempts
        var attempts = 0;
        var maxAttempts = 30;
        
        var checkViewer = setInterval(function() {
            attempts++;
            var viewerInstance = window.viewer || window._VIEWER_VARNAME_;
            
            console.log('🔍 Attempt', attempts, '- Viewer found:', !!viewerInstance);
            
            if (viewerInstance) {
                // Check if viewer is actually ready
                if (viewerInstance.isOpen && viewerInstance.isOpen()) {
                    console.log('✅ Viewer is ready, initializing Channel Manager...');
                    
                    // Create global channel manager instance
                    window.channelManager = new PolyChannelManager.Manager(viewerInstance);
                    
                    console.log('✅ Channel Manager initialized successfully');
                    clearInterval(checkViewer);
                    
                    // Debug the initialization
                    setTimeout(function() {
                        if (window.channelManager) {
                            console.log('📊 Channel Manager channels:', window.channelManager.getChannels());
                        }
                    }, 1000);
                } else {
                    console.log('⏳ Viewer found but not ready yet...');
                }
            } else if (attempts >= maxAttempts) {
                console.error('❌ Timeout waiting for viewer after', maxAttempts, 'attempts');
                clearInterval(checkViewer);
            }
        }, 1000);
    });

})();