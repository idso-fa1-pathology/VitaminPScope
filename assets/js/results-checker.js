/**
 * Results Page Checker
 * Handles checking if user has processed slides and manages the "My Results" button
 */

class ResultsChecker {
    constructor() {
        this.username = window.PolyscopeConfig?.user?.username;
        this.resultsUrl = `/customers/${this.username}-mdanderson-org/`;
        this.resultsButton = null;
        this.hasResults = false;
        this.checkInterval = null;
        this.isInitialCheck = true;
        this.init();
    }

    init() {
        if (!this.username) {
            console.warn('ResultsChecker: Username not found');
            return;
        }

        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.resultsButton = document.querySelector('a[href*="/customers/"]');
        if (!this.resultsButton) {
            console.warn('ResultsChecker: Results button not found');
            return;
        }

        // Ensure PolyscopeUI is initialized
        if (window.PolyscopeUI && typeof window.PolyscopeUI.init === 'function') {
            window.PolyscopeUI.init();
        }

        // Check if results page exists initially
        this.checkResultsAvailability();
        
        // Add click handler to show notification if no results
        this.resultsButton.addEventListener('click', (e) => this.handleResultsClick(e));
    }

    startAutoCheck() {
        // Only start checking if no results found yet
        if (!this.hasResults && !this.checkInterval) {
            this.checkInterval = setInterval(() => {
                this.checkResultsAvailability();
            }, 5000); // Check every 5 seconds
        }
    }

    stopAutoCheck() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    destroy() {
        this.stopAutoCheck();
    }

    async checkResultsAvailability() {
        try {
            const response = await fetch(this.resultsUrl, {
                method: 'HEAD', // Only get headers, not content
                cache: 'no-cache'
            });

            const newHasResults = response.ok && response.status === 200;
            
            // If results just became available (state changed)
            if (!this.hasResults && newHasResults && !this.isInitialCheck) {
                this.notifyResultsAvailable();
                this.stopAutoCheck(); // Stop checking once results are found
            }
            
            this.hasResults = newHasResults;
            this.setButtonState(this.hasResults ? 'available' : 'unavailable');
            
            // Start auto-checking after initial check if no results
            if (this.isInitialCheck) {
                this.isInitialCheck = false;
                if (!this.hasResults) {
                    this.startAutoCheck();
                }
            }

        } catch (error) {
            console.warn('ResultsChecker: Error checking results availability:', error);
            this.hasResults = false;
            this.setButtonState('unavailable');
            
            if (this.isInitialCheck) {
                this.isInitialCheck = false;
                this.startAutoCheck();
            }
        }
    }

    setButtonState(state) {
        if (!this.resultsButton) return;

        // Remove existing state classes
        this.resultsButton.classList.remove('results-unavailable', 'results-available-highlight');
        
        switch (state) {
            case 'available':
                this.resultsButton.innerHTML = '📋 My Results';
                this.resultsButton.setAttribute('title', 'View your processed slide results');
                this.resultsButton.style.pointerEvents = 'auto';
                this.resultsButton.style.opacity = '1';
                this.resultsButton.classList.add('results-available-highlight');
                this.addButtonPulseEffect();
                break;
                
            case 'unavailable':
                this.resultsButton.classList.add('results-unavailable');
                this.resultsButton.innerHTML = '📋 My Results';
                this.resultsButton.setAttribute('title', 'No processed slides available yet. Process some slides first!');
                this.resultsButton.style.pointerEvents = 'auto'; // Allow clicking for notification
                this.resultsButton.style.opacity = '0.6';
                break;
        }
    }

    addButtonPulseEffect() {
        // Add pulsing animation to the button
        this.resultsButton.style.animation = 'resultsButtonPulse 2s ease-in-out 3';
        
        // Remove animation after it completes
        setTimeout(() => {
            this.resultsButton.style.animation = '';
            this.resultsButton.classList.remove('results-available-highlight');
        }, 6000);
    }

    notifyResultsAvailable() {
        // Show success notification using your existing system
        if (window.PolyscopeUI && window.PolyscopeUI.info) {
            window.PolyscopeUI.info(
                '🎉 Your slide processing is complete! Click "My Results" to view your processed slides.',
                'Results Available!',
                8000
            );
        }

        // Add CSS animation styles if they don't exist
        this.addAnimationStyles();
    }

    addAnimationStyles() {
        // Check if styles already exist
        if (document.getElementById('results-checker-styles')) return;

        const style = document.createElement('style');
        style.id = 'results-checker-styles';
        style.textContent = `
            @keyframes resultsButtonPulse {
                0% { 
                    transform: scale(1); 
                    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
                }
                50% { 
                    transform: scale(1.05); 
                    box-shadow: 0 0 0 10px rgba(34, 197, 94, 0);
                }
                100% { 
                    transform: scale(1); 
                    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
                }
            }

            .results-available-highlight {
                background-color: #22c55e !important;
                color: white !important;
                border-color: #16a34a !important;
            }

            .results-unavailable {
                opacity: 0.6;
            }
        `;
        document.head.appendChild(style);
    }

    handleResultsClick(e) {
        if (!this.hasResults) {
            e.preventDefault();
            
            // Use your existing notification system exactly like the original
            if (window.PolyscopeUI && window.PolyscopeUI.info) {
                window.PolyscopeUI.info(
                    'You haven\'t processed any slides yet. Upload and process some pathology slides first to see your results here.',
                    'No Results Available Yet',
                    5000
                );
            } else {
                // Fallback alert if PolyscopeUI isn't available
                alert('No results available yet.\n\nYou haven\'t processed any slides yet. Upload and process some pathology slides first to see your results here.');
            }

            // Highlight the upload area to guide users
            this.highlightUploadArea();
        }
    }

    highlightUploadArea() {
        const uploadZone = document.getElementById('uploadZone');
        const uploadBtn = document.getElementById('uploadBtn');
        
        if (uploadZone) {
            uploadZone.classList.add('highlight-pulse');
            setTimeout(() => {
                uploadZone.classList.remove('highlight-pulse');
            }, 3000);
        }
        
        if (uploadBtn) {
            uploadBtn.classList.add('btn-pulse');
            setTimeout(() => {
                uploadBtn.classList.remove('btn-pulse');
            }, 3000);
        }
    }

    // Method to refresh the check (can be called after processing completes)
    refreshCheck() {
        this.checkResultsAvailability();
    }
}

// Initialize when script loads
if (typeof window !== 'undefined') {
    window.ResultsChecker = ResultsChecker;
    
    // Auto-initialize and add styles
    const checker = new ResultsChecker();
    checker.addAnimationStyles();
}
