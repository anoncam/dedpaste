// Key database structure and management functions
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { homedir } from 'os';
import crypto from 'crypto';
import inquirer from 'inquirer';

// Constants
const DEFAULT_KEY_DIR = path.join(homedir(), '.dedpaste', 'keys');
const FRIENDS_KEY_DIR = path.join(homedir(), '.dedpaste', 'friends');
const KEY_DB_PATH = path.join(homedir(), '.dedpaste', 'keydb.json');

// Ensure directories exist
async function ensureDirectories() {
  await fsPromises.mkdir(DEFAULT_KEY_DIR, { recursive: true });
  await fsPromises.mkdir(FRIENDS_KEY_DIR, { recursive: true });
  return { DEFAULT_KEY_DIR, FRIENDS_KEY_DIR };
}

// Initialize key database if it doesn't exist
async function initKeyDatabase() {
  if (!fs.existsSync(KEY_DB_PATH)) {
    const defaultDb = {
      keys: {
        self: null,
        friends: {}
      },
      default_friend: null,
      last_used: null
    };
    
    await fsPromises.writeFile(KEY_DB_PATH, JSON.stringify(defaultDb, null, 2));
    return defaultDb;
  }
  
  return JSON.parse(await fsPromises.readFile(KEY_DB_PATH, 'utf8'));
}

// Load key database
async function loadKeyDatabase() {
  await ensureDirectories();
  return initKeyDatabase();
}

// Save key database
async function saveKeyDatabase(db) {
  await fsPromises.writeFile(KEY_DB_PATH, JSON.stringify(db, null, 2));
}

// Generate key fingerprint
function generateFingerprint(keyContent) {
  const hash = crypto.createHash('sha256');
  hash.update(keyContent);
  const digest = hash.digest('hex');
  
  // Format as colon-separated pairs
  return digest.match(/.{2}/g).join(':');
}

// Generate a new key pair
async function generateKeyPair() {
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
    private: privateKeyPath,
    public: publicKeyPath,
    fingerprint: generateFingerprint(publicKey),
    created: new Date().toISOString()
  };
  await saveKeyDatabase(db);
  
  return { privateKeyPath, publicKeyPath, privateKey, publicKey };
}

// Add a friend's public key
async function addFriendKey(name, keyContent) {
  const { FRIENDS_KEY_DIR } = await ensureDirectories();
  const keyPath = path.join(FRIENDS_KEY_DIR, `${name}.pem`);
  
  // Write key to file
  await fsPromises.writeFile(keyPath, keyContent);
  
  // Update key database
  const db = await loadKeyDatabase();
  db.keys.friends[name] = {
    public: keyPath,
    fingerprint: generateFingerprint(keyContent),
    added: new Date().toISOString(),
    last_used: new Date().toISOString()
  };
  
  // Set as default if it's the first friend
  if (!db.default_friend) {
    db.default_friend = name;
  }
  
  await saveKeyDatabase(db);
  return keyPath;
}

// List all keys
async function listKeys() {
  const db = await loadKeyDatabase();
  return db;
}

// Get a specific key
async function getKey(type, name) {
  const db = await loadKeyDatabase();
  
  if (type === 'self') {
    return db.keys.self;
  } else if (type === 'friend') {
    return db.keys.friends[name];
  }
  
  return null;
}

// Remove a key
async function removeKey(type, name) {
  const db = await loadKeyDatabase();
  
  if (type === 'friend' && db.keys.friends[name]) {
    // Remove the key file
    await fsPromises.unlink(db.keys.friends[name].public);
    
    // Remove from database
    delete db.keys.friends[name];
    
    // Update default friend if needed
    if (db.default_friend === name) {
      const friendNames = Object.keys(db.keys.friends);
      db.default_friend = friendNames.length > 0 ? friendNames[0] : null;
    }
    
    await saveKeyDatabase(db);
    return true;
  }
  
  return false;
}

// Update last used timestamp
async function updateLastUsed(name) {
  const db = await loadKeyDatabase();
  
  if (db.keys.friends[name]) {
    db.keys.friends[name].last_used = new Date().toISOString();
    db.last_used = name;
    await saveKeyDatabase(db);
  }
}

// Export functions
export {
  ensureDirectories,
  loadKeyDatabase,
  generateKeyPair,
  addFriendKey,
  listKeys,
  getKey,
  removeKey,
  updateLastUsed,
  DEFAULT_KEY_DIR,
  FRIENDS_KEY_DIR
};