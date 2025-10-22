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
import * as githubUtils from './githubUtils.js';
import { checkGpgKeyring, findKeysMatchingCriteria } from './keyDiagnostics.js';
import { KeyDatabase, KeyInfo } from '../src/types/index.js';

// Constants for key types
export const KEY_TYPES = {
  RSA: 'rsa',
  PGP: 'pgp',
  KEYBASE: 'keybase',
  GITHUB: 'github',
  GPG: 'gpg'
} as const;

// Extended types for unified key manager
export interface SearchOptions {
  skipSelf?: boolean;
  includeGpg?: boolean;
}

export interface KeyDetails {
  id: string;
  name: string;
  type: typeof KEY_TYPES[keyof typeof KEY_TYPES];
  fingerprint: string;
  created?: string | Date | null;
  lastUsed?: string | Date | null;
  source: 'self' | 'friend' | 'pgp' | 'keybase' | 'github' | 'gpg';
  path?: string | { public: string; private: string };
  email?: string;
  username?: string;
  expires?: string | Date;
  trust?: string;
  uids?: string[];
  gpgKey?: any;
  raw?: any;
}

export interface InitializationResult {
  success: boolean;
  directories?: any;
  database?: KeyDatabase;
  gpg?: any;
  error?: string;
}

export interface SearchResult extends KeyDetails {}

export interface ExecResult {
  error: Error | null;
  stdout: string;
  stderr: string;
}

export interface ImportOptions {
  source: 'file' | 'pgp-server' | 'keybase' | 'github' | 'gpg-import' | 'gpg-keyring';
  content?: string;
  name?: string;
  file?: string;
  email?: string;
  username?: string;
  keyId?: string;
  verify?: boolean;
}

export interface ImportResult {
  success: boolean;
  type?: typeof KEY_TYPES[keyof typeof KEY_TYPES];
  name?: string;
  fingerprint?: string;
  email?: string;
  username?: string;
  path?: string;
  keyId?: string;
  output?: string;
  source?: string;
  error?: string;
}

export interface GenerationResult {
  success: boolean;
  type?: typeof KEY_TYPES[keyof typeof KEY_TYPES];
  privateKeyPath?: string;
  publicKeyPath?: string;
  error?: string;
}

export interface RemovalResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ReadKeyOptions {
  private?: boolean;
  binary?: boolean;
  armor?: boolean;
}

export interface ReportOptions {
  includeGpg?: boolean;
}

/**
 * Initialize the key system
 * @returns Initialization result
 */
