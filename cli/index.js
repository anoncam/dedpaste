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
// Import clipboardy with error handling
let clipboard;
try {
  clipboard = await import('clipboardy');
  console.log('DEBUG: Successfully loaded clipboardy module');
} catch (error) {
  console.error(`Failed to load clipboardy: ${error.message}`);
  // Fallback implementation if clipboard fails to load
  clipboard = {
    writeSync: (text) => {
      console.error('Clipboard access is not available. URL could not be copied.');
      console.log(`Manual copy: ${text}`);
    }
  };
}

// Import our core modules
import {
  generateKeyPair,
  addFriendKey,
  listKeys,
  getKey,
  removeKey,
  updateLastUsed,
  addPgpKey,
  addKeybaseKey
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

// Import PGP and Keybase utilities
import {
  fetchPgpKey,
  importPgpKey,
  addPgpKeyFromServer
} from './pgpUtils.js';

import {
  fetchKeybaseUser,
  fetchKeybasePgpKey,
  verifyKeybaseProofs,
  addKeybaseKey as fetchAndAddKeybaseKey
} from './keybaseUtils.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

// Default API URL - can be changed via environment variable
const API_URL = process.env.DEDPASTE_API_URL || 'https://paste.d3d.dev';

program
  .name('dedpaste')
  .description('CLI client for DedPaste, a simple pastebin service')
  .version(packageJson.version)
  .addHelpText('before', `
DedPaste - Secure pastebin with end-to-end encryption

USAGE:
  $ dedpaste                     Create a paste from stdin
  $ dedpaste < file.txt          Create a paste from a file
  $ dedpaste --file path/to/file Create a paste from a specific file
  $ dedpaste --temp              Create a one-time paste (deleted after viewing)
  $ dedpaste --encrypt           Create an encrypted paste
  $ dedpaste keys                Manage encryption keys
  $ dedpaste send                Create and send an encrypted paste
  $ dedpaste get <url-or-id>     Retrieve and display a paste
  $ dedpaste completion          Generate shell completion scripts

EXAMPLES:
  $ echo "Hello, world!" | dedpaste
  $ dedpaste --file secret.txt --temp --encrypt
  $ dedpaste keys --gen-key
  $ dedpaste send --encrypt --for alice --temp
  $ dedpaste get https://paste.d3d.dev/AbCdEfGh
  $ dedpaste completion --bash > ~/.dedpaste-completion.bash
`);

// Add a command to manage keys
program
  .command('keys')
  .description('Manage encryption keys for secure communication')
  .option('--interactive', 'Use interactive menu-driven mode for key management')
  .option('--list', 'List all your keys and friends\' keys with fingerprints')
  .option('--add-friend <name>', 'Add a friend\'s public key (requires --key-file)')
  .option('--key-file <path>', 'Path to key file for import/export operations')
  .option('--export', 'Export your public key to share with friends')
  .option('--remove <name>', 'Remove a friend\'s key from your keyring')
  .option('--gen-key', 'Generate a new RSA key pair for encryption')
  .option('--my-key', 'Output your public key to the console for sharing')
  // PGP options
  .option('--pgp-key <email-or-id>', 'Fetch and add a PGP key from a keyserver')
  .option('--pgp-name <name>', 'Custom name for the PGP key (optional)')
  .option('--import-pgp-key <path>', 'Import a PGP private key for encryption/decryption')
  .option('--pgp-passphrase <phrase>', 'Passphrase for PGP private key')
  .option('--native-pgp', 'Use native PGP encryption instead of converting to PEM')
  // Keybase options
  .option('--keybase <username>', 'Fetch and add a Keybase user\'s PGP key')
  .option('--keybase-name <name>', 'Custom name for the Keybase user\'s key (optional)')
  .option('--no-verify', 'Skip verification of Keybase proofs')
  .addHelpText('after', `
Examples:
  $ dedpaste keys --gen-key                               # Generate a new key pair
  $ dedpaste keys --list                                  # List all your keys
  $ dedpaste keys --add-friend alice --key-file alice_public.pem  # Add a friend's key
  $ dedpaste keys --my-key                                # Display your public key
  $ dedpaste keys --interactive                           # Use interactive mode
  
PGP Integration:
  $ dedpaste keys --pgp-key user@example.com              # Add a PGP key from keyservers
  $ dedpaste keys --pgp-key 0x1234ABCD                    # Add a PGP key using key ID
  $ dedpaste keys --pgp-key user@example.com --pgp-name alice  # Add with custom name
  
Keybase Integration:
  $ dedpaste keys --keybase username                      # Add a Keybase user's key
  $ dedpaste keys --keybase username --keybase-name bob   # Add with custom name
  $ dedpaste keys --keybase username --no-verify          # Skip verification of proofs
  
Key Storage:
  - Your keys are stored in ~/.dedpaste/keys/
  - Friend keys are stored in ~/.dedpaste/friends/
  - PGP keys are stored in ~/.dedpaste/pgp/
  - Keybase keys are stored in ~/.dedpaste/keybase/
  - Key database is at ~/.dedpaste/keydb.json
`)
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
          // Try to remove from any collection
          const success = await removeKey('any', options.remove);
          if (success) {
            console.log(`Removed ${options.remove}'s key successfully`);
          } else {
            console.error(`Key "${options.remove}" not found`);
            process.exit(1);
          }
        } catch (error) {
          console.error(`Error removing key: ${error.message}`);
          process.exit(1);
        }
        return;
      }
      
      // Fetch and add a PGP key from keyservers
      if (options.pgpKey) {
        try {
          console.log(`Fetching PGP key for "${options.pgpKey}" from keyservers...`);
          const name = options.pgpName || options.pgpKey;
          const result = await addPgpKeyFromServer(options.pgpKey, name);
          console.log(`
✓ Added PGP key:
  - Name: ${result.name}
  - Email: ${result.email || 'Not specified'}
  - Key ID: ${result.keyId}
  - Stored at: ${result.path}
`);
        } catch (error) {
          console.error(`Error fetching PGP key: ${error.message}`);
          process.exit(1);
        }
        return;
      }
      
      // Import a PGP private key
      if (options.importPgpKey) {
        // Check if passphrase was provided
        if (!options.pgpPassphrase) {
          console.error('Error: --pgp-passphrase is required when importing a PGP private key');
          process.exit(1);
        }
        
        try {
          // Read the PGP private key file
          const pgpPrivateKeyContent = await fsPromises.readFile(options.importPgpKey, 'utf8');
          
          // Import the PGP private key
          console.log(`Importing PGP private key from ${options.importPgpKey}...`);
          const result = await importPgpPrivateKey(pgpPrivateKeyContent, options.pgpPassphrase);
          
          // Save the private and public key to the PGP key directory
          const { PGP_KEY_DIR } = await ensureDirectories();
          const privateKeyPath = path.join(PGP_KEY_DIR, `private.pem`);
          const publicKeyPath = path.join(PGP_KEY_DIR, `public.pem`);
          
          // Write the keys to files
          await fsPromises.writeFile(privateKeyPath, result.privateKey);
          await fsPromises.writeFile(publicKeyPath, result.publicKey);
          
          // Update the key database
          const db = await loadKeyDatabase();
          db.keys.pgp.self = {
            private: privateKeyPath,
            public: publicKeyPath,
            original: options.importPgpKey,
            fingerprint: result.keyId,
            name: result.name,
            email: result.email,
            created: new Date().toISOString()
          };
          await saveKeyDatabase(db);
          
          console.log(`
✓ Imported PGP private key:
  - Name: ${result.name}
  - Email: ${result.email || 'Not specified'}
  - Key ID: ${result.keyId}
  - Converted private key: ${privateKeyPath}
  - Converted public key: ${publicKeyPath}
  - Original PGP key: ${options.importPgpKey}
`);
        } catch (error) {
          console.error(`Error importing PGP private key: ${error.message}`);
          process.exit(1);
        }
        return;
      }
      
      // Fetch and add a Keybase user's key
      if (options.keybase) {
        try {
          console.log(`Fetching Keybase key for user "${options.keybase}"...`);
          
          if (options.verify) {
            console.log('Verifying user proofs on Keybase...');
          }
          
          const name = options.keybaseName || `keybase:${options.keybase}`;
          const result = await fetchAndAddKeybaseKey(options.keybase, name, options.verify);
          
          console.log(`
✓ Added Keybase key:
  - Name: ${result.name}
  - Keybase username: ${result.username}
  - Email: ${result.email || 'Not specified'}
  - Key ID: ${result.keyId}
  - Stored at: ${result.path}
`);
        } catch (error) {
          console.error(`Error fetching Keybase key: ${error.message}`);
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
  .description('Create and send an encrypted paste to friends')
  .option('-t, --temp', 'Create a one-time paste that is deleted after being viewed')
  .option('--type <content-type>', 'Specify the content type of the paste (e.g., application/json)')
  .option('-f, --file <path>', 'Upload a file from the specified path instead of stdin')
  .option('-o, --output', 'Print only the URL (without any additional text, useful for scripts)')
  .option('-e, --encrypt', 'Encrypt the content before uploading (requires key setup)')
  .option('--for <friend>', 'Encrypt for a specific friend (requires adding their key first)')
  .option('--list-friends', 'List available friends you can encrypt messages for')
  .option('--key-file <path>', 'Path to public key for encryption (alternative to stored keys)')
  .option('--gen-key', 'Generate a new key pair for encryption if you don\'t have one')
  .option('--interactive', 'Use interactive mode with guided prompts for message creation')
  .option('--debug', 'Debug mode: show encrypted content without uploading')
  .option('-c, --copy', 'Copy the URL to clipboard automatically')
  // PGP options
  .option('--pgp', 'Use PGP encryption instead of hybrid RSA/AES')
  .option('--pgp-key-file <path>', 'Use a specific PGP public key file for encryption')
  .option('--pgp-armor', 'Output ASCII-armored PGP instead of binary format')
  .addHelpText('after', `
Examples:
  $ echo "Secret message" | dedpaste send --encrypt                # Encrypt for yourself
  $ echo "For Alice only" | dedpaste send --encrypt --for alice    # Encrypt for a friend
  $ dedpaste send --file secret.txt --encrypt --temp               # Encrypt a file as one-time paste
  $ dedpaste send --interactive --encrypt                          # Interactive encrypted message
  $ dedpaste send --list-friends                                   # List available recipients
  
PGP Options:
  $ echo "Secret" | dedpaste send --encrypt --pgp                  # Use PGP encryption
  $ dedpaste send --encrypt --for alice@example.com --pgp          # Encrypt for PGP key
  $ dedpaste send --pgp-key-file friend.asc --encrypt --pgp        # Use specific PGP key file
  
Encryption:
  - Standard encryption uses RSA for key exchange and AES-256-GCM for content
  - PGP encryption (--pgp) uses OpenPGP standard compatible with GnuPG/GPG
  - Each paste uses a different key for forward secrecy
  - Encrypted pastes include metadata about sender and recipient
  - Use --debug to test encryption without uploading
`)
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
      
      // Check if encryption is requested (manually check for the flag)
      const shouldEncrypt = process.argv.includes('--encrypt') || process.argv.includes('-e');
      
      // Handle encryption if requested
      if (shouldEncrypt) {
        
        // Generate new keys if requested
        if (options.genKey) {
          console.log('Generating new key pair');
          const { publicKeyPath, privateKeyPath } = await generateKeyPair();
          console.log(`
  ✓ Generated new key pair:
    - Private key: ${privateKeyPath}
    - Public key: ${publicKeyPath}
  `);
        }
        
        // Encrypt the content
        try {
          // Check if PGP mode is requested
          const usePgp = options.pgp;
          
          // If PGP key file is provided, read it and use it directly
          if (options.pgpKeyFile) {
            const pgpKeyContent = await fsPromises.readFile(options.pgpKeyFile, 'utf8');
            content = await createPgpEncryptedMessage(content, pgpKeyContent, recipientName || 'recipient');
          } else {
            // Use the standard encryption flow with PGP option
            content = await encryptContent(content, recipientName, usePgp);
          }
          
          // Log PGP mode if used
          if (usePgp || options.pgpKeyFile) {
            console.log('Using PGP encryption');
          }
          
          // Set content type to application/json for encrypted content
          contentType = 'application/json';
        } catch (error) {
          console.error(`Encryption failed: ${error.message}`);
          
          // Provide helpful suggestions for common errors
          if (error.message.includes('PGP key detected') && !options.pgp) {
            console.log('\nSuggestion: This key appears to be a PGP key. Try adding the --pgp flag:');
            console.log(`dedpaste send --encrypt --for ${recipientName} --pgp`);
          }
          
          process.exit(1);
        }
      } else {
        console.log('No encryption requested');
      }
      
      // Determine the endpoint based on whether it's a temporary paste and encrypted
      let endpoint;
      if (shouldEncrypt) {
        endpoint = options.temp ? '/e/temp' : '/e/upload';
      } else {
        endpoint = options.temp ? '/temp' : '/upload';
      }
      
      // In debug mode, just show the encrypted content
      if (options.debug && shouldEncrypt) {
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
        
        // Copy to clipboard if requested
        if (options.copy) {
          try {
            const cleanUrl = url.trim();
            console.log(`DEBUG: Send command - Attempting to copy URL to clipboard: "${cleanUrl}"`);
            if (clipboard.default) {
              clipboard.default.writeSync(cleanUrl);
            } else {
              clipboard.writeSync(cleanUrl);
            }
            console.log(`DEBUG: Send command - URL copied successfully`);
          } catch (error) {
            console.error(`Unable to copy to clipboard: ${error.message}`);
          }
        }
        
        // Output the result
        if (options.output) {
          console.log(url.trim());
        } else {
          let encryptionMessage = '';
          if (shouldEncrypt) {
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
${options.copy ? '📋 URL copied to clipboard: ' : '📋 '} ${url.trim()}
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
  .description('Retrieve and decrypt a paste by URL or ID')
  .argument('<url-or-id>', 'URL or ID of the paste to retrieve (e.g., https://paste.d3d.dev/AbCdEfGh or just AbCdEfGh)')
  .option('--key-file <path>', 'Path to private key for decryption (if not using default key)')
  .option('--pgp-key-file <path>', 'Path to PGP private key for decryption')
  .option('--pgp-passphrase <passphrase>', 'Passphrase for PGP private key')
  .addHelpText('after', `
Examples:
  $ dedpaste get https://paste.d3d.dev/AbCdEfGh        # Get a regular paste by URL
  $ dedpaste get AbCdEfGh                              # Get a regular paste by ID
  $ dedpaste get https://paste.d3d.dev/e/AbCdEfGh      # Get and decrypt an encrypted paste
  $ dedpaste get e/AbCdEfGh                            # Get and decrypt an encrypted paste by ID
  
PGP Decryption:
  $ dedpaste get e/AbCdEfGh --pgp-key-file my.pgp      # Decrypt with PGP private key
  $ dedpaste get e/AbCdEfGh --pgp-key-file my.pgp --pgp-passphrase "secret"
  
URL Format:
  - Regular pastes: https://paste.d3d.dev/{id}
  - Encrypted pastes: https://paste.d3d.dev/e/{id}
  - The CLI automatically detects encrypted pastes and attempts decryption
  
Decryption:
  - Encrypted pastes are automatically decrypted if you have the correct private key
  - PGP encrypted pastes will require a PGP private key and passphrase
  - Metadata about sender and creation time is displayed when available
  - One-time pastes are deleted from the server after viewing
`)
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
          let result;
          
          // Check if PGP key file is provided
          if (options.pgpKeyFile) {
            // Use PGP decryption
            console.log('Using PGP decryption');
            
            // Check for passphrase
            if (!options.pgpPassphrase) {
              console.error('Error: --pgp-passphrase is required when using --pgp-key-file');
              process.exit(1);
            }
            
            // Decrypt with PGP
            result = await decryptContent(contentBuffer, options.pgpKeyFile, options.pgpPassphrase);
          } else {
            // Use standard decryption
            result = await decryptContent(contentBuffer);
          }
          
          // Display metadata if available
          if (result.metadata) {
            // Handle version 2 (standard RSA/AES encryption)
            if (result.metadata.version === 2) {
              if (result.metadata.sender && result.metadata.sender !== 'self') {
                console.log(`Sender: ${result.metadata.sender}`);
              }
              
              if (result.metadata.timestamp) {
                console.log(`Created: ${new Date(result.metadata.timestamp).toLocaleString()}`);
              }
            } 
            // Handle PGP-specific format (version 3)
            else if (result.metadata.pgp) {
              console.log(`PGP encrypted message`);
              
              if (result.metadata.recipient && result.metadata.recipient.name) {
                console.log(`Recipient: ${result.metadata.recipient.name}`);
              }
              
              if (result.metadata.recipient && result.metadata.recipient.email) {
                console.log(`Email: ${result.metadata.recipient.email}`);
              }
              
              if (result.metadata.recipient && result.metadata.recipient.keyId) {
                console.log(`Key ID: ${result.metadata.recipient.keyId}`);
              }
              
              if (result.metadata.timestamp) {
                console.log(`Created: ${new Date(result.metadata.timestamp).toLocaleString()}`);
              }
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

// Add options for the default command (no subcommand)
program
  .option('-t, --temp', 'Create a one-time paste that is deleted after being viewed')
  .option('--type <content-type>', 'Specify the content type of the paste (e.g., application/json)')
  .option('-f, --file <path>', 'Upload a file from the specified path instead of stdin')
  .option('-o, --output', 'Print only the URL (without any additional text)')
  .option('-e, --encrypt', 'Encrypt the content before uploading (requires key setup)')
  .option('-c, --copy', 'Copy the URL to clipboard automatically')
  .addHelpText('after', `
Default Command Examples:
  $ echo "Hello, world!" | dedpaste                    # Create a basic paste
  $ dedpaste --file document.txt                       # Upload a file
  $ echo "Secret data" | dedpaste --encrypt            # Create an encrypted paste
  $ dedpaste --file image.jpg --type image/jpeg        # Upload with specific content type
  $ echo "One-time message" | dedpaste --temp          # Create a one-time paste
  
For more advanced options, use the subcommands:
  $ dedpaste keys --help                               # Key management options
  $ dedpaste send --help                               # Advanced sending options
  $ dedpaste get --help                                # Retrieval options
`);

// Add a default command that handles unencrypted pastes
program
  .action(async (options) => {
    try {
      // Only show help if no arguments are provided and no stdin (user is at a TTY)
      if (process.argv.length <= 2 && process.stdin.isTTY) {
        program.help();
        return;
      }

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
      
      // Check if encryption is requested (manually check for the flag)
      const shouldEncrypt = process.argv.includes('--encrypt') || process.argv.includes('-e');
      
      // Handle encryption if requested
      if (shouldEncrypt) {
        // We need to use the full send command implementation here
        // rather than trying to redirect to it, since we would lose stdin
        
        // Use the created content as is
        try {
          // Encrypt the content
          try {
            // Check if PGP mode is requested
            const usePgp = options.pgp;
            
            // If PGP key file is provided, read it and use it directly
            if (options.pgpKeyFile) {
              const pgpKeyContent = await fsPromises.readFile(options.pgpKeyFile, 'utf8');
              content = await createPgpEncryptedMessage(content, pgpKeyContent, 'self');
            } else {
              // Use the standard encryption flow with PGP option
              content = await encryptContent(content, null, usePgp);
            }
            
            // Log PGP mode if used
            if (usePgp || options.pgpKeyFile) {
              console.log('Using PGP encryption');
            }
            
            // Set content type to application/json for encrypted content
            contentType = 'application/json';
          } catch (error) {
            console.error(`Encryption failed: ${error.message}`);
            process.exit(1);
          }
          
          // Determine the endpoint for encrypted pastes
          const endpoint = options.temp ? '/e/temp' : '/e/upload';
          
          // Make the API request
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
          
          // Copy to clipboard if requested
          if (options.copy) {
            try {
              const cleanUrl = url.trim();
              console.log(`DEBUG: Encrypted command - Attempting to copy URL to clipboard: "${cleanUrl}"`);
              if (clipboard.default) {
                clipboard.default.writeSync(cleanUrl);
              } else {
                clipboard.writeSync(cleanUrl);
              }
              console.log(`DEBUG: Encrypted command - URL copied successfully`);
            } catch (error) {
              console.error(`Unable to copy to clipboard: ${error.message}`);
            }
          }
          
          // Output the result with encryption notice
          if (options.output) {
            console.log(url.trim());
          } else {
            console.log(`
✓ Paste created successfully!
${options.temp ? '⚠️  This is a one-time paste that will be deleted after first view\n' : ''}
🔒 This paste is encrypted and can only be decrypted with your private key

${options.copy ? '📋 URL copied to clipboard: ' : '📋 '} ${url.trim()}
`);
          }
          return;
        } catch (error) {
          console.error(`Error: ${error.message}`);
          process.exit(1);
        }
      }
      
      // Determine the endpoint based on whether it's a temporary paste
      const endpoint = options.temp ? '/temp' : '/upload';
      
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
        
        // Copy to clipboard if requested
        if (options.copy) {
          try {
            const cleanUrl = url.trim();
            console.log(`DEBUG: Primary command - Attempting to copy URL to clipboard: "${cleanUrl}"`);
            if (clipboard.default) {
              clipboard.default.writeSync(cleanUrl);
            } else {
              clipboard.writeSync(cleanUrl);
            }
            console.log(`DEBUG: Primary command - URL copied successfully`);
          } catch (error) {
            console.error(`Unable to copy to clipboard: ${error.message}`);
          }
        }
        
        // Output the result
        if (options.output) {
          console.log(url.trim());
        } else {
          console.log(`
✓ Paste created successfully!
${options.temp ? '⚠️  This is a one-time paste that will be deleted after first view\n' : ''}
${options.copy ? '📋 URL copied to clipboard: ' : '📋 '} ${url.trim()}
`);
        }
      } catch (error) {
        console.error(`Network error: ${error.message}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Add a command for shell completion setup
program
  .command('completion')
  .description('Generate shell completion script')
  .option('--bash', 'Output Bash completion script')
  .option('--zsh', 'Output Zsh completion script')
  .option('--install', 'Print installation instructions instead of the script')
  .addHelpText('after', `
Examples:
  $ dedpaste completion --bash            # Output Bash completion script
  $ dedpaste completion --zsh             # Output Zsh completion script
  $ dedpaste completion --bash --install  # Show Bash installation instructions
  $ dedpaste completion --zsh --install   # Show Zsh installation instructions
  
Installation:
  # For Bash (add to your ~/.bashrc):
  dedpaste completion --bash > ~/.dedpaste-completion.bash
  echo 'source ~/.dedpaste-completion.bash' >> ~/.bashrc
  
  # For Zsh (add to your ~/.zshrc):
  dedpaste completion --zsh > ~/.dedpaste-completion.zsh
  echo 'source ~/.dedpaste-completion.zsh' >> ~/.zshrc
`)
  .action(async (options) => {
    try {
      // Check if we should output for bash or zsh
      if (!options.bash && !options.zsh) {
        console.error("Error: You must specify either --bash or --zsh");
        process.exit(1);
      }
      
      if (options.bash && options.zsh) {
        console.error("Error: Please specify only one shell type (--bash or --zsh)");
        process.exit(1);
      }
      
      // Installation instructions
      if (options.install) {
        if (options.bash) {
          console.log(`
# Bash Completion Installation Instructions

# Option 1: Source directly in your shell profile
dedpaste completion --bash > ~/.dedpaste-completion.bash
echo 'source ~/.dedpaste-completion.bash' >> ~/.bashrc

# Option 2: Install system-wide (if you have bash-completion installed)
# On macOS with Homebrew:
dedpaste completion --bash | sudo tee /usr/local/etc/bash_completion.d/dedpaste > /dev/null

# On Linux (Ubuntu/Debian):
dedpaste completion --bash | sudo tee /etc/bash_completion.d/dedpaste > /dev/null

# Don't forget to restart your shell or source your profile:
source ~/.bashrc
`);
        } else if (options.zsh) {
          console.log(`
# Zsh Completion Installation Instructions

# Option 1: Source directly in your shell profile
dedpaste completion --zsh > ~/.dedpaste-completion.zsh
echo 'source ~/.dedpaste-completion.zsh' >> ~/.zshrc

# Option 2: Install to your fpath
mkdir -p ~/.zsh/completions
dedpaste completion --zsh > ~/.zsh/completions/_dedpaste
echo 'fpath=(~/.zsh/completions $fpath)' >> ~/.zshrc

# Make sure you have compinit loaded in your .zshrc
# If not already there, add:
# autoload -Uz compinit
# compinit

# Don't forget to restart your shell or source your profile:
source ~/.zshrc
`);
        }
        return;
      }
      
      // Generate bash completion script
      if (options.bash) {
        console.log(`#!/usr/bin/env bash

_dedpaste_completions() {
  local cur prev opts commands
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  commands="keys send get completion"
  main_opts="-t --temp --type -f --file -o --output -e --encrypt -c --copy --help --version"
  
  # Check if we're completing a command
  if [[ \${COMP_CWORD} -eq 1 ]]; then
    if [[ \${cur} == -* ]]; then
      COMPREPLY=( $(compgen -W "\${main_opts}" -- "\${cur}") )
      return 0
    else
      COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
      return 0
    fi
  fi
  
  # Complete options for specific commands
  case "\${COMP_WORDS[1]}" in
    keys)
      local key_opts="--interactive --list --add-friend --key-file --export --remove --gen-key --my-key --help"
      if [[ \${cur} == -* ]]; then
        COMPREPLY=( $(compgen -W "\${key_opts}" -- "\${cur}") )
      elif [[ \${prev} == "--key-file" ]]; then
        COMPREPLY=( $(compgen -f -- "\${cur}") )
      fi
      return 0
      ;;
    send)
      local send_opts="-t --temp --type -f --file -o --output -e --encrypt --for --list-friends --key-file --gen-key --interactive --debug -c --copy --help"
      if [[ \${cur} == -* ]]; then
        COMPREPLY=( $(compgen -W "\${send_opts}" -- "\${cur}") )
      elif [[ \${prev} == "--key-file" || \${prev} == "-f" || \${prev} == "--file" ]]; then
        COMPREPLY=( $(compgen -f -- "\${cur}") )
      elif [[ \${prev} == "--type" ]]; then
        local content_types="text/plain application/json text/html text/markdown application/xml application/javascript text/css"
        COMPREPLY=( $(compgen -W "\${content_types}" -- "\${cur}") )
      fi
      return 0
      ;;
    get)
      local get_opts="--key-file --help"
      if [[ \${cur} == -* ]]; then
        COMPREPLY=( $(compgen -W "\${get_opts}" -- "\${cur}") )
      elif [[ \${prev} == "--key-file" ]]; then
        COMPREPLY=( $(compgen -f -- "\${cur}") )
      fi
      return 0
      ;;
    completion)
      local completion_opts="--bash --zsh --install --help"
      if [[ \${cur} == -* ]]; then
        COMPREPLY=( $(compgen -W "\${completion_opts}" -- "\${cur}") )
      fi
      return 0
      ;;
    *)
      if [[ \${cur} == -* ]]; then
        COMPREPLY=( $(compgen -W "\${main_opts}" -- "\${cur}") )
      elif [[ \${prev} == "--key-file" || \${prev} == "-f" || \${prev} == "--file" ]]; then
        COMPREPLY=( $(compgen -f -- "\${cur}") )
      elif [[ \${prev} == "--type" ]]; then
        local content_types="text/plain application/json text/html text/markdown application/xml application/javascript text/css"
        COMPREPLY=( $(compgen -W "\${content_types}" -- "\${cur}") )
      fi
      return 0
      ;;
  esac
}

complete -F _dedpaste_completions dedpaste`);
      }
      
      // Generate zsh completion script
      if (options.zsh) {
        console.log(`#compdef dedpaste

_dedpaste() {
  local -a commands
  local -a main_opts
  
  commands=(
    'keys:Manage encryption keys for secure communication'
    'send:Create and send an encrypted paste to friends'
    'get:Retrieve and decrypt a paste by URL or ID'
    'completion:Generate shell completion script'
  )
  
  main_opts=(
    '(-t --temp)'{-t,--temp}'[Create a one-time paste that is deleted after being viewed]'
    '--type[Specify the content type of the paste (e.g., application/json)]:content-type:(text/plain application/json text/html text/markdown application/xml application/javascript text/css)'
    '(-f --file)'{-f,--file}'[Upload a file from the specified path instead of stdin]:file:_files'
    '(-o --output)'{-o,--output}'[Print only the URL (without any additional text)]'
    '(-e --encrypt)'{-e,--encrypt}'[Encrypt the content before uploading (requires key setup)]'
    '(-c --copy)'{-c,--copy}'[Copy the URL to clipboard automatically]'
    '--help[Show help message]'
    '--version[Show version information]'
  )
  
  _arguments -C \\
    '1: :->command' \\
    '*: :->args' && ret=0
    
  case $state in
    (command)
      _describe -t commands 'dedpaste commands' commands
      _describe -t options 'dedpaste options' main_opts
      ;;
    (args)
      case $line[1] in
        (keys)
          _arguments \\
            '--interactive[Use interactive menu-driven mode for key management]' \\
            '--list[List all your keys and friends keys with fingerprints]' \\
            '--add-friend[Add a friends public key (requires --key-file)]:friend name:' \\
            '--key-file[Path to key file for import/export operations]:key file:_files' \\
            '--export[Export your public key to share with friends]' \\
            '--remove[Remove a friends key from your keyring]:friend name:' \\
            '--gen-key[Generate a new RSA key pair for encryption]' \\
            '--my-key[Output your public key to the console for sharing]' \\
            '--help[Show help message]'
          ;;
        (send)
          _arguments \\
            '(-t --temp)'{-t,--temp}'[Create a one-time paste that is deleted after being viewed]' \\
            '--type[Specify the content type of the paste (e.g., application/json)]:content-type:(text/plain application/json text/html text/markdown application/xml application/javascript text/css)' \\
            '(-f --file)'{-f,--file}'[Upload a file from the specified path instead of stdin]:file:_files' \\
            '(-o --output)'{-o,--output}'[Print only the URL (without any additional text)]' \\
            '(-e --encrypt)'{-e,--encrypt}'[Encrypt the content before uploading (requires key setup)]' \\
            '--for[Encrypt for a specific friend (requires adding their key first)]:friend name:' \\
            '--list-friends[List available friends you can encrypt messages for]' \\
            '--key-file[Path to public key for encryption (alternative to stored keys)]:key file:_files' \\
            '--gen-key[Generate a new key pair for encryption if you dont have one]' \\
            '--interactive[Use interactive mode with guided prompts for message creation]' \\
            '--debug[Debug mode: show encrypted content without uploading]' \\
            '(-c --copy)'{-c,--copy}'[Copy the URL to clipboard automatically]' \\
            '--help[Show help message]'
          ;;
        (get)
          _arguments \\
            '1:url or ID:' \\
            '--key-file[Path to private key for decryption (if not using default key)]:key file:_files' \\
            '--help[Show help message]'
          ;;
        (completion)
          _arguments \\
            '--bash[Output Bash completion script]' \\
            '--zsh[Output Zsh completion script]' \\
            '--install[Print installation instructions instead of the script]' \\
            '--help[Show help message]'
          ;;
      esac
      ;;
  esac
}

_dedpaste "$@"`);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program.parse();