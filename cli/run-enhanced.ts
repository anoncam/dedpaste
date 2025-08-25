#!/usr/bin/env node

// Simple script to directly run the enhanced mode
console.log('Directly running enhanced mode...');

// Get the path to the current module directory
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn, ChildProcess } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const enhancedLauncherPath = join(__dirname, 'enhancedModeLauncher.js');

console.log(`Launching: ${enhancedLauncherPath}`);

// Spawn the launcher as a separate process
const enhancedProcess: ChildProcess = spawn('node', [enhancedLauncherPath], {
  stdio: 'inherit',
  env: process.env
});

// Handle process events
enhancedProcess.on('error', (err: Error) => {
  console.error(`Error launching enhanced mode: ${err.message}`);
  process.exit(1);
});

enhancedProcess.on('exit', (code: number | null) => {
  console.log(`Enhanced mode exited with code ${code}`);
  process.exit(code || 0);
});