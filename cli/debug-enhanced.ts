#!/usr/bin/env node
/**
 * Direct debug script for enhanced mode
 * This bypasses the launcher mechanism to help diagnose hanging issues
 */

import { enhancedKeyManagement } from './enhancedInteractiveMode.js';

console.log('Initializing enhanced mode directly...');

async function runDirectly(): Promise<void> {
  try {
    console.log('Starting enhancedKeyManagement function...');
    const result = await enhancedKeyManagement();
    console.log('enhancedKeyManagement completed:', result);
    process.exit(0);
  } catch (error) {
    console.error('Error in enhanced mode:', error);
    process.exit(1);
  }
}

runDirectly().catch(err => {
  console.error('Unhandled promise rejection:', err);
  process.exit(1);
});