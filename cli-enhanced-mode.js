#!/usr/bin/env node

// This is a standalone script for running the enhanced interactive mode
// It avoids the Commander parsing and directly invokes the enhanced mode
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory path
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import our enhanced mode
import('./cli/enhancedInteractiveMode.js')
  .then(mod => {
    // Run the enhanced mode
    return mod.enhancedKeyManagement();
  })
  .then(result => {
    if (!result.success) {
      console.error(`Error: ${result.message}`);
      process.exit(1);
    }
    process.exit(0);
  })
  .catch(error => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });