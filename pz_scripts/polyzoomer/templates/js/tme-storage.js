/**
 * TME Results Storage Manager
 * Handles persistence of TME analysis results using localStorage AND VPS filesystem
 */

const TME_STORAGE = {
    KEYS: {
        RESULTS: 'tme_results_data',
        JOB_ID: 'tme_current_job_id',
        TIMESTAMP: 'tme_results_timestamp',
        SLIDE_ID: 'tme_slide_id'
    },
    
    /**
     * Save TME results to localStorage (browser-level backup)
     */
    saveResults(resultsData, jobId, slideId = null) {
        try {
            const dataToSave = {
                results: resultsData,
                jobId: jobId,
                slideId: slideId || this.getCurrentSlideId(),
                timestamp: new Date().toISOString(),
                version: '1.0'
            };
            
            localStorage.setItem(this.KEYS.RESULTS, JSON.stringify(dataToSave));
            console.log('✅ TME results saved to localStorage');
            return true;
        } catch (error) {
            console.error('Failed to save TME results:', error);
            // Handle quota exceeded error
            if (error.name === 'QuotaExceededError') {
                console.warn('LocalStorage quota exceeded, clearing old data...');
                this.clearResults();
            }
            return false;
        }
    },
    
    /**
     * Load TME results from localStorage
     */
    loadResults(slideId = null) {
        try {
            const resultsJson = localStorage.getItem(this.KEYS.RESULTS);
            
            if (!resultsJson) {
                return null;
            }
            
            const data = JSON.parse(resultsJson);
            
            // Check if results match current slide (optional)
            const currentSlideId = slideId || this.getCurrentSlideId();
            if (currentSlideId && data.slideId !== currentSlideId) {
                console.log('Stored results are for different slide, ignoring');
                return null;
            }
            
            return data;
        } catch (error) {
            console.error('Failed to load TME results:', error);
            return null;
        }
    },
    
    /**
     * Clear TME results from localStorage
     */
    clearResults() {
        try {
            localStorage.removeItem(this.KEYS.RESULTS);
            console.log('✅ TME results cleared from localStorage');
            return true;
        } catch (error) {
            console.error('Failed to clear TME results:', error);
            return false;
        }
    },
    
    /**
     * Check if results exist in localStorage
     */
    hasResults(slideId = null) {
        const data = this.loadResults(slideId);
        return data !== null;
    },
    
    /**
     * Get results age in hours
     */
    getResultsAge() {
        const data = this.loadResults();
        if (!data || !data.timestamp) return null;
        
        const savedDate = new Date(data.timestamp);
        const now = new Date();
        const diffMs = now - savedDate;
        return diffMs / (1000 * 60 * 60); // Convert to hours
    },
    
    /**
     * Get current slide ID from page
     */
    getCurrentSlideId() {
        // Try to get from polyscopeConfig
        if (window.polyscopeConfig && window.polyscopeConfig.contentId) {
            return window.polyscopeConfig.contentId;
        }
        
        // Try to find viewer dynamically
        for (let key in window) {
            try {
                const obj = window[key];
                if (obj && typeof obj === 'object' && obj.viewport && 
                    typeof obj.isOpen === 'function' && key !== 'viewer') {
                    return key;
                }
            } catch (e) { continue; }
        }
        
        return 'unknown_slide';
    },
    
    /**
     * Get storage info (for debugging)
     */
    getStorageInfo() {
        const data = this.loadResults();
        if (!data) {
            return {
                exists: false,
                size: 0
            };
        }
        
        const resultsJson = localStorage.getItem(this.KEYS.RESULTS);
        const sizeKB = (resultsJson.length / 1024).toFixed(2);
        
        return {
            exists: true,
            size: sizeKB + ' KB',
            slideId: data.slideId,
            timestamp: data.timestamp,
            age: this.getResultsAge().toFixed(1) + ' hours',
            jobId: data.jobId
        };
    },
    
    // ==========================================
    // ✅ NEW: VPS FILESYSTEM FUNCTIONS
    // ==========================================
    
    /**
     * Check if results exist on VPS filesystem for current slide
     */
    async checkVPSResults(filePath) {
        try {
            console.log('🔍 Checking VPS for existing results:', filePath);
            
            const formData = new FormData();
            formData.append('file_path', filePath);
            
            const response = await fetch('../ai_proxy.php?endpoint=check_results_tme', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                console.warn('VPS check failed:', response.status);
                return null;
            }
            
            const data = await response.json();
            console.log('VPS check result:', data);
            
            return data;
        } catch (error) {
            console.error('Failed to check VPS results:', error);
            return null;
        }
    },
    
    /**
     * Load results from VPS filesystem
     */
    async loadVPSResults(filePath) {
        try {
            console.log('📥 Loading results from VPS:', filePath);
            
            const formData = new FormData();
            formData.append('file_path', filePath);
            
            const response = await fetch('../ai_proxy.php?endpoint=load_results_tme', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                console.warn('Failed to load VPS results:', response.status);
                return null;
            }
            
            const results = await response.json();
            console.log('✅ Loaded results from VPS:', results);
            
            return results;
        } catch (error) {
            console.error('Failed to load VPS results:', error);
            return null;
        }
    },
    
    /**
     * Get overlay image URL from VPS filesystem
     */
    getVPSOverlayURL(filePath) {
        // Create FormData and convert to URL parameters
        const params = new URLSearchParams();
        params.append('file_path', filePath);
        
        // Return URL that can be used directly in img src or fetch
        return `../ai_proxy.php?endpoint=overlay_file_tme&${params.toString()}`;
    },
    
    /**
     * Master function: Try VPS first, fallback to localStorage
     */
    async loadResultsFromAnySource(filePath = null) {
        console.log('🔄 Loading results from any available source...');
        
        // 1. Try VPS filesystem first (most reliable)
        if (filePath) {
            const vpsCheck = await this.checkVPSResults(filePath);
            
            if (vpsCheck && vpsCheck.exists) {
                console.log('✅ Found results on VPS filesystem');
                const vpsResults = await this.loadVPSResults(filePath);
                
                if (vpsResults) {
                    // Also save to localStorage as cache
                    this.saveResults(vpsResults, vpsResults.job_id);
                    return {
                        source: 'vps',
                        results: vpsResults,
                        jobInfo: vpsCheck.job_info,
                        hasOverlay: vpsCheck.has_overlay
                    };
                }
            } else {
                console.log('ℹ️ No results found on VPS filesystem');
            }
        }
        
        // 2. Fallback to localStorage
        const localData = this.loadResults();
        if (localData) {
            console.log('✅ Found results in localStorage (browser cache)');
            return {
                source: 'localStorage',
                results: localData.results,
                jobId: localData.jobId,
                timestamp: localData.timestamp
            };
        }
        
        // 3. No results found anywhere
        console.log('ℹ️ No results found in VPS or localStorage');
        return null;
    }
};

