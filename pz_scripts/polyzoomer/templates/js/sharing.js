/*
   Sharing Functionality for Polyscope Pathology Viewer
   Author: Enhanced for URL sharing with error handling
   File: sharing.js
*/

// Global functions first (for immediate availability)
function shareSlide() {
    console.log('shareSlide called');
    if (window.slideSharing) {
        window.slideSharing.openModal();
    } else {
        console.warn('slideSharing not initialized yet, retrying...');
        setTimeout(() => {
            if (window.slideSharing) {
                window.slideSharing.openModal();
            } else {
                alert('Sharing functionality is not ready yet. Please try again.');
            }
        }, 1000);
    }
}

function toggleExportDropdown() {
    const dropdown = document.getElementById('exportDropdown');
    const arrow = document.querySelector('.export-arrow');
    
    if (dropdown) {
        if (dropdown.style.display === 'block') {
            dropdown.style.display = 'none';
            if (arrow) arrow.style.transform = 'rotate(0deg)';
        } else {
            dropdown.style.display = 'block';
            if (arrow) arrow.style.transform = 'rotate(180deg)';
        }
    }
}

class SlideSharing {
    constructor() {
        this.modal = null;
        this.shareUrl = '';
        this.viewerCheckAttempts = 0;
        this.maxViewerCheckAttempts = 20;
        this.init();
    }

    init() {
        console.log('Initializing SlideSharing...');
        
        // Handle shared URLs when page loads
        this.handleSharedUrl();
        
        // Create modal if it doesn't exist
        this.createShareModal();
        
        // Add event listeners
        this.addEventListeners();
        
        // Wait for viewer to be ready
        this.waitForViewer();
    }

    waitForViewer() {
        const checkViewer = () => {
            this.viewerCheckAttempts++;
            const viewer = this.getViewer();
            
            if (viewer) {
                console.log('Viewer found for sharing:', viewer.id || 'unnamed');
                return;
            }
            
            if (this.viewerCheckAttempts < this.maxViewerCheckAttempts) {
                console.log(`Waiting for viewer... attempt ${this.viewerCheckAttempts}`);
                setTimeout(checkViewer, 500);
            } else {
                console.warn('Viewer not found after maximum attempts');
            }
        };
        
        checkViewer();
    }

    createShareModal() {
        // Check if modal already exists
        if (document.getElementById('shareModal')) {
            this.modal = document.getElementById('shareModal');
            console.log('Share modal already exists');
            return;
        }

        console.log('Creating share modal...');

        // Create modal HTML
        const modalHTML = `
            <div class="share-modal" id="shareModal">
                <div class="share-content">
                    <div class="share-header">
                        <h3><i class="fas fa-share-alt"></i> Share This Slide</h3>
                        <button class="close-btn" onclick="window.slideSharing.closeModal()">&times;</button>
                    </div>
                    <div class="share-body">
                        <label>Share URL:</label>
                        <div class="url-container">
                            <input type="text" id="shareUrlInput" readonly>
                            <button class="copy-btn" onclick="window.slideSharing.copyUrl()">
                                <i class="fas fa-copy"></i> Copy
                            </button>
                        </div>
                        <div class="share-options">
                            <button class="share-option-btn email" onclick="window.slideSharing.shareViaEmail()">
                                <i class="fas fa-envelope"></i> Email
                            </button>
                            <button class="share-option-btn twitter" onclick="window.slideSharing.shareViaTwitter()">
                                <i class="fab fa-twitter"></i> Twitter
                            </button>
                            <button class="share-option-btn linkedin" onclick="window.slideSharing.shareViaLinkedIn()">
                                <i class="fab fa-linkedin"></i> LinkedIn
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('shareModal');
        console.log('Share modal created successfully');
    }

    addEventListeners() {
        // Close modal when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal && this.modal.classList.contains('show')) {
                this.closeModal();
            }
        });

        // Close export dropdown when clicking outside
        document.addEventListener('click', (event) => {
            const exportContainer = document.querySelector('.export-btn-container');
            if (exportContainer && !exportContainer.contains(event.target)) {
                const dropdown = document.getElementById('exportDropdown');
                const arrow = document.querySelector('.export-arrow');
                if (dropdown) dropdown.style.display = 'none';
                if (arrow) arrow.style.transform = 'rotate(0deg)';
            }
        });
    }

    generateShareUrl() {
        const baseUrl = window.location.origin + window.location.pathname;
        
        // Get slide information from polyscopeConfig or fallback methods
        let slideId, patientId, channelId;
        
        if (window.polyscopeConfig) {
            patientId = window.polyscopeConfig.patientId;
            channelId = window.polyscopeConfig.channelId;
            slideId = window.polyscopeConfig.contentId;
            console.log('Using polyscopeConfig:', { patientId, channelId, slideId });
        } else {
            // Fallback: extract from URL or page elements
            const pathParts = window.location.pathname.split('/');
            patientId = pathParts[pathParts.length - 2] || 'unknown';
            channelId = 'unknown';
            slideId = 'unknown';
            console.log('Using fallback extraction:', { patientId, channelId, slideId });
        }

        // Create URL with parameters
        const url = new URL(baseUrl);
        url.searchParams.set('slide', slideId);
        url.searchParams.set('patient', patientId);
        url.searchParams.set('channel', channelId);
        
        // Add current viewport if viewer is available
        const viewer = this.getViewer();
        if (viewer && viewer.viewport) {
            try {
                const center = viewer.viewport.getCenter();
                const zoom = viewer.viewport.getZoom();
                
                url.searchParams.set('x', center.x.toFixed(4));
                url.searchParams.set('y', center.y.toFixed(4));
                url.searchParams.set('z', zoom.toFixed(4));
                
                console.log('Added viewport info:', { x: center.x, y: center.y, z: zoom });
            } catch (error) {
                console.warn('Could not get viewport info:', error);
            }
        } else {
            console.warn('No viewer available for viewport info');
        }

        return url.toString();
    }

    openModal() {
        console.log('Opening share modal...');
        
        if (!this.modal) {
            console.error('Share modal not available');
            return;
        }
        
        this.shareUrl = this.generateShareUrl();
        console.log('Generated share URL:', this.shareUrl);
        
        const urlInput = document.getElementById('shareUrlInput');
        if (urlInput) {
            urlInput.value = this.shareUrl;
        }
        
        this.modal.classList.add('show');
        
        // Focus on URL input for easy selection
        setTimeout(() => {
            if (urlInput) {
                urlInput.select();
            }
        }, 100);
    }

    closeModal() {
        if (this.modal) {
            this.modal.classList.remove('show');
        }
    }

    async copyUrl() {
        const urlInput = document.getElementById('shareUrlInput');
        const copyBtn = document.querySelector('.copy-btn');
        
        if (!urlInput || !copyBtn) {
            console.error('Copy elements not found');
            return;
        }
        
        try {
            // Modern browser method
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(this.shareUrl);
            } else {
                // Fallback method
                urlInput.select();
                urlInput.setSelectionRange(0, 99999);
                document.execCommand('copy');
            }
            
            // Visual feedback
            const originalContent = copyBtn.innerHTML;
            copyBtn.classList.add('copied');
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            
            this.showNotification('URL copied to clipboard!', 'success');
            
            // Reset button after 2 seconds
            setTimeout(() => {
                copyBtn.classList.remove('copied');
                copyBtn.innerHTML = originalContent;
            }, 2000);
            
        } catch (err) {
            console.error('Failed to copy URL:', err);
            this.showNotification('Failed to copy URL - please copy manually', 'error');
        }
    }

    shareViaEmail() {
        const subject = `Pathology Slide: ${window.polyscopeConfig?.patientId || 'Medical Sample'}`;
        const body = `I'd like to share this pathology slide with you:\n\n${this.shareUrl}\n\nView it in the Polyscope viewer.`;
        
        const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(mailtoUrl);
    }

