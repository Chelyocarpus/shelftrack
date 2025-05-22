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

  // Configuration for the scanner - updated with better settings
  const scannerConfig = {
    fps: 10,
    // Instead of using a fixed qrbox, we'll calculate based on container size
    qrbox: (viewfinderWidth, viewfinderHeight) => {
      // Use 80% of the smaller dimension for the scanning square
      const minDimension = Math.min(viewfinderWidth, viewfinderHeight);
      const desiredWidth = Math.floor(minDimension * 0.8);
      
      return {
        width: desiredWidth,
        height: desiredWidth
      };
    },
    aspectRatio: 1.0, // Square aspect ratio for the video feed
    formatsToSupport: [
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.CODE_93,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.EAN_13,
    ],
    // Explicitly enable camera controls
    showTorchButtonIfSupported: true,
    showZoomSliderIfSupported: true,
    defaultZoomValueIfSupported: 1.5 // Start with slight zoom for better visibility
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
   * Initialize the scanner with proper DOM structure
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

      // Make sure container is visible and sized appropriately
      qrContainer.style.width = '100%';
      qrContainer.style.height = '300px'; // Use more explicit height for better visibility
      qrContainer.style.position = 'relative';
      qrContainer.classList.add('qr-container');

      // Create HTML5 QR scanner
      htmlScanner = new Html5Qrcode('qr-reader', { verbose: false });
      
      // Add styling to ensure the HTML5-QR-code library elements are visible
      setTimeout(() => {
        const scannerRegion = qrContainer.querySelector('#qr-shaded-region');
        const controlsElement = qrContainer.querySelector('.html5-qrcode-element');
        
        if (scannerRegion) {
          scannerRegion.style.borderRadius = '8px';
          scannerRegion.style.border = '2px solid rgba(0, 128, 255, 0.5)';
        }
        
        if (controlsElement) {
          controlsElement.style.marginTop = '10px';
        }
      }, 1000);

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
   * Open the QR scanner modal with improved camera access
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
      
      // Define camera configuration with explicit constraints for better camera control
      const cameraConfig = cameraId ? 
        { deviceId: { exact: cameraId } } : 
        { 
          facingMode: { exact: "environment" },
          // Add advanced constraints for better camera control
          advanced: [
            { zoom: { ideal: 1 } },
            { focusMode: { ideal: "continuous" } }
          ]
        };
      
      // Start scanning with the selected camera and explicit configuration
      await htmlScanner.start(
        cameraConfig,
        scannerConfig,
        handleScan,
        handleScanError
      );
      
      // Check for torch/flash availability after starting
      setTimeout(() => {
        if (htmlScanner.getRunningTrackCapabilities) {
          const capabilities = htmlScanner.getRunningTrackCapabilities();
          if (capabilities && capabilities.torch === true) {
            logger.log({
              level: 'info',
              message: 'Torch/flash is available'
            });
          } else {
            logger.log({
              level: 'info',
              message: 'Torch/flash is not available on this device'
            });
          }
        }
      }, 1000);
      
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
   * Close the QR scanner modal and clean up resources
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
    
    // Initialize scanner controls with a delay to allow the DOM to be ready
    setTimeout(() => {
      const scanButtons = document.querySelectorAll('#scan-shelf-btn, #scan-mobile-shelf-btn');
      scanButtons.forEach(button => {
        if (button) {
          button.addEventListener('click', (e) => {
            e.preventDefault();
            const input = button.id === 'scan-shelf-btn' ? 
              document.getElementById('shelf-number') : 
              document.getElementById('mobile-shelf-number');
            if (input) {
              openScanner(input);
            }
          });
        }
      });
    }, 500);
  });
  
  // Expose the scanner API globally
  window.qrScanner = {
    open: openScanner,
    close: closeScanner,
    isInitialized: () => scannerInitialized
  };
})();
