// app.js
const { 
  loadShelves, saveShelves, 
  loadGroups, saveGroups,
  linkShelves, linkShelfPair, unlinkShelves, 
  getLinkedShelves, cleanupGroups, removeShelfFromGroup,
  getAllGroups, getGroupForShelf, setGroupName
} = window.storage;
const { debounce, showAlert } = window.utils;
const { log } = window.logger;

let shelves = loadShelves();

const shelfForm = document.getElementById('shelf-form');
const shelfTableBody = document.getElementById('shelf-table-body');
const linkShelfForm = document.getElementById('link-shelf-form');

// Modified to sync dates across linked shelves
const saveAndRender = debounce(() => {
  // Before saving, ensure all linked shelves have the same most recent date
  const groups = getAllGroups();
  groups.forEach(group => {
    if (group.length > 1) {
      // Find the most recent date in the group
      let mostRecentDate = '';
      group.forEach(shelf => {
        if (shelves[shelf] && (!mostRecentDate || shelves[shelf] > mostRecentDate)) {
          mostRecentDate = shelves[shelf];
        }
      });
      
      // Apply the most recent date to all shelves in the group
      if (mostRecentDate) {
        group.forEach(shelf => {
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
  if (!/^[A-Z0-9]{3}-[0-9]{2}\.[0-9]{3}$/.test(shelf)) {
    showAlert('Shelf number format is invalid.');
    return;
  }
  shelves[shelf] = date;
  saveAndRender();
  shelfInput.value = '';
  dateInput.value = '';
  shelfInput.focus();
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
      delete shelves[shelf];
      saveAndRender();
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

// Helper to get date status
const getDateStatus = (date) => {
  const today = new Date();
  const dateObj = new Date(date);
  today.setHours(0, 0, 0, 0);
  dateObj.setHours(0, 0, 0, 0);
  
  if (dateObj < today) {
    return 'expired';
  }
  
  const diffDays = Math.floor((dateObj - today) / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) {
    return 'approaching';
  }
  
  return '';
};

const renderTable = () => {
  // Prepare data for DataTable with raw dates and links
  const groups = loadGroups(); // Changed from loadLinks() to loadGroups()
  const shelfArr = getShelvesArray().map(([shelf, date]) => {
    // Find which group this shelf belongs to, if any
    const linkedShelves = getLinkedShelves(shelf);
    
    return {
      shelf,
      date,
      status: getDateStatus(date),
      displayDate: formatDateDisplay(date),
      links: linkedShelves // Use getLinkedShelves instead of links[shelf]
    };
  });

  // Destroy previous DataTable instance if exists
  if (window.shelfDataTable) {
    window.shelfDataTable.destroy();
    window.shelfDataTable = null;
  }

  // Clear table body
  shelfTableBody.innerHTML = '';
  
  const jq = window.jQuery || window.$;
  if (jq && typeof jq === 'function' && jq.fn && jq.fn.dataTable) {
    window.shelfDataTable = jq('#shelf-table').DataTable({
      destroy: true,
      data: shelfArr,
      columns: [
        { 
          data: 'shelf',
          className: 'px-4 py-3 font-mono',
          render: function(data, type, row) {
            // Show link icon if shelf has links
            if (type === 'display' && row.links && row.links.length > 0) {
              return `${data} <svg xmlns="http://www.w3.org/2000/svg" class="inline-block w-4 h-4 text-primary-500 ml-1" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <title>Linked shelves</title>
                <path fill-rule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clip-rule="evenodd" />
              </svg>`;
            }
            return data;
          }
        },
        { 
          data: null,
          className: 'px-4 py-3 text-sm editable-date cursor-pointer underline decoration-dotted decoration-primary-400 transition-colors focus:bg-primary-100',
          render: function(data) {
            return `
              <span class="date-value" data-raw-date="${data.date}">${data.displayDate}</span>
              <span class="sr-only">(editable)</span>
              <svg xmlns="http://www.w3.org/2000/svg" class="inline ml-1 w-4 h-4 text-primary-400 align-text-bottom pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
                <title>Edit date</title>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536M9 13l6-6m2 2l-6 6m-2 2h6a2 2 0 002-2v-6a2 2 0 00-2-2h-6a2 2 0 00-2 2v6a2 2 0 002 2z"/>
              </svg>`;
          }
        },
        {
          data: 'shelf',
          className: 'px-4 py-3',
          render: function(shelf) {
            return `
              <div class="flex">
                <button class="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 active:bg-red-800 min-w-[44px] min-h-[44px] transition-colors" 
                  aria-label="Remove ${shelf}" 
                  onclick="window.app.removeShelf('${shelf}')">Remove</button>
              </div>`;
          }
        }
      ],
      // Use raw date for sorting
      order: [[1, 'asc']],
      createdRow: function(row, data) {
        const baseClasses = 'transition-colors border-b';
        // Add stronger background colors that won't be overridden
        if (data.status === 'expired') {
          jq(row).addClass(`${baseClasses} !bg-red-100`).hover(
            function() { jq(this).addClass('!bg-red-200'); },
            function() { jq(this).removeClass('!bg-red-200'); }
          );
        } else if (data.status === 'approaching') {
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
        emptyTable: 'No shelves available'
      },
      initComplete: function() {
        // Add custom styling to DataTables elements
        jq('.dataTables_length select').addClass('border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-400');
        jq('.dataTables_filter input').addClass('border rounded px-3 py-1 ml-2 focus:outline-none focus:ring-1 focus:ring-primary-400');
        jq('.dataTables_paginate .paginate_button').addClass('px-3 py-1 border rounded mx-1 hover:bg-gray-100');
        jq('.dataTables_paginate .paginate_button.current').addClass('bg-primary-50 text-primary-700 border-primary-300');
      }
    });

    // Add legend after table
    const legend = `
      <div class="mt-4 text-sm flex gap-4">
        <span class="flex items-center">
          <span class="w-4 h-4 inline-block mr-2 bg-red-100"></span>
          Expired
        </span>
        <span class="flex items-center">
          <span class="w-4 h-4 inline-block mr-2 bg-yellow-100"></span>
          Due within 7 days
        </span>
      </div>`;
    jq('#shelf-table_wrapper').append(legend);
  }

  // Inline date editing - Add touch events
  shelfTableBody.querySelectorAll('.editable-date').forEach(td => {
    const startEdit = (e) => {
      if (td.querySelector('input')) {
        return;
      }
      const { shelf } = td.dataset;
      const oldDate = shelves[shelf];
      const dateSpan = td.querySelector('.date-value');
      const editIcon = td.querySelector('svg');
      
      if (!dateSpan) {
        return;
      }

      // Hide the date text and icon, but keep them in DOM
      dateSpan.style.display = 'none';
      if (editIcon) {
        editIcon.style.display = 'none';
      }

      const input = document.createElement('input');
      input.type = 'date';
      input.value = oldDate;
      input.className = 'border border-primary-400 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-primary-400 bg-primary-50 touch-manipulation';
      input.setAttribute('aria-label', `Change date for ${shelf}`);
      td.insertBefore(input, dateSpan);
      input.focus();

      const restoreCell = (val) => {
        input.remove();
        dateSpan.textContent = formatDateDisplay(val);
        dateSpan.style.display = '';
        if (editIcon) {
          editIcon.style.display = '';
        }
      };

      const saveDate = () => {
        const newDate = input.value;
        if (newDate && newDate !== oldDate) {
          // Get linked shelves
          const linkedShelves = getLinkedShelves(shelf);
          
          // Update this shelf
          shelves[shelf] = newDate;
          
          // If this shelf is part of a group, update all shelves in the group
          // to have the same date (the most recent one)
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

      // Handle touch events
      let touchMoved = false;
      input.addEventListener('touchstart', () => {
        touchMoved = false;
      });
      input.addEventListener('touchmove', () => {
        touchMoved = true;
      });
      input.addEventListener('touchend', (ev) => {
        if (!touchMoved) {
          ev.preventDefault();
        }
      });

      input.addEventListener('blur', saveDate);
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          saveDate();
          ev.preventDefault();
        } else if (ev.key === 'Escape') {
          restoreCell(oldDate);
          ev.preventDefault();
        }
      });
    };

    // Add both mouse and touch event handlers
    td.addEventListener('click', startEdit);
    td.addEventListener('touchend', (e) => {
      if (!e.target.closest('input')) {
        e.preventDefault();
        startEdit(e);
      }
    });
  });

  // Update the linked shelves panel
  renderLinkedShelvesPanel();
  renderLinkOptions();
};

// Render the linked shelves panel with improved UX
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
        <div class="bg-white border rounded shadow-sm overflow-hidden">
          <div class="bg-primary-50 px-3 py-2 flex justify-between items-center">
            <div class="flex items-center gap-2">
              <span class="font-medium text-primary-800 group-name" id="group-name-${groupIndex}">${groupName}</span>
              <button 
                onclick="window.app.editGroupName(${groupIndex})"
                class="p-1 text-primary-700 hover:bg-primary-200 rounded"
                aria-label="Edit group name"
                title="Edit group name">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536M9 13l6-6m2 2l-6 6m-2 2h6a2 2 0 002-2v-6a2 2 0 00-2-2h-6a2 2 0 00-2 2v6a2 2 0 002 2z"/>
                </svg>
              </button>
            </div>
            <div class="flex items-center space-x-1">
              <button 
                onclick="window.app.addToGroup(${groupIndex})" 
                class="p-1 text-primary-700 hover:bg-primary-100 rounded"
                aria-label="Add shelf to this group"
                title="Add shelf">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                </svg>
              </button>
              <button 
                onclick="window.app.expandCollapseGroup('${groupId}')" 
                id="toggle-${groupId}"
                class="p-1 text-primary-700 hover:bg-primary-100 rounded"
                aria-label="${group.shelves.length > 3 ? 'Show all shelves' : 'Collapse group'}"
                aria-expanded="${group.shelves.length > 3 ? 'false' : 'true'}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
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
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
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
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
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
    
    // Change icon direction
    if (isExpanded) {
      button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>`;
    } else {
      button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd" />
      </svg>`;
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
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
        </svg>
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
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
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

window.app = { 
  checkInventory, removeShelf, 
  linkShelvesUI, unlinkShelvesUI,
  expandCollapseGroup, removeFromGroup,
  addToGroup, createGroup, editGroupName
};

// Initial render
document.addEventListener('DOMContentLoaded', () => {
  renderTable();
  renderLinkOptions(); // Add this line to ensure options are populated on page load
  
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
});
