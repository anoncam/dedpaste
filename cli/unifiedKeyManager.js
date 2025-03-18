// Unified key management interface
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { homedir } from 'os';
import crypto from 'crypto';
import inquirer from 'inquirer';
import chalk from 'chalk';

// Import our specific key management modules
import * as keyManager from './keyManager.js';
import * as pgpUtils from './pgpUtils.js';
import * as keybaseUtils from './keybaseUtils.js';
import { checkGpgKeyring, findKeysMatchingCriteria } from './keyDiagnostics.js';

// Constants for key types
const KEY_TYPES = {
  RSA: 'rsa',
  PGP: 'pgp',
  KEYBASE: 'keybase',
  GPG: 'gpg'
};

/**
 * Initialize the key system
 * @returns {Promise<Object>} - Initialization result
 */
async function initialize() {
  try {
    // Create necessary directories
    const dirs = await keyManager.ensureDirectories();
    
    // Initialize key database
    const db = await keyManager.loadKeyDatabase();
    
    // Check GPG keyring
    const gpgStatus = await checkGpgKeyring();
    
    return {
      success: true,
      directories: dirs,
      database: db,
      gpg: gpgStatus
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Search for keys with fuzzy matching
 * @param {string} query - Search term
 * @param {Object} options - Search options
 * @returns {Promise<Array>} - Matching keys
 */
async function searchKeys(query, options = {}) {
  try {
    const db = await keyManager.loadKeyDatabase();
    const results = [];
    
    // Prepare a regex for fuzzy searching
    // Escape special regex characters in the query
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Convert to a fuzzy pattern (allows characters between)
    const fuzzyPattern = escapedQuery.split('').join('.*');
    const regex = new RegExp(fuzzyPattern, 'i');
    
    // Helper function to check if a field matches the query
    const fieldMatches = (value) => {
      if (!value) return false;
      
      if (typeof value === 'string') {
        return regex.test(value);
      }
      
      return false;
    };
    
    // Check self key if requested
    if (!options.skipSelf && db.keys.self) {
      const selfKey = db.keys.self;
      
      // Construct a friendly name for the self key
      const selfName = 'Self Key';
      
      // Check if it matches the query
      if (
        fieldMatches(selfName) || 
        fieldMatches(selfKey.fingerprint)
      ) {
        results.push({
          id: 'self',
          name: selfName,
          type: KEY_TYPES.RSA,
          fingerprint: selfKey.fingerprint,
          created: selfKey.created,
          source: 'self',
          path: selfKey.public
        });
      }
    }
    
    // Check friend keys
    for (const [name, info] of Object.entries(db.keys.friends || {})) {
      // Check if it matches the query
      if (
        fieldMatches(name) || 
        fieldMatches(info.fingerprint)
      ) {
        results.push({
          id: name,
          name: name,
          type: KEY_TYPES.RSA,
          fingerprint: info.fingerprint,
          created: info.added,
          lastUsed: info.last_used,
          source: 'friend',
          path: info.public
        });
      }
    }
    
    // Check PGP keys
    for (const [name, info] of Object.entries(db.keys.pgp || {})) {
      // Check if it matches the query
      if (
        fieldMatches(name) || 
        fieldMatches(info.fingerprint) ||
        fieldMatches(info.email)
      ) {
        results.push({
          id: name,
          name: name,
          type: KEY_TYPES.PGP,
          fingerprint: info.fingerprint,
          email: info.email,
          created: info.added,
          lastUsed: info.last_used,
          source: 'pgp',
          path: info.path
        });
      }
    }
    
    // Check Keybase keys
    for (const [name, info] of Object.entries(db.keys.keybase || {})) {
      // Check if it matches the query
      if (
        fieldMatches(name) || 
        fieldMatches(info.fingerprint) ||
        fieldMatches(info.email) ||
        fieldMatches(info.username)
      ) {
        results.push({
          id: name,
          name: name,
          type: KEY_TYPES.KEYBASE,
          fingerprint: info.fingerprint,
          email: info.email,
          username: info.username,
          created: info.added,
          lastUsed: info.last_used,
          source: 'keybase',
          path: info.path
        });
      }
    }
    
    // Check GPG keys if enabled
    if (options.includeGpg) {
      const gpgInfo = await checkGpgKeyring();
      
      if (gpgInfo.available && gpgInfo.keys.length > 0) {
        for (const key of gpgInfo.keys) {
          // Extract user information from the first UID
          const uidInfo = key.uids.length > 0 ? key.uids[0] : { uid: 'Unknown' };
          const uidString = uidInfo.uid;
          
          // Extract email from UID (if present)
          let email = null;
          const emailMatch = uidString.match(/<([^>]+)>/);
          if (emailMatch) {
            email = emailMatch[1];
          }
          
          // Extract name from UID (if present)
          let name = uidString;
          if (emailMatch) {
            name = uidString.replace(/<[^>]+>/, '').trim();
          }
          
          // Check if it matches the query
          if (
            fieldMatches(key.id) || 
            fieldMatches(uidString) ||
            fieldMatches(email) ||
            fieldMatches(name)
          ) {
            results.push({
              id: key.id,
              name: name,
              type: KEY_TYPES.GPG,
              fingerprint: key.id,
              email: email,
              created: key.created,
              expires: key.expires,
              trust: key.trust,
              uids: key.uids.map(u => u.uid),
              source: 'gpg',
              gpgKey: key
            });
          }
        }
      }
    }
    
    return results;
  } catch (error) {
    console.error(`Error searching keys: ${error.message}`);
    return [];
  }
}

/**
 * Get a key by ID with full details
 * @param {string} id - Key identifier
 * @param {Object} options - Options
 * @returns {Promise<Object>} - Key details or null if not found
 */
async function getKeyById(id, options = {}) {
  try {
    // Handle special case for 'self'
    if (id === 'self') {
      const selfKey = await keyManager.getKey('self');
      
      if (!selfKey) {
        return null;
      }
      
      return {
        id: 'self',
        name: 'Self Key',
        type: KEY_TYPES.RSA,
        fingerprint: selfKey.fingerprint,
        created: selfKey.created,
        source: 'self',
        path: {
          public: selfKey.public,
          private: selfKey.private
        },
        raw: selfKey
      };
    }
    
    // Try to find in all collections
    const key = await keyManager.getKey('any', id);
    
    if (key) {
      // Determine the type and build response based on it
      if (key.type === 'pgp') {
        return {
          id: id,
          name: id,
          type: KEY_TYPES.PGP,
          fingerprint: key.fingerprint,
          email: key.email,
          created: key.added,
          lastUsed: key.last_used,
          source: 'pgp',
          path: key.path,
          raw: key
        };
      } else if (key.type === 'keybase') {
        return {
          id: id,
          name: id,
          type: KEY_TYPES.KEYBASE,
          fingerprint: key.fingerprint,
          email: key.email,
          username: key.username,
          created: key.added,
          lastUsed: key.last_used,
          source: 'keybase',
          path: key.path,
          raw: key
        };
      } else {
        // Regular friend key (RSA)
        return {
          id: id,
          name: id,
          type: KEY_TYPES.RSA,
          fingerprint: key.fingerprint,
          created: key.added,
          lastUsed: key.last_used,
          source: 'friend',
          path: key.public,
          raw: key
        };
      }
    }
    
    // Check GPG if enabled
    if (options.includeGpg) {
      const gpgInfo = await checkGpgKeyring();
      
      if (gpgInfo.available && gpgInfo.keys.length > 0) {
        // Try to find a matching key by ID
        const gpgKey = gpgInfo.keys.find(k => k.id === id || k.id.endsWith(id));
        
        if (gpgKey) {
          // Extract user information from the first UID
          const uidInfo = gpgKey.uids.length > 0 ? gpgKey.uids[0] : { uid: 'Unknown' };
          const uidString = uidInfo.uid;
          
          // Extract email from UID (if present)
          let email = null;
          const emailMatch = uidString.match(/<([^>]+)>/);
          if (emailMatch) {
            email = emailMatch[1];
          }
          
          // Extract name from UID (if present)
          let name = uidString;
          if (emailMatch) {
            name = uidString.replace(/<[^>]+>/, '').trim();
          }
          
          return {
            id: gpgKey.id,
            name: name,
            type: KEY_TYPES.GPG,
            fingerprint: gpgKey.id,
            email: email,
            created: gpgKey.created,
            expires: gpgKey.expires,
            trust: gpgKey.trust,
            uids: gpgKey.uids.map(u => u.uid),
            source: 'gpg',
            gpgKey: gpgKey,
            raw: gpgKey
          };
        }
      }
    }
    
    // Not found
    return null;
  } catch (error) {
    console.error(`Error getting key by ID: ${error.message}`);
    return null;
  }
}

/**
 * Read key content from various sources
 * @param {Object} key - Key object from getKeyById or searchKeys
 * @param {Object} options - Options
 * @returns {Promise<string|null>} - Key content or null on error
 */
async function readKeyContent(key, options = {}) {
  try {
    if (!key) return null;
    
    // Handle different key types and sources
    switch (key.type) {
      case KEY_TYPES.RSA:
        if (key.source === 'self') {
          // Read self key content based on options
          const keyPath = options.private ? key.path.private : key.path.public;
          return await fsPromises.readFile(keyPath, 'utf8');
        } else {
          // Read friend key content
          return await fsPromises.readFile(key.path, 'utf8');
        }
      
      case KEY_TYPES.PGP:
      case KEY_TYPES.KEYBASE:
        // Read PGP or Keybase key content
        return await fsPromises.readFile(key.path, 'utf8');
      
      case KEY_TYPES.GPG:
        // Export key from GPG keyring
        return await exportGpgKey(key.id, options);
      
      default:
        throw new Error(`Unsupported key type: ${key.type}`);
    }
  } catch (error) {
    console.error(`Error reading key content: ${error.message}`);
    return null;
  }
}

/**
 * Export a key from GPG keyring
 * @param {string} keyId - GPG key ID
 * @param {Object} options - Export options
 * @returns {Promise<string|null>} - Exported key or null on error
 */
async function exportGpgKey(keyId, options = {}) {
  try {
    // Import child_process dynamically
    const childProcess = await import('child_process');
    const { execFile } = childProcess;
    
    // Promisify execFile
    const execFilePromise = (cmd, args) => {
      return new Promise((resolve) => {
        execFile(cmd, args, (error, stdout, stderr) => {
          resolve({ error, stdout, stderr });
        });
      });
    };
    
    // Build export arguments
    const args = ['--export'];
    
    // Add armor (ASCII) output flag if not binary
    if (!options.binary) {
      args.push('--armor');
    }
    
    // Add key ID
    args.push(keyId);
    
    // Execute GPG export
    const result = await execFilePromise('gpg', args);
    
    if (result.error) {
      console.error(`GPG export error: ${result.error.message}`);
      return null;
    }
    
    if (!result.stdout) {
      console.error('GPG export returned empty output');
      return null;
    }
    
    return result.stdout;
  } catch (error) {
    console.error(`GPG export error: ${error.message}`);
    return null;
  }
}

/**
 * Import a key from various sources
 * @param {Object} options - Import options
 * @returns {Promise<Object>} - Import result
 */
async function importKey(options) {
  try {
    const { source, content, name, file, email, username, verify = true } = options;
    
    let keyContent = content;
    let keyInfo;
    
    // If file path is provided, read content from file
    if (file && !content) {
      keyContent = await fsPromises.readFile(file, 'utf8');
    }
    
    switch (source) {
      case 'file': {
        // Auto-detect key type
        if (keyContent.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----')) {
          // PGP key
          keyInfo = await pgpUtils.importPgpKey(keyContent);
          
          // Use provided name or derive from key
          const keyName = name || (keyInfo.email ? keyInfo.email : `pgp-${keyInfo.keyId.substring(keyInfo.keyId.length - 8)}`);
          
          // Store as PGP key
          const keyPath = await keyManager.addPgpKey(keyName, keyInfo);
          
          return {
            success: true,
            type: KEY_TYPES.PGP,
            name: keyName,
            fingerprint: keyInfo.keyId,
            email: keyInfo.email,
            path: keyPath
          };
        } else if (keyContent.includes('-----BEGIN PUBLIC KEY-----')) {
          // RSA key
          const keyName = name || 'imported-friend';
          const keyPath = await keyManager.addFriendKey(keyName, keyContent);
          
          // Get the fingerprint
          const db = await keyManager.loadKeyDatabase();
          const keyInfo = db.keys.friends[keyName];
          
          return {
            success: true,
            type: KEY_TYPES.RSA,
            name: keyName,
            fingerprint: keyInfo.fingerprint,
            path: keyPath
          };
        } else {
          throw new Error('Unsupported key format. Must be PGP or RSA public key');
        }
      }
      
      case 'pgp-server': {
        if (!email && !options.keyId) {
          throw new Error('Email or key ID is required for PGP server import');
        }
        
        const identifier = email || options.keyId;
        const customName = name || identifier;
        
        const result = await pgpUtils.addPgpKeyFromServer(identifier, customName);
        
        return {
          success: true,
          type: KEY_TYPES.PGP,
          name: result.name,
          email: result.email,
          fingerprint: result.keyId,
          path: result.path
        };
      }
      
      case 'keybase': {
        if (!username) {
          throw new Error('Username is required for Keybase import');
        }
        
        const customName = name || `keybase:${username}`;
        
        const result = await keybaseUtils.addKeybaseKey(username, customName, verify);
        
        return {
          success: true,
          type: KEY_TYPES.KEYBASE,
          name: result.name,
          username: result.keybaseUser,
          email: result.email,
          fingerprint: result.keyId,
          path: result.path
        };
      }
      
      case 'gpg-import': {
        if (!keyContent) {
          throw new Error('Key content is required for GPG import');
        }
        
        // Write key to temporary file
        const tempFile = path.join(
          await fsPromises.mkdtemp(path.join(homedir(), '.dedpaste-temp-')),
          'key.asc'
        );
        
        await fsPromises.writeFile(tempFile, keyContent);
        
        // Import key into GPG keyring
        const childProcess = await import('child_process');
        const { execFile } = childProcess;
        
        const execFilePromise = (cmd, args) => {
          return new Promise((resolve) => {
            execFile(cmd, args, (error, stdout, stderr) => {
              resolve({ error, stdout, stderr });
            });
          });
        };
        
        const importResult = await execFilePromise('gpg', ['--import', tempFile]);
        
        // Clean up temporary file
        try {
          await fsPromises.unlink(tempFile);
          await fsPromises.rmdir(path.dirname(tempFile));
        } catch (cleanupError) {
          console.error(`Warning: Failed to clean up temporary file: ${cleanupError.message}`);
        }
        
        if (importResult.error) {
          throw new Error(`GPG import failed: ${importResult.error.message}`);
        }
        
        // Extract key ID from import output
        const keyIdMatch = importResult.stderr.match(/key ([A-F0-9]+):/i);
        const keyId = keyIdMatch ? keyIdMatch[1] : 'unknown';
        
        return {
          success: true,
          type: KEY_TYPES.GPG,
          keyId: keyId,
          output: importResult.stderr
        };
      }
      
      case 'gpg-keyring': {
        if (!options.keyId) {
          throw new Error('Key ID is required for GPG keyring import');
        }
        
        // Export key from GPG keyring
        const exportedKey = await exportGpgKey(options.keyId, { armor: true });
        
        if (!exportedKey) {
          throw new Error(`Failed to export key ${options.keyId} from GPG keyring`);
        }
        
        // Import into our key database
        keyInfo = await pgpUtils.importPgpKey(exportedKey);
        
        // Use provided name or derive from key
        const keyName = name || (keyInfo.email ? keyInfo.email : `gpg-${keyInfo.keyId.substring(keyInfo.keyId.length - 8)}`);
        
        // Store as PGP key
        const keyPath = await keyManager.addPgpKey(keyName, {
          key: exportedKey,
          keyId: keyInfo.keyId,
          email: keyInfo.email
        });
        
        return {
          success: true,
          type: KEY_TYPES.PGP,
          name: keyName,
          fingerprint: keyInfo.keyId,
          email: keyInfo.email,
          path: keyPath,
          source: 'gpg-keyring'
        };
      }
      
      default:
        throw new Error(`Unsupported import source: ${source}`);
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate a new key pair
 * @param {Object} options - Key generation options
 * @returns {Promise<Object>} - Generation result
 */
async function generateKey(options = {}) {
  try {
    const result = await keyManager.generateKeyPair();
    
    return {
      success: true,
      type: KEY_TYPES.RSA,
      privateKeyPath: result.privateKeyPath,
      publicKeyPath: result.publicKeyPath
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Remove a key from the database
 * @param {string} id - Key identifier
 * @returns {Promise<Object>} - Removal result
 */
async function removeKey(id) {
  try {
    // Try to remove from any key collection
    const success = await keyManager.removeKey('any', id);
    
    return {
      success,
      message: success ? `Key '${id}' removed successfully` : `Key '${id}' not found`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get a printable report of all keys
 * @param {Object} options - Report options
 * @returns {Promise<string>} - Formatted report
 */
async function getKeyReport(options = {}) {
  try {
    const db = await keyManager.loadKeyDatabase();
    let report = '# DedPaste Key Report\n\n';
    
    // Self key
    report += '## Self Keys\n\n';
    if (db.keys.self) {
      report += `- Name: Self\n`;
      report += `  - Fingerprint: ${db.keys.self.fingerprint}\n`;
      report += `  - Created: ${new Date(db.keys.self.created).toLocaleString()}\n`;
      report += `  - Private key: ${db.keys.self.private}\n`;
      report += `  - Public key: ${db.keys.self.public}\n`;
    } else {
      report += '- No self key found. Generate one with `dedpaste keys --gen-key`\n';
    }
    
    // Friend keys
    const friendNames = Object.keys(db.keys.friends || {});
    if (friendNames.length > 0) {
      report += '\n## Friend Keys\n\n';
      for (const name of friendNames) {
        const friend = db.keys.friends[name];
        const lastUsed = friend.last_used ? new Date(friend.last_used).toLocaleString() : 'Never';
        
        report += `- Name: ${name}\n`;
        report += `  - Fingerprint: ${friend.fingerprint}\n`;
        report += `  - Last used: ${lastUsed}\n`;
        report += `  - Path: ${friend.public}\n`;
      }
    }
    
    // PGP keys
    const pgpNames = Object.keys(db.keys.pgp || {});
    if (pgpNames.length > 0) {
      report += '\n## PGP Keys\n\n';
      for (const name of pgpNames) {
        const pgp = db.keys.pgp[name];
        const lastUsed = pgp.last_used ? new Date(pgp.last_used).toLocaleString() : 'Never';
        
        report += `- Name: ${name}\n`;
        report += `  - Fingerprint: ${pgp.fingerprint}\n`;
        if (pgp.email) report += `  - Email: ${pgp.email}\n`;
        report += `  - Last used: ${lastUsed}\n`;
        report += `  - Path: ${pgp.path}\n`;
      }
    }
    
    // Keybase keys
    const keybaseNames = Object.keys(db.keys.keybase || {});
    if (keybaseNames.length > 0) {
      report += '\n## Keybase Keys\n\n';
      for (const name of keybaseNames) {
        const kb = db.keys.keybase[name];
        const lastUsed = kb.last_used ? new Date(kb.last_used).toLocaleString() : 'Never';
        
        report += `- Name: ${name}\n`;
        report += `  - Keybase username: ${kb.username}\n`;
        report += `  - Fingerprint: ${kb.fingerprint}\n`;
        if (kb.email) report += `  - Email: ${kb.email}\n`;
        report += `  - Last used: ${lastUsed}\n`;
        report += `  - Path: ${kb.path}\n`;
      }
    }
    
    // GPG keyring
    if (options.includeGpg) {
      const gpgInfo = await checkGpgKeyring();
      
      if (gpgInfo.available) {
        report += '\n## GPG Keyring\n\n';
        report += `- GPG version: ${gpgInfo.version}\n`;
        report += `- Total keys: ${gpgInfo.keys.length}\n\n`;
        
        if (gpgInfo.keys.length > 0) {
          for (const key of gpgInfo.keys) {
            const uid = key.uids.length > 0 ? key.uids[0].uid : 'No user ID';
            
            report += `- Key ID: ${key.id}\n`;
            report += `  - User: ${uid}\n`;
            if (key.created) report += `  - Created: ${new Date(key.created).toLocaleString()}\n`;
            if (key.expires) report += `  - Expires: ${new Date(key.expires).toLocaleString()}\n`;
            if (key.trust) report += `  - Trust: ${key.trust}\n`;
            report += '\n';
          }
        }
      }
    }
    
    return report;
  } catch (error) {
    return `Error generating key report: ${error.message}`;
  }
}

export {
  KEY_TYPES,
  initialize,
  searchKeys,
  getKeyById,
  readKeyContent,
  importKey,
  generateKey,
  removeKey,
  getKeyReport,
  exportGpgKey
};