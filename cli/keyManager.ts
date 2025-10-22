// Key database structure and management functions
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { homedir } from 'os';
import crypto from 'crypto';
import type { KeyInfo, KeyDatabase } from '../src/types/index.js';

// Constants
export const DEFAULT_KEY_DIR = path.join(homedir(), '.dedpaste', 'keys');
export const FRIENDS_KEY_DIR = path.join(homedir(), '.dedpaste', 'friends');
export const KEY_DB_PATH = path.join(homedir(), '.dedpaste', 'keydb.json');
export const PGP_KEY_DIR = path.join(homedir(), '.dedpaste', 'pgp');
export const KEYBASE_KEY_DIR = path.join(homedir(), '.dedpaste', 'keybase');
export const GITHUB_KEY_DIR = path.join(homedir(), '.dedpaste', 'github');

// Directory structure interface
interface KeyDirectories {
  DEFAULT_KEY_DIR: string;
  FRIENDS_KEY_DIR: string;
  PGP_KEY_DIR: string;
  KEYBASE_KEY_DIR: string;
  GITHUB_KEY_DIR: string;
}

// Ensure directories exist
export async function ensureDirectories(): Promise<KeyDirectories> {
  await fsPromises.mkdir(DEFAULT_KEY_DIR, { recursive: true });
  await fsPromises.mkdir(FRIENDS_KEY_DIR, { recursive: true });
  await fsPromises.mkdir(PGP_KEY_DIR, { recursive: true });
  await fsPromises.mkdir(KEYBASE_KEY_DIR, { recursive: true });
  await fsPromises.mkdir(GITHUB_KEY_DIR, { recursive: true });
  return { DEFAULT_KEY_DIR, FRIENDS_KEY_DIR, PGP_KEY_DIR, KEYBASE_KEY_DIR, GITHUB_KEY_DIR };
}

// Initialize key database if it doesn't exist
async function initKeyDatabase(): Promise<KeyDatabase> {
  if (!fs.existsSync(KEY_DB_PATH)) {
    const defaultDb: KeyDatabase = {
      keys: {
        self: null,
        friends: {},
        pgp: {},
        keybase: {},
        github: {}
      },
      default_friend: null,
      last_used: null
    };

    await fsPromises.writeFile(KEY_DB_PATH, JSON.stringify(defaultDb, null, 2));
    return defaultDb;
  }

  // Read existing database
  const dbContent = await fsPromises.readFile(KEY_DB_PATH, 'utf8');
  const db = JSON.parse(dbContent) as KeyDatabase;

  // Ensure new properties exist (for upgrades)
  if (!db.keys.pgp) {
    db.keys.pgp = {};
  }
  if (!db.keys.keybase) {
    db.keys.keybase = {};
  }
  if (!db.keys.github) {
    db.keys.github = {};
  }

  return db;
}

// Load key database
export async function loadKeyDatabase(): Promise<KeyDatabase> {
  await ensureDirectories();
  return initKeyDatabase();
}

// Save key database
export async function saveKeyDatabase(db: KeyDatabase): Promise<void> {
  await fsPromises.writeFile(KEY_DB_PATH, JSON.stringify(db, null, 2));
}

// Generate key fingerprint
function generateFingerprint(keyContent: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(keyContent);
  const digest = hash.digest('hex');
  
  // Format as colon-separated pairs
  const pairs = digest.match(/.{2}/g);
  return pairs ? pairs.join(':') : digest;
}

// Key pair generation result
interface KeyPairResult {
  privateKeyPath: string;
  publicKeyPath: string;
  privateKey: string;
  publicKey: string;
}

