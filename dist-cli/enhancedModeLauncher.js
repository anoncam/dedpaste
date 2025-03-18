#!/usr/bin/env node
"use strict";
/**
 * Enhanced mode launcher - Direct approach
 * Simplified launcher that works more like our debug script
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
// Debug logging helper
const debugLog = (message) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
};
debugLog('Enhanced mode launcher started');
// Setup graceful shutdown handler for Ctrl+C
process.on('SIGINT', () => {
    debugLog('Received interrupt signal');
    console.log('\nExiting enhanced mode...');
    process.exit(0);
});
// Use a simple, direct approach to load and execute the enhanced mode
async function runEnhancedMode() {
    debugLog('Starting enhanced mode directly');
    try {
        // Import the enhanced mode module directly
        debugLog('Importing enhancedInteractiveMode.js');
        // Now using proper type declaration file
        const { enhancedKeyManagement } = await Promise.resolve().then(() => __importStar(require('./enhancedInteractiveMode.js')));
        debugLog('Successfully imported enhancedKeyManagement function');
        if (typeof enhancedKeyManagement !== 'function') {
            throw new Error('enhancedKeyManagement is not a function');
        }
        // Execute enhanced key management
        debugLog('Executing enhancedKeyManagement function');
        const result = await enhancedKeyManagement();
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
        process.exit(0);
    }
    catch (error) {
        // Handle any errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        debugLog(`Enhanced mode error: ${errorMessage}`);
        console.error(`Enhanced mode error: ${errorMessage}`);
        if (error instanceof Error && error.stack) {
            debugLog(`Stack trace: ${error.stack}`);
        }
        process.exit(1);
    }
}
// Run the enhanced mode
runEnhancedMode().catch(error => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    debugLog(`Unhandled promise rejection: ${errorMessage}`);
    console.error(`Critical error in enhanced mode: ${errorMessage}`);
    process.exit(1);
});
