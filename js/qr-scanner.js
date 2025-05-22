/**
 * QR and Barcode scanner utility using the html5-qrcode library
 * This utility provides functionality to scan barcodes and QR codes using the device camera
 */

(() => {
  // Default logger with fallback
  const logger = window.logger || {
    log: (options) => console.log('[QR-Scanner]', options?.message || options)
  };

  // Track scanner state
  let scannerInitialized = false;
  let htmlScanner = null;
  let targetInput = null;
  let lastScanned = null;
  let lastScannedTime = 0;

  // Configuration for the scanner
  const scannerConfig = {
    fps: 10,
    qrbox: { width: 250, height: 250 }, // Larger scan area for better QR code detection
    aspectRatio: 1.0,
    formatsToSupport: [
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.CODE_93,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.EAN_13,
    ],
    showTorchButtonIfSupported: true,
    showZoomSliderIfSupported: true
  };

  // Camera selection helper - prefers back facing camera
  const getCameraPreference = async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      
      if (devices && devices.length) {
        // Try to find back camera first (environment facing camera)
        const backCamera = devices.find(camera => 
          camera.label.toLowerCase().includes('back') || 
          camera.label.toLowerCase().includes('environment')
        );
        
        // If found back camera, use it
        if (backCamera) {
          logger.log({
            level: 'info',
            message: `Selected back camera: ${backCamera.label}`,
            cameraId: backCamera.id
          });
          return backCamera.id;
        }
        
        // Otherwise, use first available camera
        logger.log({
          level: 'info',
          message: `No back camera found, using first available: ${devices[0].label}`,
          cameraId: devices[0].id
        });
        return devices[0].id;
      }
      
      return null; // No cameras found
    } catch (error) {
      logger.log({
        level: 'error',
        message: 'Error getting cameras',
        error
      });
      return null;
    }
  };

  /**
   * Update the scanner status message
   */
  const updateScannerStatus = (message, isError = false) => {
    const statusEl = document.getElementById('qr-scanner-status');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = `text-sm text-center py-2 ${isError ? 'text-red-600' : 'text-gray-600'}`;
    }
  };

  /**
   * Initialize the scanner
   */
  const initializeScanner = async () => {
    if (scannerInitialized) return true;

    try {
      if (!Html5Qrcode) {
        updateScannerStatus('QR scanner library not loaded', true);
        return false;
      }

      const qrContainer = document.getElementById('qr-reader');
      if (!qrContainer) {
        logger.log({
          level: 'error',
          message: 'QR reader container not found'
        });
        return false;
      }

      htmlScanner = new Html5Qrcode('qr-reader');
      scannerInitialized = true;
      return true;
    } catch (error) {
      logger.log({
        level: 'error',
        message: 'Error initializing scanner',
        error
      });
      updateScannerStatus('Failed to initialize camera', true);
      return false;
    }
  };

  /**
   * Open the QR scanner modal
   */
  const openScanner = async (inputElement) => {
    // Store target input for later
    targetInput = inputElement;
    
    // Show the scanner modal
    const modal = document.getElementById('qr-scanner-modal');
    if (modal) {
      modal.classList.remove('hidden');
    }
    
    // Initialize scanner if not already done
    const isInitialized = await initializeScanner();
    if (!isInitialized) {
      updateScannerStatus('Could not initialize scanner', true);
      return;
    }
    
    updateScannerStatus('Starting camera...');
    
    try {
      // Get preferred camera (back camera)
      const cameraId = await getCameraPreference();
      
      // Start scanning with the selected camera
      await htmlScanner.start(
        cameraId || { facingMode: "environment" }, // Fallback to environment facing camera
        scannerConfig,
        handleScan,
        handleScanError
      );
      
      updateScannerStatus('Scanning... Point camera at barcode or QR code');
    } catch (error) {
      logger.log({
        level: 'error',
        message: 'Error starting scanner',
        error
      });
      updateScannerStatus('Failed to access camera. Please ensure camera permissions are granted.', true);
    }
  };
  
  /**
   * Close the QR scanner modal
   */
  const closeScanner = async () => {
    // Hide the scanner modal
    const modal = document.getElementById('qr-scanner-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
    
    // Stop the scanner if it's running
    if (htmlScanner && htmlScanner.isScanning) {
      try {
        await htmlScanner.stop();
        updateScannerStatus('');
      } catch (error) {
        logger.log({
          level: 'error',
          message: 'Error stopping scanner',
          error
        });
      }
    }
  };

  /**
   * Handle successful scan
   */
  const handleScan = (decodedText, decodedResult) => {
    // Debounce scans to prevent duplicates
    const now = Date.now();
    if (lastScanned === decodedText && now - lastScannedTime < 2000) {
      return;
    }
    
    lastScanned = decodedText;
    lastScannedTime = now;
    
    // Update the UI
    updateScannerStatus(`Scanned: ${decodedText}`);
    
    // Update the target input with the scanned value
    if (targetInput) {
      targetInput.value = decodedText;
      
      // Trigger input event for React or other frameworks
      const event = new Event('input', { bubbles: true });
      targetInput.dispatchEvent(event);
    }
    
    // Close the scanner after successful scan with a slight delay
    setTimeout(() => closeScanner(), 800);
    
    logger.log({
      level: 'info',
      message: 'Successfully scanned code',
      decodedText,
      format: decodedResult.result.format
    });
  };

  /**
   * Handle scan errors
   */
  const handleScanError = (error) => {
    // Don't show errors for normal scan attempts
    if (error === 'QR code parse error, error = Scan Error') {
      return;
    }
    
    logger.log({
      level: 'warn',
      message: 'QR scan error',
      error
    });
  };

  // Set up event listeners
  document.addEventListener('DOMContentLoaded', () => {
    // Close scanner button
    const closeButton = document.getElementById('close-qr-scanner');
    if (closeButton) {
      closeButton.addEventListener('click', closeScanner);
    }
    
    // Also close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeScanner();
      }
    });
  });
  
  // Expose the scanner API globally
  window.qrScanner = {
    open: openScanner,
    close: closeScanner,
    isInitialized: () => scannerInitialized
  };
})();
