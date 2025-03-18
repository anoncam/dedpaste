// Enhanced interactive mode for key management and encryption
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { homedir } from 'os';

// Import our unified key manager
import * as unifiedKeyManager from './unifiedKeyManager.js';
import { runKeyDiagnostics, formatDiagnosticsReport, checkGpgKeyring } from './keyDiagnostics.js';
import { encryptContent, decryptContent } from './encryptionUtils.js';

/**
 * Show enhanced interactive key management menu
 * @returns {Promise<Object>} - Operation result
 */
async function enhancedKeyManagement() {
  try {
    // Display welcome message
    console.log(chalk.bold.blue('\n===== DedPaste Enhanced Key Management =====\n'));
    console.log(chalk.cyan('Initializing key system... Please wait...\n'));

    // Initialize the key manager
    const init = await unifiedKeyManager.initialize();
    
    if (!init.success) {
      console.error(chalk.red(`Failed to initialize key system: ${init.error}`));
      return {
        success: false,
        message: `Failed to initialize key system: ${init.error}`
      };
    }
    
    console.log(chalk.green('✓ Key system initialized successfully!\n'));
    
    // Main menu loop
    let exitMenu = false;
    
    while (!exitMenu) {
      const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'DedPaste Key Management',
        prefix: chalk.magenta('🔑'),
        choices: [
          { name: chalk.green('List and search keys'), value: 'search' },
          { name: chalk.green('Add or import key'), value: 'add' },
          { name: chalk.green('Generate a new key'), value: 'generate' },
          { name: chalk.green('View key details'), value: 'view' },
          { name: chalk.green('Export keys'), value: 'export' },
          { name: chalk.green('Remove keys'), value: 'remove' },
          { name: chalk.green('Run diagnostics'), value: 'diagnostics' },
          { name: chalk.red('Exit'), value: 'exit' }
        ]
      }]);
      
      switch (action) {
        case 'search':
          await searchAndListKeys();
          break;
        case 'add':
          await addOrImportKey();
          break;
        case 'generate':
          await generateNewKey();
          break;
        case 'view':
          await viewKeyDetails();
          break;
        case 'export':
          await exportKeys();
          break;
        case 'remove':
          await removeKeys();
          break;
        case 'diagnostics':
          await runDiagnostics();
          break;
        case 'exit':
          exitMenu = true;
          break;
      }
    }
    
    console.log(chalk.blue('\nThank you for using DedPaste Key Management!\n'));
    
    return {
      success: true,
      message: 'Key management session completed'
    };
  } catch (error) {
    console.error(chalk.red(`\nError in key management: ${error.message}`));
    return {
      success: false,
      message: `Error in key management: ${error.message}`
    };
  }
}

/**
 * Search and list keys
 * @returns {Promise<void>}
 */
