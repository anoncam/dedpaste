// Advanced logging system for dedpaste
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { homedir } from 'os';

// Log levels enum
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

// Log level names for display
export const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.TRACE]: 'TRACE'
};

// Logger configuration interface
interface LoggerConfig {
  level: LogLevel | string;
  logToConsole: boolean;
  logToFile: boolean;
  logDir: string;
  logFile: string;
  maxLogSize: number;
  maxLogFiles: number;
  redactSecrets: boolean;
}

// Log context interface
interface LogContext {
  [key: string]: any;
}

// Log entry interface
interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  [key: string]: any;
}

// Logger instance interface
export interface Logger {
  error: (message: string, context?: LogContext) => Promise<boolean>;
  warn: (message: string, context?: LogContext) => Promise<boolean>;
  info: (message: string, context?: LogContext) => Promise<boolean>;
  debug: (message: string, context?: LogContext) => Promise<boolean>;
  trace: (message: string, context?: LogContext) => Promise<boolean>;
  setLevel: (level: LogLevel | string) => void;
  getLevel: () => string;
  enableFileLogging: () => Promise<void>;
  disableFileLogging: () => void;
  setLogFile: (filePath: string) => void;
}

// Default configuration
let config: LoggerConfig = {
  level: LogLevel.INFO,
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
 * @param options - Configuration options
 * @returns Logger instance
 */
export async function initialize(options: Partial<LoggerConfig> = {}): Promise<Logger> {
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
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to create log directory: ${message}`);
      config.logToFile = false;
    }
  }
  
  initialized = true;
  
  return {
    error: (message: string, context: LogContext = {}) => log(LogLevel.ERROR, message, context),
    warn: (message: string, context: LogContext = {}) => log(LogLevel.WARN, message, context),
    info: (message: string, context: LogContext = {}) => log(LogLevel.INFO, message, context),
    debug: (message: string, context: LogContext = {}) => log(LogLevel.DEBUG, message, context),
    trace: (message: string, context: LogContext = {}) => log(LogLevel.TRACE, message, context),
    setLevel: (level: LogLevel | string) => {
      if (typeof level === 'string') {
        config.level = getLevelFromString(level);
      } else {
        config.level = level;
      }
    },
    getLevel: () => {
      const level = typeof config.level === 'string' ? getLevelFromString(config.level) : config.level;
      return LOG_LEVEL_NAMES[level];
    },
    enableFileLogging: async () => {
      config.logToFile = true;
      await fsPromises.mkdir(config.logDir, { recursive: true });
    },
    disableFileLogging: () => {
      config.logToFile = false;
    },
    setLogFile: (filePath: string) => {
      config.logFile = filePath;
    }
  };
}

/**
 * Convert string log level to numeric value
 * @param levelStr - Log level string
 * @returns Numeric log level
 */
function getLevelFromString(levelStr: string): LogLevel {
  const upperLevel = levelStr.toUpperCase();
  const level = LogLevel[upperLevel as keyof typeof LogLevel];
  return level !== undefined ? level : LogLevel.INFO;
}

/**
 * Log a message at the specified level
 * @param level - Log level
 * @param message - Log message
 * @param context - Additional context
 * @returns Success
 */
export async function log(level: LogLevel, message: string, context: LogContext = {}): Promise<boolean> {
  // Check if logger is initialized
  if (!initialized) {
    await initialize();
  }
  
  // Check if this level should be logged
  const configLevel = typeof config.level === 'string' ? getLevelFromString(config.level) : config.level;
  if (level > configLevel) {
    return false;
  }
  
  // Format timestamp
  const timestamp = new Date().toISOString();
  
  // Format log entry
  const logEntry: LogEntry = {
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
    let consoleMethod: (...args: any[]) => void;
    let logPrefix: string;
    
    switch (level) {
      case LogLevel.ERROR:
        consoleMethod = console.error;
        logPrefix = '\x1b[31mERROR\x1b[0m'; // Red
        break;
      case LogLevel.WARN:
        consoleMethod = console.warn;
        logPrefix = '\x1b[33mWARN\x1b[0m';  // Yellow
        break;
      case LogLevel.INFO:
        consoleMethod = console.info;
        logPrefix = '\x1b[32mINFO\x1b[0m';  // Green
        break;
      case LogLevel.DEBUG:
        consoleMethod = console.debug;
        logPrefix = '\x1b[36mDEBUG\x1b[0m'; // Cyan
        break;
      case LogLevel.TRACE:
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
      const contextObj: LogContext = {};
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
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to write to log file: ${message}`);
      }
      return false;
    }
  }
  
  return true;
}

/**
 * Rotate log file if it exceeds the maximum size
 * @param logFilePath - Path to log file
 * @returns Whether rotation was performed
 */
async function rotateLogFileIfNeeded(logFilePath: string): Promise<boolean> {
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
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to rotate log file: ${message}`);
    }
    return false;
  }
}

/**
 * Redact sensitive information from log entries
 * @param logEntry - Log entry to redact
 */
function redactSecrets(logEntry: LogEntry): void {
  // Patterns to redact (keys are patterns, values are replacement text)
  const patterns: Record<string, string> = {
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
  function redactObject(obj: any): void {
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

// For backward compatibility, export LOG_LEVELS as an object
export const LOG_LEVELS = {
  ERROR: LogLevel.ERROR,
  WARN: LogLevel.WARN,
  INFO: LogLevel.INFO,
  DEBUG: LogLevel.DEBUG,
  TRACE: LogLevel.TRACE
};