/**
 * TME Notification System
 */
const TME_NOTIFICATIONS = {
    /**
     * Show notification banner
     */
    show(title, message, type = 'info', duration = 5000) {
        // Remove existing notification
        const existing = document.getElementById('tme-notification');
        if (existing) {
            existing.remove();
        }
        
        // Icon mapping
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        // Color mapping
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#007bff'
        };
        
        // Create notification
        const notification = document.createElement('div');
        notification.id = 'tme-notification';
        notification.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            max-width: 350px;
            padding: 15px 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            border-left: 4px solid ${colors[type]};
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: start; gap: 12px;">
                <div style="font-size: 20px;">
                    ${icons[type]}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; margin-bottom: 4px; font-size: 14px;">${title}</div>
                    <div style="font-size: 12px; color: #666;">${message}</div>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" 
                        style="border: none; background: none; cursor: pointer; font-size: 18px; color: #999; padding: 0; line-height: 1;">
                    ×
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.style.animation = 'slideOut 0.3s ease-in';
                    setTimeout(() => notification.remove(), 300);
                }
            }, duration);
        }
    },
    
    /**
     * Show success notification
     */
    success(title, message, duration = 5000) {
        this.show(title, message, 'success', duration);
    },
    
    /**
     * Show error notification
     */
    error(title, message, duration = 7000) {
        this.show(title, message, 'error', duration);
    },
    
    /**
     * Show warning notification
     */
    warning(title, message, duration = 6000) {
        this.show(title, message, 'warning', duration);
    },
    
    /**
     * Show info notification
     */
    info(title, message, duration = 5000) {
        this.show(title, message, 'info', duration);
    }
};

// Add CSS animations for notifications
(function addNotificationStyles() {
    if (document.getElementById('tme-notification-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'tme-notification-styles';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
})();

// Export to global scope
window.TME_STORAGE = TME_STORAGE;
window.TME_NOTIFICATIONS = TME_NOTIFICATIONS;