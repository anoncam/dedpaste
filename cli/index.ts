#!/usr/bin/env node

import { Command } from 'commander';
import fetch from 'node-fetch';
import { lookup } from 'mime-types';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { promises as fsPromises } from 'fs';
import { homedir, tmpdir } from 'os';
import inquirer from 'inquirer';
import { spawn, ChildProcess } from 'child_process';

// Type imports
import type { 
  KeyInfo, 
  KeyDatabase, 
  PasteOptions,
  InteractiveChoice,
  ApiResponse
} from '../src/types/index.js';

// Handle clipboard import with error handling
let clipboard: any;
try {
  clipboard = await import('clipboardy');
} catch (error: any) {
  console.error(`Failed to load clipboardy: ${error.message}`);
  // Fallback implementation if clipboard fails to load
  clipboard = {
    writeSync: (text: string) => {
      console.error('Clipboard access is not available. URL could not be copied.');
      console.log(`Manual copy: ${text}`);
    },
    default: {
      writeSync: (text: string) => {
        console.error('Clipboard access is not available. URL could not be copied.');
        console.log(`Manual copy: ${text}`);
      }
    }
  };
}

// Import analytics
import { analytics } from './analytics.js';

// Import our core modules
import {
  generateKeyPair,
  addFriendKey,
  listKeys,
  getKey,
  removeKey,
  updateLastUsed,
  addPgpKey,
  addKeybaseKey,
  loadKeyDatabase,
  saveKeyDatabase,
  ensureDirectories
} from './keyManager.js';

import {
  encryptContent,
  decryptContent
} from './encryptionUtils.js';

import {
  createPgpEncryptedMessage,
  importPgpPrivateKey
} from './pgpUtils.js';

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

const program = new Command();

// Type definitions for command options
interface KeysOptions {
  interactive?: boolean;
  enhanced?: boolean;
  list?: boolean;
  addFriend?: string;
  keyFile?: string;
  export?: boolean;
  remove?: string;
  genKey?: boolean;
  myKey?: boolean;
  diagnostics?: boolean;
  search?: string;
  details?: string;
  backup?: string;
  fromGpg?: string;
  gpgImport?: string;
  pgpKey?: string;
  pgpName?: string;
  importPgpKey?: string;
  pgpPassphrase?: string;
  nativePgp?: boolean;
  keybase?: string;
  keybaseName?: string;
  github?: string;
  githubName?: string;
  verify?: boolean;
  groupCreate?: string[];
  groupAdd?: string[];
  groupRemove?: string[];
  groupDelete?: string;
  groupList?: boolean;
  verbose?: boolean;
  debug?: boolean;
  logLevel?: string;
  logFile?: string | boolean;
}

interface SendOptions {
  temp?: boolean;
  type?: string;
  file?: string;
  output?: boolean;
  encrypt?: boolean;
  for?: string[];  // Changed to string[] to support multiple recipients
  listFriends?: boolean;
  keyFile?: string;
  genKey?: boolean;
  interactive?: boolean;
  enhanced?: boolean;
  debug?: boolean;
  copy?: boolean;
  pgp?: boolean;
  pgpKeyFile?: string;
  pgpArmor?: boolean;
  refreshGithubKeys?: boolean;
}

interface GetOptions {
  keyFile?: string;
  pgpKeyFile?: string;
  pgpPassphrase?: string;
  useGpgKeyring?: boolean;
  showMetadata?: boolean;
  interactive?: boolean;
}

interface CompletionOptions {
  bash?: boolean;
  zsh?: boolean;
  install?: boolean;
}

interface DefaultOptions {
  temp?: boolean;
  type?: string;
  file?: string;
  output?: boolean;
  encrypt?: boolean;
  copy?: boolean;
  interactive?: boolean;
  enhanced?: boolean;
  pgp?: boolean;
  pgpKeyFile?: string;
  for?: string;
}

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
  $ dedpaste keys:enhanced       Manage keys with enhanced interactive UI
  $ dedpaste send                Create and send an encrypted paste
  $ dedpaste get <url-or-id>     Retrieve and display a paste
  $ dedpaste completion          Generate shell completion scripts

EXAMPLES:
  $ echo "Hello, world!" | dedpaste
  $ dedpaste --file secret.txt --temp --encrypt
  $ dedpaste keys --gen-key
  $ dedpaste keys:enhanced       # Use the enhanced UI for key management
  $ dedpaste send --encrypt --for alice --temp
  $ dedpaste get https://paste.d3d.dev/AbCdEfGh
  $ dedpaste completion --bash > ~/.dedpaste-completion.bash
`);

// Add a special direct command for enhanced mode
program
  .command('keys:enhanced')
  .description('Manage encryption keys in enhanced interactive TUI mode')
  .action(async () => {
    try {
      // Track command execution
      analytics.trackCommand('keys:enhanced');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      const enhancedLauncherPath = path.join(__dirname, 'enhancedModeLauncher.js');

      console.log('Starting enhanced mode...');
      
      // Spawn the launcher as a separate process
      const enhancedProcess: ChildProcess = spawn('node', [enhancedLauncherPath], {
        stdio: 'inherit',
        env: process.env
      });
      
      // Handle process events
      process.on('SIGINT', () => {
        console.log('\nTerminating enhanced mode...');
        enhancedProcess.kill('SIGTERM');
        // Allow clean exit
        setTimeout(() => process.exit(0), 300);
      });
      
      // Wait for the process to complete with a timeout
      await new Promise<void>((resolve, reject) => {
        // Set a timeout to prevent hanging
        const timeout = setTimeout(() => {
          console.log('\nEnhanced mode is taking too long. Terminating...');
          enhancedProcess.kill('SIGTERM');
          reject(new Error('Enhanced mode timed out'));
        }, 60000); // 60 second timeout
        
        enhancedProcess.on('exit', (code) => {
          clearTimeout(timeout);
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Enhanced mode exited with code ${code}`));
          }
        });
        
        enhancedProcess.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    } catch (error: any) {
      console.error(`Error running enhanced mode: ${error.message}`);
      process.exit(1);
    }
  });

