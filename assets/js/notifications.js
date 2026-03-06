// Modern Notification and Modal System
window.PolyscopeUI = {
  
    // Initialize the UI system
    init() {
      this.createNotificationContainer();
      this.setupModalCloseHandlers();
    },
    
    // Create notification container
    createNotificationContainer() {
      if (document.getElementById('notificationContainer')) return;
      
      const container = document.createElement('div');
      container.id = 'notificationContainer';
      container.className = 'notification-container';
      document.body.appendChild(container);
    },
    
    // Show notification
    notify(message, type = 'info', title = '', duration = 5000) {
      this.createNotificationContainer();
      
      const container = document.getElementById('notificationContainer');
      const notification = document.createElement('div');
      notification.className = `notification ${type}`;
      
      const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
      };
      
      const titles = {
        success: title || 'Success',
        error: title || 'Error',
        warning: title || 'Warning',
        info: title || 'Information'
      };
      
      notification.innerHTML = `
        <div class="notification-icon">${icons[type]}</div>
        <div class="notification-content">
          <div class="notification-title">${titles[type]}</div>
          <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        <div class="notification-progress"></div>
      `;
      
      container.appendChild(notification);
      
      // Animate in
      setTimeout(() => notification.classList.add('show'), 100);
      
      // Auto remove with progress bar
      if (duration > 0) {
        const progressBar = notification.querySelector('.notification-progress');
        progressBar.style.width = '100%';
        progressBar.style.transitionDuration = duration + 'ms';
        
        setTimeout(() => {
          progressBar.style.width = '0%';
        }, 100);
        
        setTimeout(() => {
          if (notification.parentElement) {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
          }
        }, duration);
      }
      
      return notification;
    },
    
    // Convenience methods
    success(message, title = '', duration = 4000) {
      return this.notify(message, 'success', title, duration);
    },
    
    error(message, title = '', duration = 6000) {
      return this.notify(message, 'error', title, duration);
    },
    
    warning(message, title = '', duration = 5000) {
      return this.notify(message, 'warning', title, duration);
    },
    
    info(message, title = '', duration = 4000) {
      return this.notify(message, 'info', title, duration);
    },
    
    // Show modal
    showModal(content, options = {}) {
      const defaults = {
        title: 'Modal',
        size: 'medium',
        closable: true,
        backdrop: true
      };
      
      const config = { ...defaults, ...options };
      
      // Remove existing modal
      this.closeModal();
      
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.id = 'currentModal';
      
      const modal = document.createElement('div');
      modal.className = `modal modal-${config.size}`;
      
      modal.innerHTML = `
        <div class="modal-header">
          <h3 class="modal-title">${config.title}</h3>
        </div>
        <div class="modal-body">
          ${content}
        </div>
      `;
      
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      
      // Show modal
      setTimeout(() => overlay.classList.add('active'), 100);
      
      // Close on backdrop click
      if (config.backdrop && config.closable) {
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            this.closeModal();
          }
        });
      }
      
      // Close on escape key
      if (config.closable) {
        const escapeHandler = (e) => {
          if (e.key === 'Escape') {
            this.closeModal();
            document.removeEventListener('keydown', escapeHandler);
          }
        };
        document.addEventListener('keydown', escapeHandler);
      }
      
      return overlay;
    },
    
    // Close modal
    closeModal() {
      const modal = document.getElementById('currentModal');
      if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
      }
    },
    
    // Show prompt modal
    // Replace the prompt method in your notifications.js with this enhanced debug version

    prompt(title, message = '', defaultValue = '', placeholder = '') {
        console.log('=== PROMPT METHOD CALLED ===');
        console.log('Title:', title);
        console.log('Message:', message);
        console.log('Default value:', defaultValue);
        
        return new Promise((resolve) => {
        const content = `
            <div class="form-group">
            <label class="form-label">${message}</label>
            <input type="text" class="form-input" id="promptInput" value="${defaultValue}" placeholder="${placeholder}" autocomplete="off">
            <div class="form-help">Press Enter to confirm or Escape to cancel</div>
            </div>
        `;
        
        const footer = `
            <div class="modal-footer">
            <button class="btn btn-outline" id="promptCancel">Cancel</button>
            <button class="btn btn-primary" id="promptConfirm">OK</button>
            </div>
        `;
        
        console.log('About to show modal...');
        const modal = this.showModal(content + footer, { title });
        console.log('Modal created:', modal);
        
        const input = modal.querySelector('#promptInput');
        const confirmBtn = modal.querySelector('#promptConfirm');
        const cancelBtn = modal.querySelector('#promptCancel');
        
        console.log('Input element:', input);
        console.log('Confirm button:', confirmBtn);
        console.log('Cancel button:', cancelBtn);
        
        // Focus input
        setTimeout(() => {
            if (input) {
            input.focus();
            input.select();
            console.log('Input focused and selected');
            }
        }, 300);
        
        const handleConfirm = () => {
            console.log('Confirm clicked');
            const value = input ? input.value.trim() : '';
            console.log('Input value:', value);
            this.closeModal();
            resolve(value || null);
        };
        
        const handleCancel = () => {
            console.log('Cancel clicked');
            this.closeModal();
            resolve(null);
        };
        
        // Event listeners
        if (confirmBtn) {
            confirmBtn.addEventListener('click', handleConfirm);
            console.log('Confirm button listener added');
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', handleCancel);
            console.log('Cancel button listener added');
        }
        
        if (input) {
            input.addEventListener('keydown', (e) => {
            console.log('Key pressed:', e.key);
            if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            }
            });
            console.log('Input keydown listener added');
        }
        
        // Handle modal overlay click to cancel
        modal.addEventListener('click', (e) => {
            console.log('Modal clicked, target:', e.target, 'modal:', modal);
            if (e.target === modal) {
            console.log('Overlay clicked - cancelling');
            handleCancel();
            }
        });
        
        console.log('=== PROMPT SETUP COMPLETE ===');
        });
    },
    
    // Show confirmation dialog
    confirm(title, message, type = 'warning') {
      return new Promise((resolve) => {
        const icons = {
          warning: '⚠️',
          danger: '🗑️',
          info: 'ℹ️'
        };
        
        const content = `
          <div class="confirmation-content">
            <div class="confirmation-icon ${type}">
              ${icons[type] || '❓'}
            </div>
            <div class="confirmation-title">${title}</div>
            <div class="confirmation-message">${message}</div>
          </div>
        `;
        
        const footer = `
          <div class="modal-footer">
            <button class="btn btn-outline" id="confirmCancel">Cancel</button>
            <button class="btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'}" id="confirmOk">
              ${type === 'danger' ? 'Delete' : 'OK'}
            </button>
          </div>
        `;
        
        const modal = this.showModal(content + footer, { 
          title: '',
          closable: true 
        });
        
        modal.querySelector('#confirmOk').addEventListener('click', () => {
          this.closeModal();
          resolve(true);
        });
        
        modal.querySelector('#confirmCancel').addEventListener('click', () => {
          this.closeModal();
          resolve(false);
        });
      });
    },
    
    // Setup modal close handlers
    setupModalCloseHandlers() {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const modal = document.getElementById('currentModal');
          if (modal && modal.classList.contains('active')) {
            this.closeModal();
          }
        }
      });
    }
  };