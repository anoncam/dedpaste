#!/usr/bin/env node

import { program } from 'commander';
import fetch from 'node-fetch';
import { lookup } from 'mime-types';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

// Default API URL - can be changed via environment variable
const API_URL = process.env.DEDPASTE_API_URL || 'https://paste.d3d.dev';

program
  .name('dedpaste')
  .description('CLI client for DedPaste, a simple pastebin service')
  .version(packageJson.version);

program
  .option('-t, --temp', 'Create a one-time paste that is deleted after being viewed')
  .option('--type <content-type>', 'Specify the content type of the paste')
  .option('-f, --file <path>', 'Upload a file from the specified path')
  .option('-o, --output', 'Print only the URL (without any additional text)')
  .action(async (options) => {
    try {
      let content;
      let contentType;
      
      // Determine if we're reading from a file or stdin
      if (options.file) {
        // Read from the specified file
        if (!fs.existsSync(options.file)) {
          console.error(`Error: File '${options.file}' does not exist`);
          process.exit(1);
        }
        
        content = fs.readFileSync(options.file);
        // Try to detect the content type from the file extension
        contentType = options.type || lookup(options.file) || 'text/plain';
      } else {
        // Read from stdin
        const stdinBuffer = [];
        for await (const chunk of process.stdin) {
          stdinBuffer.push(chunk);
        }
        
        if (stdinBuffer.length === 0) {
          console.error('Error: No input provided. Pipe content to dedpaste or use --file option.');
          process.exit(1);
        }
        
        content = Buffer.concat(stdinBuffer);
        contentType = options.type || 'text/plain';
      }
      
      // Determine the endpoint based on whether it's a temporary paste
      const endpoint = options.temp ? '/temp' : '/upload';
      
      // Make the API request
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': contentType
        },
        body: content
      });
      
      if (!response.ok) {
        console.error(`Error: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error(errorText);
        process.exit(1);
      }
      
      const url = await response.text();
      
      // Output the result
      if (options.output) {
        console.log(url.trim());
      } else {
        console.log(`
✓ Paste created successfully!
${options.temp ? '⚠️  This is a one-time paste that will be deleted after first view\n' : ''}
📋 ${url.trim()}
`);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program.parse();