async function searchAndListKeys() {
  try {
    const { searchMode, query } = await inquirer.prompt([
      {
        type: 'list',
        name: 'searchMode',
        message: 'How would you like to find keys?',
        choices: [
          { name: 'List all keys', value: 'all' },
          { name: 'Search by name', value: 'name' },
          { name: 'Search by email', value: 'email' },
          { name: 'Search by fingerprint', value: 'fingerprint' }
        ]
      },
      {
        type: 'input',
        name: 'query',
        message: 'Enter search term:',
        when: (answers) => answers.searchMode !== 'all'
      }
    ]);
    
    // Set up search options
    const searchOptions = {
      includeGpg: true
    };
    
    // Get keys based on search mode
    let keys;
    if (searchMode === 'all') {
      keys = await unifiedKeyManager.searchKeys('', searchOptions);
    } else {
      keys = await unifiedKeyManager.searchKeys(query, searchOptions);
    }
    
    if (keys.length === 0) {
      console.log(chalk.yellow('\nNo keys found matching your criteria'));
      return;
    }
    
    // Group keys by type
    const groupedKeys = {
      self: [],
      friend: [],
      pgp: [],
      keybase: [],
      gpg: []
    };
    
    for (const key of keys) {
      if (key.source === 'self') {
        groupedKeys.self.push(key);
      } else if (key.source === 'friend') {
        groupedKeys.friend.push(key);
      } else if (key.source === 'pgp') {
        groupedKeys.pgp.push(key);
      } else if (key.source === 'keybase') {
        groupedKeys.keybase.push(key);
      } else if (key.source === 'gpg') {
        groupedKeys.gpg.push(key);
      }
    }
    
    // Print results in a formatted way
    console.log(chalk.bold.green('\n===== Key Search Results ====='));
    
    // Print self key
    if (groupedKeys.self.length > 0) {
      console.log(chalk.bold.blue('\nSelf Keys:'));
      for (const key of groupedKeys.self) {
        console.log(`- ${chalk.green('Name:')} Self`);
        console.log(`  ${chalk.green('Type:')} ${key.type.toUpperCase()}`);
        console.log(`  ${chalk.green('Fingerprint:')} ${key.fingerprint}`);
        if (key.created) {
          console.log(`  ${chalk.green('Created:')} ${new Date(key.created).toLocaleString()}`);
        }
      }
    }
    
    // Print friend keys
    if (groupedKeys.friend.length > 0) {
      console.log(chalk.bold.blue('\nFriend Keys:'));
      for (const key of groupedKeys.friend) {
        console.log(`- ${chalk.green('Name:')} ${key.name}`);
        console.log(`  ${chalk.green('Type:')} ${key.type.toUpperCase()}`);
        console.log(`  ${chalk.green('Fingerprint:')} ${key.fingerprint}`);
        if (key.lastUsed) {
          console.log(`  ${chalk.green('Last Used:')} ${new Date(key.lastUsed).toLocaleString()}`);
        }
      }
    }
    
    // Print PGP keys
    if (groupedKeys.pgp.length > 0) {
      console.log(chalk.bold.blue('\nPGP Keys:'));
      for (const key of groupedKeys.pgp) {
        console.log(`- ${chalk.green('Name:')} ${key.name}`);
        console.log(`  ${chalk.green('Type:')} ${key.type.toUpperCase()}`);
        console.log(`  ${chalk.green('Fingerprint:')} ${key.fingerprint}`);
        if (key.email) {
          console.log(`  ${chalk.green('Email:')} ${key.email}`);
        }
        if (key.lastUsed) {
          console.log(`  ${chalk.green('Last Used:')} ${new Date(key.lastUsed).toLocaleString()}`);
        }
      }
    }
    
    // Print Keybase keys
    if (groupedKeys.keybase.length > 0) {
      console.log(chalk.bold.blue('\nKeybase Keys:'));
      for (const key of groupedKeys.keybase) {
        console.log(`- ${chalk.green('Name:')} ${key.name}`);
        console.log(`  ${chalk.green('Type:')} ${key.type.toUpperCase()}`);
        console.log(`  ${chalk.green('Username:')} ${key.username}`);
        console.log(`  ${chalk.green('Fingerprint:')} ${key.fingerprint}`);
        if (key.email) {
          console.log(`  ${chalk.green('Email:')} ${key.email}`);
        }
        if (key.lastUsed) {
          console.log(`  ${chalk.green('Last Used:')} ${new Date(key.lastUsed).toLocaleString()}`);
        }
      }
    }
    
    // Print GPG keys
    if (groupedKeys.gpg.length > 0) {
      console.log(chalk.bold.blue('\nGPG Keyring Keys:'));
      for (const key of groupedKeys.gpg) {
        console.log(`- ${chalk.green('Key ID:')} ${key.id}`);
        console.log(`  ${chalk.green('Name:')} ${key.name}`);
        console.log(`  ${chalk.green('Type:')} ${key.type.toUpperCase()}`);
        if (key.email) {
          console.log(`  ${chalk.green('Email:')} ${key.email}`);
        }
        if (key.created) {
          console.log(`  ${chalk.green('Created:')} ${new Date(key.created).toLocaleString()}`);
        }
        if (key.expires) {
          console.log(`  ${chalk.green('Expires:')} ${new Date(key.expires).toLocaleString()}`);
        }
      }
    }
    
    console.log(chalk.bold.green('\n============================='));
    
    // Ask if user wants to view details of a specific key
    const { viewDetails } = await inquirer.prompt([{
      type: 'confirm',
      name: 'viewDetails',
      message: 'Would you like to view details of a specific key?',
      default: false
    }]);
    
    if (viewDetails) {
      await viewKeyDetails(keys);
    }
    
  } catch (error) {
    console.error(chalk.red(`\nError searching keys: ${error.message}`));
  }
}

/**
 * Add or import a key
 * @returns {Promise<void>}
 */
