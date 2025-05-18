// app.js
// Ensure logger is available
const logger = window.logger || {
  log: (options) => console.log('[App]', typeof options === 'string' ? options : options.message, options),
  error: (msg) => console.error('[App]', msg),
  warn: (msg) => console.warn('[App]', msg),
  info: (msg) => console.info('[App]', msg),
  debug: (msg) => console.debug('[App]', msg)
};

const { 
  loadShelves, saveShelves, 
  loadGroups, saveGroups,
  linkShelves, linkShelfPair, unlinkShelves, 
  getLinkedShelves, cleanupGroups, removeShelfFromGroup,
  getAllGroups, getGroupForShelf, setGroupName
} = window.storage || {};
const { debounce, showAlert } = window.utils || { 
  debounce: (fn, delay = 300) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  },
  showAlert: (msg) => window.alert(msg)
};
const { log } = logger;

let shelves = loadShelves();
let recentlyAddedShelves = [];

const shelfForm = document.getElementById('shelf-form');
const shelfTableBody = document.getElementById('shelf-table-body');
const linkShelfForm = document.getElementById('link-shelf-form');

// Toggle the mobile add panel
const toggleMobileAddPanel = (show = true) => {
  const panel = document.getElementById('mobile-add-panel');
  const backdrop = document.getElementById('mobile-backdrop');
  
  // Close groups panel if open to avoid conflicts
  const groupsPanel = document.getElementById('mobile-groups-panel');
  if (groupsPanel && groupsPanel.classList.contains('open')) {
    groupsPanel.classList.remove('open');
  }
  
  if (panel) {
    if (show) {
      panel.classList.add('open');
      backdrop.classList.add('open');
      
      // Set focus on the first input field after a delay to allow animation to complete
      setTimeout(() => {
        const input = document.getElementById('mobile-shelf-number');
        if (input) {
          // Set focus but don't scroll yet - we'll handle that separately
          input.focus({preventScroll: true});
          
          // Manually scroll to make the input visible with extra padding for keyboard
          setTimeout(() => {
            // Scroll the panel to show the input
            const panelRect = panel.getBoundingClientRect();
            const inputRect = input.getBoundingClientRect();
            
            // Calculate how much to scroll to get input in viewport center
            const scrollAmount = inputRect.top - (window.innerHeight / 3);
            panel.scrollTop += scrollAmount;
          }, 100);
        }
      }, 300);
      
      // Store the original overflow value before changing it
      document.body.dataset.originalOverflow = document.body.style.overflow;
      // Prevent body scrolling
      document.body.style.overflow = 'hidden';
    } else {
      panel.classList.remove('open');
      backdrop.classList.remove('open');
      
      // Restore body scrolling using the stored value
      if (document.body.dataset.originalOverflow) {
        document.body.style.overflow = document.body.dataset.originalOverflow;
      } else {
        document.body.style.overflow = '';
      }
      
      // Reset scroll position for next time the panel opens
      panel.scrollTop = 0;
    }
  }
};

// Toggle the mobile groups panel - NEW
const toggleMobileGroupsPanel = (show = true) => {
  const panel = document.getElementById('mobile-groups-panel');
  const backdrop = document.getElementById('mobile-backdrop');
  
  // Close add panel if open to avoid conflicts
  const addPanel = document.getElementById('mobile-add-panel');
  if (addPanel && addPanel.classList.contains('open')) {
    addPanel.classList.remove('open');
  }
  
  if (panel) {
    if (show) {
      panel.classList.add('open');
      backdrop.classList.add('open');
      
      // Clone and update linked shelves content for mobile view
      const desktopContainer = document.getElementById('linked-shelves-container');
      const mobileContainer = document.getElementById('mobile-linked-shelves-container');
      
      if (desktopContainer && mobileContainer) {
        mobileContainer.innerHTML = desktopContainer.innerHTML;
      }
      
      // Store the original overflow value before changing it
      document.body.dataset.originalOverflow = document.body.style.overflow;
      // Prevent body scrolling
      document.body.style.overflow = 'hidden';
    } else {
      panel.classList.remove('open');
      backdrop.classList.remove('open');
      
      // Restore body scrolling using the stored value
      if (document.body.dataset.originalOverflow) {
        document.body.style.overflow = document.body.dataset.originalOverflow;
      } else {
        document.body.style.overflow = '';
      }
    }
  }
};

// Modified to sync dates across linked shelves
const saveAndRender = debounce(() => {
  // Before saving, ensure all linked shelves have the same most recent date
  const groups = getAllGroups();
  groups.forEach(group => {
    if (group.shelves && group.shelves.length > 1) {
      // Find the most recent date in the group
      let mostRecentDate = '';
      group.shelves.forEach(shelf => {
        if (shelves[shelf] && (!mostRecentDate || shelves[shelf] > mostRecentDate)) {
          mostRecentDate = shelves[shelf];
        }
      });
      
      // Apply the most recent date to all shelves in the group
      if (mostRecentDate) {
        group.shelves.forEach(shelf => {
          if (shelves[shelf] !== mostRecentDate) {
            shelves[shelf] = mostRecentDate;
            log({ level: 'info', message: `Updated shelf ${shelf} date to match group (${mostRecentDate})` });
          }
        });
      }
    }
  });

  saveShelves(shelves);
  cleanupGroups(shelves);
  renderTable();
  
  log({ level: 'info', message: 'Shelves updated', shelves });
}, 200);

shelfForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const shelfInput = document.getElementById('shelf-number');
  const dateInput = document.getElementById('inventory-date');
  const shelf = shelfInput.value.trim().toUpperCase();
  const date = dateInput.value;

  try {
    // Validate input
    if (!/^[A-Z0-9]{3}-[0-9]{2}\.[0-9]{3}$/.test(shelf)) {
      showAlert('Shelf number format is invalid.', { 
        html: true, 
        isConfirm: false,
        alertType: 'error'
      });
      return;
    }

    // Check if shelf already exists and show duplicate error
    if (shelves[shelf]) {
      showAlert(`
        <div class="flex items-start">
          <i class="fas fa-exclamation-triangle h-6 w-6 text-yellow-500 mr-2 flex-shrink-0" aria-hidden="true"></i>
          <div>
            <span class="font-medium">Duplicate Entry!</span>
            <p>Shelf <span class="font-mono font-medium">${shelf}</span> already exists with date ${formatDateDisplay(shelves[shelf])}.</p>
            <p class="mt-2">Would you like to update it to ${formatDateDisplay(date)}?</p>
          </div>
        </div>
      `, { 
        html: true, 
        alertType: 'warning',
        isConfirm: true,
        confirmText: 'Update',
        onConfirm: () => {
          // Update the shelf with new date
          shelves[shelf] = date;
          
          // Create a function to highlight and scroll after rendering
          const scrollToUpdatedRow = () => {
            const updatedRow = document.querySelector(`tr[data-shelf="${shelf}"]`);
            if (updatedRow) {
              updatedRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
              updatedRow.classList.add('highlight-new-row');
            }
          };
          
          // If DataTable exists, use its draw event
          if (window.shelfDataTable) {
            const drawListener = function() {
              scrollToUpdatedRow();
              // Remove the listener after it fires once
              window.shelfDataTable.off('draw.scroll');
            };
            // Register the listener for the next draw event
            window.shelfDataTable.on('draw.scroll', drawListener);
          }
          
          saveAndRender();
          
          // Show confirmation dialog for update
          showAlert(`
            <div class="flex items-center">
              <i class="fas fa-check-circle h-6 w-6 text-green-500 mr-2" aria-hidden="true"></i>
              <div>
                <span class="font-medium">Success!</span>
                <p>Shelf <span class="font-mono font-medium">${shelf}</span> was updated with date ${formatDateDisplay(date)}.</p>
              </div>
            </div>
          `, { 
            html: true, 
            alertType: 'success',
            autoClose: 2000 // Auto close after 2 seconds
          });
          
          // Clear inputs and focus
          shelfInput.value = '';
          dateInput.value = '';
          shelfInput.focus();
        }
      });
      return;
    }
    
    // If shelf doesn't exist, proceed with adding it
    shelves[shelf] = date;
    
    // Add to recently added shelves list with timestamp
    recentlyAddedShelves.push({
      shelf,
      timestamp: Date.now()
    });
    
    // Only keep the 5 most recent additions
    if (recentlyAddedShelves.length > 5) {
      recentlyAddedShelves.shift();
    }
    
    // Create a function to highlight and scroll after rendering
    const scrollToNewRow = () => {
      const newRow = document.querySelector(`tr[data-shelf="${shelf}"]`);
      if (newRow) {
        newRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };
    
    // If DataTable exists, use its draw event
    if (window.jQuery && window.jQuery.fn && window.jQuery.fn.dataTable) {
      const $ = window.jQuery;
      $(document).one('draw.dt', '#shelf-table', scrollToNewRow);
    }
    
    saveAndRender();
    
    // Close mobile panel if active
    const mobileShelfForm = document.getElementById('mobile-shelf-form');
    if (mobileShelfForm && mobileShelfForm.contains(shelfInput)) {
      toggleMobileAddPanel(false);
    }
    
    // Ensure body scrolling is restored
    document.body.style.overflow = '';
    
    // Show confirmation dialog
    showAlert(`
      <div class="flex items-center">
        <i class="fas fa-check-circle h-6 w-6 text-green-500 mr-2" aria-hidden="true"></i>
        <div>
          <span class="font-medium">Success!</span>
          <p>Shelf <span class="font-mono font-medium">${shelf}</span> was added with date ${formatDateDisplay(date)}.</p>
        </div>
      </div>
    `, { 
      html: true, 
      alertType: 'success',
      autoClose: 2000 // Auto close after 2 seconds
    });
    
    // Clear inputs and focus
    shelfInput.value = '';
    dateInput.value = '';
    shelfInput.focus();
  } 
  catch (error) {
    log({ level: 'error', message: 'Error adding shelf', error });
    showAlert(`
      <div class="flex items-start">
        <i class="fas fa-exclamation-circle h-6 w-6 text-red-500 mr-2 flex-shrink-0" aria-hidden="true"></i>
        <div>
          <span class="font-medium">Failed!</span>
          <p>Could not add shelf. Please try again.</p>
          <p class="text-sm text-gray-600 mt-1">${error.message || 'Unknown error'}</p>
        </div>
      </div>
    `, { 
      html: true, 
      alertType: 'error'
    });
    
    // Ensure body scrolling is restored even on error
    document.body.style.overflow = '';
  }
});

const checkInventory = (shelf) => {
  const today = new Date().toISOString().split('T')[0];
  const date = shelves[shelf];
  const linkedShelves = getLinkedShelves(shelf);
  let message = '';
  
  if (date < today) {
    message = `Inventory needed for shelf ${shelf}. Last date: ${formatDateDisplay(date)}`;
  } else {
    message = `No inventory needed for shelf ${shelf}. Last date: ${formatDateDisplay(date)}`;
  }
  
  if (linkedShelves.length > 0) {
    message += `<br><br><span class="font-semibold">Linked shelves:</span><ul class="mt-2 ml-4 list-disc">`;
    linkedShelves.forEach(linkedShelf => {
      const linkedDate = shelves[linkedShelf];
      message += `<li><span class="font-mono">${linkedShelf}</span>: ${formatDateDisplay(linkedDate)}</li>`;
    });
    message += '</ul>';
  }
  
  showAlert(message, { html: true });
};

const removeShelf = (shelf) => {
  window.utils.showAlert(`Are you sure you want to remove shelf <span class='font-mono font-semibold'>${shelf}</span>?`, { 
    html: true,
    isConfirm: true,
    onConfirm: () => {
      // Store the linked shelves before removing, to mention in the confirmation message
      const linkedShelves = getLinkedShelves(shelf);
      
      // First remove the shelf from any groups it belongs to
      removeShelfFromGroup(shelf);
      
      // Then delete it from the shelves object
      delete shelves[shelf];
      
      // Save changes to local storage and re-render the UI
      saveShelves(shelves);
      
      // Properly clean up groups that might now be invalid
      cleanupGroups(shelves);
      
      // Show confirmation with details
      window.utils.showAlert(`
        <div class="flex items-start">
          <i class="fas fa-check-circle h-6 w-6 text-green-500 mr-2" aria-hidden="true"></i>
          <div>
            <span class="font-medium">Success!</span>
            <p>Shelf <span class="font-mono font-medium">${shelf}</span> was removed.</p>
            ${linkedShelves.length ? `<p class="mt-1 text-sm">This shelf was also removed from its group.</p>` : ''}
          </div>
        </div>
      `, { 
        html: true, 
        alertType: 'success',
        autoClose: 2000
      });
      
      // Re-render the table after the shelf is removed
      renderTable();
      
      // Update mobile view if it exists
      if (window.MobileInteractions?.refreshData) {
        window.MobileInteractions.refreshData();
      }
    }
  });
};

// Ensure dates sync properly when linking shelves 
const linkShelvesUI = () => {
  const shelf1Select = document.getElementById('link-shelf-1');
  const shelf2Select = document.getElementById('link-shelf-2');
  
  if (shelf1Select && shelf2Select) {
    const shelf1 = shelf1Select.value;
    const shelf2 = shelf2Select.value;
    
    if (shelf1 === shelf2) {
      showAlert('Cannot link a shelf to itself.');
      return;
    }
    
    // Find the most recent date between these shelves
    const date1 = shelves[shelf1] || '';
    const date2 = shelves[shelf2] || '';
    const mostRecentDate = date1 > date2 ? date1 : date2;
    
    // Update both shelves with the most recent date
    if (mostRecentDate) {
      shelves[shelf1] = mostRecentDate;
      shelves[shelf2] = mostRecentDate;
      log({ level: 'info', message: `Synced dates for linked shelves to ${mostRecentDate}`, shelves: [shelf1, shelf2] });
    }
    
    // Use linkShelfPair to link the shelves
    linkShelfPair(shelf1, shelf2);
    
    // Save changes and render
    saveShelves(shelves);
    renderTable();
    showAlert(`Successfully linked shelves ${shelf1} and ${shelf2}.`);
  }
};

