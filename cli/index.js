#!/usr/bin/env node

import { program } from 'commander';
import fetch from 'node-fetch';
import { lookup } from 'mime-types';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { promises as fsPromises } from 'fs';
import { homedir } from 'os';
import inquirer from 'inquirer';

// Import our new modules
import {
  generateKeyPair,
  addFriendKey,
  listKeys,
  getKey,
  removeKey,
  updateLastUsed
} from './keyManager.js';

import {
  encryptContent,
  decryptContent
} from './encryptionUtils.js';

import {
  interactiveKeyManagement,
  interactiveListKeys,
  interactiveAddFriend,
  interactiveRemoveKey,
  interactiveExportKey,
  interactiveSend
} from './interactiveMode.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

// Default API URL - can be changed via environment variable
const API_URL = process.env.DEDPASTE_API_URL || 'https://paste.d3d.dev';

program
  .name('dedpaste')
  .description('CLI client for DedPaste, a simple pastebin service')
  .version(packageJson.version);

// Add a command to manage keys
program
  .command('keys')
  .description('Manage encryption keys')
  .option('--interactive', 'Use interactive mode')
  .option('--list', 'List all keys')
  .option('--add-friend <name>', 'Add a friend\'s public key')
  .option('--key-file <path>', 'Path to key file')
  .option('--export', 'Export your public key')
  .option('--remove <name>', 'Remove a key')
  .option('--gen-key', 'Generate a new key pair')
  .option('--my-key', 'Output your public key to the console')
  .action(async (options) => {
    try {
      // Interactive mode
      if (options.interactive) {
        const result = await interactiveKeyManagement();
        if (result.message) {
          console.log(result.message);
        }
        return;
      }
      
      // List keys
      if (options.list) {
        await interactiveListKeys();
        return;
      }
      
      // Add a friend's key
      if (options.addFriend) {
        if (!options.keyFile) {
          console.error('Error: --key-file is required when adding a friend');
          process.exit(1);
        }
        
        try {
          const keyContent = await fsPromises.readFile(options.keyFile, 'utf8');
          const keyPath = await addFriendKey(options.addFriend, keyContent);
          console.log(`Added ${options.addFriend}'s public key at ${keyPath}`);
        } catch (error) {
          console.error(`Error adding friend's key: ${error.message}`);
          process.exit(1);
        }
        return;
      }
      
      // Export public key
      if (options.export) {
        const result = await interactiveExportKey();
        if (result.message) {
          console.log(result.message);
        }
        return;
      }
      
      // Remove a key
      if (options.remove) {
        try {
          const success = await removeKey('friend', options.remove);
          if (success) {
            console.log(`Removed ${options.remove}'s key successfully`);
          } else {
            console.error(`Friend "${options.remove}" not found`);
            process.exit(1);
          }
        } catch (error) {
          console.error(`Error removing key: ${error.message}`);
          process.exit(1);
        }
        return;
      }
      
      // Generate a new key pair
      if (options.genKey) {
        const { privateKeyPath, publicKeyPath } = await generateKeyPair();
        console.log(`
✓ Generated new key pair:
  - Private key: ${privateKeyPath}
  - Public key: ${publicKeyPath}
`);
        return;
      }
      
      // Output public key to console
      if (options.myKey) {
        const selfKey = await getKey('self');
        if (!selfKey) {
          console.error('No personal key found. Generate one with --gen-key first.');
          process.exit(1);
        }
        
        try {
          const publicKeyContent = await fsPromises.readFile(selfKey.public, 'utf8');
          console.log('\nYour public key:');
          console.log('----------------');
          console.log(publicKeyContent);
          console.log('----------------');
          console.log('\nShare this key with your friends so they can send you encrypted pastes.');
        } catch (error) {
          console.error(`Error reading public key: ${error.message}`);
          process.exit(1);
        }
        return;
      }
      
      // If no specific action is provided, show help
      program.commands.find(cmd => cmd.name() === 'keys').help();
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Add a command to send a paste
program
  .command('send')
  .description('Create and send an encrypted paste')
  .option('-t, --temp', 'Create a one-time paste that is deleted after being viewed')
  .option('--type <content-type>', 'Specify the content type of the paste')
  .option('-f, --file <path>', 'Upload a file from the specified path')
  .option('-o, --output', 'Print only the URL (without any additional text)')
  .option('-e, --encrypt', 'Encrypt the content before uploading')
  .option('--for <friend>', 'Encrypt for a specific friend')
  .option('--list-friends', 'List available friends')
  .option('--key-file <path>', 'Path to public key for encryption')
  .option('--gen-key', 'Generate a new key pair for encryption')
  .option('--interactive', 'Use interactive mode')
  .option('--debug', 'Debug mode: show encrypted content without uploading')
  .action(async (options) => {
    try {
      // List friends if requested
      if (options.listFriends) {
        const db = await listKeys();
        const friendNames = Object.keys(db.keys.friends);
        
        if (friendNames.length === 0) {
          console.log('No friend keys found. Add one with "dedpaste keys add-friend"');
          return;
        }
        
        console.log('\nAvailable friends:');
        for (const name of friendNames) {
          const friend = db.keys.friends[name];
          const lastUsed = new Date(friend.last_used).toLocaleString();
          console.log(`  - ${name} (last used: ${lastUsed})`);
        }
        return;
      }
      
      let content;
      let contentType;
      let recipientName = options.for;
      
      // Interactive mode
      if (options.interactive) {
        const result = await interactiveSend();
        content = result.content;
        recipientName = result.recipient;
        options.temp = result.temp;
        contentType = 'text/plain';
      } else {
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
      }
      
      // Handle encryption if requested
      if (options.encrypt) {
        // Generate new keys if requested
        if (options.genKey) {
          const { publicKeyPath, privateKeyPath } = await generateKeyPair();
          console.log(`
✓ Generated new key pair:
  - Private key: ${privateKeyPath}
  - Public key: ${publicKeyPath}
`);
        }
        
        // Encrypt the content
        content = await encryptContent(content, recipientName);
        
        // Set content type to application/json for encrypted content
        contentType = 'application/json';
      }
      
      // Determine the endpoint based on whether it's a temporary paste and encrypted
      let endpoint;
      if (options.encrypt) {
        endpoint = options.temp ? '/e/temp' : '/e/upload';
      } else {
        endpoint = options.temp ? '/temp' : '/upload';
      }
      
      // In debug mode, just show the encrypted content
      if (options.debug && options.encrypt) {
        console.log('Debug mode: Showing encrypted content without uploading');
        console.log('Encrypted content (JSON):');
        console.log(content.toString());
        return;
      }
      
      // Make the API request
      try {
        const response = await fetch(`${API_URL}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': contentType,
            'User-Agent': `dedpaste-cli/${packageJson.version}`
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
          let encryptionMessage = '';
          if (options.encrypt) {
            if (recipientName) {
              encryptionMessage = `🔒 This paste is encrypted for ${recipientName} and can only be decrypted with their private key\n`;
            } else {
              encryptionMessage = '🔒 This paste is encrypted and can only be decrypted with your private key\n';
            }
          }
          
          console.log(`
✓ Paste created successfully!
${options.temp ? '⚠️  This is a one-time paste that will be deleted after first view\n' : ''}
${encryptionMessage}
📋 ${url.trim()}
`);
        }
      } catch (error) {
        console.error(`Network error: ${error.message}`);
        console.error('If you just want to test encryption without uploading, use the --debug flag');
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Update the 'get' command to use the new decryption function
program
  .command('get')
  .description('Get a paste by URL or ID')
  .argument('<url-or-id>', 'URL or ID of the paste to retrieve')
  .option('--key-file <path>', 'Path to private key for decryption')
  .action(async (urlOrId, options) => {
    try {
      // Extract ID and check if it's an encrypted paste
      let id = urlOrId;
      let isEncrypted = false;
      
      // If it's a URL, extract the ID and check the path
      if (urlOrId.startsWith('http')) {
        const url = new URL(urlOrId);
        const path = url.pathname;
        
        // Check if it's an encrypted paste
        const encryptedMatch = path.match(/^\/e\/([a-zA-Z0-9]{8})$/);
        if (encryptedMatch) {
          id = encryptedMatch[1];
          isEncrypted = true;
        } else {
          const regularMatch = path.match(/^\/([a-zA-Z0-9]{8})$/);
          if (regularMatch) {
            id = regularMatch[1];
          } else {
            console.error('Invalid paste URL format');
            process.exit(1);
          }
        }
      } else if (id.length === 8) {
        // It's just an ID, assume it's not encrypted
        isEncrypted = false;
      } else {
        console.error('Invalid paste ID format');
        process.exit(1);
      }
      
      // Determine the URL to fetch
      const fetchUrl = isEncrypted
        ? `${API_URL}/e/${id}`
        : `${API_URL}/${id}`;
      
      // Fetch the paste
      const response = await fetch(fetchUrl);
      
      if (!response.ok) {
        console.error(`Error: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error(errorText);
        process.exit(1);
      }
      
      // Get the content
      const content = await response.arrayBuffer();
      const contentBuffer = Buffer.from(content);
      
      // If it's encrypted, decrypt it
      if (isEncrypted) {
        console.log('⚠️  This paste is encrypted');
        
        try {
          const result = await decryptContent(contentBuffer);
          
          // Display metadata if available
          if (result.metadata && result.metadata.version === 2) {
            if (result.metadata.sender && result.metadata.sender !== 'self') {
              console.log(`Sender: ${result.metadata.sender}`);
            }
            
            if (result.metadata.timestamp) {
              console.log(`Created: ${new Date(result.metadata.timestamp).toLocaleString()}`);
            }
          }
          
          console.log('\n✓ Paste decrypted successfully:\n');
          process.stdout.write(result.content);
        } catch (error) {
          console.error(`Decryption error: ${error.message}`);
          process.exit(1);
        }
      } else {
        // Just output the content
        process.stdout.write(contentBuffer);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Add a default command that shows help if no command is specified
program
  .action(() => {
    program.help();
  });

program.parse();