async function addOrImportKey() {
  try {
    const { importSource } = await inquirer.prompt([{
      type: 'list',
      name: 'importSource',
      message: 'How would you like to add a key?',
      choices: [
        { name: 'Import from file', value: 'file' },
        { name: 'Fetch from PGP keyserver', value: 'pgp-server' },
        { name: 'Fetch from Keybase', value: 'keybase' },
        { name: 'Import from GPG keyring', value: 'gpg-keyring' },
        { name: 'Import to GPG keyring', value: 'gpg-import' },
        { name: 'Paste key content', value: 'paste' }
      ]
    }]);
    
    let options = { source: importSource };
    
    // Handle different import sources
    switch (importSource) {
      case 'file': {
        const { filePath, name } = await inquirer.prompt([
          {
            type: 'input',
            name: 'filePath',
            message: 'Enter the path to the key file:',
            validate: (input) => {
              if (!input) return 'Path cannot be empty';
              if (!fs.existsSync(input)) return 'File does not exist';
              return true;
            }
          },
          {
            type: 'input',
            name: 'name',
            message: 'Enter a name for this key (leave empty to use default):',
            default: ''
          }
        ]);
        
        options.file = filePath;
        if (name) options.name = name;
        break;
      }
      
      case 'pgp-server': {
        const { identifier, name } = await inquirer.prompt([
          {
            type: 'input',
            name: 'identifier',
            message: 'Enter email address or key ID:',
            validate: (input) => input ? true : 'Identifier cannot be empty'
          },
          {
            type: 'input',
            name: 'name',
            message: 'Enter a name for this key (leave empty to use default):',
            default: ''
          }
        ]);
        
        if (identifier.includes('@')) {
          options.email = identifier;
        } else {
          options.keyId = identifier;
        }
        
        if (name) options.name = name;
        break;
      }
      
      case 'keybase': {
        const { username, name, verify } = await inquirer.prompt([
          {
            type: 'input',
            name: 'username',
            message: 'Enter Keybase username:',
            validate: (input) => input ? true : 'Username cannot be empty'
          },
          {
            type: 'input',
            name: 'name',
            message: 'Enter a name for this key (leave empty to use default):',
            default: ''
          },
          {
            type: 'confirm',
            name: 'verify',
            message: 'Verify Keybase proofs?',
            default: true
          }
        ]);
        
        options.username = username;
        if (name) options.name = name;
        options.verify = verify;
        break;
      }
      
      case 'gpg-keyring': {
        // Check if GPG is available
        const gpgInfo = await unifiedKeyManager.initialize();
        
        if (!gpgInfo.gpg || !gpgInfo.gpg.available) {
          console.log(chalk.red('\nGPG is not available on your system'));
          return;
        }
        
        // List available GPG keys for selection
        console.log(chalk.blue('\nAvailable GPG keys:'));
        
        const gpgKeys = gpgInfo.gpg.keys.map((key, index) => {
          const uid = key.uids.length > 0 ? key.uids[0].uid : 'No user ID';
          return {
            name: `${key.id} - ${uid}`,
            value: key.id,
            short: key.id
          };
        });
        
        if (gpgKeys.length === 0) {
          console.log(chalk.yellow('No keys found in GPG keyring'));
          return;
        }
        
        const { keyId, name } = await inquirer.prompt([
          {
            type: 'list',
            name: 'keyId',
            message: 'Select a key from GPG keyring:',
            choices: gpgKeys
          },
          {
            type: 'input',
            name: 'name',
            message: 'Enter a name for this key (leave empty to use default):',
            default: ''
          }
        ]);
        
        options.keyId = keyId;
        if (name) options.name = name;
        break;
      }
      
      case 'gpg-import': {
        const { content } = await inquirer.prompt([{
          type: 'editor',
          name: 'content',
          message: 'Paste the PGP key to import to GPG keyring:',
          validate: (input) => {
            if (!input) return 'Key content cannot be empty';
            if (!input.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----')) {
              return 'Invalid PGP key format';
            }
            return true;
          }
        }]);
        
        options.content = content;
        break;
      }
      
      case 'paste': {
        const { content, name } = await inquirer.prompt([
          {
            type: 'editor',
            name: 'content',
            message: 'Paste the key content:',
            validate: (input) => input ? true : 'Key content cannot be empty'
          },
          {
            type: 'input',
            name: 'name',
            message: 'Enter a name for this key:',
            validate: (input) => input ? true : 'Name cannot be empty'
          }
        ]);
        
        // Change to file source with content
        options.source = 'file';
        options.content = content;
        options.name = name;
        break;
      }
    }
    
    // Show a "working" message for operations that might take time
    console.log(chalk.blue('\nImporting key... please wait...'));
    
    // Import the key
    const result = await unifiedKeyManager.importKey(options);
    
    if (result.success) {
      console.log(chalk.green('\n✓ Key imported successfully!'));
      
      // Display key details
      console.log(chalk.bold('\nKey details:'));
      console.log(`- ${chalk.green('Type:')} ${result.type}`);
      console.log(`- ${chalk.green('Name:')} ${result.name}`);
      
      if (result.fingerprint) {
        console.log(`- ${chalk.green('Fingerprint:')} ${result.fingerprint}`);
      }
      
      if (result.email) {
        console.log(`- ${chalk.green('Email:')} ${result.email}`);
      }
      
      if (result.username) {
        console.log(`- ${chalk.green('Username:')} ${result.username}`);
      }
      
      if (result.path) {
        console.log(`- ${chalk.green('Stored at:')} ${result.path}`);
      }
      
      if (result.keyId) {
        console.log(`- ${chalk.green('Key ID:')} ${result.keyId}`);
      }
      
      if (result.output) {
        console.log(`\n${result.output}`);
      }
    } else {
      console.log(chalk.red(`\n✗ Import failed: ${result.error}`));
    }
  } catch (error) {
    console.error(chalk.red(`\nError importing key: ${error.message}`));
  }
}

