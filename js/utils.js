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

  const showAlert = (message, { html = false, isConfirm = false, onConfirm = null, confirmText = 'Confirm' } = {}) => {
    const alertBox = document.getElementById('custom-alert');
    const alertMsg = document.getElementById('alert-message');
    const alertClose = document.getElementById('alert-close');
    const confirmButtons = document.getElementById('confirm-buttons');
    const cancelBtn = document.getElementById('cancel-action');
    const confirmBtn = document.getElementById('confirm-action');
    
    if (alertBox && alertMsg) {
      if (html) {
        alertMsg.innerHTML = message;
      } else {
        alertMsg.textContent = message;
      }
      
      alertBox.classList.remove('hidden');
      
      // Move function declarations to the top so they're available throughout
      const closeAlert = () => {
        alertBox.classList.add('hidden');
        if (alertClose) alertClose.removeEventListener('click', closeAlert);
        if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
        if (confirmBtn) confirmBtn.removeEventListener('click', handleConfirm);
        document.removeEventListener('keydown', keyHandler);
        alertBox.removeEventListener('click', outsideClickHandler);
        document.body.style.overflow = '';
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
        if (alertClose) alertClose.classList.remove('hidden');
        alertClose.focus();
      }
      
      // Handle escape key press to close alert
      const keyHandler = (e) => {
        if (e.key === 'Escape') {
          closeAlert();
        }
      };
      
      // Handle click outside dialog to close
      const outsideClickHandler = (e) => {
        if (e.target === alertBox) {
          closeAlert();
        }
      };
      
      if (alertClose && !isConfirm) {
        alertClose.addEventListener('click', closeAlert);
      }
      
      document.addEventListener('keydown', keyHandler);
      alertBox.addEventListener('click', outsideClickHandler);
      
      // Prevent scroll when alert is open
      document.body.style.overflow = 'hidden';
    }
  };

  window.utils = { debounce, batchRequests, showAlert };
})();