const unlinkShelvesUI = (shelf1, shelf2) => {
  window.utils.showAlert(`Are you sure you want to unlink shelves <span class='font-mono'>${shelf1}</span> and <span class='font-mono'>${shelf2}</span>?`, { 
    html: true,
    isConfirm: true,
    onConfirm: () => {
      unlinkShelves(shelf1, shelf2);
      renderTable();
      showAlert(`Shelves ${shelf1} and ${shelf2} have been unlinked.`);
    }
  });
};

const getShelvesArray = () => Object.entries(shelves);

// Helper to format date as DD.MM.YYYY
const formatDateDisplay = (isoDate) => {
  if (!isoDate) {
    return '';
  }
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) {
    return isoDate;
  }
  return `${day}.${month}.${year}`;
};

// Enhanced getDateStatus function with more detailed inventory status
const getDateStatus = (date) => {
  const today = new Date();
  const dateObj = new Date(date);
  today.setHours(0, 0, 0, 0);
  dateObj.setHours(0, 0, 0, 0);
  
  if (dateObj < today) {
    // Calculate how many days overdue
    const daysDiff = Math.floor((today - dateObj) / (1000 * 60 * 60 * 24));
    return { 
      status: 'expired', 
      daysDiff,
      label: daysDiff === 1 ? '1 day overdue' : `${daysDiff} days overdue`
    };
  }
  
  const diffDays = Math.floor((dateObj - today) / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) {
    return { 
      status: 'approaching', 
      daysDiff: diffDays,
      label: diffDays === 0 ? 'Due today' : diffDays === 1 ? 'Due tomorrow' : `Due in ${diffDays} days`
    };
  }
  
  return { 
    status: 'current', 
    daysDiff: diffDays,
    label: `Due in ${diffDays} days`
  };
};

// Function to update the dashboard statistics
const updateDashboard = (shelfData) => {
  const counts = {
    expired: 0,
    approaching: 0,
    current: 0
  };
  
  // Count shelves by status
  shelfData.forEach(item => {
    if (item.status.status === 'expired') {
      counts.expired++;
    } else if (item.status.status === 'approaching') {
      counts.approaching++;
    } else {
      counts.current++;
    }
  });
  
  // Update the dashboard elements
  const overdueElement = document.getElementById('overdue-value');
  const upcomingElement = document.getElementById('upcoming-value');
  const currentElement = document.getElementById('current-value');
  
  if (overdueElement) {
    overdueElement.textContent = counts.expired;
  }
  
  if (upcomingElement) {
    upcomingElement.textContent = counts.approaching;
  }
  
  if (currentElement) {
    currentElement.textContent = counts.current;
  }
  
  // Add badge to page title if there are overdue shelves
  if (counts.expired > 0) {
    document.title = `(${counts.expired}) ShelfTrack| Inventory Schedule Management`;
  } else {
    document.title = `ShelfTrack | Inventory Schedule Management`;
  }
};

const renderTable = () => {
  // Prepare data for DataTable with raw dates and links
  const groups = loadGroups();
  const shelfArr = getShelvesArray().map(([shelf, date]) => {
    // Find which group this shelf belongs to, if any
    const linkedShelves = getLinkedShelves(shelf);
    const status = getDateStatus(date);
    
    return {
      shelf,
      date,
      status,
      displayDate: formatDateDisplay(date),
      links: linkedShelves
    };
  });

  // Update the dashboard with the current data
  updateDashboard(shelfArr);

  // Destroy previous DataTable instance if exists
  if (window.shelfDataTable) {
    window.shelfDataTable.destroy();
    window.shelfDataTable = null;
  }

  // Clear table body
  shelfTableBody.innerHTML = '';
  
  const jq = window.jQuery || window.$;
  if (jq && typeof jq === 'function' && jq.fn && jq.fn.dataTable) {
    // Before creating a new DataTable, trigger a custom event to notify any listeners 
    // that the table is about to be re-rendered
    jq(document).trigger('beforeTableRender');
    
    window.shelfDataTable = jq('#shelf-table').DataTable({
      destroy: true,
      data: shelfArr,
      columns: [
        { 
          data: 'shelf',
          className: 'px-4 py-3 font-mono',
          render: function(data, type, row) {
            // Show link icon if shelf has links
            // Also show the status label below the shelf code
            if (type === 'display') {
              let statusClass = '';
              let statusIcon = '';

              if (row.status.status === 'expired') {
                statusIcon = '<i class="fas fa-exclamation-circle text-red-500 mr-1"></i>';
                statusClass = 'text-red-600 font-medium';
              } else if (row.status.status === 'approaching') {
                statusIcon = '<i class="fas fa-clock text-yellow-500 mr-1"></i>';
                statusClass = 'text-yellow-600';
              } else {
                statusIcon = '<i class="fas fa-check text-green-500 mr-1"></i>';
                statusClass = 'text-green-600';
              }

              return `
                <div>
                  <span>${data} ${row.links && row.links.length > 0 ? 
                    '<i class="fas fa-link text-primary-500 ml-1" aria-hidden="true" title="Linked shelves"></i>' : 
                    ''}
                  </span>
                  <div class="text-xs mt-1 ${statusClass} flex items-center">
                    ${statusIcon}${row.status.label}
                  </div>
                </div>`;
            }
            return data;
          }
        },
        { 
          data: null,
          className: 'px-4 py-3 text-sm editable-date cursor-pointer underline decoration-dotted decoration-primary-400 transition-colors focus:bg-primary-100',
          render: function(data) {
            // Only show the date value with its edit icon - status moved to shelf column
            let statusClass = '';
            
            if (data.status.status === 'expired') {
              statusClass = 'text-red-600 font-semibold';
            } else if (data.status.status === 'approaching') {
              statusClass = 'text-yellow-600';
            } else {
              statusClass = 'text-green-600';
            }
            
            return `
              <span class="date-value ${statusClass}" data-raw-date="${data.date}">${data.displayDate}</span>
              <span class="sr-only">(editable)</span>
              <i class="fas fa-pencil-alt ml-1 text-primary-400 align-text-bottom pointer-events-none" aria-hidden="true"></i>`;
          }
        },
        {
          data: 'shelf',
          className: 'px-4 py-3',
          render: function(shelf) {
            return `
              <div class="flex">
                <button class="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 active:bg-red-800 min-w-[44px] min-h-[44px] transition-colors mr-2" 
                  aria-label="Remove ${shelf}" 
                  onclick="window.app.removeShelf('${shelf}')">
                  <i class="fas fa-trash mr-1"></i> Remove
                </button>
                <button class="bg-primary-600 text-white px-4 py-2 rounded text-sm hover:bg-primary-700 active:bg-primary-800 min-w-[44px] min-h-[44px] transition-colors" 
                  aria-label="Mark inventory complete for ${shelf}" 
                  onclick="window.app.markInventoryComplete('${shelf}')">
                  <i class="fas fa-check-circle mr-1"></i> Done
                </button>
              </div>`;
          }
        }
      ],
      // Use raw date for sorting
      order: [[1, 'asc']],
      createdRow: function(row, data) {
        // Add data attribute for shelf identification
        jq(row).attr('data-shelf', data.shelf);
        
        const baseClasses = 'transition-colors border-b';
        
        // Check if this shelf was recently added (within last 30 seconds)
        const recentlyAdded = recentlyAddedShelves.find(item => 
          item.shelf === data.shelf && (Date.now() - item.timestamp) < 30000
        );
        
        if (recentlyAdded) {
          // Apply highlight animation for recently added shelves
          jq(row).addClass(`${baseClasses} highlight-new-row`);
          
          // Add "NEW" badge
          const firstCell = jq(row).find('td:first-child');
          firstCell.append('<span class="ml-2 inline-block px-1.5 py-0.5 text-xs font-bold bg-green-500 text-white rounded animate-pulse">NEW</span>');
        }
        else if (data.status.status === 'expired') {
          jq(row).addClass(`${baseClasses} !bg-red-100`).hover(
            function() { jq(this).addClass('!bg-red-200'); },
            function() { jq(this).removeClass('!bg-red-200'); }
          );
        } else if (data.status.status === 'approaching') {
          jq(row).addClass(`${baseClasses} !bg-yellow-100`).hover(
            function() { jq(this).addClass('!bg-yellow-200'); },
            function() { jq(this).removeClass('!bg-yellow-200'); }
          );
        } else {
          jq(row).addClass(`${baseClasses}`).hover(
            function() { jq(this).addClass('!bg-gray-50'); },
            function() { jq(this).removeClass('!bg-gray-50'); }
          );
        }

        // Add data attributes for editing
        jq(row).find('.editable-date').attr('data-shelf', data.shelf);
        
        // Add hover tooltip for linked shelves
        if (data.links && data.links.length > 0) {
          jq(row).find('td:first-child').attr('title', `Linked to: ${data.links.join(', ')}`);
        }
      },
      paging: true,
      pageLength: 5,
      lengthMenu: [5, 10, 25, 50],
      searching: true,
      ordering: true,
      info: true,
      responsive: true,
      autoWidth: false,
      dom: '<"flex flex-col md:flex-row justify-between items-center mb-4"<"flex-none mb-2 md:mb-0"l><"flex-none"f>>rtip',
      columnDefs: [
        { orderable: true, targets: [0, 1] },
        { orderable: false, targets: 2 },
        { searchable: false, targets: 2 }
      ],
      language: {
        search: 'Search:',
        lengthMenu: 'Show _MENU_',
        info: 'Showing _START_ to _END_ of _TOTAL_ shelves',
        paginate: { 
          previous: '<span aria-hidden="true">&laquo;</span>',
          next: '<span aria-hidden="true">&raquo;</span>'
        },
        emptyTable: 'No shelves to inventory - add one to get started'
      },
      // Remove scrollY and scrollCollapse to let table content spill
      scrollY: '',
      scrollCollapse: false,
      initComplete: function() {
        // Add custom styling to DataTables elements
        jq('.dataTables_length select').addClass('border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-400');
        jq('.dataTables_filter input').addClass('border rounded px-3 py-1 ml-2 focus:outline-none focus:ring-1 focus:ring-primary-400');
        jq('.dataTables_paginate .paginate_button').addClass('px-3 py-1 border rounded mx-1 hover:bg-gray-100');
        jq('.dataTables_paginate .paginate_button.current').addClass('bg-primary-50 text-primary-700 border-primary-300');
        
        // Clean up stale recently added shelves (older than 30 seconds)
        recentlyAddedShelves = recentlyAddedShelves.filter(item => 
          (Date.now() - item.timestamp) < 30000
        );

        // Use event delegation for date editing instead of attaching to each cell
        setupDateEditingWithDelegation();
      },
      // Add a custom order to prioritize expired shelves first
      rowCallback: function(row, data) {
        if (data.status.status === 'expired') {
          jq(row).addClass('priority-high');
        } else if (data.status.status === 'approaching') {
          jq(row).addClass('priority-medium');
        } else {
          jq(row).addClass('priority-low');
        }
      }
    });

    // Add page change listener to ensure edit handlers work properly
    window.shelfDataTable.on('page.dt', function() {
      // Let the table render the new page before reattaching handlers
      setTimeout(() => {
        log({ level: 'info', message: 'DataTable page changed, refreshing edit handlers' });
      }, 100); // Small delay to ensure DOM has updated
    });

    // Add enhanced legend after table
    const legend = `
      <div class="mt-4 text-sm flex flex-wrap gap-4">
        <span class="flex items-center">
          <span class="w-4 h-4 inline-block mr-2 bg-red-100"></span>
          <i class="fas fa-exclamation-circle text-red-500 mr-1"></i>
          Overdue - Inventory needed
        </span>
        <span class="flex items-center">
          <span class="w-4 h-4 inline-block mr-2 bg-yellow-100"></span>
          <i class="fas fa-clock text-yellow-500 mr-1"></i>
          Due within 7 days
        </span>
        <span class="flex items-center">
          <span class="w-4 h-4 inline-block mr-2 bg-white border"></span>
          <i class="fas fa-check text-green-500 mr-1"></i>
          Current - No action needed
        </span>
      </div>`;
    jq('#shelf-table_wrapper').append(legend);
  }

  // Use event delegation instead of attaching directly to each cell
  setupDateEditingWithDelegation();
  
  // Update the linked shelves panel
  renderLinkedShelvesPanel();
  renderLinkOptions();
};

// New function to set up date editing with event delegation
const setupDateEditingWithDelegation = () => {
  // Remove any existing delegated event handlers first to prevent duplicates
  const table = document.getElementById('shelf-table');
  if (!table) return;

  // Remove previous event listeners if any
  table.removeEventListener('click', handleDateCellClick);
  table.removeEventListener('touchend', handleDateCellTouch);
  
  // Add event delegation for clicks
  table.addEventListener('click', handleDateCellClick);
  
  // Add event delegation for touch events
  table.addEventListener('touchend', handleDateCellTouch);
};

// Event handler for date cell clicks
const handleDateCellClick = (e) => {
  const cell = e.target.closest('.editable-date');
  if (cell && !cell.querySelector('input')) {
    startCellEdit(cell);
  }
};

// Event handler for date cell touch events
const handleDateCellTouch = (e) => {
  const cell = e.target.closest('.editable-date');
  if (cell && !cell.querySelector('input')) {
    e.preventDefault(); // Prevent default touch actions
    startCellEdit(cell);
  }
};

// Function to start cell editing
const startCellEdit = (cell) => {
  // Don't start editing if already editing
  if (cell.querySelector('input') || !cell.dataset.shelf) return;
  
  const shelf = cell.dataset.shelf;
  const oldDate = shelves[shelf];
  const dateSpan = cell.querySelector('.date-value');
  const editIcon = cell.querySelector('.fa-pencil-alt');
  
  if (!dateSpan) return;

  // Hide the date text and icon, but keep them in DOM
  dateSpan.style.display = 'none';
  if (editIcon) editIcon.style.display = 'none';

  // Create input element
  const input = document.createElement('input');
  input.type = 'date';
  input.value = oldDate;
  input.className = 'border border-primary-400 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-primary-400 bg-primary-50 touch-manipulation';
  input.setAttribute('aria-label', `Change date for ${shelf}`);
  cell.insertBefore(input, dateSpan);

  // Focus input after a short delay for touch devices
  setTimeout(() => {
    input.focus();
    input.click();
  }, 10);

  const restoreCell = (val) => {
    input.remove();
    dateSpan.textContent = formatDateDisplay(val);
    dateSpan.style.display = '';
    if (editIcon) editIcon.style.display = '';
  };

  const saveDate = () => {
    const newDate = input.value;
    if (newDate && newDate !== oldDate) {
      // Get linked shelves
      const linkedShelves = getLinkedShelves(shelf);
      
      // Update this shelf
      shelves[shelf] = newDate;
      
      // If this shelf is part of a group, update all shelves in the group
      if (linkedShelves.length > 0) {
        // Always use the new date for all shelves in the group
        linkedShelves.forEach(linkedShelf => {
          shelves[linkedShelf] = newDate;
          log({ 
            level: 'info', 
            message: `Updated date for linked shelf ${linkedShelf} to ${newDate}`
          });
        });
      }
      
      saveAndRender();
    } else {
      restoreCell(oldDate);
    }
  };

  // Handle input blur (save)
  input.addEventListener('blur', saveDate);
  
  // Handle keyboard events
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      saveDate();
      ev.preventDefault();
    } else if (ev.key === 'Escape') {
      restoreCell(oldDate);
      ev.preventDefault();
    }
  });

  // Prevent duplicate edit on touch
  input.addEventListener('touchend', (ev) => {
    ev.stopPropagation();
  });
};

