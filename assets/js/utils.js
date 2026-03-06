// Polyscope Utilities
window.PolyscopeUtils = {
  string: {
    formatFileSize: function(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
  },
  dom: {
    createElement: function(tag, attributes) {
      attributes = attributes || {};
      const element = document.createElement(tag);
      Object.keys(attributes).forEach(function(key) {
        const value = attributes[key];
        if (key === 'className') {
          element.className = value;
        } else if (key === 'textContent') {
          element.textContent = value;
        } else {
          element.setAttribute(key, value);
        }
      });
      return element;
    }
  },
  events: {
    listeners: {},
    
    emit: function(eventName, data) {
      if (this.listeners[eventName]) {
        this.listeners[eventName].forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error('Event listener error:', error);
          }
        });
      }
    },
    
    on: function(eventName, callback) {
      if (!this.listeners[eventName]) {
        this.listeners[eventName] = [];
      }
      this.listeners[eventName].push(callback);
    },
    
    off: function(eventName, callback) {
      if (this.listeners[eventName]) {
        const index = this.listeners[eventName].indexOf(callback);
        if (index > -1) {
          this.listeners[eventName].splice(index, 1);
        }
      }
    }
  }
};

// Basic App Controller
window.PolyscopeApp = {
  showLoading: function(message) {
    message = message || 'Loading...';
    const overlay = document.getElementById('loadingOverlay');
    const text = overlay.querySelector('p');
    if (text) text.textContent = message;
    overlay.classList.add('active');
  },
  
  hideLoading: function() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.remove('active');
  }
};