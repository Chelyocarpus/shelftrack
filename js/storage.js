// storage.js
(() => {
  const STORAGE_KEY = 'shelfInventory';
  const GROUPS_KEY = 'shelfGroups'; // Changed from LINKS_KEY to GROUPS_KEY

  // Add support for cloud storage with fallback to localStorage
  const useCloudStorage = () => {
    return window.gistdb && window.gistdb.isEnabled();
  };

  const loadShelves = () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      window.logger.log({ level: 'error', message: 'Failed to load shelves', error: e });
      return {};
    }
  };

  const saveShelves = (shelves) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shelves));
      
      // If cloud sync is enabled AND auto backup is enabled, update Gist immediately
      if (useCloudStorage() && window.gistdb.getConfig().autoBackup) {
        const syncPromise = window.gistdb.pushData().catch(err => {
          window.logger.log({ 
            level: 'error', 
            message: 'Failed to sync shelves to cloud', 
            error: err 
          });
        });
        
        // Return promise for async operations
        return syncPromise;
      }
      
      return Promise.resolve(true);
    } catch (e) {
      window.logger.log({ level: 'error', message: 'Failed to save shelves', error: e });
      return Promise.reject(e);
    }
  };

  // Change groups to objects: { name: string, shelves: string[] }
  const loadGroups = () => {
    try {
      const data = localStorage.getItem(GROUPS_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      // Backward compatibility: convert array of arrays to array of objects
      if (Array.isArray(parsed) && parsed.length && Array.isArray(parsed[0])) {
        return parsed.map((shelves, i) => ({ name: `Group ${i + 1}`, shelves }));
      }
      return parsed;
    } catch (e) {
      window.logger.log({ level: 'error', message: 'Failed to load shelf groups', error: e });
      return [];
    }
  };

  const saveGroups = (groups) => {
    try {
      localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
      
      // If cloud sync is enabled AND auto backup is enabled, update Gist immediately
      if (useCloudStorage() && window.gistdb.getConfig().autoBackup) {
        const syncPromise = window.gistdb.pushData().catch(err => {
          window.logger.log({ 
            level: 'error', 
            message: 'Failed to sync groups to cloud', 
            error: err 
          });
        });
        
        // Return promise for async operations
        return syncPromise;
      }
      
      return Promise.resolve(true);
    } catch (e) {
      window.logger.log({ level: 'error', message: 'Failed to save shelf groups', error: e });
      return Promise.reject(e);
    }
  };

  // Get a list of shelves that are in the same group as the given shelf
  const getLinkedShelves = (shelf) => {
    const groups = loadGroups();
    for (const group of groups) {
      if (group.shelves.includes(shelf)) {
        return group.shelves.filter(s => s !== shelf);
      }
    }
    return [];
  };
  
  // Get the group index that contains the shelf, or -1 if not found
  const getGroupForShelf = (shelf) => {
    const groups = loadGroups();
    return groups.findIndex(group => group.shelves.includes(shelf));
  };

  // Link shelves in a group. Add to existing group if any shelf is already in a group
  const linkShelves = (shelves) => {
    if (!Array.isArray(shelves) || shelves.length < 2) {
      return;
    }
    
    const groups = loadGroups();
    let targetGroupIndex = -1;
    
    // Check if any of the shelves are already in a group
    for (let i = 0; i < shelves.length; i++) {
      const groupIndex = getGroupForShelf(shelves[i]);
      if (groupIndex !== -1) {
        if (targetGroupIndex === -1) {
          targetGroupIndex = groupIndex;
        } else if (targetGroupIndex !== groupIndex) {
          // Merge groups if shelves are in different groups
          groups[targetGroupIndex].shelves = [...new Set([...groups[targetGroupIndex].shelves, ...groups[groupIndex].shelves])];
          groups.splice(groupIndex, 1);
        }
      }
    }
    
    // Add shelves to existing group or create a new one
    if (targetGroupIndex !== -1) {
      groups[targetGroupIndex].shelves = [...new Set([...groups[targetGroupIndex].shelves, ...shelves])];
    } else {
      groups.push({ name: `Group ${groups.length + 1}`, shelves: shelves });
    }
    
    saveGroups(groups);
    return groups;
  };

  // Specific function to link two shelves (for backward compatibility)
  const linkShelfPair = (shelf1, shelf2) => {
    return linkShelves([shelf1, shelf2]);
  };

  // Remove a shelf from its group
  const removeShelfFromGroup = (shelf) => {
    const groups = loadGroups();
    const groupIndex = getGroupForShelf(shelf);
    
    if (groupIndex !== -1) {
      groups[groupIndex].shelves = groups[groupIndex].shelves.filter(s => s !== shelf);
      
      // Remove the group if it has less than 2 shelves
      if (groups[groupIndex].shelves.length < 2) {
        groups.splice(groupIndex, 1);
      }
      
      saveGroups(groups);
    }
    
    return groups;
  };

  // Unlink a pair of shelves (keep them in their groups if other connections exist)
  const unlinkShelves = (shelf1, shelf2) => {
    const groups = loadGroups();
    const groupIndex = groups.findIndex(group => 
      group.shelves.includes(shelf1) && group.shelves.includes(shelf2)
    );
    
    if (groupIndex === -1) return groups;
    
    // Create a new group without this link
    const originalGroup = groups[groupIndex];
    groups.splice(groupIndex, 1);
    
    // Use a graph algorithm to find connected components
    const graph = {};
    originalGroup.shelves.forEach(s => {
      graph[s] = [];
    });
    
    for (let i = 0; i < originalGroup.shelves.length; i++) {
      for (let j = i + 1; j < originalGroup.shelves.length; j++) {
        const s1 = originalGroup.shelves[i];
        const s2 = originalGroup.shelves[j];
        
        if ((s1 === shelf1 && s2 === shelf2) || (s1 === shelf2 && s2 === shelf1)) {
          continue; // Skip this link
        }
        
        graph[s1].push(s2);
        graph[s2].push(s1);
      }
    }
    
    // Find connected components using BFS
    const visited = {};
    originalGroup.shelves.forEach(s => {
      visited[s] = false;
    });
    
    originalGroup.shelves.forEach(start => {
      if (visited[start]) return;
      
      const component = [];
      const queue = [start];
      visited[start] = true;
      
      while (queue.length > 0) {
        const current = queue.shift();
        component.push(current);
        
        graph[current].forEach(neighbor => {
          if (!visited[neighbor]) {
            visited[neighbor] = true;
            queue.push(neighbor);
          }
        });
      }
      
      if (component.length > 1) {
        groups.push({ name: `Group ${groups.length + 1}`, shelves: component });
      }
    });
    
    saveGroups(groups);
    return groups;
  };

  // Clean up groups when shelves are deleted
  const cleanupGroups = (shelves) => {
    const groups = loadGroups();
    let changed = false;
    
    for (let i = 0; i < groups.length; i++) {
      const originalLength = groups[i].shelves.length;
      groups[i].shelves = groups[i].shelves.filter(shelf => shelves[shelf]);
      
      if (groups[i].shelves.length !== originalLength) {
        changed = true;
      }
      
      if (groups[i].shelves.length < 2) {
        groups.splice(i, 1);
        i--;
        changed = true;
      }
    }
    
    if (changed) {
      saveGroups(groups);
    }
    
    return groups;
  };

  // Get all groups
  const getAllGroups = () => {
    return loadGroups();
  };

  const setGroupName = (groupIndex, name) => {
    const groups = loadGroups();
    if (groups[groupIndex]) {
      groups[groupIndex].name = name;
      saveGroups(groups);
    }
  };

  // New function to sync with cloud storage
  const syncWithCloud = async () => {
    if (!useCloudStorage()) {
      return { success: false, message: 'Cloud storage is not enabled' };
    }
    
    try {
      // Pull data from cloud
      const cloudData = await window.gistdb.pullData();
      
      window.logger.log({ 
        level: 'info', 
        message: 'Successfully synced with cloud storage', 
        data: cloudData 
      });
      
      return { success: true, data: cloudData };
    } catch (error) {
      window.logger.log({ 
        level: 'error', 
        message: 'Failed to sync with cloud storage', 
        error 
      });
      
      return { success: false, error, message: error.message };
    }
  };

  // Configure cloud storage
  const configureCloudStorage = () => {
    if (window.gistdb) {
      window.gistdb.showConfigForm();
    } else {
      window.logger.log({ 
        level: 'error', 
        message: 'Cloud storage module is not available' 
      });
    }
  };

  window.storage = { 
    loadShelves, saveShelves, 
    loadGroups, saveGroups, 
    linkShelves, linkShelfPair, unlinkShelves, 
    getLinkedShelves, cleanupGroups, removeShelfFromGroup,
    getAllGroups, getGroupForShelf, setGroupName,
    // New cloud storage functions
    syncWithCloud, configureCloudStorage
  };
})();
