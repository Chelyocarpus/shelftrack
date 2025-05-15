/**
 * Mobile interaction handler
 * Manages touch interactions for better mobile experience
 */

const MobileInteractions = (() => {
  // Create a fallback logger if the main logger is not available
  let logger;
  
  try {
    logger = window.logger || {
      info: (msg) => console.info('[Mobile]', msg),
      debug: (msg) => console.debug('[Mobile]', msg),
      warn: (msg) => console.warn('[Mobile]', msg),
      error: (msg) => console.error('[Mobile]', msg),
      log: (obj) => console.log('[Mobile]', obj)
    };
  } catch (e) {
    logger = {
      info: (msg) => console.info('[Mobile]', msg),
      debug: (msg) => console.debug('[Mobile]', msg),
      warn: (msg) => console.warn('[Mobile]', msg),
      error: (msg) => console.error('[Mobile]', msg),
      log: (obj) => console.log('[Mobile]', obj)
    };
  }
  
  // Store the current active tab to prevent DataTables from capturing events in other tabs
  let activeTabId = 'mobile-table-btn'; // Default to table view
  
  // DOM elements that should block DataTables touch events
  const getScrollableSections = () => {
    return [
      document.querySelector('#linked-shelves-container'),
      document.querySelector('#shelf-form')?.closest('.bg-white'),
      document.querySelector('#link-shelf-form')?.closest('.bg-white'),
      // Add any additional form containers that need protection
      document.querySelector('.lg\\:col-span-1')
    ].filter(Boolean); // Filter out null/undefined elements
  };

  /**
   * Initialize mobile interaction handlers
   */
  const init = () => {
    logger.info('Initializing mobile interactions');
    
    // Wait for DOM content to be loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initTouchHandlers);
    } else {
      initTouchHandlers();
    }
  };
  
  /**
   * Initialize all touch-related handlers
   */
  const initTouchHandlers = () => {
    // Check if it's a touch device
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) {
      logger.debug('Not a touch device, skipping mobile interactions setup');
      return;
    }
    
    setupTabIsolation();
    protectScrollableSections();
    configureDataTables();
    
    // Monitor tab changes to update active tab ID
    monitorTabChanges();
    
    logger.info('Mobile interactions initialized');
  };
  
  /**
   * Set up tab isolation to prevent interference between views
   */
  const setupTabIsolation = () => {
    const navButtons = document.querySelectorAll('#mobile-nav-bar button');
    
    if (!navButtons || navButtons.length === 0) {
      logger.debug('No mobile navigation buttons found, skipping tab isolation setup');
      return;
    }
    
    // Save default active tab
    const defaultActive = Array.from(navButtons).find(btn => 
      btn.classList.contains('bg-primary-600'));
    
    if (defaultActive) {
      activeTabId = defaultActive.id;
    }
    
    logger.debug(`Initial active tab: ${activeTabId}`);
  };
  
  /**
   * Monitor tab changes to update active tab ID
   */
  const monitorTabChanges = () => {
    const navBar = document.getElementById('mobile-nav-bar');
    
    if (!navBar) {
      logger.debug('No mobile navigation bar found, skipping tab change monitoring');
      return;
    }
    
    // Use event delegation to capture button clicks
    navBar.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (button) {
        activeTabId = button.id;
        logger.debug(`Active tab changed to: ${activeTabId}`);
        
        // Re-apply the protection for the newly active section
        setTimeout(protectScrollableSections, 100);
      }
    });
  };
  
  /**
   * Protect scrollable sections from DataTables capturing their touch events
   */
  const protectScrollableSections = () => {
    // Get scrollable sections that need protection
    const scrollableSections = getScrollableSections();
    
    // Remove any existing handlers to prevent duplicates
    scrollableSections.forEach(section => {
      if (!section) return;
      
      section.removeEventListener('touchstart', handleTouchStart);
      section.removeEventListener('touchmove', handleTouchMove);
    });
    
    // Add touch event listeners to scrollable sections
    scrollableSections.forEach(section => {
      if (!section) return;
      
      section.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true });
      section.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
      
      // Add a visual indicator that this section has touch protection
      section.setAttribute('data-touch-protected', 'true');
      
      logger.debug(`Touch protection added to section: ${section.id || section.className}`);
    });
    
    // If we're not in table view, add a global touch interceptor
    if (activeTabId !== 'mobile-table-btn') {
      const formSection = document.querySelector('.lg\\:col-span-1');
      if (formSection && !formSection.classList.contains('hidden')) {
        // Add special class for CSS styling
        formSection.classList.add('touch-protected');
      }
    }
  };
  
  /**
   * Handle touch start events
   * Use capture phase to intercept before DataTables
   */
  const handleTouchStart = (event) => {
    // Only stop propagation if we're not in the table tab
    if (activeTabId !== 'mobile-table-btn') {
      event.stopPropagation();
    }
  };
  
  /**
   * Handle touch move events
   * Use capture phase to intercept before DataTables
   */
  const handleTouchMove = (event) => {
    // Only stop propagation if we're not in the table tab
    if (activeTabId !== 'mobile-table-btn') {
      event.stopPropagation();
    }
  };
  
  /**
   * Configure DataTables for better mobile experience
   */
  const configureDataTables = () => {
    // If jQuery and DataTables are loaded, configure them
    if (!window.jQuery) {
      logger.warn('jQuery not available yet, waiting to configure DataTables');
      setTimeout(configureDataTables, 500);
      return;
    }
    
    const $ = window.jQuery;
    if (!$ || !$.fn || !$.fn.dataTable) {
      logger.warn('DataTables not available yet, waiting to configure');
      setTimeout(configureDataTables, 500);
      return;
    }
    
    // Extend DataTables settings for better mobile experience
    $.extend($.fn.dataTable.defaults, {
      responsive: true,
      // Reduce sensitivity of touch scroll detection
      touchThreshold: 10, // Higher threshold means less sensitive
    });
    
    // Add a custom check to prevent touch handling when not in table view
    const originalTouch = $.fn.dataTable.ext.features.touch;
    if (originalTouch) {
      $.fn.dataTable.ext.features.touch = function() {
        // Only enable touch handling when in the table tab
        if (activeTabId === 'mobile-table-btn') {
          return originalTouch.apply(this, arguments);
        }
        return false;
      };
    }
    
    logger.debug('DataTables mobile configuration applied with context awareness');
  };
  
  /**
   * Switch to a specific tab programmatically
   */
  const switchToTab = (tabId) => {
    const button = document.getElementById(tabId);
    if (button) {
      button.click();
      activeTabId = tabId;
      logger.debug(`Programmatically switched to tab: ${tabId}`);
    }
  };
  
  return {
    init,
    switchToTab
  };
})();

// Initialize the module if window is defined (browser environment)
if (typeof window !== 'undefined') {
  // Add to window object for access from app.js
  window.MobileInteractions = MobileInteractions;
}
