#!/usr/bin/env node
/**
 * Enhanced mode launcher - Direct approach
 * Simplified launcher that works more like our debug script
 */
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
        // Import with a timeout to prevent hanging
        debugLog('Importing enhancedInteractiveMode.js');
        let enhancedKeyManagement;
        try {
            // Set a timeout for the dynamic import
            const importTimeout = setTimeout(() => {
                throw new Error('Import timed out after 10 seconds');
            }, 10000);
            // Attempt to dynamically import the module
            const module = await import('./enhancedInteractiveMode.js');
            clearTimeout(importTimeout);
            enhancedKeyManagement = module.enhancedKeyManagement;
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            throw new Error(`Failed to import enhancedInteractiveMode.js: ${errorMessage}`);
        }
        debugLog('Successfully imported enhancedKeyManagement function');
        if (typeof enhancedKeyManagement !== 'function') {
            throw new Error('enhancedKeyManagement is not a function');
        }
        // Execute the function without a timeout to prevent users from being
        // kicked out in the middle of key operations
        debugLog('Executing enhancedKeyManagement function');
        let result;
        try {
            // Execute the function without timeout
            result = await enhancedKeyManagement();
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            throw new Error(`Failed to execute enhancedKeyManagement: ${errorMessage}`);
        }
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
export {};
