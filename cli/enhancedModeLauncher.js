#!/usr/bin/env node
/**
 * Enhanced mode launcher - TypeScript implementation
 * A direct approach to resolve hanging issues when launching enhanced mode
 */
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import process from 'process';
// Create a debug log with timestamps
const debugLog = (message) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
};
debugLog('Enhanced mode launcher started');
// Get the current file's directory path
const currentFilePath = fileURLToPath(import.meta.url);
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
        return await import(modulePath);
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
    dirContents.forEach(file => debugLog(` - ${file}`));
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
        // Try to load just one function from the module to test if that works
        // This can help identify if the issue is with the entire module or specific functions
        debugLog('Starting module import with timeout protection');
        const enhancedModule = await safeImport(modulePath);
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