// Generate a new key pair
export async function generateKeyPair(): Promise<KeyPairResult> {
  const { DEFAULT_KEY_DIR } = await ensureDirectories();
  const privateKeyPath = path.join(DEFAULT_KEY_DIR, 'private.pem');
  const publicKeyPath = path.join(DEFAULT_KEY_DIR, 'public.pem');
  
  // Generate RSA key pair
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });
  
  // Write keys to files
  await fsPromises.writeFile(privateKeyPath, privateKey);
  await fsPromises.writeFile(publicKeyPath, publicKey);
  
  // Update key database
  const db = await loadKeyDatabase();
  db.keys.self = {
    type: 'self',
    name: 'self',
    path: publicKeyPath,
    private: privateKeyPath,
    public: publicKeyPath,
    fingerprint: generateFingerprint(publicKey),
    created: new Date().toISOString()
  };
  await saveKeyDatabase(db);
  
  return { privateKeyPath, publicKeyPath, privateKey, publicKey };
}

// Add a friend's public key
export async function addFriendKey(name: string, keyContent: string): Promise<string> {
  const { FRIENDS_KEY_DIR } = await ensureDirectories();
  const keyPath = path.join(FRIENDS_KEY_DIR, `${name}.pem`);
  
  // Write key to file
  await fsPromises.writeFile(keyPath, keyContent);
  
  // Update key database
  const db = await loadKeyDatabase();
  db.keys.friends[name] = {
    type: 'friend',
    name: name,
    path: keyPath,
    public: keyPath,
    fingerprint: generateFingerprint(keyContent),
    addedDate: new Date().toISOString(),
    lastUsed: new Date().toISOString()
  };
  
  // Set as default if it's the first friend
  if (!db.default_friend) {
    db.default_friend = name;
  }
  
  await saveKeyDatabase(db);
  return keyPath;
}

// List all keys
export async function listKeys(): Promise<KeyDatabase> {
  const db = await loadKeyDatabase();
  return db;
}

// Get a specific key
export async function getKey(type: string, name?: string): Promise<KeyInfo | null> {
  const db = await loadKeyDatabase();
  
  if (type === 'self') {
    return db.keys.self;
  } else if (type === 'friend' && name) {
    return db.keys.friends[name] || null;
  } else if (type === 'pgp' && name) {
    return db.keys.pgp[name] || null;
  } else if (type === 'keybase' && name) {
    return db.keys.keybase[name] || null;
  } else if (type === 'github' && name) {
    return db.keys.github[name] || null;
  } else if (type === 'any' && name) {
    // Try to find the key in any of the collections
    return db.keys.friends[name] ||
           db.keys.pgp[name] ||
           db.keys.keybase[name] ||
           db.keys.github[name] ||
           null;
  }

  return null;
}

// Remove a key
export async function removeKey(type: string, name: string): Promise<boolean> {
  const db = await loadKeyDatabase();
  
  if (type === 'friend' && db.keys.friends[name]) {
    // Remove the key file
    await fsPromises.unlink(db.keys.friends[name].public!);
    
    // Remove from database
    delete db.keys.friends[name];
    
    // Update default friend if needed
    if (db.default_friend === name) {
      const friendNames = Object.keys(db.keys.friends);
      db.default_friend = friendNames.length > 0 ? friendNames[0] : null;
    }
    
    await saveKeyDatabase(db);
    return true;
  } else if (type === 'pgp' && db.keys.pgp[name]) {
    // Remove the key file
    const pgpPath = typeof db.keys.pgp[name].path === 'string' ? db.keys.pgp[name].path : db.keys.pgp[name].path.public;
    await fsPromises.unlink(pgpPath);
    
    // Remove from database
    delete db.keys.pgp[name];
    
    await saveKeyDatabase(db);
    return true;
  } else if (type === 'keybase' && db.keys.keybase[name]) {
    // Remove the key file
    const keybasePath = typeof db.keys.keybase[name].path === 'string' ? db.keys.keybase[name].path : db.keys.keybase[name].path.public;
    await fsPromises.unlink(keybasePath);
    
    // Remove from database
    delete db.keys.keybase[name];
    
    await saveKeyDatabase(db);
    return true;
  } else if (type === 'github' && db.keys.github[name]) {
    // Remove the key file
    const githubPath = typeof db.keys.github[name].path === 'string' ? db.keys.github[name].path : db.keys.github[name].path.public;
    await fsPromises.unlink(githubPath);

    // Remove from database
    delete db.keys.github[name];

    await saveKeyDatabase(db);
    return true;
  } else if (type === 'any') {
    // Try to remove from any collection
    if (db.keys.friends[name]) {
      return await removeKey('friend', name);
    } else if (db.keys.pgp[name]) {
      return await removeKey('pgp', name);
    } else if (db.keys.keybase[name]) {
      return await removeKey('keybase', name);
    } else if (db.keys.github[name]) {
      return await removeKey('github', name);
    }
  }

  return false;
}

