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
  
  // Touch tracking variables to detect scrolling vs tapping
  let touchStartY = 0;
  let touchStartX = 0;
  let isScrolling = false;
  let scrollLockTimer = null;
  let touchStartTime = 0;
  
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
    
    // Add global touch handlers for scroll detection
    document.addEventListener('touchstart', handleGlobalTouchStart, { passive: true });
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: true });
    document.addEventListener('touchend', handleGlobalTouchEnd, { passive: true });
    
    // Monitor tab changes to update active tab ID
    monitorTabChanges();
    
    // Prevent DataTables from capturing touch events in non-table tabs
    setupDataTablesOverride();
    
    logger.info('Mobile interactions initialized');
  };
  
  /**
   * Handle global touch start event for scroll detection
   */
  const handleGlobalTouchStart = (e) => {
    if (e.touches.length !== 1) return; // Only track single touches
    
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
    isScrolling = false;
    touchStartTime = Date.now();
    
    // Clear any existing scroll lock timer
    if (scrollLockTimer) {
      clearTimeout(scrollLockTimer);
      scrollLockTimer = null;
    }
  };
  
  /**
   * Handle global touch move event for scroll detection
   */
  const handleGlobalTouchMove = (e) => {
    if (e.touches.length !== 1 || !touchStartY) return;
    
    const touchY = e.touches[0].clientY;
    const touchX = e.touches[0].clientX;
    const deltaY = touchY - touchStartY;
    const deltaX = touchX - touchStartX;
    
    // Detect if user is scrolling (more vertical movement than horizontal)
    if (!isScrolling && Math.abs(deltaY) > 10 && Math.abs(deltaY) > Math.abs(deltaX)) {
      isScrolling = true;
      
      // Lock tab switching during scroll
      document.body.classList.add('is-scrolling');
      logger.debug('Scroll detected, locking tab switching');
    }
  };
  
  /**
   * Handle global touch end event for scroll detection
   */
  const handleGlobalTouchEnd = () => {
    // Keep the scroll lock active briefly after touch end
    // to prevent accidental tab switches at the end of scroll
    if (isScrolling) {
      scrollLockTimer = setTimeout(() => {
        document.body.classList.remove('is-scrolling');
        isScrolling = false;
        logger.debug('Scroll lock released');
      }, 300);
    }
    
    touchStartY = 0;
    touchStartX = 0;
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
      if (button && !document.body.classList.contains('is-scrolling')) {
        activeTabId = button.id;
        logger.debug(`Active tab changed to: ${activeTabId}`);
        
        // Re-apply the protection for the newly active section
        setTimeout(protectScrollableSections, 100);
      } else if (document.body.classList.contains('is-scrolling')) {
        // Prevent tab changes during scroll
        e.preventDefault();
        e.stopPropagation();
        logger.debug('Tab change prevented during scroll');
      }
    });
    
    // Also add direct touch handlers to prevent unwanted tab changes
    navBar.querySelectorAll('button').forEach(button => {
      button.addEventListener('touchstart', (e) => {
        // Store original button position to check if this is a scroll or a tap
        const rect = button.getBoundingClientRect();
        button.dataset.touchStartY = e.touches[0].clientY;
        button.dataset.touchStartX = e.touches[0].clientX;
        button.dataset.touchStartTop = rect.top;
      }, { passive: true });
      
      button.addEventListener('touchend', (e) => {
        // Check if this was a scroll or a real tap
        if (isScrolling || document.body.classList.contains('is-scrolling')) {
          // This was a scroll, prevent tab change
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
        
        // Check if button moved significantly (indicating a scroll rather than a tap)
        const currentRect = button.getBoundingClientRect();
        const startTop = parseFloat(button.dataset.touchStartTop || '0');
        
        if (Math.abs(currentRect.top - startTop) > 10) {
          // Button position changed significantly, likely a scroll
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }, { passive: false }); // Not passive to allow preventDefault
    });
  };
  
  /**
   * Override DataTables event handling in non-table tabs
   */
  const setupDataTablesOverride = () => {
    // Wait for DataTables to be loaded
    if (!window.jQuery?.fn?.dataTable) {
      setTimeout(setupDataTablesOverride, 500);
      return;
    }
    
    const $ = window.jQuery;
    
    // Store the original _fnDraw function
    const originalFnDraw = $.fn.dataTable.ext.internal._fnDraw;
    
    // Override the _fnDraw function to prevent table redraws during scrolling
    if (originalFnDraw) {
      $.fn.dataTable.ext.internal._fnDraw = function() {
        // Only allow drawing when in table tab or not scrolling
        if (activeTabId === 'mobile-table-btn' || (!isScrolling && !document.body.classList.contains('is-scrolling'))) {
          return originalFnDraw.apply(this, arguments);
        } else {
          logger.debug('Prevented DataTables draw during scroll in non-table tab');
          return;
        }
      };
    }
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
      section.removeEventListener('touchend', handleTouchEnd);
    });
    
    // Add touch event listeners to scrollable sections
    scrollableSections.forEach(section => {
      if (!section) return;
      
      section.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true });
      section.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
      section.addEventListener('touchend', handleTouchEnd, { passive: false, capture: true });
      
      // Add a visual indicator that this section has touch protection
      section.setAttribute('data-touch-protected', 'true');
      section.classList.add('touch-protected');
      
      logger.debug(`Touch protection added to section: ${section.id || section.className}`);
    });
    
    // If we're not in table view, add a global touch interceptor
    if (activeTabId !== 'mobile-table-btn') {
      const formSection = document.querySelector('.lg\\:col-span-1');
      if (formSection && !formSection.classList.contains('hidden')) {
        // Add special class for CSS styling
        formSection.classList.add('touch-protected');
        formSection.classList.add('current-mobile-tab');
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
   * Handle touch end events
   * Use capture phase to intercept before DataTables
   */
  const handleTouchEnd = (event) => {
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
        // Only enable touch handling when in the table tab and not scrolling
        if (activeTabId === 'mobile-table-btn' && !isScrolling && !document.body.classList.contains('is-scrolling')) {
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
