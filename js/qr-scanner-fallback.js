/**
 * QR scanner fallback loader
 * Ensures HTML5-QRCode library is available even if CDN load fails
 */

(function() {
  const CDN_URL = "https://unpkg.com/html5-qrcode@2.3.10/html5-qrcode.min.js";
  const ALTERNATE_CDN_URL = "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.10/html5-qrcode.min.js";
  
  function loadQRScanner() {
    // Check if already loaded
    if (window.Html5Qrcode) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
      console.log('[QRScanner] Loading HTML5-QRCode library from CDN...');
      
      const script = document.createElement('script');
      script.src = CDN_URL;
      script.async = true;
      
      script.onload = () => {
        console.log('[QRScanner] Library loaded successfully');
        resolve();
      };
      
      script.onerror = () => {
        console.warn('[QRScanner] Primary CDN failed, trying alternate source');
        const fallbackScript = document.createElement('script');
        fallbackScript.src = ALTERNATE_CDN_URL;
        fallbackScript.async = true;
        
        fallbackScript.onload = () => {
          console.log('[QRScanner] Library loaded from alternate CDN');
          resolve();
        };
        
        fallbackScript.onerror = () => {
          console.error('[QRScanner] Failed to load library from both sources');
          reject(new Error('Failed to load QR scanner library'));
        };
        
        document.head.appendChild(fallbackScript);
      };
      
      document.head.appendChild(script);
    });
  }
  
  // Attempt to load on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadQRScanner);
  } else {
    loadQRScanner();
  }
  
  // Expose loader function
  window.loadQRScanner = loadQRScanner;
})();
