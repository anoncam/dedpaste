#!/usr/bin/env node
/**
 * Enhanced mode launcher - TypeScript implementation
 * A direct approach to resolve hanging issues when launching enhanced mode
 */

// Using require-style imports for Node.js built-ins to avoid TypeScript module resolution issues
const url = require('url');
const path = require('path');
const fs = require('fs');
const childProcess = require('child_process');
const { fileURLToPath } = url;
const { spawn } = childProcess;

interface ProcessResult {
  success: boolean;
  message?: string;
  data?: any;
}

// Create a debug log with timestamps
const debugLog = (message: string): void => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

debugLog('Enhanced mode launcher started');

// Get the current file's directory path
// Get current file path using __filename which is available in both CommonJS and when transpiled from ESM
const getCurrentFilePath = () => {
  try {
    // Try to use __filename directly (works in CommonJS)
    // @ts-ignore: Allow __filename usage which is defined at runtime
    return __filename; 
  } catch (e) {
    // Fallback
    return path.join(process.cwd(), 'cli', 'enhancedModeLauncher.js');
  }
};

const currentFilePath = getCurrentFilePath();
const cliDir = path.dirname(currentFilePath);
debugLog(`CLI directory: ${cliDir}`);

// Setup graceful shutdown handler for Ctrl+C
process.on('SIGINT', () => {
  debugLog('Received interrupt signal');
  console.log('\nExiting enhanced mode...');
  process.exit(0);
});

// Function to safely import modules with timeout protection
async function safeImport<T>(modulePath: string): Promise<T> {
  debugLog(`Importing module: ${modulePath}`);
  
  try {
    return await import(modulePath) as Promise<T>;
  } catch (err) {
    const error = err as Error;
    debugLog(`Error importing module ${modulePath}: ${error.message}`);
    throw error;
  }
}

// Display directory contents for debugging
try {
  debugLog('CLI directory contents:');
  const dirContents = fs.readdirSync(cliDir);
  dirContents.forEach((file: string) => debugLog(` - ${file}`));
} catch (err) {
  const error = err as Error;
  debugLog(`Failed to list directory: ${error.message}`);
}

// Enhanced mode entry point
async function runEnhancedMode(): Promise<void> {
  
  try {
    // Import directly from enhancedInteractiveMode.js
    const modulePath = path.join(cliDir, 'enhancedInteractiveMode.js');
    
    if (!fs.existsSync(modulePath)) {
      debugLog(`Module not found at ${modulePath}`);
      throw new Error(`Cannot find required module at ${modulePath}`);
    }
    
    // Import the module using a dynamic import (works in both ESM and CommonJS when transpiled)
    debugLog('Starting module import');
    // Use dynamic import wrapped in a try/catch for better error handling
    const enhancedModuleImport = await new Promise<any>((resolve, reject) => {
      try {
        // Use dynamic import via require for better CommonJS compatibility
        const importedModule = require(modulePath);
        resolve(importedModule);
      } catch (error) {
        reject(error);
      }
    });
    
    const enhancedModule = enhancedModuleImport;
    debugLog('Enhanced module loaded successfully');
    
    // Check if the module has the required function
    if (typeof enhancedModule.enhancedKeyManagement !== 'function') {
      throw new Error('enhancedKeyManagement function not found in module');
    }
    
    debugLog('Starting enhancedKeyManagement');
    // Run the enhanced key management
    const result = await enhancedModule.enhancedKeyManagement();
    
    debugLog('enhancedKeyManagement completed');
    
    // Handle the result
    if (!result.success) {
      debugLog(`Error in result: ${result.message || 'Unknown error'}`);
      console.error('Error:', result.message || 'Unknown error');
      process.exit(1);
    }
    
    if (result.message) {
      console.log(result.message);
    }
    
    debugLog('Enhanced mode completed successfully');
    // Process completed successfully
    process.exit(0);
  } catch (error) {
    const err = error as Error;
    debugLog(`Enhanced mode error: ${err.message}`);
    if (err.stack) {
      debugLog(`Stack trace: ${err.stack}`);
    }
    
    // Log detailed error information to help with debugging
    debugLog(`Error details: ${err.message}`);
    if (err.stack) {
      debugLog(`Stack trace: ${err.stack}`);
    }
    console.error(`Enhanced mode error: ${err.message}`);
    process.exit(1);
  }
}

// Run the enhanced mode
runEnhancedMode().catch(err => {
  debugLog(`Unhandled promise rejection: ${err.message}`);
  console.error(`Critical error in enhanced mode: ${err.message}`);
  process.exit(1);
});