// Add a command to manage keys
program
  .command('keys')
  .description('Manage encryption keys for secure communication')
  .option('--interactive', 'Use interactive menu-driven mode for key management')
  .option('--enhanced', 'Use enhanced interactive TUI mode with color and advanced features')
  .option('--list', 'List all your keys and friends\' keys with fingerprints')
  .option('--add-friend <name>', 'Add a friend\'s public key (requires --key-file)')
  .option('--key-file <path>', 'Path to key file for import/export operations')
  .option('--export', 'Export your public key to share with friends')
  .option('--remove <name>', 'Remove a friend\'s key from your keyring')
  .option('--gen-key', 'Generate a new RSA key pair for encryption')
  .option('--my-key', 'Output your public key to the console for sharing')
  .option('--diagnostics', 'Run diagnostics on your key configuration and show a report')
  .option('--search <query>', 'Search for keys by name, email, or fingerprint')
  .option('--details <id>', 'Show detailed information about a specific key')
  .option('--backup <dir>', 'Backup all keys to the specified directory')
  // PGP options
  .option('--pgp-key <email-or-id>', 'Fetch and add a PGP key from a keyserver')
  .option('--pgp-name <name>', 'Custom name for the PGP key (optional)')
  .option('--import-pgp-key <path>', 'Import a PGP private key for encryption/decryption')
  .option('--pgp-passphrase <phrase>', 'Passphrase for PGP private key')
  .option('--native-pgp', 'Use native PGP encryption instead of converting to PEM')
  .option('--from-gpg <key-id>', 'Import a key from your GPG keyring')
  .option('--gpg-import <path>', 'Import a key to your GPG keyring')
  // Keybase options
  .option('--keybase <username>', 'Fetch and add a Keybase user\'s PGP key')
  .option('--keybase-name <name>', 'Custom name for the Keybase user\'s key (optional)')
  .option('--no-verify', 'Skip verification of Keybase proofs')
  // GitHub options
  .option('--github <username>', 'Fetch and add a GitHub user\'s GPG public key')
  .option('--github-name <name>', 'Custom name for the GitHub user\'s key (optional)')
  .option('--refresh-github-keys', 'Force refresh of cached GitHub keys (re-fetch from GitHub)')
  // Group management options
  .option('--group-create <name> <members...>', 'Create a new recipient group with members')
  .option('--group-add <name> <members...>', 'Add members to an existing group')
  .option('--group-remove <name> <members...>', 'Remove members from a group')
  .option('--group-delete <name>', 'Delete a group entirely')
  .option('--group-list', 'List all groups and their members')
  // Debugging and logging options
  .option('--verbose', 'Enable verbose logging (same as --log-level debug)')
  .option('--debug', 'Enable debug mode with extensive logging (same as --log-level trace)')
  .option('--log-level <level>', 'Set logging level (error, warn, info, debug, trace)')
  .option('--log-file <path>', 'Log to the specified file')
  .option('--no-log-file', 'Disable logging to file')
  .addHelpText('after', `
Examples:
  $ dedpaste keys --gen-key                               # Generate a new key pair
  $ dedpaste keys --list                                  # List all your keys
  $ dedpaste keys --add-friend alice --key-file alice_public.pem  # Add a friend's key
  $ dedpaste keys --my-key                                # Display your public key
  $ dedpaste keys --interactive                           # Use interactive mode
  $ dedpaste keys:enhanced                               # Use enhanced UI (recommended)
  
PGP Integration:
  $ dedpaste keys --pgp-key user@example.com              # Add a PGP key from keyservers
  $ dedpaste keys --pgp-key 0x1234ABCD                    # Add a PGP key using key ID
  $ dedpaste keys --pgp-key user@example.com --pgp-name alice  # Add with custom name
  
Keybase Integration:
  $ dedpaste keys --keybase username                      # Add a Keybase user's key
  $ dedpaste keys --keybase username --keybase-name bob   # Add with custom name
  $ dedpaste keys --keybase username --no-verify          # Skip verification of proofs

GitHub Integration:
  $ dedpaste keys --github username                       # Add a GitHub user's GPG key
  $ dedpaste keys --github username --github-name bob     # Add with custom name

Group Management (NEW):
  $ dedpaste keys --group-create team gh:alice kb:bob     # Create a group named 'team'
  $ dedpaste keys --group-add team gh:charlie             # Add member to group
  $ dedpaste keys --group-remove team gh:bob              # Remove member from group
  $ dedpaste keys --group-list                            # List all groups
  $ dedpaste keys --group-delete team                     # Delete a group

Key Storage:
  - Your keys are stored in ~/.dedpaste/keys/
  - Friend keys are stored in ~/.dedpaste/friends/
  - PGP keys are stored in ~/.dedpaste/pgp/
  - Keybase keys are stored in ~/.dedpaste/keybase/
  - GitHub keys are stored in ~/.dedpaste/github/
  - Key database is at ~/.dedpaste/keydb.json
`)
  .action(async (options: KeysOptions) => {
    try {
      // Track command execution
      const flags = Object.keys(options).filter(k => (options as any)[k] !== undefined);
      analytics.trackCommand('keys', undefined, flags);

      // Initialize logger based on options
      let logLevel = 'info';
      if (options.verbose) logLevel = 'debug';
      if (options.debug) logLevel = 'trace';
      if (options.logLevel) logLevel = options.logLevel;

      const logOptions = {
        level: logLevel,
        logToFile: options.logFile !== false,
        logFile: typeof options.logFile === 'string' ? options.logFile : 'dedpaste.log'
      };

      // Import and initialize logger
      const { initialize: initLogger } = await import('./logger.js');
      const logger = await initLogger(logOptions);

      // Log the start of execution
      logger.info('Starting key management operation', { options });
      
      // Enhanced interactive mode takes precedence
      if (options.enhanced) {
        logger.debug('Enhanced mode requested - using non-blocking startup', { options });
        console.log('Starting enhanced mode...');
        console.log('Debug info: enhanced flag =', options.enhanced);
        
        try {
          // Get the current module directory where our launcher is located
          const cliDir = path.dirname(fileURLToPath(import.meta.url));
          const launcherPath = path.join(cliDir, 'enhancedModeLauncher.js');
          
          // Verify that the launcher exists
          if (!fs.existsSync(launcherPath)) {
            logger.error('Enhanced mode launcher not found', { path: launcherPath });
            throw new Error(`Enhanced mode launcher not found at: ${launcherPath}`);
          }
          
          // Spawn the launcher as a separate process with the right working directory
          const enhancedProcess = spawn('node', [launcherPath, '--debug'], {
            stdio: 'inherit',
            env: process.env,
            cwd: cliDir // Use CLI directory as working directory
          });
          
          // Process termination handling
          process.on('SIGINT', () => {
            console.log('\nTerminating enhanced mode...');
            enhancedProcess.kill('SIGTERM');
            // Allow clean exit
            setTimeout(() => process.exit(0), 300);
          });
          
          // Wait for the process to complete with a timeout
          await new Promise<void>((resolve, reject) => {
            // Set a timeout to prevent hanging
            const timeout = setTimeout(() => {
              console.log('\nEnhanced mode is taking too long. Terminating...');
              enhancedProcess.kill('SIGTERM');
              reject(new Error('Enhanced mode timed out'));
            }, 30000); // 30 second timeout
            
            enhancedProcess.on('exit', (code) => {
              clearTimeout(timeout);
              if (code === 0) {
                resolve();
              } else {
                reject(new Error(`Enhanced mode exited with code ${code}`));
              }
            });
            
            enhancedProcess.on('error', (err) => {
              clearTimeout(timeout);
              reject(err);
            });
          });
          
        } catch (enhancedError: any) {
          logger.error('Enhanced mode failed', { error: enhancedError.message, stack: enhancedError.stack });
          console.error(`Error running enhanced mode: ${enhancedError.message}`);
          console.error('Stack trace:', enhancedError.stack);
          console.log('Falling back to standard interactive mode...');
          
          // Fall back to regular interactive mode
          const result = await interactiveKeyManagement();
          if (result.message) {
            console.log(result.message);
          }
        }
        
        return;
      }
      
      // Regular interactive mode
      if (options.interactive) {
        logger.debug('Entering interactive mode');
        const result = await interactiveKeyManagement();
        if (result.message) {
          console.log(result.message);
        }
        return;
      }
      
      // Run diagnostics
      if (options.diagnostics) {
        logger.debug('Running key diagnostics');
        const { runKeyDiagnostics, formatDiagnosticsReport } = await import('./keyDiagnostics.js');
        
        console.log('Running key system diagnostics... Please wait...');
        const results = await runKeyDiagnostics();
        const report = formatDiagnosticsReport(results);
        
        console.log(report);
        
        if (results.status !== 'ok') {
          logger.warn('Diagnostics found issues', { 
            errors: results.errors.length, 
            warnings: results.warnings.length 
          });
          
          // Suggest fixing issues
          console.log('\nTo fix issues automatically, use:');
          console.log('dedpaste keys --enhanced');
          console.log('Then select "Run diagnostics" and follow the prompts.');
        }
        
        return;
      }
      
      // Search for keys
      if (options.search) {
        logger.debug('Searching for keys', { query: options.search });
        
        const { searchKeys } = await import('./unifiedKeyManager.js');
        const keys = await searchKeys(options.search, { includeGpg: true });
        
        if (keys.length === 0) {
          console.log(`No keys found matching "${options.search}"`);
          return;
        }
        
        console.log(`\nFound ${keys.length} keys matching "${options.search}":\n`);
        
        for (const key of keys) {
          console.log(`- ${key.name} (${key.type.toUpperCase()})`);
          
          if (key.email) {
            console.log(`  Email: ${key.email}`);
          }
          
          if (key.username) {
            console.log(`  Username: ${key.username}`);
          }
          
          console.log(`  Fingerprint: ${key.fingerprint}`);
          console.log(`  Source: ${key.source}`);
          
          if (key.created) {
            console.log(`  Created: ${new Date(key.created).toLocaleString()}`);
          }
          
          console.log('');
        }
        
        return;
      }
      
      // Show detailed key information
      if (options.details) {
        logger.debug('Showing key details', { keyId: options.details });
        
        const { getKeyById, readKeyContent } = await import('./unifiedKeyManager.js');
        const keyInfo = await getKeyById(options.details, { includeGpg: true });
        
        if (!keyInfo) {
          console.error(`Key "${options.details}" not found`);
          process.exit(1);
        }
        
        console.log(`\nKey details for "${keyInfo.name}":\n`);
        console.log(`- ID: ${keyInfo.id}`);
        console.log(`- Name: ${keyInfo.name}`);
        console.log(`- Type: ${keyInfo.type.toUpperCase()}`);
        console.log(`- Source: ${keyInfo.source}`);
        console.log(`- Fingerprint: ${keyInfo.fingerprint}`);
        
        if (keyInfo.email) {
          console.log(`- Email: ${keyInfo.email}`);
        }
        
        if (keyInfo.username) {
          console.log(`- Username: ${keyInfo.username}`);
        }
        
        if (keyInfo.created) {
          console.log(`- Created: ${new Date(keyInfo.created).toLocaleString()}`);
        }
        
        if (keyInfo.lastUsed) {
          console.log(`- Last Used: ${new Date(keyInfo.lastUsed).toLocaleString()}`);
        }
        
        if (keyInfo.path) {
          if (typeof keyInfo.path === 'object') {
            console.log(`- Public Key Path: ${keyInfo.path.public}`);
            console.log(`- Private Key Path: ${keyInfo.path.private}`);
          } else {
            console.log(`- Key Path: ${keyInfo.path}`);
          }
        }
        
        // Ask if user wants to see key content
        if (keyInfo.source === 'self' || keyInfo.source === 'friend' || 
            keyInfo.source === 'pgp' || keyInfo.source === 'keybase') {
          
          const { showContent } = await inquirer.prompt([{
            type: 'confirm',
            name: 'showContent',
            message: 'Show key content?',
            default: false
          }]);
          
          if (showContent) {
            // For self keys, ask if they want to see private key
            let showPrivate = false;
            if (keyInfo.source === 'self') {
              const { viewPrivate } = await inquirer.prompt([{
                type: 'confirm',
                name: 'viewPrivate',
                message: 'Show private key? (This is sensitive information)',
                default: false
              }]);
              
              showPrivate = viewPrivate;
            }
            
            // Read the key content
            const keyContent = await readKeyContent(keyInfo, { private: showPrivate });
            
            if (keyContent) {
              console.log('\n--- Key Content ---\n');
              console.log(keyContent);
              console.log('\n-------------------\n');
            } else {
              console.error('Could not read key content');
            }
          }
        }
        
        return;
      }
      
      // Backup keys
      if (options.backup) {
        logger.debug('Backing up keys', { directory: options.backup });
        
        const backupDir = options.backup;
        
        // Create backup directory if it doesn't exist
        await fsPromises.mkdir(backupDir, { recursive: true });
        
        // Get timestamp for backup files
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        // Get all keys
        const db = await loadKeyDatabase();
        let backupCount = 0;
        
        // Backup self key if it exists
        if (db.keys.self) {
          const privateKeyDest = path.join(backupDir, `self-private-${timestamp}.pem`);
          const publicKeyDest = path.join(backupDir, `self-public-${timestamp}.pem`);
          
          await fsPromises.copyFile(db.keys.self.private!, privateKeyDest);
          await fsPromises.copyFile(db.keys.self.public!, publicKeyDest);
          
          backupCount += 2;
          console.log(`Backed up self key to ${privateKeyDest} and ${publicKeyDest}`);
        }
        
        // Backup friend keys
        for (const [name, info] of Object.entries(db.keys.friends)) {
          const friendKeyDest = path.join(backupDir, `friend-${name}-${timestamp}.pem`);
          await fsPromises.copyFile(info.public!, friendKeyDest);
          backupCount++;
          console.log(`Backed up friend key "${name}" to ${friendKeyDest}`);
        }
        
        // Backup PGP keys
        for (const [name, info] of Object.entries(db.keys.pgp || {})) {
          const pgpKeyDest = path.join(backupDir, `pgp-${name}-${timestamp}.asc`);
          const pgpPath = typeof info.path === 'string' ? info.path : info.path.public;
          await fsPromises.copyFile(pgpPath, pgpKeyDest);
          backupCount++;
          console.log(`Backed up PGP key "${name}" to ${pgpKeyDest}`);
        }
        
        // Backup Keybase keys
        for (const [name, info] of Object.entries(db.keys.keybase || {})) {
          const keybaseKeyDest = path.join(backupDir, `keybase-${name}-${timestamp}.asc`);
          const keybasePath = typeof info.path === 'string' ? info.path : info.path.public;
          await fsPromises.copyFile(keybasePath, keybaseKeyDest);
          backupCount++;
          console.log(`Backed up Keybase key "${name}" to ${keybaseKeyDest}`);
        }
        
        // Backup key database
        const dbDest = path.join(backupDir, `keydb-${timestamp}.json`);
        await fsPromises.copyFile(path.join(homedir(), '.dedpaste', 'keydb.json'), dbDest);
        console.log(`Backed up key database to ${dbDest}`);
        
        console.log(`\nBackup complete: ${backupCount} keys backed up to ${backupDir}`);
        return;
      }
      
      // Import a key from GPG keyring
      if (options.fromGpg) {
        logger.debug('Importing key from GPG keyring', { keyId: options.fromGpg });
        
        const { importKey } = await import('./unifiedKeyManager.js');
        
        const name = options.pgpName || options.fromGpg;
        console.log(`Importing key ${options.fromGpg} from GPG keyring...`);
        
        const result = await importKey({
          source: 'gpg-keyring',
          keyId: options.fromGpg,
          name: name
        });
        
        if (result.success) {
          console.log(`\n✓ Imported key from GPG keyring: ${result.name}`);
          console.log(`  - Type: ${result.type}`);
          console.log(`  - Fingerprint: ${result.fingerprint}`);
          if (result.email) console.log(`  - Email: ${result.email}`);
          console.log(`  - Stored at: ${result.path}`);
        } else {
          console.error(`Error importing key from GPG keyring: ${result.error}`);
          process.exit(1);
        }
        
        return;
      }
      
      // Import a key to GPG keyring
      if (options.gpgImport) {
        logger.debug('Importing key to GPG keyring', { file: options.gpgImport });
        
        const { importKey } = await import('./unifiedKeyManager.js');
        
        console.log(`Importing key from ${options.gpgImport} to GPG keyring...`);
        
        const result = await importKey({
          source: 'gpg-import',
          file: options.gpgImport
        });
        
        if (result.success) {
          console.log(`\n✓ Key imported to GPG keyring successfully`);
          console.log(`  - Key ID: ${result.keyId}`);
          console.log('\nOutput from GPG:');
          console.log(result.output);
        } else {
          console.error(`Error importing key to GPG keyring: ${result.error}`);
          process.exit(1);
        }
        
        return;
      }
      
      // List keys
      if (options.list) {
        logger.debug('Listing all keys');
        await interactiveListKeys();
        return;
      }
      
      // Add a friend's key
      if (options.addFriend) {
        if (!options.keyFile) {
          console.error('Error: --key-file is required when adding a friend');
          process.exit(1);
        }
        
        logger.debug('Adding friend key', { name: options.addFriend, file: options.keyFile });
        
        try {
          const keyContent = await fsPromises.readFile(options.keyFile, 'utf8');
          const keyPath = await addFriendKey(options.addFriend, keyContent);
          console.log(`Added ${options.addFriend}'s public key at ${keyPath}`);
        } catch (error: any) {
          logger.error('Failed to add friend key', { error: error.message });
          console.error(`Error adding friend's key: ${error.message}`);
          process.exit(1);
        }
        return;
      }
      
      // Export public key
      if (options.export) {
        logger.debug('Exporting public key');
        const result = await interactiveExportKey();
        if (result.message) {
          console.log(result.message);
        }
        return;
      }
      
      // Remove a key
      if (options.remove) {
        logger.debug('Removing key', { name: options.remove });
        
        try {
          // Try to remove from any collection
          const success = await removeKey('any', options.remove);
          if (success) {
            console.log(`Removed ${options.remove}'s key successfully`);
          } else {
            console.error(`Key "${options.remove}" not found`);
            process.exit(1);
          }
        } catch (error: any) {
          logger.error('Failed to remove key', { error: error.message });
          console.error(`Error removing key: ${error.message}`);
          process.exit(1);
        }
        return;
      }
      
      // Fetch and add a PGP key from keyservers
      if (options.pgpKey) {
        logger.debug('Fetching PGP key', { identifier: options.pgpKey });
        
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
        } catch (error: any) {
          logger.error('Failed to fetch PGP key', { error: error.message });
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
        
        logger.debug('Importing PGP private key', { file: options.importPgpKey });
        
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
          db.keys.pgp = db.keys.pgp || {};
          (db.keys.pgp as any).self = {
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
        } catch (error: any) {
          logger.error('Failed to import PGP private key', { error: error.message });
          console.error(`Error importing PGP private key: ${error.message}`);
          process.exit(1);
        }
        return;
      }
      
      // Fetch and add a Keybase user's key
      if (options.keybase) {
        logger.debug('Fetching Keybase key', { username: options.keybase });

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
        } catch (error: any) {
          logger.error('Failed to fetch Keybase key', { error: error.message });
          console.error(`Error fetching Keybase key: ${error.message}`);
          process.exit(1);
        }
        return;
      }

      // Fetch and add a GitHub user's key
      if (options.github) {
        logger.debug('Fetching GitHub key', { username: options.github });

        try {
          const { addGitHubKey } = await import('./githubUtils.js');

          console.log(`Fetching GPG key for GitHub user "${options.github}"...`);

          if (options.verify) {
            console.log('Verifying GitHub user...');
          }

          const customName = options.githubName;
          const result = await addGitHubKey(options.github, customName, options.verify);

          console.log(`
✓ Added GitHub key:
  - Name: ${result.name}
  - GitHub username: ${options.github}
  - Email: ${result.email || 'Not specified'}
  - Fingerprint: ${result.fingerprint}
`);
          process.exit(0);
        } catch (error: any) {
          logger.error('Failed to fetch GitHub key', { error: error.message });
          console.error(`Error fetching GitHub key: ${error.message}`);
          process.exit(1);
        }
        return;
      }

      // Group management commands
      if (options.groupCreate) {
        const [groupName, ...members] = options.groupCreate;
        if (!groupName || members.length === 0) {
          console.error('Error: Group name and at least one member required');
          console.error('Usage: dedpaste keys --group-create <name> <member1> <member2> ...');
          process.exit(1);
        }

        try {
          const { createGroup } = await import('./groupManager.js');
          await createGroup(groupName, members);
          console.log(`\n✓ Created group "${groupName}" with ${members.length} member(s):`);
          for (const member of members) {
            console.log(`  - ${member}`);
          }
        } catch (error: any) {
          console.error(`Error creating group: ${error.message}`);
          process.exit(1);
        }
        return;
      }

      if (options.groupAdd) {
        const [groupName, ...members] = options.groupAdd;
        if (!groupName || members.length === 0) {
          console.error('Error: Group name and at least one member required');
          console.error('Usage: dedpaste keys --group-add <name> <member1> <member2> ...');
          process.exit(1);
        }

        try {
          const { addToGroup } = await import('./groupManager.js');
          await addToGroup(groupName, members);
          console.log(`\n✓ Added ${members.length} member(s) to group "${groupName}":`);
          for (const member of members) {
            console.log(`  - ${member}`);
          }
        } catch (error: any) {
          console.error(`Error adding to group: ${error.message}`);
          process.exit(1);
        }
        return;
      }

      if (options.groupRemove) {
        const [groupName, ...members] = options.groupRemove;
        if (!groupName || members.length === 0) {
          console.error('Error: Group name and at least one member required');
          console.error('Usage: dedpaste keys --group-remove <name> <member1> <member2> ...');
          process.exit(1);
        }

        try {
          const { removeFromGroup } = await import('./groupManager.js');
          await removeFromGroup(groupName, members);
          console.log(`\n✓ Removed ${members.length} member(s) from group "${groupName}":`);
          for (const member of members) {
            console.log(`  - ${member}`);
          }
        } catch (error: any) {
          console.error(`Error removing from group: ${error.message}`);
          process.exit(1);
        }
        return;
      }

      if (options.groupDelete) {
        try {
          const { deleteGroup } = await import('./groupManager.js');
          await deleteGroup(options.groupDelete);
          console.log(`\n✓ Deleted group "${options.groupDelete}"`);
        } catch (error: any) {
          console.error(`Error deleting group: ${error.message}`);
          process.exit(1);
        }
        return;
      }

      if (options.groupList) {
        try {
          const { listGroups } = await import('./groupManager.js');
          const groups = await listGroups();

          if (Object.keys(groups).length === 0) {
            console.log('\nNo groups found. Create one with:');
            console.log('  dedpaste keys --group-create <name> <member1> <member2> ...');
            return;
          }

          console.log('\n📋 Recipient Groups:\n');
          for (const [name, members] of Object.entries(groups)) {
            console.log(`  ${name} (${members.length} member${members.length !== 1 ? 's' : ''}):`);
            for (const member of members) {
              console.log(`    - ${member}`);
            }
            console.log('');
          }
        } catch (error: any) {
          console.error(`Error listing groups: ${error.message}`);
          process.exit(1);
        }
        return;
      }

      // Generate a new key pair
      if (options.genKey) {
        logger.debug('Generating new key pair');

        const { privateKeyPath, publicKeyPath } = await generateKeyPair();
        console.log(`
✓ Generated new key pair:
  - Private key: ${privateKeyPath}
  - Public key: ${publicKeyPath}
`);
        // Track key generation
        analytics.trackKeyOperation('generated', { key_type: 'RSA' });
        return;
      }
      
      // Output public key to console
      if (options.myKey) {
        logger.debug('Showing self public key');
        
        const selfKey = await getKey('self');
        if (!selfKey) {
          console.error('No personal key found. Generate one with --gen-key first.');
          process.exit(1);
        }
        
        try {
          const publicKeyContent = await fsPromises.readFile(selfKey.public!, 'utf8');
          console.log('\nYour public key:');
          console.log('----------------');
          console.log(publicKeyContent);
          console.log('----------------');
          console.log('\nShare this key with your friends so they can send you encrypted pastes.');
        } catch (error: any) {
          logger.error('Failed to read public key', { error: error.message });
          console.error(`Error reading public key: ${error.message}`);
          process.exit(1);
        }
        return;
      }
      
      // If no specific action is provided, show help
      program.commands.find(cmd => cmd.name() === 'keys')?.help();
    } catch (error: any) {
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
  .option('--for <recipients...>', 'Encrypt for recipient(s): supports gh:user, kb:user, email@domain, or group names')
  .option('--list-friends', 'List available friends you can encrypt messages for')
  .option('--key-file <path>', 'Path to public key for encryption (alternative to stored keys)')
  .option('--gen-key', 'Generate a new key pair for encryption if you don\'t have one')
  .option('--interactive', 'Use interactive mode with guided prompts for message creation')
  .option('--enhanced', 'Use enhanced interactive mode with advanced key selection features')
  .option('--debug', 'Debug mode: show encrypted content without uploading')
  .option('-c, --copy', 'Copy the URL to clipboard automatically')
  // PGP options
  .option('--pgp', 'Use PGP encryption instead of hybrid RSA/AES')
  .option('--pgp-key-file <path>', 'Use a specific PGP public key file for encryption')
  .option('--pgp-armor', 'Output ASCII-armored PGP instead of binary format')
  .option('--refresh-github-keys', 'Force refresh of cached GitHub keys when encrypting')
  .addHelpText('after', `
Examples:
  $ echo "Secret message" | dedpaste send --encrypt                # Encrypt for yourself (RSA/AES)
  $ echo "For Alice only" | dedpaste send --encrypt --for alice    # Encrypt for a friend
  $ dedpaste send --file secret.txt --encrypt --temp               # Encrypt a file as one-time paste
  $ dedpaste send --interactive --encrypt                          # Interactive encrypted message
  $ dedpaste send --enhanced --encrypt                             # Enhanced interactive mode with full key support
  $ dedpaste send --list-friends                                   # List available recipients

Short Prefix Support (NEW):
  $ dedpaste send --encrypt --for gh:torvalds                      # GitHub user (short prefix)
  $ dedpaste send --encrypt --for kb:username                      # Keybase user (short prefix)
  $ dedpaste send --encrypt --for github:torvalds                  # GitHub user (full prefix - still works)

Multiple Recipients (NEW):
  $ dedpaste send --encrypt --for gh:alice kb:bob charlie@example.com  # Multiple recipients (space-separated)

Groups (NEW):
  $ dedpaste keys --group-create team gh:alice kb:bob              # Create a group
  $ dedpaste send --encrypt --for team                             # Encrypt for all group members

PGP Options:
  $ dedpaste send --encrypt --for alice@example.com                # Encrypt for PGP key (auto-detects PGP)
  $ dedpaste send --encrypt --for alice --pgp --pgp-key-file friend.asc  # Use specific PGP key file
  $ dedpaste send --enhanced --encrypt --pgp                       # Use enhanced mode with GPG keyring support

NOTE: PGP encryption is now auto-detected based on recipient type. The --pgp flag is optional.

Encryption:
  - Standard encryption uses RSA for key exchange and AES-256-GCM for content
  - PGP encryption (--pgp) uses OpenPGP standard compatible with GnuPG/GPG
  - Each paste uses a different key for forward secrecy
  - Encrypted pastes include metadata about sender and recipient
  - Use --debug to test encryption without uploading
`)
  .action(async (options: SendOptions) => {
    // Ensure temp flag is properly set by checking command line arguments
    if (!options.temp && (process.argv.includes('--temp') || process.argv.includes('-t'))) {
      options.temp = true;
    }
    
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
          const lastUsed = friend.lastUsed ? new Date(friend.lastUsed).toLocaleString() : 'Never';
          console.log(`  - ${name} (last used: ${lastUsed})`);
        }
        return;
      }
      
      let content: Buffer;
      let contentType: string;
      let recipientName: string | string[] | null | undefined = options.for;

      // Interactive mode
      if (options.interactive) {
        // Check if we should use the enhanced interactive mode
        if (options.enhanced) {
          console.log('Using enhanced interactive mode for sending...');
          const { enhancedInteractiveSend } = await import('./enhancedInteractiveMode.js');
          const result = await enhancedInteractiveSend();

          if (!result.success) {
            console.error(`Error: ${result.message}`);
            process.exit(1);
          }

          content = Buffer.from(result.content || '');
          // Interactive mode returns a single string, wrap in array if provided
          recipientName = result.recipient ? [result.recipient] : undefined;
          options.temp = result.temp;
          options.pgp = result.pgp; // Use PGP flag from enhanced mode
          contentType = 'text/plain';
        } else {
          // Use standard interactive mode
          const result = await interactiveSend();
          content = Buffer.from(result.content || '');
          // Interactive mode returns a single string, wrap in array if provided
          recipientName = result.recipient ? [result.recipient] : undefined;
          options.temp = result.temp;
          contentType = 'text/plain';
        }
      } else {
        // Fix for file option parsing - ensure it's correctly recognized
        if (!options.file && (process.argv.includes('--file') || process.argv.includes('-f'))) {
          // If Commander didn't parse it correctly, get the file path manually
          const fileArgIndex = Math.max(
            process.argv.indexOf('--file'), 
            process.argv.indexOf('-f')
          );
          
          if (fileArgIndex !== -1 && fileArgIndex < process.argv.length - 1) {
            options.file = process.argv[fileArgIndex + 1];
          }
        }
        
        // Additional PGP flag check for send command
        if (process.argv.includes('--pgp') && !options.pgp) {
          options.pgp = true;
        }
        
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
          const stdinBuffer: Buffer[] = [];
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
          
          // For PGP encryption, always require a recipient
          if (usePgp && !recipientName) {
            console.error(`Error: PGP encryption requires specifying a recipient with --for`);
            console.error(`Please use: dedpaste send --encrypt --pgp --for <recipient_name>`);
            process.exit(1);
          }
          
          // If PGP key file is provided, read it and use it directly
          if (options.pgpKeyFile) {
            if (!recipientName || (Array.isArray(recipientName) && recipientName.length === 0)) {
              console.error(`Error: When using --pgp-key-file, you must specify a recipient with --for`);
              process.exit(1);
            }
            // For pgpKeyFile, use the first recipient
            const firstRecipient = Array.isArray(recipientName) ? recipientName[0] : recipientName;
            const pgpKeyContent = await fsPromises.readFile(options.pgpKeyFile, 'utf8');
            const pgpResult = await createPgpEncryptedMessage(content, pgpKeyContent, firstRecipient);
            content = typeof pgpResult === 'string' ? Buffer.from(pgpResult) : pgpResult;
          } else {
            // Use the standard encryption flow with PGP option
            const encryptResult = await encryptContent(
              content.toString('utf8'),
              recipientName ?? null,
              usePgp,
              options.refreshGithubKeys
            );
            content = typeof encryptResult === 'string' ? Buffer.from(encryptResult) : encryptResult;
          }
          
          // Log PGP mode if used
          if (usePgp || options.pgpKeyFile) {
            console.log('Using PGP encryption');
          }
          
          // Set content type to application/json for encrypted content
          contentType = 'application/json';
        } catch (error: any) {
          console.error(`Encryption failed: ${error.message}`);
          
          // Provide helpful suggestions for common errors
          if (error.message.includes('PGP key detected') && !options.pgp) {
            console.log('\nSuggestion: This key appears to be a PGP key. Try adding the --pgp flag:');
            console.log(`dedpaste send --encrypt --for ${recipientName} --pgp`);
          } else if (error.message.includes('requires specifying a recipient')) {
            console.log('\nFor PGP encryption, always specify a recipient:');
            console.log(`dedpaste send --encrypt --pgp --for <recipient_name>`);
          }
          
          process.exit(1);
        }
      } else {
        console.log('No encryption requested');
      }
      
      // Determine the endpoint based on whether it's a temporary paste and encrypted
      let endpoint: string;
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
        // Extract filename if uploading a file
        const filename = options.file ? path.basename(options.file) : '';

        const headers: Record<string, string> = {
          'Content-Type': contentType,
          'User-Agent': `dedpaste-cli/${packageJson.version}`
        };

        // Include filename header if we have a file
        if (filename) {
          headers['X-Filename'] = filename;
        }

        const response = await fetch(`${API_URL}${endpoint}`, {
          method: 'POST',
          headers,
          body: content
        });
        
        if (!response.ok) {
          console.error(`Error: ${response.status} ${response.statusText}`);
          const errorText = await response.text();
          console.error(errorText);
          process.exit(1);
        }
        
        const url = await response.text();

        // Track paste creation
        analytics.trackPasteCreated({
          type: options.temp ? 'one_time' : 'regular',
          content_type: contentType,
          size_bytes: content.length,
          encryption_type: options.encrypt ? 'RSA' : 'none',
          method: options.file ? 'file' : 'stdin'
        });

        // Copy to clipboard if requested
        if (options.copy) {
          try {
            const cleanUrl = url.trim();
            if (clipboard.default) {
              clipboard.default.writeSync(cleanUrl);
            } else {
              clipboard.writeSync(cleanUrl);
            }
          } catch (error: any) {
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

        // Exit successfully
        process.exit(0);
      } catch (error: any) {
        console.error(`Network error: ${error.message}`);
        console.error('If you just want to test encryption without uploading, use the --debug flag');
        process.exit(1);
      }
    } catch (error: any) {
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
  .option('--use-gpg-keyring', 'Try to decrypt PGP messages using the system GPG keyring', true)
  .option('--no-gpg-keyring', 'Disable automatic GPG keyring decryption')
  .option('--show-metadata', 'Show detailed metadata about the encrypted message')
  .option('--interactive', 'Use interactive mode for decryption (will prompt for passphrase)')
  .addHelpText('after', `
Examples:
  $ dedpaste get https://paste.d3d.dev/AbCdEfGh        # Get a regular paste by URL
  $ dedpaste get AbCdEfGh                              # Get a regular paste by ID
  $ dedpaste get https://paste.d3d.dev/e/AbCdEfGh      # Get and decrypt an encrypted paste
  $ dedpaste get e/AbCdEfGh                            # Get and decrypt an encrypted paste by ID
  $ dedpaste get e/AbCdEfGh --interactive              # Use interactive mode with password prompt
  $ dedpaste get e/AbCdEfGh --show-metadata            # Show detailed metadata about the paste
  
PGP Decryption:
  $ dedpaste get e/AbCdEfGh --pgp-key-file my.pgp      # Decrypt with PGP private key
  $ dedpaste get e/AbCdEfGh --pgp-key-file my.pgp --pgp-passphrase "secret"
  $ dedpaste get e/AbCdEfGh                            # Automatically try GPG keyring for PGP content
  $ dedpaste get e/AbCdEfGh --no-gpg-keyring           # Disable automatic GPG keyring usage
  $ dedpaste get e/AbCdEfGh --interactive              # Interactive mode with passphrase prompt
  
URL Format:
  - Regular pastes: https://paste.d3d.dev/{id}
  - Encrypted pastes: https://paste.d3d.dev/e/{id}
  - The CLI automatically detects encrypted pastes and attempts decryption
  
Decryption:
  - Encrypted pastes are automatically decrypted if you have the correct private key
  - PGP encrypted pastes will first try the system GPG keyring (if available)
  - If GPG keyring fails, a PGP private key and passphrase will be required
  - Metadata about sender and creation time is displayed when available
  - One-time pastes are deleted from the server after viewing
  
GPG Keyring Integration:
  - By default, dedpaste will attempt to use your GPG keyring for PGP-encrypted pastes
  - This allows decryption without explicitly providing a private key file
  - Your system's gpg command is used to perform the decryption
  - To disable this feature, use the --no-gpg-keyring flag
`)
  .action(async (urlOrId: string, options: GetOptions) => {
    try {
      // Extract ID and check if it's an encrypted paste
      let id = urlOrId;
      let isEncrypted = false;
      
      // Parse the URL or ID
      if (urlOrId.startsWith('http')) {
        // It's a URL
        const url = new URL(urlOrId);
        const path = url.pathname;

        // Check if it's an encrypted paste (with optional filename)
        const encryptedMatch = path.match(/^\/e\/([a-zA-Z0-9]{8})(?:\/(.+))?$/);
        if (encryptedMatch) {
          id = encryptedMatch[1];
          isEncrypted = true;
        } else {
          // Check if it's a regular paste (with optional filename)
          const regularMatch = path.match(/^\/([a-zA-Z0-9]{8})(?:\/(.+))?$/);
          if (regularMatch) {
            id = regularMatch[1];
          } else {
            console.error('Invalid paste URL format');
            process.exit(1);
          }
        }
      } else if (urlOrId.startsWith('e/') && urlOrId.length === 10) {
        // It's an encrypted ID in the format "e/AbCdEfGh"
        id = urlOrId.substring(2);
        isEncrypted = true;
      } else if (id.length === 8) {
        // It's just a regular ID
        isEncrypted = false;
      } else {
        console.error('Invalid paste ID format');
        console.error('Valid formats: https://paste.d3d.dev/AbCdEfGh, AbCdEfGh, https://paste.d3d.dev/e/AbCdEfGh, e/AbCdEfGh');
        process.exit(1);
      }
      
      // Determine the URL to fetch
      // If the original URL had a full path with filename, use it
      let fetchUrl: string;
      if (urlOrId.startsWith('http')) {
        const url = new URL(urlOrId);
        fetchUrl = `${API_URL}${url.pathname}`;
      } else {
        fetchUrl = isEncrypted
          ? `${API_URL}/e/${id}`
          : `${API_URL}/${id}`;
      }
      
      console.log(`Fetching paste from ${fetchUrl}...`);
      
      // Fetch the paste
      const response = await fetch(fetchUrl);
      
      if (!response.ok) {
        console.error(`Error: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error(errorText);
        
        // Provide more helpful error messages
        if (response.status === 404) {
          console.error('The paste was not found. It may have been deleted or expired.');
        } else if (response.status === 429) {
          console.error('Too many requests. Please try again later.');
        }
        
        process.exit(1);
      }
      
      // Get the content
      const content = await response.arrayBuffer();
      const contentBuffer = Buffer.from(content);
      
      // If it's encrypted, decrypt it
      if (isEncrypted) {
        console.log('🔒 This paste is encrypted');
        
        try {
          let result: any;
          
          // Determine whether to use GPG keyring
          const useGpgKeyring = options.useGpgKeyring !== false;
          
          // Check if we're in interactive mode
          if (options.interactive) {
            console.log('Using interactive mode for decryption...');
            
            // Check if PGP key file is provided or should be prompted
            let pgpKeyFile = options.pgpKeyFile;
            let passphrase = options.pgpPassphrase;
            
            // If no key file is provided but we're in interactive mode, ask if user wants to use one
            if (!pgpKeyFile) {
              const { usePgpKey } = await inquirer.prompt([{
                type: 'confirm',
                name: 'usePgpKey',
                message: 'Do you want to use a PGP private key file for decryption?',
                default: false
              }]);
              
              if (usePgpKey) {
                const { keyFile } = await inquirer.prompt([{
                  type: 'input',
                  name: 'keyFile',
                  message: 'Enter the path to your PGP private key file:',
                  validate: (input: string) => {
                    if (!input) return 'Path cannot be empty';
                    if (!fs.existsSync(input)) return 'File does not exist';
                    return true;
                  }
                }]);
                
                pgpKeyFile = keyFile;
              }
            }
            
            // If we're using a PGP key file and don't have a passphrase, prompt for it
            if (pgpKeyFile && !passphrase) {
              const { keyPassphrase } = await inquirer.prompt([{
                type: 'password',
                name: 'keyPassphrase',
                message: 'Enter the passphrase for your PGP private key:',
                mask: '*'
              }]);
              
              passphrase = keyPassphrase;
            }
            
            // Now we have all the information needed for decryption
            result = await decryptContent(contentBuffer, pgpKeyFile, passphrase, useGpgKeyring);
          } else {
            // Non-interactive mode
            
            // Check if PGP key file is provided
            if (options.pgpKeyFile) {
              // Use PGP decryption with specified key
              console.log('Using PGP decryption with provided key file');
              
              // Check for passphrase
              if (!options.pgpPassphrase) {
                console.error('Error: --pgp-passphrase is required when using --pgp-key-file in non-interactive mode');
                console.error('Tip: Use --interactive to be prompted for the passphrase');
                process.exit(1);
              }
              
              // Decrypt with PGP, with GPG keyring as fallback if enabled
              result = await decryptContent(contentBuffer, options.pgpKeyFile, options.pgpPassphrase, useGpgKeyring);
            } else {
              // Use standard decryption, with GPG keyring for PGP content if enabled
              if (useGpgKeyring) {
                console.log('GPG keyring integration is enabled for PGP content');
              }
              
              result = await decryptContent(contentBuffer, null, null, useGpgKeyring);
            }
          }
          
          // Display metadata if available
          if (result.metadata) {
            if (options.showMetadata) {
              // Show full metadata in a more structured format
              console.log('\n✨ Paste Metadata:');
              console.log('----------------');
              
              // Version info
              console.log(`Format Version: ${result.metadata.version || 'Unknown'}`);
              
              // Decryption method
              if (result.metadata.decryptedWith) {
                console.log(`Decrypted With: ${result.metadata.decryptedWith}`);
              }
              
              // Sender info
              if (result.metadata.sender) {
                console.log(`Sender: ${result.metadata.sender}`);
              }
              
              // Recipient info
              if (result.metadata.recipient) {
                console.log('\nRecipient Info:');
                const recipient = result.metadata.recipient;
                
                if (recipient.name) console.log(`- Name: ${recipient.name}`);
                if (recipient.email) console.log(`- Email: ${recipient.email}`);
                if (recipient.keyId) console.log(`- Key ID: ${recipient.keyId}`);
                if (recipient.fingerprint) console.log(`- Fingerprint: ${recipient.fingerprint}`);
                if (recipient.type) console.log(`- Key Type: ${recipient.type}`);
              }
              
              // Timestamp
              if (result.metadata.timestamp) {
                console.log(`\nCreated: ${new Date(result.metadata.timestamp).toLocaleString()}`);
              }
              
              // PGP-specific info
              if (result.metadata.pgp) {
                console.log('\nPGP-Specific Information:');
                console.log('- Message uses OpenPGP encryption');
                
                if (result.metadata.keyId) {
                  console.log(`- Decryption Key ID: ${result.metadata.keyId}`);
                }
              }
              
              // Signature info if available
              if (result.metadata.signature) {
                console.log('\nSignature Information:');
                const sig = result.metadata.signature;
                
                if (sig.valid === true) {
                  console.log('- ✓ Valid signature');
                } else if (sig.valid === null) {
                  console.log('- ? Unverified signature');
                } else {
                  console.log('- ✗ Invalid signature');
                }
                
                if (sig.keyId) console.log(`- Signed by key ID: ${sig.keyId}`);
                if (sig.created) console.log(`- Signed on: ${new Date(sig.created).toLocaleString()}`);
              }
              
              console.log('----------------\n');
            } else {
              // Show just the basic info
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
          }
          
          console.log('\n✓ Paste decrypted successfully:\n');
          const contentToWrite = result.decryptedContent || result.content;
          process.stdout.write(contentToWrite);

          // Add a newline at the end if the content doesn't end with one
          if (contentToWrite.length > 0 && contentToWrite[contentToWrite.length - 1] !== '\n') {
            process.stdout.write('\n');
          }

          // Exit successfully
          process.exit(0);
        } catch (error: any) {
          console.error(`\n❌ Decryption error: ${error.message}`);
          
          // Provide more useful suggestions based on the error type
          if (error.message.includes('No personal key found')) {
            console.error('\nTip: You need to generate a key pair first. Run:');
            console.error('  dedpaste keys --gen-key');
          } else if (error.message.includes('passphrase')) {
            console.error('\nTip: Try using --interactive mode to be prompted for the passphrase');
          } else if (error.message.includes('not a PGP')) {
            console.error('\nTip: This paste appears to use standard RSA/AES encryption, not PGP');
          } else if (error.message.includes('GPG keyring')) {
            console.error('\nTip: Make sure GPG is installed and you have the required private key');
            // Check if we have keyId information to help the user
            if (error.keyIds && error.keyIds.length > 0) {
              console.error('\nThis message was encrypted for:');
              error.keyIds.forEach((key: any) => {
                console.error(`- ${key.type} key ID: ${key.id}`);
              });
              console.error('\nYou need one of these keys in your GPG keyring to decrypt this message');
            }
          }
          
          process.exit(1);
        }
      } else {
        // Just output the content
        process.stdout.write(contentBuffer);

        // Add a newline at the end if the content doesn't end with one
        if (contentBuffer.length > 0 && contentBuffer[contentBuffer.length - 1] !== 10) { // ASCII 10 is newline
          process.stdout.write(Buffer.from('\n'));
        }

        // Exit successfully
        process.exit(0);
      }
    } catch (error: any) {
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
  .option('--interactive', 'Use interactive mode with guided prompts for message creation')
  .option('--enhanced', 'Use enhanced interactive mode with advanced key selection features')
  .option('--pgp', 'Use PGP encryption instead of hybrid RSA/AES')
  .addHelpText('after', `
Default Command Examples:
  $ echo "Hello, world!" | dedpaste                    # Create a basic paste
  $ dedpaste --file document.txt                       # Upload a file
  $ echo "Secret data" | dedpaste --encrypt            # Create an encrypted paste
  $ echo "Secret data" | dedpaste --encrypt --for alice --pgp # Create a PGP-encrypted paste for a recipient
  $ dedpaste --file image.jpg --type image/jpeg        # Upload with specific content type
  $ echo "One-time message" | dedpaste --temp          # Create a one-time paste
  $ dedpaste --interactive --encrypt                   # Interactive encrypted message creation
  $ dedpaste --enhanced --encrypt                      # Enhanced interactive mode with GPG support
  
For more advanced options, use the subcommands:
  $ dedpaste keys --help                               # Key management options
  $ dedpaste send --help                               # Advanced sending options (Recommended for PGP)
  $ dedpaste get --help                                # Retrieval options

NOTE: For PGP encryption, always use the 'send' command and specify a recipient with --for
`);

// Add a default command that handles unencrypted pastes
program
  .action(async (options: DefaultOptions) => {
    // Only show help if no arguments are provided and no stdin (user is at a TTY)
    if (process.argv.length <= 2 && process.stdin.isTTY) {
      program.help();
      return;
    }

    let content: Buffer;
    let contentType: string;
    
    try {
      // Check if we should use enhanced interactive mode
      if (options.interactive && options.enhanced) {
        console.log('Using enhanced interactive mode...');
        try {
          const { enhancedInteractiveSend } = await import('./enhancedInteractiveMode.js');
          const result = await enhancedInteractiveSend();
          
          if (!result.success) {
            console.error(`Error: ${result.message}`);
            process.exit(1);
          }
          
          content = Buffer.from(result.content || '');
          options.temp = result.temp;
          options.pgp = result.pgp;
          contentType = 'text/plain';
        } catch (error: any) {
          console.error(`Error in enhanced interactive mode: ${error.message}`);
          process.exit(1);
        }
      } else {
        // Regular flow - determine if we're reading from a file or stdin
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
          const stdinBuffer: Buffer[] = [];
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
      
      // Fix for file option parsing - ensure it's correctly recognized
      if (!options.file && (process.argv.includes('--file') || process.argv.includes('-f'))) {
        // If Commander didn't parse it correctly, get the file path manually
        const fileArgIndex = Math.max(
          process.argv.indexOf('--file'), 
          process.argv.indexOf('-f')
        );
        
        if (fileArgIndex !== -1 && fileArgIndex < process.argv.length - 1) {
          options.file = process.argv[fileArgIndex + 1];
          
          // Since we're handling this manually, recheck file existence
          if (!fs.existsSync(options.file)) {
            console.error(`Error: File '${options.file}' does not exist`);
            process.exit(1);
          }
          
          // Re-read content from file since we updated the option
          content = fs.readFileSync(options.file);
          contentType = options.type || lookup(options.file) || 'text/plain';
        }
      }
      
      // Additional PGP flag check
      const usePgp = options.pgp || process.argv.includes('--pgp');
      if (usePgp && !options.pgp) {
        options.pgp = true;
      }
      
      // Handle encryption if requested
      if (shouldEncrypt) {
        try {
          // If PGP is selected, validate required parameters
          if (usePgp) {
            if (!options.for) {
              console.error(`Error: PGP encryption requires specifying a recipient with --for.`);
              console.error(`Please use: dedpaste send --encrypt --pgp --for <recipient_name>`);
              process.exit(1);
            }
          }
          
          // If PGP key file is provided, read it and use it directly
          if (options.pgpKeyFile) {
            if (!options.for) {
              console.error(`Error: When using --pgp-key-file, you must specify a recipient with --for`);
              process.exit(1);
            }
            const pgpKeyContent = await fsPromises.readFile(options.pgpKeyFile, 'utf8');
            const pgpResult = await createPgpEncryptedMessage(content, pgpKeyContent, options.for);
            content = typeof pgpResult === 'string' ? Buffer.from(pgpResult) : pgpResult;
          } else {
            // Use the standard encryption flow with PGP option
            const encryptResult = await encryptContent(content.toString('utf8'), options.for, usePgp);
            content = typeof encryptResult === 'string' ? Buffer.from(encryptResult) : encryptResult;
          }
          
          // Log PGP mode if used
          if (usePgp || options.pgpKeyFile) {
            console.log('Using PGP encryption');
          }
          
          // Set content type to application/json for encrypted content
          contentType = 'application/json';
        } catch (error: any) {
          console.error(`Encryption failed: ${error.message}`);
          console.error(`\nFor PGP encryption, use: dedpaste send --encrypt --pgp --for <recipient_name>`);
          process.exit(1);
        }
        
        // Determine the endpoint for encrypted pastes
        const endpoint = options.temp ? '/e/temp' : '/e/upload';
        
        try {
          // Extract filename if uploading a file
          const filename = options.file ? path.basename(options.file) : '';

          const headers: Record<string, string> = {
            'Content-Type': contentType,
            'User-Agent': `dedpaste-cli/${packageJson.version}`
          };

          // Include filename header if we have a file
          if (filename) {
            headers['X-Filename'] = filename;
          }

          // Make the API request
          const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers,
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
              if (clipboard.default) {
                clipboard.default.writeSync(cleanUrl);
              } else {
                clipboard.writeSync(cleanUrl);
              }
            } catch (error: any) {
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

          // Exit successfully
          process.exit(0);
        } catch (error: any) {
          console.error(`Network error: ${error.message}`);
          process.exit(1);
        }
      }
      
      // Determine the endpoint based on whether it's a temporary paste
      const endpoint = options.temp ? '/temp' : '/upload';
      
      try {
        // Extract filename if uploading a file
        const filename = options.file ? path.basename(options.file) : '';

        const headers: Record<string, string> = {
          'Content-Type': contentType,
          'User-Agent': `dedpaste-cli/${packageJson.version}`
        };

        // Include filename header if we have a file
        if (filename) {
          headers['X-Filename'] = filename;
        }

        // Make the API request
        const response = await fetch(`${API_URL}${endpoint}`, {
          method: 'POST',
          headers,
          body: content
        });
        
        if (!response.ok) {
          console.error(`Error: ${response.status} ${response.statusText}`);
          const errorText = await response.text();
          console.error(errorText);
          process.exit(1);
        }
        
        const url = await response.text();

        // Track paste creation
        analytics.trackPasteCreated({
          type: options.temp ? 'one_time' : 'regular',
          content_type: contentType,
          size_bytes: content.length,
          encryption_type: options.encrypt ? 'RSA' : 'none',
          method: options.file ? 'file' : 'stdin'
        });

        // Copy to clipboard if requested
        if (options.copy) {
          try {
            const cleanUrl = url.trim();
            if (clipboard.default) {
              clipboard.default.writeSync(cleanUrl);
            } else {
              clipboard.writeSync(cleanUrl);
            }
          } catch (error: any) {
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

        // Exit successfully
        process.exit(0);
      } catch (error: any) {
        console.error(`Network error: ${error.message}`);
        process.exit(1);
      }
    } catch (error: any) {
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
  .action(async (options: CompletionOptions) => {
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
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program.parse();