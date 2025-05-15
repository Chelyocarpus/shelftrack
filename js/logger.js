// logger.js
(() => {
  const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
  let currentLogLevel = LOG_LEVELS.info;

  const setLogLevel = (level) => {
    if (LOG_LEVELS[level] !== undefined) {
      currentLogLevel = LOG_LEVELS[level];
    }
  };

  const log = ({ level = 'info', message, ...rest }) => {
    if (LOG_LEVELS[level] <= currentLogLevel) {
      // eslint-disable-next-line no-console
      console[level](message, rest);
    }
  };

  // Export for use in other scripts
  window.logger = { setLogLevel, log, LOG_LEVELS };
})();