    shareViaTwitter() {
        const text = `Pathology Slide Analysis: ${window.polyscopeConfig?.patientId || 'Medical Sample'}`;
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(this.shareUrl)}`;
        window.open(twitterUrl, '_blank', 'width=550,height=420');
    }

    shareViaLinkedIn() {
        const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(this.shareUrl)}`;
        window.open(linkedinUrl, '_blank', 'width=550,height=420');
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        // Create new notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    handleSharedUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const slideId = urlParams.get('slide');
        const patientId = urlParams.get('patient');
        const channelId = urlParams.get('channel');
        const x = urlParams.get('x');
        const y = urlParams.get('y');
        const z = urlParams.get('z');
        
        if (slideId) {
            console.log('Loading shared slide:', slideId);
            
            // Show notification about shared slide
            setTimeout(() => {
                this.showNotification(`Viewing shared slide: ${patientId || slideId}`, 'success');
            }, 2000);
            
            // Restore viewport if coordinates are provided
            if (x && y && z) {
                this.restoreViewport(parseFloat(x), parseFloat(y), parseFloat(z));
            }
        }
    }

    restoreViewport(x, y, zoom) {
        console.log('Attempting to restore viewport:', { x, y, zoom });
        
        // Wait for viewer to be ready
        const checkViewer = () => {
            const viewer = this.getViewer();
            if (viewer && viewer.viewport) {
                try {
                    console.log('Restoring viewport to:', x, y, zoom);
                    viewer.viewport.panTo(new OpenSeadragon.Point(x, y));
                    viewer.viewport.zoomTo(zoom);
                    this.showNotification('Viewport restored from shared link', 'success');
                } catch (error) {
                    console.error('Error restoring viewport:', error);
                }
            } else {
                setTimeout(checkViewer, 200);
            }
        };
        
        setTimeout(checkViewer, 1000);
    }

    getViewer() {
        // Try multiple methods to find the viewer
        
        // Method 1: Try the specific viewer variable
        if (window.MS003_UNKNOWNCHANNEL0001 && window.MS003_UNKNOWNCHANNEL0001.viewport) {
            return window.MS003_UNKNOWNCHANNEL0001;
        }
        
        // Method 2: Try polyscopeConfig
        if (window.polyscopeConfig && window.polyscopeConfig.viewerVarName) {
            const viewer = window[window.polyscopeConfig.viewerVarName];
            if (viewer && viewer.viewport) {
                return viewer;
            }
        }
        
        // Method 3: Search through window object for OpenSeadragon viewers
        for (const key in window) {
            try {
                const obj = window[key];
                if (obj && typeof obj === 'object' && obj.viewport && obj.addHandler) {
                    return obj;
                }
            } catch (e) {
                // Ignore errors when checking properties
            }
        }
        
        return null;
    }
}

// Initialize when DOM is ready
let slideSharing;

function initializeSharing() {
    console.log('DOM ready, initializing sharing...');
    slideSharing = new SlideSharing();
    window.slideSharing = slideSharing;
    console.log('Sharing initialized and attached to window');
}

// Multiple initialization methods to ensure it works
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSharing);
} else {
    // DOM already loaded
    initializeSharing();
}

// Fallback initialization
window.addEventListener('load', function() {
    if (!window.slideSharing) {
        console.log('Fallback initialization of sharing...');
        initializeSharing();
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SlideSharing;
}