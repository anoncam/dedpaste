#!/usr/bin/env node
/**
 * Enhanced mode launcher - TypeScript implementation
 * A direct approach to resolve hanging issues when launching enhanced mode
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
// Using require-style imports for Node.js built-ins to avoid TypeScript module resolution issues
const url = require('url');
const path = require('path');
const fs = require('fs');
const childProcess = require('child_process');
const { fileURLToPath } = url;
const { spawn } = childProcess;
// Create a debug log with timestamps
const debugLog = (message) => {
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
    }
    catch (e) {
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
async function safeImport(modulePath) {
    debugLog(`Importing module: ${modulePath}`);
    try {
        return await Promise.resolve(`${modulePath}`).then(s => __importStar(require(s)));
    }
    catch (err) {
        const error = err;
        debugLog(`Error importing module ${modulePath}: ${error.message}`);
        throw error;
    }
}
// Display directory contents for debugging
try {
    debugLog('CLI directory contents:');
    const dirContents = fs.readdirSync(cliDir);
    dirContents.forEach((file) => debugLog(` - ${file}`));
}
catch (err) {
    const error = err;
    debugLog(`Failed to list directory: ${error.message}`);
}
// Enhanced mode entry point
async function runEnhancedMode() {
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
        const enhancedModuleImport = await new Promise((resolve, reject) => {
            try {
                // Use dynamic import via require for better CommonJS compatibility
                const importedModule = require(modulePath);
                resolve(importedModule);
            }
            catch (error) {
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
    }
    catch (error) {
        const err = error;
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
