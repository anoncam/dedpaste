import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { promises as fsPromises } from 'fs';

// Import our modules
import {
  generateKeyPair,
  addFriendKey,
  listKeys,
  getKey,
  removeKey
} from '../cli/keyManager.js';

import {
  encryptContent,
  decryptContent
} from '../cli/encryptionUtils.js';

// Test directory for keys
const TEST_DIR = path.join(os.tmpdir(), 'dedpaste-test-' + Math.random().toString(36).substring(2, 10));

// We need to add this for Jest compatibility
global.jest = {
  mock: () => {},
  requireActual: () => {
    return {
      DEFAULT_KEY_DIR: path.join(TEST_DIR, 'keys'),
      FRIENDS_KEY_DIR: path.join(TEST_DIR, 'friends')
    };
  }
};

describe('Friend-to-Friend Encryption', () => {
  before(async () => {
    // Create test directories
    await fsPromises.mkdir(path.join(TEST_DIR, 'keys'), { recursive: true });
    await fsPromises.mkdir(path.join(TEST_DIR, 'friends'), { recursive: true });
  });

  after(async () => {
    // Clean up test directories
    await fsPromises.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('Key Management', () => {
    it('should generate a key pair', async () => {
      const { privateKeyPath, publicKeyPath } = await generateKeyPair();
      
      expect(fs.existsSync(privateKeyPath)).to.be.true;
      expect(fs.existsSync(publicKeyPath)).to.be.true;
      
      const privateKey = await fsPromises.readFile(privateKeyPath, 'utf8');
      const publicKey = await fsPromises.readFile(publicKeyPath, 'utf8');
      
      expect(privateKey).to.include('-----BEGIN PRIVATE KEY-----');
      expect(publicKey).to.include('-----BEGIN PUBLIC KEY-----');
    });
    
    it('should add a friend\'s key', async () => {
      // Generate a key pair for a "friend"
      const { publicKey } = await generateKeyPair();
      
      // Add the friend's key
      const keyPath = await addFriendKey('alice', publicKey);
      
      expect(fs.existsSync(keyPath)).to.be.true;
      
      // Check if the friend is in the database
      const db = await listKeys();
      expect(db.keys.friends).to.have.property('alice');
    });
    
    it('should list all keys', async () => {
      const db = await listKeys();
      
      expect(db.keys.self).to.not.be.null;
      expect(db.keys.friends).to.have.property('alice');
    });
    
    it('should get a specific key', async () => {
      const selfKey = await getKey('self');
      const friendKey = await getKey('friend', 'alice');
      
      expect(selfKey).to.not.be.null;
      expect(friendKey).to.not.be.null;
      expect(selfKey).to.have.property('public');
      expect(friendKey).to.have.property('public');
    });
    
    it('should remove a friend\'s key', async () => {
      const success = await removeKey('friend', 'alice');
      
      expect(success).to.be.true;
      
      const db = await listKeys();
      expect(db.keys.friends).to.not.have.property('alice');
    });
  });
  
  describe('Encryption and Decryption', () => {
    before(async () => {
      // Generate a key pair for self
      await generateKeyPair();
      
      // Generate a key pair for a "friend" and add it
      const { publicKey } = await crypto.generateKeyPairSync('rsa', {
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
      
      await addFriendKey('bob', publicKey);
    });
    
    it('should encrypt content for self', async () => {
      const originalContent = Buffer.from('This is a test message for myself');
      
      // Encrypt for self (no recipient specified)
      const encryptedContent = await encryptContent(originalContent);
      
      // Parse the encrypted data
      const encryptedData = JSON.parse(encryptedContent.toString());
      
      expect(encryptedData.version).to.equal(2);
      expect(encryptedData.metadata.recipient.type).to.equal('self');
    });
    
    it('should encrypt content for a friend', async () => {
      const originalContent = Buffer.from('This is a test message for Bob');
      
      // Encrypt for friend
      const encryptedContent = await encryptContent(originalContent, 'bob');
      
      // Parse the encrypted data
      const encryptedData = JSON.parse(encryptedContent.toString());
      
      expect(encryptedData.version).to.equal(2);
      expect(encryptedData.metadata.recipient.type).to.equal('friend');
      expect(encryptedData.metadata.recipient.name).to.equal('bob');
    });
    
    it('should decrypt content encrypted for self', async () => {
      const originalContent = Buffer.from('This is a test message for myself');
      
      // Encrypt for self
      const encryptedContent = await encryptContent(originalContent);
      
      // Decrypt
      const result = await decryptContent(encryptedContent);
      
      expect(result.content.toString()).to.equal(originalContent.toString());
      expect(result.metadata.recipient.type).to.equal('self');
    });
  });
});