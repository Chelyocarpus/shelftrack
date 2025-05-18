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
    
    if (alertBox && alertMsg) {
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
        alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 10);
      
      // Store the original overflow value before changing it
      const originalOverflow = document.body.style.overflow;
      document.body.classList.add('modal-open');
      
      // Move function declarations to the top so they're available throughout
      const closeAlert = () => {
        alertBox.classList.add('hidden');
        alertBox.removeAttribute('aria-modal');
        alertBox.removeAttribute('role');
        alertBox.removeAttribute('tabindex');
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
      
      // Handle confirmation dialogs
      if (isConfirm && confirmButtons && cancelBtn && confirmBtn) {
        confirmButtons.classList.remove('hidden');
        alertClose.classList.add('hidden');
        
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
        
        confirmBtn.focus();
        
        cancelBtn.addEventListener('click', handleCancel);
        confirmBtn.addEventListener('click', handleConfirm);
      } else {
        if (confirmButtons) confirmButtons.classList.add('hidden');
        if (alertClose) {
          alertClose.classList.remove('hidden');
          alertClose.focus();
        }
      }
      
      // Auto-close functionality
      let autoCloseTimeout;
      if (autoClose > 0) {
        autoCloseTimeout = setTimeout(closeAlert, autoClose);
      }
      
      // Handle escape key press to close alert
      const keyHandler = (e) => {
        if (e.key === 'Escape') {
          if (autoCloseTimeout) {
            clearTimeout(autoCloseTimeout);
          }
          closeAlert();
        }
      };
      
      // Handle click outside dialog to close
      const outsideClickHandler = (e) => {
        if (e.target === alertBox) {
          if (autoCloseTimeout) {
            clearTimeout(autoCloseTimeout);
          }
          closeAlert();
        }
      };
      
      if (alertClose && !isConfirm) {
        alertClose.addEventListener('click', () => {
          if (autoCloseTimeout) {
            clearTimeout(autoCloseTimeout);
          }
          closeAlert();
        });
      }
      
      document.addEventListener('keydown', keyHandler);
      alertBox.addEventListener('click', outsideClickHandler);
      
      // Prevent scroll when alert is open
      document.body.style.overflow = 'hidden';
    }
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

  window.utils = { debounce, batchRequests, showAlert, waitForElement, scrollToElement };
})();
