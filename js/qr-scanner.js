/**
 * QR Code Scanner Utility
 * Provides enhanced QR/barcode scanning functionality with camera controls and error handling
 */

(function() {
  // Private variables
  let scanner = null;
  let currentCameraId = null;
  let targetInputElement = null;
  let scannerElement = null;
  let statusElement = null;
  let modalElement = null;
  let cameraSelectElement = null;
  let isScanning = false;
  
  const logger = window.logger || {
    log: (options) => console.log('[QRScanner]', typeof options === 'string' ? options : options.message),
    error: (msg) => console.error('[QRScanner]', msg),
    warn: (msg) => console.warn('[QRScanner]', msg),
    info: (msg) => console.info('[QRScanner]', msg)
  };
  
  // Scanner configuration
  const config = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1.0,
    formatsToSupport: [
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.CODE_128
    ]
  };
  
  // Initialize the scanner
  const initialize = () => {
    // Find UI elements
    scannerElement = document.getElementById('qr-reader');
    statusElement = document.getElementById('qr-scanner-status');
    modalElement = document.getElementById('qr-scanner-modal');
    cameraSelectElement = document.getElementById('qr-camera-select');
    
    if (!scannerElement) {
      logger.error('QR reader element not found');
      return false;
    }
    
    // Setup event listeners
    setupEventListeners();
    return true;
  };
  
  // Setup event listeners
  const setupEventListeners = () => {
    // Close button event
    const closeBtn = document.getElementById('close-qr-scanner');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        close();
      });
    }
    
    // Camera switcher
    if (cameraSelectElement) {
      cameraSelectElement.addEventListener('change', (e) => {
        if (isScanning && scanner) {
          const newCameraId = e.target.value;
          if (newCameraId !== currentCameraId) {
            stopScanner()
              .then(() => startScanner(newCameraId))
              .catch(err => {
                updateStatus('Failed to switch camera', 'error');
                logger.error('Camera switch failed', err);
              });
          }
        }
      });
    }
    
    // Scan buttons
    const setupScanButton = (btnId, inputId) => {
      const btn = document.getElementById(btnId);
      const input = document.getElementById(inputId);
      
      if (btn && input) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          open(input);
        });
        logger.info(`Initialized scan button: ${btnId} for input: ${inputId}`);
      } else {
        logger.warn(`Could not find scan button ${btnId} or input ${inputId}`);
      }
    };
    
    // Setup desktop and mobile scan buttons
    setupScanButton('scan-shelf-btn', 'shelf-number');
    setupScanButton('scan-mobile-shelf-btn', 'mobile-shelf-number');
    
    // Click outside to close
    if (modalElement) {
      modalElement.addEventListener('click', (e) => {
        // Only close if clicking on the backdrop, not the modal content
        if (e.target === modalElement) {
          close();
        }
      });
    }
    
    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalElement && !modalElement.classList.contains('hidden')) {
        close();
      }
    });
  };
  
  // Open scanner with target input
  const open = async (inputElement) => {
    if (!scannerElement || !modalElement || !statusElement) {
      logger.error('Required scanner elements not found');
      window.utils?.showAlert?.('QR Scanner Error: Required elements not found', { alertType: 'error' });
      return;
    }
    
    // Store target input
    targetInputElement = inputElement;
    
    // Ensure library is loaded
    try {
      if (window.loadQRScanner) {
        await window.loadQRScanner();
      }
      
      if (!window.Html5Qrcode) {
        throw new Error('QR Scanner library not loaded');
      }
    } catch (err) {
      logger.error('Failed to load QR Scanner library', err);
      window.utils?.showAlert?.('Could not load QR scanner. Please check your internet connection.', { alertType: 'error' });
      return;
    }
    
    // Show the modal
    modalElement.classList.remove('hidden');
    document.body.classList.add('modal-open');
    
    // Update status
    updateStatus('Requesting camera access...');
    
    try {
      // Get camera list
      const cameras = await Html5Qrcode.getCameras();
      
      // Populate camera select if available
      if (cameras.length > 1 && cameraSelectElement) {
        cameraSelectElement.innerHTML = '';
        cameras.forEach((camera) => {
          const option = document.createElement('option');
          option.value = camera.id;
          option.text = camera.label || `Camera ${cameras.indexOf(camera) + 1}`;
          cameraSelectElement.appendChild(option);
        });
        cameraSelectElement.closest('div').classList.remove('hidden');
      } else if (cameraSelectElement) {
        cameraSelectElement.closest('div').classList.add('hidden');
      }
      
      if (!cameras || cameras.length === 0) {
        updateStatus('No cameras found.', 'error');
        return;
      }
      
      // Start scanner with first camera
      await startScanner(cameras[0].id);
      
    } catch (err) {
      updateStatus('Camera access denied or error.', 'error');
      logger.error('Failed to start scanner', err);
    }
  };
  
  // Start scanning with specified camera
  const startScanner = async (cameraId) => {
    if (scanner) {
      await stopScanner();
    }
    
    try {
      // Create new scanner instance
      scanner = new Html5Qrcode(scannerElement.id);
      currentCameraId = cameraId;
      
      // Set camera selector if available
      if (cameraSelectElement) {
        cameraSelectElement.value = cameraId;
      }
      
      // Start scanning
      await scanner.start(
        cameraId,
        config,
        onScanSuccess,
        onScanFailure
      );
      
      isScanning = true;
      updateStatus('Camera activated. Align code within frame.');
      logger.info('Scanner started successfully');
      
      return true;
    } catch (err) {
      updateStatus(`Failed to start camera: ${err.message || 'Unknown error'}`, 'error');
      logger.error('Scanner start failed', err);
      
      return false;
    }
  };
  
  // Stop current scanner
  const stopScanner = async () => {
    if (scanner && isScanning) {
      try {
        await scanner.stop();
        await scanner.clear();
        isScanning = false;
        scanner = null;
        return true;
      } catch (err) {
        logger.warn('Error stopping scanner', err);
        return false;
      }
    }
    return true;
  };
  
  // Close scanner modal
  const close = async () => {
    await stopScanner();
    
    if (modalElement) {
      modalElement.classList.add('hidden');
    }
    
    document.body.classList.remove('modal-open');
    targetInputElement = null;
    
    if (statusElement) {
      statusElement.textContent = '';
    }
  };
  
  // Success callback when code is scanned
  const onScanSuccess = (decodedText) => {
    // Show success message
    updateStatus('Code detected!', 'success');
    
    // Set input value if target exists
    if (targetInputElement) {
      targetInputElement.value = decodedText;
      targetInputElement.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Flash success effect on input
      targetInputElement.classList.add('bg-green-100', 'border-green-500');
      setTimeout(() => {
        targetInputElement.classList.remove('bg-green-100', 'border-green-500');
      }, 2000);
    }
    
    // Close scanner after success with delay
    setTimeout(() => {
      close();
    }, 1000);
  };
  
  // Error/failure callback during scanning
  const onScanFailure = (error) => {
    // Only update for real errors, not just "code not found in frame"
    if (error.includes('Failed to decode')) {
      return;
    }
    
    if (error.includes('NotReadableError')) {
      updateStatus('Camera error: Device may be in use by another application', 'error');
    } else if (error.includes('PermissionDenied') || error.includes('NotAllowed')) {
      updateStatus('Camera permission denied', 'error');
    }
  };
  
  // Update status message
  const updateStatus = (message, type = 'info') => {
    if (!statusElement) return;
    
    // Clear existing classes
    statusElement.className = 'text-sm py-2 text-center';
    
    // Set appropriate styling
    switch (type) {
      case 'error':
        statusElement.innerHTML = `<span class="text-red-600"><i class="fas fa-exclamation-circle mr-1"></i>${message}</span>`;
        break;
      case 'success':
        statusElement.innerHTML = `<span class="text-green-600"><i class="fas fa-check-circle mr-1"></i>${message}</span>`;
        break;
      case 'warning':
        statusElement.innerHTML = `<span class="text-yellow-600"><i class="fas fa-exclamation-triangle mr-1"></i>${message}</span>`;
        break;
      default:
        statusElement.textContent = message;
    }
  };
  
  // Initialize on DOM ready
  const onDomReady = () => {
    if (initialize()) {
      logger.info('QR Scanner initialized successfully');
    }
  };
  
  // Set up initialization based on document state
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDomReady);
  } else {
    onDomReady();
  }
  
  // Expose public API
  window.qrScanner = {
    open,
    close,
    isInitialized: () => !!scannerElement
  };
})();
