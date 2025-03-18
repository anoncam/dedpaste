// Advanced logging system for dedpaste
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { homedir } from 'os';

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

// Log level names for display
const LOG_LEVEL_NAMES = {
  [LOG_LEVELS.ERROR]: 'ERROR',
  [LOG_LEVELS.WARN]: 'WARN',
  [LOG_LEVELS.INFO]: 'INFO',
  [LOG_LEVELS.DEBUG]: 'DEBUG',
  [LOG_LEVELS.TRACE]: 'TRACE'
};

// Default configuration
let config = {
  level: LOG_LEVELS.INFO,
  logToConsole: true,
  logToFile: false,
  logDir: path.join(homedir(), '.dedpaste', 'logs'),
  logFile: 'dedpaste.log',
  maxLogSize: 5 * 1024 * 1024, // 5MB
  maxLogFiles: 5,
  redactSecrets: true
};

// Private logger state
let initialized = false;

/**
 * Initialize the logger
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - Logger instance
 */
async function initialize(options = {}) {
  // Merge options with default config
  config = { ...config, ...options };
  
  // Convert string level to numeric level if needed
  if (typeof config.level === 'string') {
    config.level = getLevelFromString(config.level);
  }
  
  // Create log directory if needed
  if (config.logToFile) {
    try {
      await fsPromises.mkdir(config.logDir, { recursive: true });
    } catch (error) {
      console.error(`Failed to create log directory: ${error.message}`);
      config.logToFile = false;
    }
  }
  
  initialized = true;
  
  return {
    error: (message, context = {}) => log(LOG_LEVELS.ERROR, message, context),
    warn: (message, context = {}) => log(LOG_LEVELS.WARN, message, context),
    info: (message, context = {}) => log(LOG_LEVELS.INFO, message, context),
    debug: (message, context = {}) => log(LOG_LEVELS.DEBUG, message, context),
    trace: (message, context = {}) => log(LOG_LEVELS.TRACE, message, context),
    setLevel: (level) => {
      if (typeof level === 'string') {
        config.level = getLevelFromString(level);
      } else {
        config.level = level;
      }
    },
    getLevel: () => LOG_LEVEL_NAMES[config.level],
    enableFileLogging: async () => {
      config.logToFile = true;
      await fsPromises.mkdir(config.logDir, { recursive: true });
    },
    disableFileLogging: () => {
      config.logToFile = false;
    },
    setLogFile: (filePath) => {
      config.logFile = filePath;
    }
  };
}

/**
 * Convert string log level to numeric value
 * @param {string} levelStr - Log level string
 * @returns {number} - Numeric log level
 */
function getLevelFromString(levelStr) {
  const upperLevel = levelStr.toUpperCase();
  return LOG_LEVELS[upperLevel] !== undefined 
    ? LOG_LEVELS[upperLevel] 
    : LOG_LEVELS.INFO;
}

/**
 * Log a message at the specified level
 * @param {number} level - Log level
 * @param {string} message - Log message
 * @param {Object} context - Additional context
 * @returns {boolean} - Success
 */
async function log(level, message, context = {}) {
  // Check if logger is initialized
  if (!initialized) {
    await initialize();
  }
  
  // Check if this level should be logged
  if (level > config.level) {
    return false;
  }
  
  // Format timestamp
  const timestamp = new Date().toISOString();
  
  // Format log entry
  const logEntry = {
    timestamp,
    level: LOG_LEVEL_NAMES[level],
    message,
    ...context
  };
  
  // Redact secrets if enabled
  if (config.redactSecrets) {
    redactSecrets(logEntry);
  }
  
  // Stringify log entry
  const logText = JSON.stringify(logEntry);
  
  // Log to console if enabled
  if (config.logToConsole) {
    // Format for console with colors
    let consoleMethod;
    let logPrefix;
    
    switch (level) {
      case LOG_LEVELS.ERROR:
        consoleMethod = console.error;
        logPrefix = '\x1b[31mERROR\x1b[0m'; // Red
        break;
      case LOG_LEVELS.WARN:
        consoleMethod = console.warn;
        logPrefix = '\x1b[33mWARN\x1b[0m';  // Yellow
        break;
      case LOG_LEVELS.INFO:
        consoleMethod = console.info;
        logPrefix = '\x1b[32mINFO\x1b[0m';  // Green
        break;
      case LOG_LEVELS.DEBUG:
        consoleMethod = console.debug;
        logPrefix = '\x1b[36mDEBUG\x1b[0m'; // Cyan
        break;
      case LOG_LEVELS.TRACE:
        consoleMethod = console.log;
        logPrefix = '\x1b[35mTRACE\x1b[0m'; // Magenta
        break;
      default:
        consoleMethod = console.log;
        logPrefix = `[${LOG_LEVEL_NAMES[level]}]`;
    }
    
    // Create a simplified format for console
    consoleMethod(`${logPrefix} ${timestamp}: ${message}`);
    
    // Log context separately if it exists and isn't empty
    const contextKeys = Object.keys(context).filter(key => key !== 'message' && key !== 'level');
    if (contextKeys.length > 0) {
      const contextObj = {};
      contextKeys.forEach(key => {
        contextObj[key] = context[key];
      });
      consoleMethod(contextObj);
    }
  }
  
  // Log to file if enabled
  if (config.logToFile) {
    try {
      const logFilePath = path.join(config.logDir, config.logFile);
      
      // Check if log rotation is needed
      await rotateLogFileIfNeeded(logFilePath);
      
      // Append to log file
      await fsPromises.appendFile(logFilePath, logText + '\n');
    } catch (error) {
      if (config.logToConsole) {
        console.error(`Failed to write to log file: ${error.message}`);
      }
      return false;
    }
  }
  
  return true;
}

