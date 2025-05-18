/**
 * DataTables date sorting extension
 * Ensures ISO dates (YYYY-MM-DD) are properly sorted regardless of display format
 */

(function() {
  // Wait for DataTables to be available
  const initDateSorting = function() {
    if (typeof jQuery !== 'undefined' && jQuery.fn.dataTable) {
      // Create a custom ISO8601 date sorting plugin
      jQuery.extend(jQuery.fn.dataTable.ext.oSort, {
        "date-iso-pre": function(a) {
          // For objects/arrays, get the original data
          if (a && typeof a === 'object' && a.date) {
            return a.date;
          }
          
          // Extract the ISO date if it's from an element with data attribute
          if (typeof a === 'string' && a.indexOf('data-raw-date') !== -1) {
            const match = a.match(/data-raw-date="([^"]+)"/);
            if (match) return match[1];
          }
          
          // For regular ISO dates (YYYY-MM-DD)
          if (typeof a === 'string' && a.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return a;
          }
          
          // Fallback for any other format
          return '0000-00-00';
        },
        "date-iso-asc": function(a, b) {
          return ((a < b) ? -1 : ((a > b) ? 1 : 0));
        },
        "date-iso-desc": function(a, b) {
          return ((a < b) ? 1 : ((a > b) ? -1 : 0));
        }
      });
      
      // Register the custom type detector
      jQuery.fn.dataTable.ext.type.detect.unshift(function(d) {
        // Detect ISO dates or elements with data-raw-date attribute
        if (typeof d === 'string' && 
            (d.match(/^\d{4}-\d{2}-\d{2}$/) || d.indexOf('data-raw-date') !== -1)) {
          return 'date-iso';
        }
        return null;
      });
      
      console.log('DataTables date sorting plugin initialized');
    }
  };

  // If DOM is already loaded, initialize immediately
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initDateSorting, 1);
  } else {
    // Otherwise wait for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', initDateSorting);
  }
  
  // Also initialize when jQuery is loaded later
  const originalJQuery = window.jQuery;
  if (!originalJQuery) {
    Object.defineProperty(window, 'jQuery', {
      configurable: true,
      get: function() { 
        return originalJQuery;
      },
      set: function(newJQuery) {
        originalJQuery = newJQuery;
        if (newJQuery && newJQuery.fn) {
          setTimeout(initDateSorting, 100);
        }
        return true;
      }
    });
  }
})();