// Update last used timestamp
export async function updateLastUsed(name: string): Promise<void> {
  const db = await loadKeyDatabase();
  
  if (db.keys.friends[name]) {
    db.keys.friends[name].lastUsed = new Date().toISOString();
    db.last_used = name;
    await saveKeyDatabase(db);
  }
}

// PGP key information interface
interface PgpKeyAddInfo {
  key: string;
  keyId: string;
  email?: string;
}

/**
 * Add a PGP key to the database
 * @param name - Name for the key
 * @param keyInfo - Key information
 * @returns Path to the stored key
 */
export async function addPgpKey(name: string, keyInfo: PgpKeyAddInfo): Promise<string> {
  const { PGP_KEY_DIR } = await ensureDirectories();
  const keyPath = path.join(PGP_KEY_DIR, `${name}.asc`);
  
  // Write key to file
  await fsPromises.writeFile(keyPath, keyInfo.key);
  
  // Update key database
  const db = await loadKeyDatabase();
  db.keys.pgp[name] = {
    type: 'pgp',
    name: name,
    path: keyPath,
    fingerprint: keyInfo.keyId,
    email: keyInfo.email,
    addedDate: new Date().toISOString(),
    lastUsed: new Date().toISOString()
  };
  
  await saveKeyDatabase(db);
  return keyPath;
}

// Keybase key information interface
interface KeybaseKeyAddInfo {
  key: string;
  keyId: string;
  username: string;
  email?: string;
}

/**
 * Add a Keybase key to the database
 * @param name - Name for the key
 * @param keyInfo - Key information
 * @returns Path to the stored key
 */
export async function addKeybaseKey(name: string, keyInfo: KeybaseKeyAddInfo): Promise<string> {
  const { KEYBASE_KEY_DIR } = await ensureDirectories();
  const keyPath = path.join(KEYBASE_KEY_DIR, `${name}.asc`);

  // Write key to file
  await fsPromises.writeFile(keyPath, keyInfo.key);

  // Update key database
  const db = await loadKeyDatabase();
  db.keys.keybase[name] = {
    type: 'keybase',
    name: name,
    path: keyPath,
    username: keyInfo.username,
    fingerprint: keyInfo.keyId,
    email: keyInfo.email,
    addedDate: new Date().toISOString(),
    lastUsed: new Date().toISOString()
  };

  await saveKeyDatabase(db);
  return keyPath;
}

// GitHub key information interface
interface GitHubKeyAddInfo {
  fingerprint: string;
  email?: string;
  created?: Date;
  lastFetched?: string;
}

/**
 * Add a GitHub key to the database
 * @param name - Name for the key (e.g., "github:username")
 * @param username - GitHub username
 * @param keyInfo - Key information from PGP import
 * @param keyData - Raw PGP key data
 * @returns Path to the stored key
 */
export async function addGitHubKey(
  name: string,
  username: string,
  keyInfo: GitHubKeyAddInfo,
  keyData: string
): Promise<string> {
  const { GITHUB_KEY_DIR } = await ensureDirectories();
  const keyPath = path.join(GITHUB_KEY_DIR, `${name}.asc`);

  // Write key to file
  await fsPromises.writeFile(keyPath, keyData);

  // Update key database
  const db = await loadKeyDatabase();
  db.keys.github[name] = {
    type: 'github',
    name: name,
    path: keyPath,
    username: username,
    fingerprint: keyInfo.fingerprint,
    email: keyInfo.email,
    created: keyInfo.created,
    addedDate: new Date().toISOString(),
    lastUsed: new Date().toISOString(),
    lastFetched: keyInfo.lastFetched || new Date().toISOString()
  };

  await saveKeyDatabase(db);
  return keyPath;
}