/**
 * Rotate log file if it exceeds the maximum size
 * @param {string} logFilePath - Path to log file
 * @returns {Promise<boolean>} - Whether rotation was performed
 */
async function rotateLogFileIfNeeded(logFilePath) {
  try {
    // Check if file exists
    try {
      await fsPromises.access(logFilePath);
    } catch (error) {
      // File doesn't exist, no rotation needed
      return false;
    }
    
    // Check file size
    const stats = await fsPromises.stat(logFilePath);
    if (stats.size < config.maxLogSize) {
      return false;
    }
    
    // Rotate logs
    for (let i = config.maxLogFiles - 1; i > 0; i--) {
      const oldFile = `${logFilePath}.${i}`;
      const newFile = `${logFilePath}.${i + 1}`;
      
      try {
        await fsPromises.access(oldFile);
        
        if (i === config.maxLogFiles - 1) {
          // Delete the oldest log file
          await fsPromises.unlink(oldFile);
        } else {
          // Rename to next number
          await fsPromises.rename(oldFile, newFile);
        }
      } catch (error) {
        // File doesn't exist, ignore
      }
    }
    
    // Rename current log file
    await fsPromises.rename(logFilePath, `${logFilePath}.1`);
    
    return true;
  } catch (error) {
    if (config.logToConsole) {
      console.error(`Failed to rotate log file: ${error.message}`);
    }
    return false;
  }
}

/**
 * Redact sensitive information from log entries
 * @param {Object} logEntry - Log entry to redact
 */
function redactSecrets(logEntry) {
  // Patterns to redact (keys are patterns, values are replacement text)
  const patterns = {
    // Private key contents
    '-----BEGIN (PRIVATE|RSA PRIVATE) KEY-----[\\s\\S]*?-----END (PRIVATE|RSA PRIVATE) KEY-----': '[REDACTED PRIVATE KEY]',
    // PGP private key blocks
    '-----BEGIN PGP PRIVATE KEY BLOCK-----[\\s\\S]*?-----END PGP PRIVATE KEY BLOCK-----': '[REDACTED PGP PRIVATE KEY]',
    // Passwords and passphrases
    'passphrase\\s*[:=]\\s*[\'"][^\'"]*[\'"]': 'passphrase: [REDACTED]',
    'password\\s*[:=]\\s*[\'"][^\'"]*[\'"]': 'password: [REDACTED]',
    // API tokens and keys
    'api[_-]?key\\s*[:=]\\s*[\'"][^\'"]*[\'"]': 'api_key: [REDACTED]',
    'token\\s*[:=]\\s*[\'"][^\'"]*[\'"]': 'token: [REDACTED]',
    // Encryption keys and IVs in their raw or encoded form
    'encryptedKey\\s*[:=]\\s*[\'"][^\'"]*[\'"]': 'encryptedKey: [REDACTED]',
    'key\\s*[:=]\\s*[\'"][A-Za-z0-9+/=]{16,}[\'"]': 'key: [REDACTED]'
  };
  
  // Helper function to recursively redact objects
  function redactObject(obj) {
    if (!obj || typeof obj !== 'object') return;
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Apply all redaction patterns
        let redactedValue = value;
        for (const [pattern, replacement] of Object.entries(patterns)) {
          redactedValue = redactedValue.replace(new RegExp(pattern, 'gi'), replacement);
        }
        obj[key] = redactedValue;
      } else if (typeof value === 'object') {
        // Recursive redaction for nested objects
        redactObject(value);
      }
    }
  }
  
  // Apply redaction to log message
  if (typeof logEntry.message === 'string') {
    let redactedMessage = logEntry.message;
    for (const [pattern, replacement] of Object.entries(patterns)) {
      redactedMessage = redactedMessage.replace(new RegExp(pattern, 'gi'), replacement);
    }
    logEntry.message = redactedMessage;
  }
  
  // Apply redaction to the whole log entry
  redactObject(logEntry);
}

export {
  LOG_LEVELS,
  LOG_LEVEL_NAMES,
  initialize,
  log
};