/**
 * Generate a new key pair
 * @returns {Promise<void>}
 */
async function generateNewKey() {
  try {
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Generate a new RSA key pair? This will overwrite your existing self key if present.',
      default: false
    }]);
    
    if (!confirm) return;
    
    console.log(chalk.blue('\nGenerating new key pair... please wait...'));
    
    // Generate the key
    const result = await unifiedKeyManager.generateKey();
    
    if (result.success) {
      console.log(chalk.green('\n✓ Key generated successfully!'));
      console.log(`- ${chalk.green('Private key:')} ${result.privateKeyPath}`);
      console.log(`- ${chalk.green('Public key:')} ${result.publicKeyPath}`);
      
      // Offer to back up the key
      const { backup } = await inquirer.prompt([{
        type: 'confirm',
        name: 'backup',
        message: 'Would you like to export your keys to a backup location?',
        default: true
      }]);
      
      if (backup) {
        const { backupDir } = await inquirer.prompt([{
          type: 'input',
          name: 'backupDir',
          message: 'Enter a directory to save backups:',
          default: path.join(homedir(), 'dedpaste-backup'),
          validate: (input) => input ? true : 'Directory cannot be empty'
        }]);
        
        // Create backup directory if it doesn't exist
        await fsPromises.mkdir(backupDir, { recursive: true });
        
        // Copy the keys
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const privateKeyBackup = path.join(backupDir, `private-key-${timestamp}.pem`);
        const publicKeyBackup = path.join(backupDir, `public-key-${timestamp}.pem`);
        
        await fsPromises.copyFile(result.privateKeyPath, privateKeyBackup);
        await fsPromises.copyFile(result.publicKeyPath, publicKeyBackup);
        
        console.log(chalk.green('\n✓ Keys backed up successfully!'));
        console.log(`- ${chalk.green('Private key backup:')} ${privateKeyBackup}`);
        console.log(`- ${chalk.green('Public key backup:')} ${publicKeyBackup}`);
        console.log(chalk.yellow('\nIMPORTANT: Keep your private key backup secure!'));
      }
    } else {
      console.log(chalk.red(`\n✗ Key generation failed: ${result.error}`));
    }
  } catch (error) {
    console.error(chalk.red(`\nError generating key: ${error.message}`));
  }
}

/**
 * View key details
 * @param {Array} preloadedKeys - Optional preloaded keys
 * @returns {Promise<void>}
 */
