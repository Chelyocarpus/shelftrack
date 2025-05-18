// utils.js
(() => {
  const debounce = (fn, delay = 300) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  };

  const batchRequests = (requests, batchSize = 5) => {
    const results = [];
    for (let i = 0; i < requests.length; i += batchSize) {
      results.push(Promise.all(requests.slice(i, i + batchSize).map((req) => req())));
    }
    return Promise.all(results).then((batches) => batches.flat());
  };
  const showAlert = (message, { html = false, isConfirm = false, onConfirm = null, confirmText = 'Confirm', alertType = 'info', autoClose = 0 } = {}) => {
    const alertBox = document.getElementById('custom-alert');
    const alertMsg = document.getElementById('alert-message');
    const alertClose = document.getElementById('alert-close');
    const confirmButtons = document.getElementById('confirm-buttons');
    const cancelBtn = document.getElementById('cancel-action');
    const confirmBtn = document.getElementById('confirm-action');
    const alertTitle = document.querySelector('#custom-alert h3');
    
    if (!alertBox || !alertMsg) {
      // Fallback to console.log if alert box doesn't exist
      console.warn('Alert dialog elements not found, falling back to console');
      console.log(message);
      return;
    }
    
    // Clear any existing timeouts to prevent issues with multiple alerts
    if (window._alertTimeout) {
      clearTimeout(window._alertTimeout);
      window._alertTimeout = null;
    }
    
    // Remove 'hidden' class to show the alert
    alertBox.classList.remove('hidden');
    
    // Set content
    if (html) {
      alertMsg.innerHTML = message;
    } else {
      alertMsg.textContent = message;
    }
    
    // Apply different styles based on alert type
    alertBox.classList.remove('hidden', 'border-blue-500', 'border-green-500', 'border-red-500', 'border-yellow-500');
    alertBox.classList.add('border-l-4');
    
    // Update title and styling based on alert type
    if (alertTitle) {
      switch (alertType) {
        case 'success':
          alertTitle.textContent = 'Success';
          alertBox.classList.add('border-green-500');
          alertTitle.classList.remove('text-gray-800', 'text-red-700', 'text-yellow-700', 'text-blue-700');
          alertTitle.classList.add('text-green-700');
          break;
        case 'error':
          alertTitle.textContent = 'Error';
          alertBox.classList.add('border-red-500');
          alertTitle.classList.remove('text-gray-800', 'text-green-700', 'text-yellow-700', 'text-blue-700');
          alertTitle.classList.add('text-red-700');
          break;
        case 'warning':
          alertTitle.textContent = 'Warning';
          alertBox.classList.add('border-yellow-500');
          alertTitle.classList.remove('text-gray-800', 'text-green-700', 'text-red-700', 'text-blue-700');
          alertTitle.classList.add('text-yellow-700');
          break;
        default: // info
          alertTitle.textContent = 'Notification';
          alertBox.classList.add('border-blue-500');
          alertTitle.classList.remove('text-green-700', 'text-red-700', 'text-yellow-700');
          alertTitle.classList.add('text-gray-800');
      }
    }
    
    alertBox.setAttribute('aria-modal', 'true');
    alertBox.setAttribute('role', 'dialog');
    alertBox.tabIndex = -1;

    // Focus management
    setTimeout(() => {
      alertBox.focus();
    }, 10);
    
    // Store the original overflow value before changing it
    const originalOverflow = document.body.style.overflow;
    document.body.classList.add('modal-open');
    
    // Define all handlers first to avoid hoisting issues
    const closeAlert = () => {
      alertBox.classList.add('hidden');
      alertBox.removeAttribute('aria-modal');
      alertBox.removeAttribute('role');
      alertBox.removeAttribute('tabindex');
      
      // Remove event listeners to prevent memory leaks
      if (alertClose) alertClose.removeEventListener('click', closeAlert);
      if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
      if (confirmBtn) confirmBtn.removeEventListener('click', handleConfirm);
      document.removeEventListener('keydown', keyHandler);
      alertBox.removeEventListener('click', outsideClickHandler);
      
      // Restore the original overflow value
      document.body.style.overflow = originalOverflow;
      document.body.classList.remove('modal-open');
      
      // Additional safeguard to ensure scrolling is enabled
      setTimeout(() => {
        if (document.body.style.overflow === 'hidden') {
          document.body.style.overflow = '';
        }
      }, 300);
    };
    
    const handleCancel = () => {
      closeAlert();
    };
    
    const handleConfirm = () => {
      if (typeof onConfirm === 'function') {
        onConfirm();
      }
      closeAlert();
    };
      const keyHandler = (e) => {
      if (e.key === 'Escape') {
        if (window._alertTimeout) {
          clearTimeout(window._alertTimeout);
          window._alertTimeout = null;
        }
        closeAlert();
      } else if (e.key === 'Enter' && isConfirm) {
        // Enter key should trigger confirmation in confirm dialogs
        handleConfirm();
      }
    };
    
    const outsideClickHandler = (e) => {
      // Only close if clicking directly on the backdrop (alertBox), not its children
      if (e.target === alertBox) {
        if (window._alertTimeout) {
          clearTimeout(window._alertTimeout);
          window._alertTimeout = null;
        }
        closeAlert();
      }
    };
    
    // Handle confirmation dialogs
    if (isConfirm && confirmButtons && cancelBtn && confirmBtn) {
      confirmButtons.classList.remove('hidden');
      if (alertClose) alertClose.classList.add('hidden');
      
      // Make buttons touch-friendly with improved styling
      const cancelBtnClasses = 'min-w-[44px] min-h-[44px] px-4 py-2 text-base bg-gray-200 text-gray-700 rounded font-medium hover:bg-gray-300 focus:ring-2 focus:ring-gray-300 focus:outline-none';
      const confirmBtnClasses = 'min-w-[44px] min-h-[44px] px-4 py-2 text-base bg-primary-600 text-white rounded font-medium hover:bg-primary-700 focus:ring-2 focus:ring-primary-400 focus:outline-none';
      
      // Update button text based on context
      cancelBtn.textContent = 'Cancel';
      
      // Use the provided confirmText or fallback to contextual defaults
      if (confirmText) {
        confirmBtn.textContent = confirmText;
      } else {
        confirmBtn.textContent = message.toLowerCase().includes('remove') ? 'Remove' : 
                                message.toLowerCase().includes('group') ? 'Create Group' : 'Confirm';
      }
      
      // Apply classes
      cancelBtn.className = cancelBtnClasses;
      confirmBtn.className = 'ml-2 ' + confirmBtnClasses;
      
      // Set up event listeners
      cancelBtn.addEventListener('click', handleCancel);
      confirmBtn.addEventListener('click', handleConfirm);
      
      // Focus the confirm button
      setTimeout(() => confirmBtn.focus(), 10);
    } else {
      // For regular alerts, show only the OK button
      if (confirmButtons) confirmButtons.classList.add('hidden');
      if (alertClose) {
        alertClose.classList.remove('hidden');
        
        // Add event listener to the OK button
        alertClose.addEventListener('click', closeAlert);
        
        // Focus the OK button
        setTimeout(() => alertClose.focus(), 10);
      }
    }
      // Auto-close functionality
    if (autoClose > 0) {
      window._alertTimeout = setTimeout(closeAlert, autoClose);
    }
    
    // Handle escape key press to close alert
    document.addEventListener('keydown', keyHandler);
    
    // Handle click outside dialog to close
    alertBox.addEventListener('click', outsideClickHandler);
    
    // Prevent scroll when alert is open
    document.body.style.overflow = 'hidden';
  };

  const waitForElement = (selector, callback, maxAttempts = 10, interval = 100) => {
    let attempts = 0;
    
    const checkElement = () => {
      const element = document.querySelector(selector);
      if (element) {
        callback(element);
        return true;
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(checkElement, interval);
        return false;
      } else {
        console.warn(`Element ${selector} not found after ${maxAttempts} attempts`);
        return false;
      }
    };
    
    return checkElement();
  };

  const scrollToElement = (selector, options = {}) => {
    const { behavior = 'smooth', block = 'center', maxAttempts = 10, highlightClass } = options;
    
    waitForElement(selector, (element) => {
      element.scrollIntoView({ behavior, block });
      
      if (highlightClass) {
        element.classList.add(highlightClass);
      }
    }, maxAttempts);
  };

  const detectVirtualKeyboard = (() => {
    // Visual viewport API for detecting keyboard
    let keyboardOpen = false;
    let initialViewportHeight = window.innerHeight;
    
    // For iOS and Android
    const detectKeyboardChange = () => {
      // Visual Viewport API (modern browsers)
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
          const currentHeight = window.visualViewport.height;
          // If height decreased significantly, keyboard likely opened
          if (initialViewportHeight > currentHeight && initialViewportHeight - currentHeight > 150) {
            document.body.classList.add('keyboard-open');
            keyboardOpen = true;
          } else {
            document.body.classList.remove('keyboard-open');
            keyboardOpen = false;
          }
        });
      } else {
        // Fallback for browsers without Visual Viewport API
        window.addEventListener('resize', () => {
          const currentHeight = window.innerHeight;
          if (initialViewportHeight > currentHeight && initialViewportHeight - currentHeight > 150) {
            document.body.classList.add('keyboard-open');
            keyboardOpen = true;
          } else {
            document.body.classList.remove('keyboard-open');
            keyboardOpen = false;
          }
        });
      }
    };

    return {
      init: () => {
        // Store initial height on page load
        initialViewportHeight = window.innerHeight;
        detectKeyboardChange();
      },
      isKeyboardOpen: () => keyboardOpen
    };
  })();

  // Initialize keyboard detection
  if (typeof window !== 'undefined' && 'ontouchstart' in window) {
    window.addEventListener('DOMContentLoaded', () => {
      detectVirtualKeyboard.init();
    });
  }

  window.utils = { 
    debounce, 
    batchRequests, 
    showAlert, 
    waitForElement, 
    scrollToElement,
    detectVirtualKeyboard 
  };
})();