const renderLinkedShelvesPanel = () => {
  const linksContainer = document.getElementById('linked-shelves-container');
  if (!linksContainer) return;
  
  const groups = getAllGroups();
  let htmlContent = '';
  
  if (groups.length === 0) {
    htmlContent = `
      <p class="text-gray-500 text-center py-4">No shelf groups yet</p>
      <p class="text-sm text-gray-500 text-center italic">When shelves are grouped, they will all use the most recent inventory date.</p>
    `;
  } else {
    htmlContent = '<div class="space-y-3">';
    groups.forEach((group, groupIndex) => {
      const groupId = `group-${groupIndex}`;
      const groupName = group.name || `Group ${groupIndex + 1}`;
      htmlContent += `
        <div class="bg-white border rounded shadow-sm">
          <div class="bg-primary-50 px-3 py-2 flex justify-between items-center">
            <div class="flex items-center gap-2">
              <span class="font-medium text-primary-800 group-name" id="group-name-${groupIndex}">${groupName}</span>
              <button 
                onclick="window.app.editGroupName(${groupIndex})"
                class="p-1 text-primary-700 hover:bg-primary-200 rounded"
                aria-label="Edit group name"
                title="Edit group name">
                <i class="fas fa-edit h-4 w-4" aria-hidden="true"></i>
              </button>
            </div>
            <div class="flex items-center space-x-1">
              <button 
                onclick="window.app.addToGroup(${groupIndex})" 
                class="p-1 text-primary-700 hover:bg-primary-100 rounded"
                aria-label="Add shelf to this group"
                title="Add shelf">
                <i class="fas fa-plus h-4 w-4" aria-hidden="true"></i>
              </button>
              <button 
                onclick="window.app.expandCollapseGroup('${groupId}')" 
                id="toggle-${groupId}"
                class="p-1 text-primary-700 hover:bg-primary-100 rounded"
                aria-label="${group.shelves.length > 3 ? 'Show all shelves' : 'Collapse group'}"
                aria-expanded="${group.shelves.length > 3 ? 'false' : 'true'}">
                <i class="fas fa-chevron-down h-4 w-4" aria-hidden="true"></i>
              </button>
            </div>
          </div>
          <div class="px-3 py-2 bg-gray-50">
            <div class="flex flex-wrap gap-1">
              ${group.shelves.slice(0, 3).map(shelf => `
                <div class="flex items-center bg-white border rounded-lg px-2 py-1 text-sm">
                  <span class="font-mono">${shelf}</span>
                  <button 
                    onclick="window.app.removeFromGroup('${shelf}')" 
                    class="ml-1 text-gray-500 hover:text-red-600"
                    aria-label="Remove ${shelf} from group">
                    <i class="fas fa-times h-3.5 w-3.5" aria-hidden="true"></i>
                  </button>
                </div>
              `).join('')}
              ${group.shelves.length > 3 ? `
                <div class="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
                  +${group.shelves.length - 3} more
                </div>
              ` : ''}
            </div>
          </div>
          <div id="${groupId}" class="${group.shelves.length > 3 ? 'hidden' : ''} border-t px-3 py-2">
            <div class="flex flex-wrap gap-1">
              ${group.shelves.slice(3).map(shelf => `
                <div class="flex items-center bg-white border rounded-lg px-2 py-1 text-sm">
                  <span class="font-mono">${shelf}</span>
                  <button 
                    onclick="window.app.removeFromGroup('${shelf}')" 
                    class="ml-1 text-gray-500 hover:text-red-600"
                    aria-label="Remove ${shelf} from group">
                    <i class="fas fa-times h-3.5 w-3.5" aria-hidden="true"></i>
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        </div>`;
    });
    htmlContent += '</div>';
  }
  linksContainer.innerHTML = htmlContent;
  
  // Also update mobile panel if it's open
  const mobileContainer = document.getElementById('mobile-linked-shelves-container');
  if (mobileContainer && mobileContainer.offsetParent !== null) {
    mobileContainer.innerHTML = htmlContent;
  }
};

// Add group name editing logic
const editGroupName = (groupIndex) => {
  const groups = getAllGroups();
  const currentName = groups[groupIndex]?.name || `Group ${groupIndex + 1}`;
  window.utils.showAlert(`
    <label for="edit-group-name-input" class="block text-sm font-medium text-gray-700 mb-2">Edit Group Name</label>
    <input id="edit-group-name-input" type="text" value="${currentName.replace(/"/g, '&quot;')}" class="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400" maxlength="40" />
  `, {
    html: true,
    isConfirm: true,
    confirmText: 'Save Name',
    onConfirm: () => {
      const input = document.getElementById('edit-group-name-input');
      if (input && input.value.trim()) {
        setGroupName(groupIndex, input.value.trim());
        renderLinkedShelvesPanel();
      }
    }
  });
};

const expandCollapseGroup = (groupId) => {
  const group = document.getElementById(groupId);
  const button = document.getElementById(`toggle-${groupId}`);
  
  if (group && button) {
    const isExpanded = group.classList.toggle('hidden');
    button.setAttribute('aria-expanded', !isExpanded);
    button.setAttribute('aria-label', isExpanded ? 'Show all shelves' : 'Collapse group');
    
    // Change icon direction with consistent sizing
    if (isExpanded) {
      button.innerHTML = `<i class="fas fa-chevron-down h-4 w-4" aria-hidden="true"></i>`;
    } else {
      button.innerHTML = `<i class="fas fa-chevron-up h-4 w-4" aria-hidden="true"></i>`;
    }
  }
};

const removeFromGroup = (shelf) => {
  window.utils.showAlert(`Are you sure you want to remove shelf <span class='font-mono'>${shelf}</span> from this group?`, { 
    html: true,
    isConfirm: true,
    onConfirm: () => {
      removeShelfFromGroup(shelf);
      renderTable();
      showAlert(`Shelf ${shelf} has been removed from the group.`);
    }
  });
};

// Improved addToGroup function with a cleaner UI
const addToGroup = (groupIndex) => {
  const groups = getAllGroups();
  if (!groups[groupIndex]) return;
  
  const availableShelves = Object.keys(shelves).filter(shelf => 
    !groups[groupIndex].includes(shelf)
  );
  
  if (availableShelves.length === 0) {
    showAlert('No more shelves to add to this group.');
    return;
  }
  
  // Create select options HTML
  let optionsHtml = availableShelves.map(shelf => 
    `<option value="${shelf}">${shelf}</option>`
  ).join('');
  
  window.utils.showAlert(`
    <div class="mb-3">
      <h3 class="text-base font-medium text-gray-900 mb-2">Add to Group ${groupIndex + 1}</h3>
      <p class="text-sm text-gray-600">Select shelf to add to this group:</p>
    </div>
    <div class="mb-4">
      <select id="add-to-group-select" class="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400">
        <option value="" disabled selected>Select a shelf</option>
        ${optionsHtml}
      </select>
    </div>
    <div class="mt-4 pt-3 border-t text-sm italic text-gray-600">
      Note: The added shelf will use the same date as the rest of the group.
    </div>
  `, { 
    html: true,
    isConfirm: true,
    confirmText: 'Add to Group', // Ensure button text is clear
    onConfirm: () => {
      const selectElement = document.getElementById('add-to-group-select');
      if (selectElement && selectElement.value) {
        const newShelf = selectElement.value;
        const updatedGroup = [...groups[groupIndex], newShelf];
        
        // Find the most recent date in the existing group
        let mostRecentDate = '';
        groups[groupIndex].forEach(shelf => {
          if (shelves[shelf] && (!mostRecentDate || shelves[shelf] > mostRecentDate)) {
            mostRecentDate = shelves[shelf];
          }
        });
        
        // Set the date of the new shelf to match group's date
        if (mostRecentDate) {
          shelves[newShelf] = mostRecentDate;
        }
        
        // Update the group
        groups[groupIndex] = updatedGroup;
        saveGroups(groups);
        
        saveAndRender();
        showAlert(`Added shelf ${newShelf} to Group ${groupIndex + 1}.`);
      } else {
        showAlert('Please select a shelf to add.');
      }
    }
  });
};

// Fix linkShelves to properly handle date syncing
const createGroup = () => {
  const availableShelves = Object.keys(shelves);
  
  if (availableShelves.length < 2) {
    showAlert('You need at least two shelves to create a group.');
    return;
  }
  
  // Create select options HTML with better styling
  let optionsHtml = availableShelves.map(shelf => 
    `<option value="${shelf}">${shelf}</option>`
  ).join('');
  
  window.utils.showAlert(`
    <div class="mb-3">
      <h3 class="text-base font-medium text-gray-900 mb-2">Create New Group</h3>
      <p class="text-sm text-gray-600">Select at least two shelves for the new group.</p>
    </div>
    <div class="mb-3 border-b pb-3">
      <label class="block text-sm font-medium text-gray-700 mb-1">Required Shelves:</label>
      <div class="space-y-2">
        <div>
          <select id="new-group-shelf-1" class="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-400">
            <option value="" disabled selected>Select first shelf</option>
            ${optionsHtml}
          </select>
        </div>
        <div>
          <select id="new-group-shelf-2" class="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-400">
            <option value="" disabled selected>Select second shelf</option>
            ${optionsHtml}
          </select>
        </div>
      </div>
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Additional Shelves (Optional):</label>
      <div id="additional-shelves-container">
        <div class="mb-2 flex items-center">
          <select class="additional-shelf w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-400">
            <option value="" disabled selected>Select additional shelf</option>
            ${optionsHtml}
          </select>
        </div>
      </div>
      <button type="button" id="add-another-shelf" 
        class="mt-2 text-sm bg-primary-100 text-primary-700 px-3 py-1 rounded hover:bg-primary-200 flex items-center gap-1 transition-colors">
        <i class="fas fa-plus h-4 w-4" aria-hidden="true"></i>
        Add Another Shelf
      </button>
    </div>
    <div class="mt-3 pt-3 border-t">
      <p class="text-sm text-gray-600 italic">Note: When shelves are grouped, they will all use the most recent inventory date.</p>
    </div>
  `, { 
    html: true,
    isConfirm: true,
    confirmText: 'Create Group', // Ensure button text is clear
    onConfirm: () => {
      const select1 = document.getElementById('new-group-shelf-1');
      const select2 = document.getElementById('new-group-shelf-2');
      const additionalSelects = document.querySelectorAll('.additional-shelf');
      
      if (!select1.value || !select2.value) {
        showAlert('Please select at least two different shelves.');
        return;
      }
      
      if (select1.value === select2.value) {
        showAlert('Cannot add the same shelf twice.');
        return;
      }
      
      // Collect all selected shelves
      const selectedShelvesArray = [select1.value, select2.value];
      
      // Add any additional shelves that were selected
      additionalSelects.forEach(select => {
        if (select.value && !selectedShelvesArray.includes(select.value)) {
          selectedShelvesArray.push(select.value);
        }
      });
      
      // Find the most recent date among all selected shelves
      let mostRecentDate = '';
      selectedShelvesArray.forEach(shelf => {
        if (shelves[shelf] && (!mostRecentDate || shelves[shelf] > mostRecentDate)) {
          mostRecentDate = shelves[shelf];
        }
      });
      
      // Update all shelves in the new group with the most recent date
      if (mostRecentDate) {
        selectedShelvesArray.forEach(shelf => {
          shelves[shelf] = mostRecentDate;
        });
        
        log({ 
          level: 'info', 
          message: `Updated dates for new group to ${mostRecentDate}`, 
          shelves: selectedShelvesArray
        });
        
        // Save the updated shelf dates
        saveShelves(shelves);
      }
      
      // Create the group with all selected shelves
      linkShelves(selectedShelvesArray);
      
      renderTable();
      showAlert(`Created new group with ${selectedShelvesArray.length} shelves.`);
    }
  });
  
  // Add functionality for the "Add another shelf" button - make it more visible
  setTimeout(() => {
    const addButton = document.getElementById('add-another-shelf');
    const container = document.getElementById('additional-shelves-container');
    
    if (addButton && container) {
      addButton.addEventListener('click', () => {
        const newRow = document.createElement('div');
        newRow.className = 'mb-2 flex items-center';
        
        newRow.innerHTML = `
          <select class="additional-shelf w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-400">
            <option value="" disabled selected>Select additional shelf</option>
            ${optionsHtml}
          </select>
          <button type="button" class="remove-shelf ml-2 p-1 text-red-600 hover:bg-red-100 rounded">
            <i class="fas fa-times h-4 w-4" aria-hidden="true"></i>
          </button>
        `;
        
        container.appendChild(newRow);
        
        // Add remove functionality to the button
        const removeBtn = newRow.querySelector('.remove-shelf');
        if (removeBtn) {
          removeBtn.addEventListener('click', () => {
            newRow.remove();
          });
        }
      });
    }
  }, 100);
};

// Render the link shelf selects - simple version focusing on groups
const renderLinkOptions = () => {
  const shelf1Select = document.getElementById('link-shelf-1');
  const shelf2Select = document.getElementById('link-shelf-2');
  
  if (shelf1Select && shelf2Select) {
    // Clear existing options
    shelf1Select.innerHTML = '';
    shelf2Select.innerHTML = '';
    
    // Add options for each shelf
    const shelfOptions = Object.keys(shelves).sort();
    if (shelfOptions.length === 0) {
      const option1 = document.createElement('option');
      option1.value = '';
      option1.textContent = 'No shelves available';
      option1.disabled = true;
      option1.selected = true;
      shelf1Select.appendChild(option1);
      
      const option2 = document.createElement('option');
      option2.value = '';
      option2.textContent = 'No shelves available';
      option2.disabled = true;
      option2.selected = true;
      shelf2Select.appendChild(option2);
    } else {
      // Add default disabled option
      const defaultOption1 = document.createElement('option');
      defaultOption1.value = '';
      defaultOption1.textContent = 'Select a shelf';
      defaultOption1.disabled = true;
      defaultOption1.selected = true;
      shelf1Select.appendChild(defaultOption1);
      
      const defaultOption2 = document.createElement('option');
      defaultOption2.value = '';
      defaultOption2.textContent = 'Select a shelf';
      defaultOption2.disabled = true;
      defaultOption2.selected = true;
      shelf2Select.appendChild(defaultOption2);
      
      shelfOptions.forEach(shelf => {
        const option1 = document.createElement('option');
        option1.value = shelf;
        option1.textContent = shelf;
        shelf1Select.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = shelf;
        option2.textContent = shelf;
        shelf2Select.appendChild(option2);
      });
    }
  }
};

// Updated function to first ask for confirmation before marking inventory complete
const markInventoryComplete = (shelf) => {
  const oldDate = shelves[shelf];
  
  // Ask for confirmation before proceeding
  showAlert(`
    <div class="flex items-start">
      <i class="fas fa-question-circle h-6 w-6 text-primary-500 mr-2 flex-shrink-0" aria-hidden="true"></i>
      <div>
        <span class="font-medium">Mark as complete?</span>
        <p>Are you sure you want to mark shelf <span class="font-mono font-medium">${shelf}</span> as completed?</p>
        <p class="mt-1 text-sm text-gray-600">This will update the date and move the shelf to the end of the list.</p>
      </div>
    </div>
  `, { 
    html: true, 
    alertType: 'info',
    isConfirm: true,
    confirmText: 'Complete Inventory',
    onConfirm: () => {
      // Find the latest date in all shelves
      const today = new Date().toISOString().split('T')[0];
      let latestDate = today;
      Object.values(shelves).forEach(date => {
        if (date > latestDate) {
          latestDate = date;
        }
      });
      
      // Set date to one day after the latest date to ensure it appears at the end
      const latestDateObj = new Date(latestDate);
      latestDateObj.setDate(latestDateObj.getDate() + 1);
      const newDate = latestDateObj.toISOString().split('T')[0];
      
      // Update the shelf with the new date
      shelves[shelf] = newDate;
      
      // If shelf is in a group, update all linked shelves
      const linkedShelves = getLinkedShelves(shelf);
      if (linkedShelves.length > 0) {
        linkedShelves.forEach(linkedShelf => {
          shelves[linkedShelf] = newDate;
        });
      }
      
      saveAndRender();
      
      // Show success message with clear explanation of what happened
      showAlert(`
        <div class="flex items-center">
          <i class="fas fa-check-circle h-6 w-6 text-green-500 mr-2" aria-hidden="true"></i>
          <div>
            <span class="font-medium">Inventory Complete!</span>
            <p>Shelf <span class="font-mono font-medium">${shelf}</span> was updated from ${formatDateDisplay(oldDate)} to ${formatDateDisplay(newDate)}.</p>
            <p class="mt-1 text-xs text-gray-600">The date was set to ensure this shelf appears at the end of the list.</p>
            ${linkedShelves.length > 0 ? `<p class="mt-1 text-sm">Also updated ${linkedShelves.length} linked ${linkedShelves.length === 1 ? 'shelf' : 'shelves'}.</p>` : ''}
          </div>
        </div>
      `, { 
        html: true, 
        alertType: 'success',
        autoClose: 2500
      });
    }
  });
};

// Export app functions to window scope for button handlers
window.app = {
  removeShelf,
  markInventoryComplete,
  checkInventory,
  linkShelvesUI,
  unlinkShelvesUI,
  createGroup,
  editGroupName,
  expandCollapseGroup,
  removeFromGroup,
  addToGroup,
  toggleMobileAddPanel,
  toggleMobileGroupsPanel, // Add new function to exports
  getShelves: () => shelves
};

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
  // Use the globally available logger but create convenience methods if needed
  const logger = window.logger || { 
    log: console.log.bind(console)
  };
  
  // Create convenience methods that use the standard log function
  const logInfo = (msg) => {
    if (typeof logger.log === 'function') {
      logger.log({ level: 'info', message: msg });
    } else if (typeof logger.info === 'function') {
      logger.info(msg);
    } else {
      console.info('[App]', msg);
    }
  };
  
  logInfo('Application starting');
  
  // Initialize DataTables
  const $ = window.jQuery || window.$;
  if ($ && $.fn && $.fn.dataTable) {
    $('#shelf-table').DataTable({
      responsive: true,
      ordering: true,
      paging: true,
      searching: true,
      info: true,
      lengthMenu: [[10, 25, 50, -1], [10, 25, 50, "All"]],
      language: {
        emptyTable: "No shelves to inventory - add one to get started"
      }
    });
  }
  
  // Set up desktop form
  setupShelfForm(shelfForm);
  
  // Set up mobile form
  const mobileShelfForm = document.getElementById('mobile-shelf-form');
  if (mobileShelfForm) {
    setupShelfForm(mobileShelfForm);
  }
  
  // Set up mobile add panel
  setupMobileAddPanel();
  
  renderTable();
  renderLinkOptions(); // Ensure options are populated on page load
  
  // Set up link form
  const linkForm = document.getElementById('link-shelf-form');
  if (linkForm) {
    linkForm.addEventListener('submit', (e) => {
      e.preventDefault();
      linkShelvesUI();
    });
  }

  // Add event listener for the Create Group button
  const createGroupBtn = document.getElementById('create-group-btn');
  if (createGroupBtn) {
    createGroupBtn.addEventListener('click', createGroup);
  }
  
  // Add mobile group button handler
  const mobileCreateGroupBtn = document.getElementById('mobile-create-group-btn');
  if (mobileCreateGroupBtn) {
    mobileCreateGroupBtn.addEventListener('click', () => {
      toggleMobileGroupsPanel(false); // Close panel before showing dialog
      createGroup();
    });
  }
});

// Setup the add shelf form (works for both mobile and desktop)
const setupShelfForm = (formElement) => {
  if (!formElement) return;
  
  // Add focus handler to scroll to the focused input
  const inputs = formElement.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    input.addEventListener('focus', () => {
      // If this is a mobile form
      if (formElement.id === 'mobile-shelf-form') {
        // Get the panel
        const panel = document.getElementById('mobile-add-panel');
        if (!panel) return;
        
        // Give time for keyboard to appear
        setTimeout(() => {
          // Calculate position to scroll input into middle of visible area
          const inputRect = input.getBoundingClientRect();
          const panelRect = panel.getBoundingClientRect();
          
          // Calculate the amount to scroll to put the input in the middle
          // 80px adds padding to account for keyboard
          const scrollAmount = inputRect.top - panelRect.top - (panelRect.height / 3) + panel.scrollTop;
          
          // Smoothly scroll to the input
          panel.scrollTo({
            top: scrollAmount,
            behavior: 'smooth'
          });
        }, 300); // Wait for keyboard to appear
      }
    });
  });
  
  formElement.addEventListener('submit', (e) => {
    e.preventDefault();
    // Determine if this is mobile form
    const isMobile = formElement.id === 'mobile-shelf-form';
    const shelfInput = isMobile ? 
      document.getElementById('mobile-shelf-number') : 
      document.getElementById('shelf-number');
    const dateInput = isMobile ? 
      document.getElementById('mobile-inventory-date') : 
      document.getElementById('inventory-date');
    
    const shelf = shelfInput.value.trim().toUpperCase();
    const date = dateInput.value;
    
    try {
      // Validate input
      if (!/^[A-Z0-9]{3}-[0-9]{2}\.[0-9]{3}$/.test(shelf)) {
        showAlert('Shelf number format is invalid.', { 
          html: true, 
          isConfirm: false,
          alertType: 'error'
        });
        return;
      }
      
      // Check if shelf already exists and show duplicate error
      if (shelves[shelf]) {
        showAlert(`
          <div class="flex items-start">
            <i class="fas fa-exclamation-triangle h-6 w-6 text-yellow-500 mr-2 flex-shrink-0" aria-hidden="true"></i>
            <div>
              <span class="font-medium">Duplicate Entry!</span>
              <p>Shelf <span class="font-mono font-medium">${shelf}</span> already exists with date ${formatDateDisplay(shelves[shelf])}.</p>
              <p class="mt-2">Would you like to update it to ${formatDateDisplay(date)}?</p>
            </div>
          </div>
        `, { 
          html: true, 
          alertType: 'warning',
          isConfirm: true,
          confirmText: 'Update',
          onConfirm: () => {
            // Update the shelf with new date
            shelves[shelf] = date;
            
            // Create a function to highlight and scroll after rendering
            const scrollToUpdatedRow = () => {
              const updatedRow = document.querySelector(`tr[data-shelf="${shelf}"]`);
              if (updatedRow) {
                updatedRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                updatedRow.classList.add('highlight-new-row');
              }
            };
            
            // If DataTable exists, use its draw event
            if (window.shelfDataTable) {
              const drawListener = function() {
                scrollToUpdatedRow();
                // Remove the listener after it fires once
                window.shelfDataTable.off('draw.scroll');
              };
              // Register the listener for the next draw event
              window.shelfDataTable.on('draw.scroll', drawListener);
            }
            
            saveAndRender();
            
            // Show confirmation dialog for update
            showAlert(`
              <div class="flex items-center">
                <i class="fas fa-check-circle h-6 w-6 text-green-500 mr-2" aria-hidden="true"></i>
                <div>
                  <span class="font-medium">Success!</span>
                  <p>Shelf <span class="font-mono font-medium">${shelf}</span> was updated with date ${formatDateDisplay(date)}.</p>
                </div>
              </div>
            `, { 
              html: true, 
              alertType: 'success',
              autoClose: 2000 // Auto close after 2 seconds
            });
            
            // Clear inputs and focus
            shelfInput.value = '';
            dateInput.value = '';
            shelfInput.focus();
          }
        });
        return;
      }
      
      // If shelf doesn't exist, proceed with adding it
      shelves[shelf] = date;
      
      // Add to recently added shelves list with timestamp
      recentlyAddedShelves.push({
        shelf,
        timestamp: Date.now()
      });
      
      // Only keep the 5 most recent additions
      if (recentlyAddedShelves.length > 5) {
        recentlyAddedShelves.shift();
      }
      
      // Create a function to highlight and scroll after rendering
      const scrollToNewRow = () => {
        const newRow = document.querySelector(`tr[data-shelf="${shelf}"]`);
        if (newRow) {
          newRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };
      
      // If DataTable exists, use its draw event
      if (window.jQuery && window.jQuery.fn && window.jQuery.fn.dataTable) {
        const $ = window.jQuery;
        $(document).one('draw.dt', '#shelf-table', scrollToNewRow);
      }
      
      saveAndRender();
      
      // Close mobile panel if active
      const mobileShelfForm = document.getElementById('mobile-shelf-form');
      if (mobileShelfForm && mobileShelfForm.contains(shelfInput)) {
        toggleMobileAddPanel(false);
      }
      
      // Ensure body scrolling is restored
      document.body.style.overflow = '';
      
      // Show confirmation dialog
      showAlert(`
        <div class="flex items-center">
          <i class="fas fa-check-circle h-6 w-6 text-green-500 mr-2" aria-hidden="true"></i>
          <div>
            <span class="font-medium">Success!</span>
            <p>Shelf <span class="font-mono font-medium">${shelf}</span> was added with date ${formatDateDisplay(date)}.</p>
          </div>
        </div>
      `, { 
        html: true, 
        alertType: 'success',
        autoClose: 2000 // Auto close after 2 seconds
      });
      
      // Clear inputs and focus
      shelfInput.value = '';
      dateInput.value = '';
      shelfInput.focus();
    } 
    catch (error) {
      log({ level: 'error', message: 'Error adding shelf', error });
      showAlert(`
        <div class="flex items-start">
          <i class="fas fa-exclamation-circle h-6 w-6 text-red-500 mr-2 flex-shrink-0" aria-hidden="true"></i>
          <div>
            <span class="font-medium">Failed!</span>
            <p>Could not add shelf. Please try again.</p>
            <p class="text-sm text-gray-600 mt-1">${error.message || 'Unknown error'}</p>
          </div>
        </div>
      `, { 
        html: true, 
        alertType: 'error'
      });
      
      // Ensure body scrolling is restored even on error
      document.body.style.overflow = '';
    }
  });
};

// Set up mobile add panel functionality
const setupMobileAddPanel = () => {
  const addButton = document.getElementById('mobile-add-button');
  const closeButton = document.getElementById('mobile-close-panel');
  const panel = document.getElementById('mobile-add-panel');
  const backdrop = document.getElementById('mobile-backdrop');
  
  if (addButton && panel) {
    // Set up FAB button
    addButton.addEventListener('click', () => {
      toggleMobileAddPanel(true);
    });
  }
  
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      toggleMobileAddPanel(false);
    });
  }
  
  // Set up groups button - NEW
  const groupsButton = document.getElementById('mobile-groups-button');
  const closeGroupsButton = document.getElementById('mobile-close-groups-panel');
  const groupsPanel = document.getElementById('mobile-groups-panel');
  
  if (groupsButton && groupsPanel) {
    groupsButton.addEventListener('click', () => {
      toggleMobileGroupsPanel(true);
    });
  }
  
  if (closeGroupsButton) {
    closeGroupsButton.addEventListener('click', () => {
      toggleMobileGroupsPanel(false);
    });
  }
  
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      toggleMobileAddPanel(false);
      toggleMobileGroupsPanel(false); // Close groups panel too if backdrop is clicked
    });
  }
  
  // Close panel when pressing escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      toggleMobileAddPanel(false);
      toggleMobileGroupsPanel(false);
    }
  });
};

renderTable();