async function viewKeyDetails(preloadedKeys = null) {
  try {
    // If keys are not preloaded, search for all keys
    const keys = preloadedKeys || await unifiedKeyManager.searchKeys('', { includeGpg: true });
    
    if (keys.length === 0) {
      console.log(chalk.yellow('\nNo keys found'));
      return;
    }
    
    // Prepare choices for key selection
    const keyChoices = keys.map(key => {
      let label = '';
      
      if (key.source === 'self') {
        label = `${key.name} (Self Key)`;
      } else if (key.source === 'friend') {
        label = `${key.name} (Friend Key)`;
      } else if (key.source === 'pgp') {
        label = `${key.name} (PGP Key${key.email ? ` - ${key.email}` : ''})`;
      } else if (key.source === 'keybase') {
        label = `${key.name} (Keybase - ${key.username || 'unknown'})`;
      } else if (key.source === 'gpg') {
        const uid = key.uids && key.uids.length > 0 ? key.uids[0] : 'Unknown';
        label = `${key.id} (GPG - ${uid})`;
      }
      
      return {
        name: label,
        value: key.id || key.fingerprint,
        short: key.id || key.fingerprint
      };
    });
    
    const { selectedKeyId } = await inquirer.prompt([{
      type: 'list',
      name: 'selectedKeyId',
      message: 'Select a key to view details:',
      choices: keyChoices
    }]);
    
    // Get detailed key info
    const keyInfo = await unifiedKeyManager.getKeyById(selectedKeyId, { includeGpg: true });
    
    if (!keyInfo) {
      console.log(chalk.red('\nKey not found'));
      return;
    }
    
    // Display detailed key information
    console.log(chalk.bold.green('\n===== Key Details ====='));
    console.log(`- ${chalk.green('ID:')} ${keyInfo.id}`);
    console.log(`- ${chalk.green('Name:')} ${keyInfo.name}`);
    console.log(`- ${chalk.green('Type:')} ${keyInfo.type.toUpperCase()}`);
    console.log(`- ${chalk.green('Source:')} ${keyInfo.source}`);
    console.log(`- ${chalk.green('Fingerprint:')} ${keyInfo.fingerprint}`);
    
    if (keyInfo.email) {
      console.log(`- ${chalk.green('Email:')} ${keyInfo.email}`);
    }
    
    if (keyInfo.username) {
      console.log(`- ${chalk.green('Username:')} ${keyInfo.username}`);
    }
    
    if (keyInfo.created) {
      console.log(`- ${chalk.green('Created:')} ${new Date(keyInfo.created).toLocaleString()}`);
    }
    
    if (keyInfo.lastUsed) {
      console.log(`- ${chalk.green('Last Used:')} ${new Date(keyInfo.lastUsed).toLocaleString()}`);
    }
    
    if (keyInfo.expires) {
      console.log(`- ${chalk.green('Expires:')} ${new Date(keyInfo.expires).toLocaleString()}`);
    }
    
    if (keyInfo.trust) {
      console.log(`- ${chalk.green('Trust Level:')} ${keyInfo.trust}`);
    }
    
    if (keyInfo.uids && keyInfo.uids.length > 0) {
      console.log(chalk.green('- User IDs:'));
      keyInfo.uids.forEach(uid => {
        console.log(`  - ${uid}`);
      });
    }
    
    if (keyInfo.path) {
      if (typeof keyInfo.path === 'object') {
        console.log(`- ${chalk.green('Public Key Path:')} ${keyInfo.path.public}`);
        console.log(`- ${chalk.green('Private Key Path:')} ${keyInfo.path.private}`);
      } else {
        console.log(`- ${chalk.green('Key Path:')} ${keyInfo.path}`);
      }
    }
    
    console.log(chalk.bold.green('\n========================='));
    
    // Offer to view key content
    const { viewContent } = await inquirer.prompt([{
      type: 'confirm',
      name: 'viewContent',
      message: 'Would you like to view the key content?',
      default: false
    }]);
    
    if (viewContent) {
      // Ask about private key for self keys
      let viewPrivate = false;
      if (keyInfo.source === 'self') {
        const { usePrivate } = await inquirer.prompt([{
          type: 'confirm',
          name: 'usePrivate',
          message: 'View private key? (WARNING: Private keys should be kept secure)',
          default: false
        }]);
        viewPrivate = usePrivate;
      }
      
      const keyContent = await unifiedKeyManager.readKeyContent(keyInfo, { 
        private: viewPrivate 
      });
      
      if (keyContent) {
        console.log(chalk.bold.green('\n===== Key Content ====='));
        console.log(keyContent);
        console.log(chalk.bold.green('\n========================='));
      } else {
        console.log(chalk.red('\nCould not read key content'));
      }
    }
  } catch (error) {
    console.error(chalk.red(`\nError viewing key details: ${error.message}`));
  }
}

/**
 * Export keys to files
 * @returns {Promise<void>}
 */
