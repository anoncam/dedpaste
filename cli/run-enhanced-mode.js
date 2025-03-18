#!/usr/bin/env node

// Direct runner for enhanced interactive mode
import { enhancedKeyManagement } from './enhancedInteractiveMode.js';

// Run the enhanced mode
async function run() {
  try {
    await enhancedKeyManagement();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

run();