export async function initialize(): Promise<InitializationResult> {
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Search for keys with fuzzy matching
 * @param query - Search term
 * @param options - Search options
 * @returns Matching keys
 */
export async function searchKeys(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  try {
    const db = await keyManager.loadKeyDatabase();
    const results: SearchResult[] = [];
    
    // Prepare a regex for fuzzy searching
    // Escape special regex characters in the query
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Convert to a fuzzy pattern (allows characters between)
    const fuzzyPattern = escapedQuery.split('').join('.*');
    const regex = new RegExp(fuzzyPattern, 'i');
    
    // Helper function to check if a field matches the query
    const fieldMatches = (value: string | null | undefined): boolean => {
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
        const publicPath = typeof selfKey.path === 'object' ? selfKey.path.public : selfKey.public || '';
        results.push({
          id: 'self',
          name: selfName,
          type: KEY_TYPES.RSA,
          fingerprint: selfKey.fingerprint,
          created: selfKey.created,
          source: 'self',
          path: publicPath
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
        const publicPath = typeof info.path === 'string' ? info.path : info.public || '';
        results.push({
          id: name,
          name: name,
          type: KEY_TYPES.RSA,
          fingerprint: info.fingerprint,
          created: info.addedDate,
          lastUsed: info.lastUsed,
          source: 'friend',
          path: publicPath
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
        const keyPath = typeof info.path === 'string' ? info.path : '';
        results.push({
          id: name,
          name: name,
          type: KEY_TYPES.PGP,
          fingerprint: info.fingerprint,
          email: info.email,
          created: info.addedDate,
          lastUsed: info.lastUsed,
          source: 'pgp',
          path: keyPath
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
        const keyPath = typeof info.path === 'string' ? info.path : '';
        results.push({
          id: name,
          name: name,
          type: KEY_TYPES.KEYBASE,
          fingerprint: info.fingerprint,
          email: info.email,
          username: info.username,
          created: info.addedDate,
          lastUsed: info.lastUsed,
          source: 'keybase',
          path: keyPath
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
          const uidString = uidInfo.uid || 'Unknown';
          
          // Extract email from UID (if present)
          let email: string | null = null;
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
              email: email ?? undefined,
              created: key.created,
              expires: key.expires || undefined,
              trust: key.trust,
              uids: key.uids.map((u: any) => u.uid || ''),
              source: 'gpg',
              gpgKey: key
            });
          }
        }
      }
    }
    
    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error searching keys: ${errorMessage}`);
    return [];
  }
}

/**
 * Get a key by ID with full details
 * @param id - Key identifier
 * @param options - Options
 * @returns Key details or null if not found
 */
export async function getKeyById(id: string, options: SearchOptions = {}): Promise<KeyDetails | null> {
  try {
    // Handle special case for 'self'
    if (id === 'self') {
      const selfKey = await keyManager.getKey('self');
      
      if (!selfKey) {
        return null;
      }
      
      const publicPath = typeof selfKey.path === 'object' ? selfKey.path.public : selfKey.public || '';
      const privatePath = typeof selfKey.path === 'object' ? selfKey.path.private : selfKey.private || '';
      
      return {
        id: 'self',
        name: 'Self Key',
        type: KEY_TYPES.RSA,
        fingerprint: selfKey.fingerprint,
        created: selfKey.created,
        source: 'self',
        path: {
          public: publicPath,
          private: privatePath
        },
        raw: selfKey
      };
    }
    
    // Try to find in all collections
    const key = await keyManager.getKey('any', id);
    
    if (key) {
      // Determine the type and build response based on it
      if (key.type === 'pgp') {
        const keyPath = typeof key.path === 'string' ? key.path : '';
        return {
          id: id,
          name: id,
          type: KEY_TYPES.PGP,
          fingerprint: key.fingerprint,
          email: key.email,
          created: key.addedDate,
          lastUsed: key.lastUsed,
          source: 'pgp',
          path: keyPath,
          raw: key
        };
      } else if (key.type === 'keybase') {
        const keyPath = typeof key.path === 'string' ? key.path : '';
        return {
          id: id,
          name: id,
          type: KEY_TYPES.KEYBASE,
          fingerprint: key.fingerprint,
          email: key.email,
          username: key.username,
          created: key.addedDate,
          lastUsed: key.lastUsed,
          source: 'keybase',
          path: keyPath,
          raw: key
        };
      } else {
        // Regular friend key (RSA)
        const keyPath = typeof key.path === 'string' ? key.path : key.public || '';
        return {
          id: id,
          name: id,
          type: KEY_TYPES.RSA,
          fingerprint: key.fingerprint,
          created: key.addedDate,
          lastUsed: key.lastUsed,
          source: 'friend',
          path: keyPath,
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
          const uidString = uidInfo.uid || 'Unknown';
          
          // Extract email from UID (if present)
          let email: string | null = null;
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
            email: email || undefined,
            created: gpgKey.created,
            expires: gpgKey.expires || undefined,
            trust: gpgKey.trust,
            uids: gpgKey.uids.map((u: any) => u.uid || ''),
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error getting key by ID: ${errorMessage}`);
    return null;
  }
}

/**
 * Read key content from various sources
 * @param key - Key object from getKeyById or searchKeys
 * @param options - Options
 * @returns Key content or null on error
 */
export async function readKeyContent(key: KeyDetails, options: ReadKeyOptions = {}): Promise<string | null> {
  try {
    if (!key) return null;
    
    // Handle different key types and sources
    switch (key.type) {
      case KEY_TYPES.RSA:
        if (key.source === 'self') {
          // Read self key content based on options
          const keyPath = typeof key.path === 'object' 
            ? (options.private ? key.path.private : key.path.public)
            : String(key.path);
          return await fsPromises.readFile(keyPath, 'utf8');
        } else {
          // Read friend key content
          const keyPath = typeof key.path === 'string' ? key.path : '';
          return await fsPromises.readFile(keyPath, 'utf8');
        }
      
      case KEY_TYPES.PGP:
      case KEY_TYPES.KEYBASE:
        // Read PGP or Keybase key content
        const keyPath = typeof key.path === 'string' ? key.path : '';
        return await fsPromises.readFile(keyPath, 'utf8');
      
      case KEY_TYPES.GPG:
        // Export key from GPG keyring
        return await exportGpgKey(key.id, options);
      
      default:
        throw new Error(`Unsupported key type: ${key.type}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error reading key content: ${errorMessage}`);
    return null;
  }
}

/**
 * Export a key from GPG keyring
 * @param keyId - GPG key ID
 * @param options - Export options
 * @returns Exported key or null on error
 */
export async function exportGpgKey(keyId: string, options: ReadKeyOptions = {}): Promise<string | null> {
  try {
    // Import child_process dynamically
    const childProcess = await import('child_process');
    const { execFile } = childProcess;
    
    // Promisify execFile
    const execFilePromise = (cmd: string, args: string[]): Promise<ExecResult> => {
      return new Promise((resolve) => {
        execFile(cmd, args, (error, stdout, stderr) => {
          resolve({ error, stdout: stdout || '', stderr: stderr || '' });
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`GPG export error: ${errorMessage}`);
    return null;
  }
}

/**
 * Import a key from various sources
 * @param options - Import options
 * @returns Import result
 */
export async function importKey(options: ImportOptions): Promise<ImportResult> {
  try {
    const { source, content, name, file, email, username, verify = true } = options;
    
    let keyContent = content;
    let keyInfo: any;
    
    // If file path is provided, read content from file
    if (file && !content) {
      keyContent = await fsPromises.readFile(file, 'utf8');
    }
    
    switch (source) {
      case 'file': {
        if (!keyContent) {
          throw new Error('Key content is required for file import');
        }
        
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
        
        const identifier = email || options.keyId || '';
        const customName = name || identifier;
        
        const result = await pgpUtils.addPgpKeyFromServer(identifier, customName);
        
        return {
          success: true,
          type: KEY_TYPES.PGP,
          name: result.name,
          email: result.email ?? undefined,
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

      case 'github': {
        if (!username) {
          throw new Error('Username is required for GitHub import');
        }

        const customName = name || `github:${username}`;

        const result = await githubUtils.addGitHubKey(username, customName, verify);

        return {
          success: true,
          type: KEY_TYPES.GITHUB,
          name: result.name,
          username: username,
          email: result.email,
          fingerprint: result.fingerprint
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
        
        const execFilePromise = (cmd: string, args: string[]): Promise<ExecResult> => {
          return new Promise((resolve) => {
            execFile(cmd, args, (error, stdout, stderr) => {
              resolve({ error, stdout: stdout || '', stderr: stderr || '' });
            });
          });
        };
        
        const importResult = await execFilePromise('gpg', ['--import', tempFile]);
        
        // Clean up temporary file
        try {
          await fsPromises.unlink(tempFile);
          await fsPromises.rmdir(path.dirname(tempFile));
        } catch (cleanupError) {
          const errorMessage = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
          console.error(`Warning: Failed to clean up temporary file: ${errorMessage}`);
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Generate a new key pair
 * @param options - Key generation options
 * @returns Generation result
 */
export async function generateKey(options: any = {}): Promise<GenerationResult> {
  try {
    const result = await keyManager.generateKeyPair();
    
    return {
      success: true,
      type: KEY_TYPES.RSA,
      privateKeyPath: result.privateKeyPath,
      publicKeyPath: result.publicKeyPath
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Remove a key from the database
 * @param id - Key identifier
 * @returns Removal result
 */
export async function removeKey(id: string): Promise<RemovalResult> {
  try {
    // Try to remove from any key collection
    const success = await keyManager.removeKey('any', id);
    
    return {
      success,
      message: success ? `Key '${id}' removed successfully` : `Key '${id}' not found`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Get a printable report of all keys
 * @param options - Report options
 * @returns Formatted report
 */
export async function getKeyReport(options: ReportOptions = {}): Promise<string> {
  try {
    const db = await keyManager.loadKeyDatabase();
    let report = '# DedPaste Key Report\n\n';
    
    // Self key
    report += '## Self Keys\n\n';
    if (db.keys.self) {
      const selfKey = db.keys.self;
      const privatePath = typeof selfKey.path === 'object' ? selfKey.path.private : selfKey.private || '';
      const publicPath = typeof selfKey.path === 'object' ? selfKey.path.public : selfKey.public || '';
      
      report += `- Name: Self\n`;
      report += `  - Fingerprint: ${selfKey.fingerprint}\n`;
      report += `  - Created: ${new Date(selfKey.created || '').toLocaleString()}\n`;
      report += `  - Private key: ${privatePath}\n`;
      report += `  - Public key: ${publicPath}\n`;
    } else {
      report += '- No self key found. Generate one with `dedpaste keys --gen-key`\n';
    }
    
    // Friend keys
    const friendNames = Object.keys(db.keys.friends || {});
    if (friendNames.length > 0) {
      report += '\n## Friend Keys\n\n';
      for (const name of friendNames) {
        const friend = db.keys.friends[name];
        const lastUsed = friend.lastUsed ? new Date(friend.lastUsed).toLocaleString() : 'Never';
        const friendPath = typeof friend.path === 'string' ? friend.path : friend.public || '';
        
        report += `- Name: ${name}\n`;
        report += `  - Fingerprint: ${friend.fingerprint}\n`;
        report += `  - Last used: ${lastUsed}\n`;
        report += `  - Path: ${friendPath}\n`;
      }
    }
    
    // PGP keys
    const pgpNames = Object.keys(db.keys.pgp || {});
    if (pgpNames.length > 0) {
      report += '\n## PGP Keys\n\n';
      for (const name of pgpNames) {
        const pgp = db.keys.pgp[name];
        const lastUsed = pgp.lastUsed ? new Date(pgp.lastUsed).toLocaleString() : 'Never';
        const pgpPath = typeof pgp.path === 'string' ? pgp.path : '';
        
        report += `- Name: ${name}\n`;
        report += `  - Fingerprint: ${pgp.fingerprint}\n`;
        if (pgp.email) report += `  - Email: ${pgp.email}\n`;
        report += `  - Last used: ${lastUsed}\n`;
        report += `  - Path: ${pgpPath}\n`;
      }
    }
    
    // Keybase keys
    const keybaseNames = Object.keys(db.keys.keybase || {});
    if (keybaseNames.length > 0) {
      report += '\n## Keybase Keys\n\n';
      for (const name of keybaseNames) {
        const kb = db.keys.keybase[name];
        const lastUsed = kb.lastUsed ? new Date(kb.lastUsed).toLocaleString() : 'Never';
        const kbPath = typeof kb.path === 'string' ? kb.path : '';
        
        report += `- Name: ${name}\n`;
        report += `  - Keybase username: ${kb.username}\n`;
        report += `  - Fingerprint: ${kb.fingerprint}\n`;
        if (kb.email) report += `  - Email: ${kb.email}\n`;
        report += `  - Last used: ${lastUsed}\n`;
        report += `  - Path: ${kbPath}\n`;
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Error generating key report: ${errorMessage}`;
  }
}

// Aliases for compatibility
export const getKey = getKeyById;