async function exportKeys() {
  try {
    // Search for all keys
    const keys = await unifiedKeyManager.searchKeys('', { includeGpg: true });
    
    if (keys.length === 0) {
      console.log(chalk.yellow('\nNo keys found to export'));
      return;
    }
    
    // Prepare choices for key selection
    const keyChoices = keys.map(key => {
      let label = '';
      
      if (key.source === 'self') {
        label = `${key.name} (Self Key)`;
      } else if (key.source === 'friend') {
        label = `${key.name} (Friend Key)`;
      } else if (key.source === 'pgp') {
        label = `${key.name} (PGP Key${key.email ? ` - ${key.email}` : ''})`;
      } else if (key.source === 'keybase') {
        label = `${key.name} (Keybase - ${key.username || 'unknown'})`;
      } else if (key.source === 'gpg') {
        const uid = key.uids && key.uids.length > 0 ? key.uids[0] : 'Unknown';
        label = `${key.id} (GPG - ${uid})`;
      }
      
      return {
        name: label,
        value: key.id || key.fingerprint,
        short: key.id || key.fingerprint
      };
    });
    
    const { selectedKeyId } = await inquirer.prompt([{
      type: 'list',
      name: 'selectedKeyId',
      message: 'Select a key to export:',
      choices: keyChoices
    }]);
    
    // Get detailed key info
    const keyInfo = await unifiedKeyManager.getKeyById(selectedKeyId, { includeGpg: true });
    
    if (!keyInfo) {
      console.log(chalk.red('\nKey not found'));
      return;
    }
    
    // Ask about private key for self keys
    let exportPrivate = false;
    if (keyInfo.source === 'self') {
      const { usePrivate } = await inquirer.prompt([{
        type: 'confirm',
        name: 'usePrivate',
        message: 'Export private key? (WARNING: Private keys should be kept secure)',
        default: false
      }]);
      exportPrivate = usePrivate;
    }
    
    // Get export location
    const { exportDir } = await inquirer.prompt([{
      type: 'input',
      name: 'exportDir',
      message: 'Enter a directory to export the key:',
      default: homedir(),
      validate: (input) => {
        if (!input) return 'Directory cannot be empty';
        if (!fs.existsSync(input)) return 'Directory does not exist';
        return true;
      }
    }]);
    
    // Generate filename based on key type and name
    let filename;
    if (keyInfo.source === 'self') {
      filename = exportPrivate ? 'dedpaste_private_key.pem' : 'dedpaste_public_key.pem';
    } else if (keyInfo.type === 'pgp' || keyInfo.type === 'keybase') {
      filename = `${keyInfo.name.replace(/[^a-z0-9_-]/gi, '_')}.asc`;
    } else if (keyInfo.type === 'gpg') {
      filename = `gpg_${keyInfo.id.substring(keyInfo.id.length - 8)}.asc`;
    } else {
      filename = `${keyInfo.name.replace(/[^a-z0-9_-]/gi, '_')}.pem`;
    }
    
    const { customFilename } = await inquirer.prompt([{
      type: 'input',
      name: 'customFilename',
      message: 'Enter a filename (leave empty to use default):',
      default: filename
    }]);
    
    const exportPath = path.join(exportDir, customFilename || filename);
    
    // Read key content
    const keyContent = await unifiedKeyManager.readKeyContent(keyInfo, { 
      private: exportPrivate 
    });
    
    if (!keyContent) {
      console.log(chalk.red('\nCould not read key content'));
      return;
    }
    
    // Write key to file
    await fsPromises.writeFile(exportPath, keyContent);
    
    console.log(chalk.green(`\n✓ Key exported successfully to: ${exportPath}`));
    
    if (exportPrivate) {
      console.log(chalk.yellow('\nWARNING: This file contains a private key. Keep it secure!'));
    }
  } catch (error) {
    console.error(chalk.red(`\nError exporting key: ${error.message}`));
  }
}

/**
 * Remove keys
 * @returns {Promise<void>}
 */
async function removeKeys() {
  try {
    // Search for all keys except GPG (which we can't remove through our interface)
    const keys = await unifiedKeyManager.searchKeys('', { includeGpg: false });
    
    if (keys.length === 0) {
      console.log(chalk.yellow('\nNo keys found to remove'));
      return;
    }
    
    // Prepare choices for key selection
    const keyChoices = keys.map(key => {
      let label = '';
      
      if (key.source === 'self') {
        label = `${key.name} (Self Key)`;
      } else if (key.source === 'friend') {
        label = `${key.name} (Friend Key)`;
      } else if (key.source === 'pgp') {
        label = `${key.name} (PGP Key${key.email ? ` - ${key.email}` : ''})`;
      } else if (key.source === 'keybase') {
        label = `${key.name} (Keybase - ${key.username || 'unknown'})`;
      }
      
      return {
        name: label,
        value: key.id || key.fingerprint,
        short: key.id || key.fingerprint
      };
    });
    
    const { selectedKeyId } = await inquirer.prompt([{
      type: 'list',
      name: 'selectedKeyId',
      message: 'Select a key to remove:',
      choices: keyChoices
    }]);
    
    // Get detailed key info for confirmation
    const keyInfo = await unifiedKeyManager.getKeyById(selectedKeyId);
    
    if (!keyInfo) {
      console.log(chalk.red('\nKey not found'));
      return;
    }
    
    // Special warning for self key
    let confirmMessage = `Are you sure you want to remove ${keyInfo.name}?`;
    if (keyInfo.source === 'self') {
      confirmMessage = chalk.yellow('WARNING: You are about to remove your personal key. This will prevent decryption of messages sent to you. Are you sure?');
    }
    
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: confirmMessage,
      default: false
    }]);
    
    if (!confirm) {
      console.log(chalk.blue('\nOperation cancelled'));
      return;
    }
    
    // Remove the key
    const result = await unifiedKeyManager.removeKey(selectedKeyId);
    
    if (result.success) {
      console.log(chalk.green(`\n✓ Key removed successfully`));
    } else {
      console.log(chalk.red(`\n✗ Failed to remove key: ${result.error}`));
    }
  } catch (error) {
    console.error(chalk.red(`\nError removing key: ${error.message}`));
  }
}

/**
 * Run key system diagnostics
 * @returns {Promise<void>}
 */
