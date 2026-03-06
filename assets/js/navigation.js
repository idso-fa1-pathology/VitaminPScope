// Navigation Management
window.PolyscopeNavigation = {
  
  currentView: 'fileManagerView',
  views: [],
  lastTransitionTime: 0,
  automaticTransitionEnabled: true,

  /**
   * Initialize navigation
   */
  init() {
    this.setupViews();
    this.setupEventListeners();
    this.showView('fileManagerView');
  },

  /**
   * Setup view configuration
   */
  setupViews() {
    this.views = [
      { id: 'fileManagerView', title: 'File Manager', icon: '📁' },
      { id: 'processingView', title: 'Processing Status', icon: '⚙️' }
    ];
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Navigation buttons (will be added to header)
    const prevBtn = document.getElementById('prevView');
    const nextBtn = document.getElementById('nextView');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.navigateRelative(-1));
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.navigateRelative(1));
    }

    // View indicators
    const indicators = document.querySelectorAll('.view-indicator');
    indicators.forEach(indicator => {
      indicator.addEventListener('click', () => {
        const viewId = indicator.dataset.view;
        if (viewId) {
          this.showView(viewId, true); // Manual transition
        }
      });
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return; // Don't navigate when typing
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          this.navigateRelative(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.navigateRelative(1);
          break;
        case 'Escape':
          e.preventDefault();
          this.closeModals();
          break;
        case '1':
          e.preventDefault();
          this.showView('fileManagerView', true);
          break;
        case '2':
          e.preventDefault();
          this.showView('processingView', true);
          break;
      }
    });

    // Auto-transition on inactivity
    this.setupAutoTransition();
  },

  /**
   * Navigate to relative view
   */
  navigateRelative(direction) {
    const currentIndex = this.getCurrentViewIndex();
    const newIndex = this.getValidViewIndex(currentIndex + direction);
    const newView = this.views[newIndex];
    
    if (newView) {
      this.showView(newView.id, true);
    }
  },

  /**
   * Get current view index
   */
  getCurrentViewIndex() {
    return this.views.findIndex(view => view.id === this.currentView);
  },

  /**
   * Get valid view index (wrapping around)
   */
  getValidViewIndex(index) {
    if (index < 0) return this.views.length - 1;
    if (index >= this.views.length) return 0;
    return index;
  },

  /**
   * Show specific view
   */
  showView(viewId, isManual = false) {
    // Check if transition is allowed
    if (!this.canTransition(isManual)) {
      return;
    }

    const targetView = this.views.find(view => view.id === viewId);
    if (!targetView) {
      console.warn(`View ${viewId} not found`);
      return;
    }

    // Hide all views
    this.views.forEach(view => {
      const element = document.getElementById(view.id);
      if (element) {
        element.classList.remove('active');
        element.style.display = 'none';
      }
    });

    // Show target view
    const targetElement = document.getElementById(viewId);
    if (targetElement) {
      targetElement.classList.add('active');
      targetElement.style.display = 'block';
    }

    // Update current view
    this.currentView = viewId;
    this.lastTransitionTime = Date.now();

    // Update indicators
    this.updateIndicators();

    // Update navigation buttons
    this.updateNavigationButtons();

    // Trigger view-specific initialization
    this.onViewChanged(viewId);

    // Emit event
    if (window.PolyscopeUtils && window.PolyscopeUtils.events) {
      window.PolyscopeUtils.events.emit('viewChanged', {
        viewId,
        isManual
      });
    }
  },

  /**
   * Check if transition is allowed
   */
  canTransition(isManual) {
    // Always allow manual transitions
    if (isManual) return true;

    // Check if enough time has passed for automatic transitions
    const timeSinceLastTransition = Date.now() - this.lastTransitionTime;
    const timeout = (window.PolyscopeConfig && window.PolyscopeConfig.timing && window.PolyscopeConfig.timing.automaticTimeout) || 5000;
    return timeSinceLastTransition >= timeout;
  },

  /**
   * Update view indicators
   */
  updateIndicators() {
    const indicators = document.querySelectorAll('.view-indicator');
    indicators.forEach(indicator => {
      const viewId = indicator.dataset.view;
      indicator.classList.toggle('active', viewId === this.currentView);
    });
  },

  /**
   * Update navigation button states
   */
  updateNavigationButtons() {
    const prevBtn = document.getElementById('prevView');
    const nextBtn = document.getElementById('nextView');
    const currentIndex = this.getCurrentViewIndex();

    if (prevBtn) {
      prevBtn.disabled = false; // Always enabled for circular navigation
    }

    if (nextBtn) {
      nextBtn.disabled = false; // Always enabled for circular navigation
    }

    // Update button text to show next/previous view names
    if (prevBtn) {
      const prevIndex = this.getValidViewIndex(currentIndex - 1);
      const prevView = this.views[prevIndex];
      prevBtn.title = `Previous: ${prevView.title} (←)`;
    }

    if (nextBtn) {
      const nextIndex = this.getValidViewIndex(currentIndex + 1);
      const nextView = this.views[nextIndex];
      nextBtn.title = `Next: ${nextView.title} (→)`;
    }
  },

  /**
   * Handle view-specific initialization
   */
  onViewChanged(viewId) {
    switch (viewId) {
      case 'fileManagerView':
        // Refresh file manager (with safety check)
        if (window.fileManager && typeof window.fileManager.refreshCurrentDirectory === 'function') {
          window.fileManager.refreshCurrentDirectory();
        } else {
          console.log('File manager not ready yet');
        }
        break;
        
      case 'processingView':
        // Refresh processing status (with safety check)
        if (window.dziProcessor && typeof window.dziProcessor.manualStatusCheck === 'function') {
          window.dziProcessor.manualStatusCheck();
          window.dziProcessor.updateProcessingUI();
        } else {
          console.log('DZI processor not ready yet');
        }
        break;
    }
  },

  /**
   * Setup automatic transition
   */
  setupAutoTransition() {
    // Auto-transition logic can be implemented here
    // For now, we'll rely on manual transitions and external triggers
  },

  /**
   * Trigger automatic transition to specific view
   */
  autoTransition(viewId) {
    if (this.automaticTransitionEnabled) {
      this.showView(viewId, false);
    }
  },

  /**
   * Enable/disable automatic transitions
   */
  setAutoTransition(enabled) {
    this.automaticTransitionEnabled = enabled;
    console.log('Auto-transition', enabled ? 'enabled' : 'disabled');
  },

  /**
   * Close any open modals
   */
  closeModals() {
    const modals = document.querySelectorAll('.modal.active');
    modals.forEach(modal => {
      modal.classList.remove('active');
    });

    // Close any other overlays
    const overlays = document.querySelectorAll('.loading-overlay.active');
    overlays.forEach(overlay => {
      overlay.classList.remove('active');
    });
  },

  /**
   * Get current view info
   */
  getCurrentView() {
    return this.views.find(view => view.id === this.currentView);
  },

  /**
   * Check if specific view is active
   */
  isViewActive(viewId) {
    return this.currentView === viewId;
  },

  /**
   * Add navigation controls to header
   */
  addNavigationControls() {
    const headerContent = document.querySelector('.header-content');
    const userInfo = headerContent.querySelector('.user-info');
    
    // Create navigation controls
    const navControls = document.createElement('div');
    navControls.className = 'nav-controls';
    navControls.innerHTML = `
      <div class="view-indicators">
        ${this.views.map(view => `
          <button class="view-indicator btn btn-outline btn-sm" data-view="${view.id}" title="${view.title}">
            ${view.icon}
          </button>
        `).join('')}
      </div>
      <div class="nav-buttons">
        <button id="prevView" class="btn btn-outline btn-sm" title="Previous View (←)">←</button>
        <button id="nextView" class="btn btn-outline btn-sm" title="Next View (→)">→</button>
      </div>
    `;
    
    headerContent.insertBefore(navControls, userInfo);
    
    // Re-setup event listeners for new buttons
    this.setupEventListeners();
  }
};