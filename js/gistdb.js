/**
 * GitHub Gist Database
 * Use GitHub Gists as a simple database for storing and retrieving data
 */
(() => {
  // Create a fallback logger with consistent API
  let logger;
  
  try {
    logger = window.logger || {
      log: (options) => {
        const { level = 'info', message } = options;
        console[level]('[GistDB]', message, options);
      }
    };
  } catch (e) {
    logger = {
      log: (options) => {
        const { level = 'info', message } = options;
        console[level]('[GistDB]', message, options);
      }
    };
  }
  
  // Configuration storage key
  const CONFIG_KEY = 'gistdb_config';
  
  // Default configuration
  const DEFAULT_CONFIG = {
    enabled: false,
    token: '',
    gistId: '',
    autoSync: true,  // Changed default to true
    syncInterval: 30, // minutes
    lastSync: null,
    autoBackup: true  // Added new option for immediate backups on changes
  };
  
  // Current configuration
  let config = { ...DEFAULT_CONFIG };
  
  // Load configuration from localStorage
  const loadConfig = () => {
    try {
      const storedConfig = localStorage.getItem(CONFIG_KEY);
      if (storedConfig) {
        config = { ...DEFAULT_CONFIG, ...JSON.parse(storedConfig) };
      }
      return config;
    } catch (err) {
      logger.log({ level: 'error', message: 'Failed to load GistDB config', error: err });
      return DEFAULT_CONFIG;
    }
  };
  
  // Save configuration to localStorage
  const saveConfig = (newConfig) => {
    try {
      config = { ...config, ...newConfig };
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
      return true;
    } catch (err) {
      logger.log({ level: 'error', message: 'Failed to save GistDB config', error: err });
      return false;
    }
  };
  
  // Check if GistDB is configured and enabled
  const isEnabled = () => {
    return config.enabled && config.token && config.gistId;
  };
  
  // Fetch data from the GitHub Gist
  const fetchFromGist = async () => {
    if (!isEnabled()) {
      throw new Error('GistDB is not properly configured');
    }
    
    try {
      const response = await fetch(`https://api.github.com/gists/${config.gistId}`, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `token ${config.token}`,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }
      
      const gistData = await response.json();
      
      // Data processing logic
      const result = {};
      
      // Process each file in the gist
      Object.keys(gistData.files).forEach(filename => {
        try {
          // Extract data from each file based on its name
          const fileContent = gistData.files[filename].content;
          const key = filename.replace('.json', '');
          
          // Attempt to parse JSON content
          try {
            result[key] = JSON.parse(fileContent);
          } catch (parseErr) {
            // If not valid JSON, store as string
            result[key] = fileContent;
          }
        } catch (fileErr) {
          logger.log({ 
            level: 'warn', 
            message: `Error processing file ${filename}`, 
            error: fileErr 
          });
        }
      });
      
      // Record last sync time
      config.lastSync = new Date().toISOString();
      saveConfig({ lastSync: config.lastSync });
      
      return result;
    } catch (err) {
      logger.log({ 
        level: 'error', 
        message: 'Failed to fetch data from Gist', 
        error: err 
      });
      throw err;
    }
  };
  
  // Save data to GitHub Gist
  const saveToGist = async (dataObject) => {
    if (!isEnabled()) {
      throw new Error('GistDB is not properly configured');
    }
    
    try {
      // Prepare files object for Gist API
      const files = {};
      
      // Convert each key to a file in the gist
      Object.keys(dataObject).forEach(key => {
        const content = typeof dataObject[key] === 'string' 
          ? dataObject[key] 
          : JSON.stringify(dataObject[key], null, 2);
          
        files[`${key}.json`] = { content };
      });
      
      // Update the gist with new data
      const response = await fetch(`https://api.github.com/gists/${config.gistId}`, {
        method: 'PATCH',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `token ${config.token}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          description: `ShelfTrack Data - Updated ${new Date().toISOString()}`,
          files
        })
      });
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }
      
      // Record last sync time
      config.lastSync = new Date().toISOString();
      saveConfig({ lastSync: config.lastSync });
      
      return true;
    } catch (err) {
      logger.log({ 
        level: 'error', 
        message: 'Failed to save data to Gist', 
        error: err 
      });
      throw err;
    }
  };
  
  // Create a new Gist if gistId is not provided
  const createGist = async (initialData = {}) => {
    if (!config.token) {
      throw new Error('GitHub token is required to create a Gist');
    }
    
    try {
      // Prepare files object with initial data
      const files = {
        'shelves.json': {
          content: JSON.stringify(initialData.shelves || {}, null, 2)
        },
        'groups.json': {
          content: JSON.stringify(initialData.groups || [], null, 2)
        },
        'config.json': {
          content: JSON.stringify({
            created: new Date().toISOString(),
            app: 'ShelfTrack'
          }, null, 2)
        }
      };
      
      // Create a new gist
      const response = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `token ${config.token}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          description: 'ShelfTrack Data Storage',
          public: false,
          files
        })
      });
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }
      
      const newGist = await response.json();
      
      // Update config with the new Gist ID
      saveConfig({
        gistId: newGist.id,
        lastSync: new Date().toISOString()
      });
      
      return newGist.id;
    } catch (err) {
      logger.log({ 
        level: 'error', 
        message: 'Failed to create Gist', 
        error: err 
      });
      throw err;
    }
  };
  
  // Set up auto-sync if enabled
  let autoSyncInterval = null;
  
  const setupAutoSync = () => {
    // Clear any existing interval
    if (autoSyncInterval) {
      clearInterval(autoSyncInterval);
      autoSyncInterval = null;
    }
    
    // If auto-sync is enabled, set up interval
    if (config.enabled && config.autoSync && config.syncInterval > 0) {
      autoSyncInterval = setInterval(async () => {
        try {
          // Only sync if user has made changes since last sync
          const shelves = window.storage?.loadShelves();
          const groups = window.storage?.loadGroups();
          
          if (shelves && groups) {
            logger.log({ level: 'info', message: 'Auto-syncing data to Gist' });
            await saveToGist({ shelves, groups });
            
            // Notify user if UI element exists
            const syncStatus = document.getElementById('gist-sync-status');
            if (syncStatus) {
              syncStatus.textContent = `Last synced: ${new Date().toLocaleTimeString()}`;
              syncStatus.classList.remove('text-red-500');
              syncStatus.classList.add('text-green-500');
              
              // Reset after a few seconds
              setTimeout(() => {
                syncStatus.textContent = 'Auto-sync enabled';
                syncStatus.classList.remove('text-green-500');
                syncStatus.classList.add('text-gray-600');
              }, 3000);
            }
          }
        } catch (err) {
          logger.log({ 
            level: 'error', 
            message: 'Auto-sync failed', 
            error: err 
          });
          
          // Update UI if element exists
          const syncStatus = document.getElementById('gist-sync-status');
          if (syncStatus) {
            syncStatus.textContent = 'Sync failed';
            syncStatus.classList.remove('text-gray-600', 'text-green-500');
            syncStatus.classList.add('text-red-500');
          }
        }
      }, config.syncInterval * 60 * 1000); // Convert minutes to milliseconds
      
      logger.log({ 
        level: 'info', 
        message: `Auto-sync enabled with ${config.syncInterval} minute interval` 
      });
    }
  };
  
  // Initialize the module
  const init = () => {
    // Load configuration
    loadConfig();
    
    // Set up auto-sync
    setupAutoSync();
    
    logger.log({ level: 'info', message: 'GistDB initialized', enabled: isEnabled() });
    
    // Return config
    return config;
  };
  
  // API for configuration form
  const showConfigForm = () => {
    if (!window.utils?.showAlert) {
      console.error('Utils module not available');
      return;
    }
    
    window.utils.showAlert(`
      <div>
        <h3 class="text-lg font-medium mb-4">GitHub Gist Database Configuration</h3>
        
        <div class="mb-4">
          <label class="flex items-center">
            <input type="checkbox" id="gist-enabled" class="mr-2 h-4 w-4" ${config.enabled ? 'checked' : ''}>
            <span>Enable Gist Database</span>
          </label>
          <p class="text-xs text-gray-500 mt-1">When enabled, your data will be stored in a GitHub Gist</p>
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1" for="gist-token">
            GitHub Personal Access Token
          </label>
          <input type="password" id="gist-token" value="${config.token}" 
            class="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary-400"
            placeholder="ghp_xxxxxxxxxxxx">
          <p class="text-xs text-gray-500 mt-1">Needs 'gist' scope only. <a href="https://github.com/settings/tokens/new?scopes=gist&description=ShelfTrack%20App" target="_blank" class="text-blue-500 hover:underline">Create token</a></p>
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1" for="gist-id">
            Gist ID (Optional)
          </label>
          <input type="text" id="gist-id" value="${config.gistId}" 
            class="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary-400"
            placeholder="Leave blank to create new">
          <p class="text-xs text-gray-500 mt-1">Leave blank to create a new Gist</p>
        </div>
        
        <div class="mb-4 flex gap-4">
          <label class="flex items-center">
            <input type="checkbox" id="gist-autosync" class="mr-2 h-4 w-4" ${config.autoSync ? 'checked' : ''}>
            <span>Enable Auto-Sync</span>
          </label>
          
          <label class="flex items-center">
            <input type="checkbox" id="gist-autobackup" class="mr-2 h-4 w-4" ${config.autoBackup ? 'checked' : ''}>
            <span>Backup on Changes</span>
          </label>
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1" for="gist-interval">
            Sync Interval (minutes)
          </label>
          <input type="number" id="gist-interval" value="${config.syncInterval}" min="1" max="1440"
            class="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary-400">
        </div>
        
        ${config.lastSync ? `
        <div class="text-xs text-gray-500 mb-4">
          Last synced: ${new Date(config.lastSync).toLocaleString()}
        </div>
        ` : ''}
        
        ${config.gistId ? `
        <div class="mb-4 text-xs">
          <a href="https://gist.github.com/${config.gistId}" target="_blank" class="text-blue-500 hover:underline">
            View Gist on GitHub
          </a>
        </div>
        ` : ''}
      </div>
    `, {
      isConfirm: true,
      html: true,
      confirmText: 'Save Configuration',
      alertType: 'info',
      onConfirm: async () => {
        try {
          const enabled = document.getElementById('gist-enabled').checked;
          const token = document.getElementById('gist-token').value.trim();
          let gistId = document.getElementById('gist-id').value.trim();
          const autoSync = document.getElementById('gist-autosync').checked;
          const autoBackup = document.getElementById('gist-autobackup').checked; // New option
          const syncInterval = parseInt(document.getElementById('gist-interval').value, 10) || 30;
          
          // Validate token if enabled
          if (enabled && !token) {
            window.utils.showAlert('GitHub token is required when Gist Database is enabled.', {
              alertType: 'error'
            });
            return;
          }
          
          // Save settings first
          saveConfig({
            enabled,
            token,
            gistId,
            autoSync,
            syncInterval,
            autoBackup // Save new option
          });
          
          // If enabled but no Gist ID, create a new one
          if (enabled && token && !gistId) {
            try {
              // Get current data to use as initial data for the new Gist
              const initialData = {
                shelves: window.storage?.loadShelves() || {},
                groups: window.storage?.loadGroups() || []
              };
              
              window.utils.showAlert('Creating new Gist...', {
                alertType: 'info',
                autoClose: 2000
              });
              
              const newGistId = await createGist(initialData);
              gistId = newGistId;
              
              window.utils.showAlert(`New Gist created successfully with ID: ${gistId}`, {
                alertType: 'success'
              });
            } catch (err) {
              window.utils.showAlert(`Failed to create Gist: ${err.message}`, {
                alertType: 'error'
              });
              return;
            }
          }
          
          // Set up auto-sync with new settings
          setupAutoSync();
          
          // Show success message
          window.utils.showAlert('Configuration saved successfully!', {
            alertType: 'success',
            autoClose: 2000
          });
          
          // Update UI if elements exist
          if (enabled) {
            const statusEl = document.getElementById('gist-status-indicator');
            if (statusEl) {
              statusEl.classList.remove('bg-gray-500', 'bg-red-500');
              statusEl.classList.add('bg-green-500');
            }
          }
        } catch (err) {
          window.utils.showAlert(`Error saving configuration: ${err.message}`, {
            alertType: 'error'
          });
        }
      }
    });
  };
  
  // Manually sync data (pull from Gist)
  const pullData = async () => {
    if (!isEnabled()) {
      throw new Error('GistDB is not properly configured');
    }
    
    try {
      const data = await fetchFromGist();
      
      // Apply data to local storage if available
      if (data.shelves && window.storage?.saveShelves) {
        window.storage.saveShelves(data.shelves);
      }
      
      if (data.groups && window.storage?.saveGroups) {
        window.storage.saveGroups(data.groups);
      }
      
      return data;
    } catch (err) {
      logger.log({ level: 'error', message: 'Pull data failed', error: err });
      throw err;
    }
  };
  
  // Manually sync data (push to Gist)
  const pushData = async () => {
    if (!isEnabled()) {
      throw new Error('GistDB is not properly configured');
    }
    
    try {
      const shelves = window.storage?.loadShelves() || {};
      const groups = window.storage?.loadGroups() || [];
      
      await saveToGist({ shelves, groups });
      return true;
    } catch (err) {
      logger.log({ level: 'error', message: 'Push data failed', error: err });
      throw err;
    }
  };
  
  // Export public API
  window.gistdb = {
    init,
    isEnabled,
    getConfig: () => ({ ...config }),
    showConfigForm,
    pullData,
    pushData,
    saveToGist,
    fetchFromGist,
    createGist
  };
  
  // Auto-initialize
  init();
})();