async function runDiagnostics() {
  try {
    console.log(chalk.blue('\nRunning key system diagnostics... please wait...'));
    
    const results = await runKeyDiagnostics();
    const report = formatDiagnosticsReport(results);
    
    console.log('\n' + report);
    
    // Offer to fix common issues
    if (results.errors.length > 0 || results.warnings.length > 0) {
      const { fixIssues } = await inquirer.prompt([{
        type: 'confirm',
        name: 'fixIssues',
        message: 'Would you like to attempt to fix issues automatically?',
        default: true
      }]);
      
      if (fixIssues) {
        await fixDiagnosticIssues(results);
      }
    }
  } catch (error) {
    console.error(chalk.red(`\nError running diagnostics: ${error.message}`));
  }
}

/**
 * Fix common diagnostic issues
 * @param {Object} diagnosticResults - Results from runKeyDiagnostics
 * @returns {Promise<void>}
 */
async function fixDiagnosticIssues(diagnosticResults) {
  try {
    // Check for missing directories
    let fixedCount = 0;
    const missingDirs = Object.entries(diagnosticResults.filesystemChecks.directories)
      .filter(([dir, info]) => !info.exists)
      .map(([dir]) => dir);
    
    if (missingDirs.length > 0) {
      console.log(chalk.blue('\nCreating missing directories...'));
      
      for (const dir of missingDirs) {
        try {
          await fsPromises.mkdir(dir, { recursive: true });
          console.log(chalk.green(`✓ Created directory: ${dir}`));
          fixedCount++;
        } catch (error) {
          console.log(chalk.red(`✗ Failed to create directory ${dir}: ${error.message}`));
        }
      }
    }
    
    // Check for missing self key
    if (!diagnosticResults.keyStats.self) {
      console.log(chalk.yellow('\nYou have no self key for encryption/decryption.'));
      const { generateKey } = await inquirer.prompt([{
        type: 'confirm',
        name: 'generateKey',
        message: 'Would you like to generate a new key?',
        default: true
      }]);
      
      if (generateKey) {
        await generateNewKey();
        fixedCount++;
      }
    }
    
    // Report results
    if (fixedCount > 0) {
      console.log(chalk.green(`\n✓ Fixed ${fixedCount} issues`));
    } else {
      console.log(chalk.yellow('\nNo issues were fixed automatically'));
    }
    
    // Suggest manual actions for remaining issues
    const remainingIssues = [...diagnosticResults.errors, ...diagnosticResults.warnings];
    
    if (remainingIssues.length > 0) {
      console.log(chalk.yellow('\nRemaining issues that require manual attention:'));
      remainingIssues.forEach(issue => {
        console.log(`- ${issue}`);
      });
      
      console.log(chalk.blue('\nSuggested actions:'));
      
      // Check for permission issues
      const permissionIssues = remainingIssues.some(issue => issue.includes('not writable'));
      if (permissionIssues) {
        console.log('- Check file and directory permissions in the .dedpaste directory');
        console.log(`  Run: chmod -R u+rw ${path.join(homedir(), '.dedpaste')}`);
      }
      
      // Check for missing/corrupted keys
      const keyIssues = remainingIssues.some(issue => 
        issue.includes('key file not found') || 
        issue.includes('Invalid') || 
        issue.includes('Error reading')
      );
      
      if (keyIssues) {
        console.log('- Reimport or regenerate problematic keys');
        console.log('- Check if key files were moved or deleted manually');
      }
    }
  } catch (error) {
    console.error(chalk.red(`\nError fixing issues: ${error.message}`));
  }
}

/**
 * Send a message with enhanced interactive features
 * @returns {Promise<Object>}
 */
