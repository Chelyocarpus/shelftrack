// Simple configurable logger
(() => {
  // Default log level (can be overridden)
  let logLevel = 'info';
  
  // Map log levels to numeric values for comparison
  const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    none: 4
  };
  
  // Function to check if we should log this message based on current log level
  const shouldLog = (level) => {
    return LOG_LEVELS[level] >= LOG_LEVELS[logLevel];
  };
  
  // The main log function that handles different message formats
  const log = (options) => {
    // Allow both object format and simple string format
    const opts = typeof options === 'string' 
      ? { level: 'info', message: options }
      : options;
    
    const { level = 'info', message, ...rest } = opts;
    
    if (!shouldLog(level)) {
      return;
    }
    
    const hasAdditionalInfo = Object.keys(rest).length > 0;
    
    switch (level) {
      case 'debug':
        console.debug(`[DEBUG] ${message}`);
        if (hasAdditionalInfo) console.debug(rest);
        break;
      case 'info':
        console.info(`[INFO] ${message}`);
        if (hasAdditionalInfo) console.info(rest);
        break;
      case 'warn':
        console.warn(`[WARN] ${message}`);
        if (hasAdditionalInfo) console.warn(rest);
        break;
      case 'error':
        console.error(`[ERROR] ${message}`);
        if (hasAdditionalInfo) console.error(rest);
        break;
    }
  };
  
  // Function to change the current log level
  const setLogLevel = (level) => {
    if (LOG_LEVELS[level] !== undefined) {
      logLevel = level;
      log({ 
        level: 'info', 
        message: `Log level set to: ${level}`
      });
    } else {
      log({ 
        level: 'error', 
        message: `Invalid log level: ${level}. Must be one of: ${Object.keys(LOG_LEVELS).join(', ')}`
      });
    }
  };
  
  // Convenience methods for different log levels
  const debug = (msg) => log({ level: 'debug', message: msg });
  const info = (msg) => log({ level: 'info', message: msg });
  const warn = (msg) => log({ level: 'warn', message: msg });
  const error = (msg) => log({ level: 'error', message: msg });
  
  // Expose the logger API
  window.logger = {
    log,
    debug,
    info,
    warn,
    error,
    setLogLevel
  };
})();