async function enhancedInteractiveSend() {
  try {
    // Initialize the key manager
    const init = await unifiedKeyManager.initialize();
    
    if (!init.success) {
      return {
        success: false,
        message: `Failed to initialize key system: ${init.error}`
      };
    }
    
    // Get message
    const { message } = await inquirer.prompt([{
      type: 'editor',
      name: 'message',
      message: 'Enter your message:',
      validate: input => input.trim() !== '' ? true : 'Message cannot be empty'
    }]);
    
    // Get all recipients (except GPG, which we handle separately)
    const allKeys = await unifiedKeyManager.searchKeys('', { includeGpg: false });
    
    if (allKeys.length === 0) {
      console.log(chalk.yellow('\nNo keys found. Generate a key first with "dedpaste keys --gen-key"'));
      return { success: false, message: 'No keys available' };
    }
    
    // Filter keys by type for better organization
    const selfKeys = allKeys.filter(key => key.source === 'self');
    const friendKeys = allKeys.filter(key => key.source === 'friend');
    const pgpKeys = allKeys.filter(key => key.source === 'pgp');
    const keybaseKeys = allKeys.filter(key => key.source === 'keybase');
    
    // Create categorized choices
    const choices = [];
    
    // Self category
    if (selfKeys.length > 0) {
      choices.push({ name: chalk.bold.blue('--- Self ---'), value: null, disabled: true });
      choices.push(...selfKeys.map(key => ({
        name: 'Self',
        value: null,
        short: 'Self'
      })));
    }
    
    // Friend category
    if (friendKeys.length > 0) {
      choices.push({ name: chalk.bold.blue('--- Friends ---'), value: null, disabled: true });
      choices.push(...friendKeys.map(key => ({
        name: key.name,
        value: key.id,
        short: key.name
      })));
    }
    
    // PGP category
    if (pgpKeys.length > 0) {
      choices.push({ name: chalk.bold.blue('--- PGP Keys ---'), value: null, disabled: true });
      choices.push(...pgpKeys.map(key => ({
        name: `${key.name}${key.email ? ` <${key.email}>` : ''}`,
        value: key.id,
        short: key.name
      })));
    }
    
    // Keybase category
    if (keybaseKeys.length > 0) {
      choices.push({ name: chalk.bold.blue('--- Keybase ---'), value: null, disabled: true });
      choices.push(...keybaseKeys.map(key => ({
        name: `${key.name} (${key.username || 'unknown'})`,
        value: key.id,
        short: key.name
      })));
    }
    
    // GPG option at the end
    choices.push({ name: chalk.bold.blue('--- Other Options ---'), value: null, disabled: true });
    choices.push({ name: 'Use GPG keyring directly (select a GPG key)', value: 'gpg', short: 'GPG' });
    
    // Get recipient
    const { recipient } = await inquirer.prompt([{
      type: 'list',
      name: 'recipient',
      message: 'Select recipient:',
      choices: choices
    }]);
    
    let recipientId = recipient;
    
    // Handle GPG keyring selection
    if (recipient === 'gpg') {
      // Check if GPG is available
      const gpgInfo = await checkGpgKeyring();
      
      if (!gpgInfo.available || gpgInfo.keys.length === 0) {
        console.log(chalk.red('\nGPG is not available or no keys found in keyring'));
        return { success: false, message: 'GPG not available' };
      }
      
      // Create GPG key choices
      const gpgChoices = gpgInfo.keys.map(key => {
        const uid = key.uids.length > 0 ? key.uids[0].uid : 'Unknown';
        return {
          name: `${uid} (${key.id})`,
          value: key.id,
          short: key.id
        };
      });
      
      const { gpgKey } = await inquirer.prompt([{
        type: 'list',
        name: 'gpgKey',
        message: 'Select a GPG key:',
        choices: gpgChoices
      }]);
      
      recipientId = `gpg:${gpgKey}`;
    }
    
    // Get paste options
    const { isTemp, isPgp } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'isTemp',
        message: 'Create a one-time paste (deleted after first view)?',
        default: false
      },
      {
        type: 'confirm',
        name: 'isPgp',
        message: 'Use PGP encryption? (If no, RSA/AES hybrid encryption will be used)',
        default: recipient === 'gpg' || recipientId?.startsWith('gpg:') || false
      }
    ]);
    
    // Handle different encryption methods
    let encryptedContent;
    if (recipient === null) {
      // Encrypt for self
      encryptedContent = await encryptContent(Buffer.from(message), null, isPgp);
    } else if (recipient === 'gpg' || recipientId?.startsWith('gpg:')) {
      // Export the GPG key and use it directly
      const gpgKeyId = recipientId.replace('gpg:', '');
      
      console.log(chalk.blue(`\nExporting GPG key ${gpgKeyId}...`));
      const keyContent = await unifiedKeyManager.exportGpgKey(gpgKeyId, { armor: true });
      
      if (!keyContent) {
        console.log(chalk.red('\nFailed to export GPG key'));
        return { success: false, message: 'Failed to export GPG key' };
      }
      
      console.log(chalk.green('\n✓ GPG key exported successfully!'));
      console.log(chalk.blue('\nEncrypting message with PGP...'));
      
      // Use PGP encryption (always with GPG keys)
      encryptedContent = await encryptContent(Buffer.from(message), `gpg-user-${gpgKeyId}`, true);
    } else {
      // Encrypt for recipient
      encryptedContent = await encryptContent(Buffer.from(message), recipientId, isPgp);
    }
    
    return {
      success: true,
      content: encryptedContent,
      recipient: recipientId,
      temp: isTemp,
      pgp: isPgp
    };
  } catch (error) {
    return {
      success: false,
      message: `Error sending message: ${error.message}`
    };
  }
}

export {
  enhancedKeyManagement,
  searchAndListKeys,
  addOrImportKey,
  generateNewKey,
  viewKeyDetails,
  exportKeys,
  removeKeys,
  runDiagnostics,
  enhancedInteractiveSend
};