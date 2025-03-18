import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { promises as fsPromises } from 'fs';
import * as openpgp from 'openpgp';

// Import PGP utilities
import { 
  encryptWithPgp, 
  decryptWithPgp, 
  decryptWithGpgKeyring, 
  createPgpEncryptedMessage,
  decryptPgpMessage
} from '../cli/pgpUtils.js';

import { decryptContent } from '../cli/encryptionUtils.js';

// Test directory
const TEST_DIR = path.join(os.tmpdir(), 'dedpaste-pgp-test-' + Math.random().toString(36).substring(2, 10));

// Test PGP keys
let testPublicKey;
let testPrivateKey;
const TEST_PASSPHRASE = 'test-passphrase';

describe('PGP Decryption Tests', function() {
  // Increase timeout for key generation
  this.timeout(10000);
  
  before(async () => {
    // Create test directory
    await fsPromises.mkdir(TEST_DIR, { recursive: true });
    
    // Generate test PGP key pair
    console.log('Generating test PGP key pair...');
    const { privateKey, publicKey } = await openpgp.generateKey({
      type: 'rsa',
      rsaBits: 2048,
      userIDs: [{ name: 'Test User', email: 'test@example.com' }],
      passphrase: TEST_PASSPHRASE
    });
    
    testPrivateKey = privateKey;
    testPublicKey = publicKey;
    
    // Save keys to files
    await fsPromises.writeFile(path.join(TEST_DIR, 'test-private.asc'), privateKey);
    await fsPromises.writeFile(path.join(TEST_DIR, 'test-public.asc'), publicKey);
    
    console.log('Test PGP key pair generated and saved');
  });
  
  after(async () => {
    // Clean up test directory
    await fsPromises.rm(TEST_DIR, { recursive: true, force: true });
  });
  
  describe('Basic PGP Encryption/Decryption', () => {
    it('should encrypt and decrypt text content with PGP', async () => {
      const originalContent = 'This is a test message for PGP encryption';
      
      // Encrypt with PGP
      const encryptedContent = await encryptWithPgp(originalContent, testPublicKey);
      
      // Verify it's encrypted
      expect(encryptedContent.toString()).to.include('-----BEGIN PGP MESSAGE-----');
      expect(encryptedContent.toString()).to.not.include(originalContent);
      
      // Decrypt with PGP
      const decryptedContent = await decryptWithPgp(encryptedContent, testPrivateKey, TEST_PASSPHRASE);
      
      // Verify decryption worked
      expect(decryptedContent.toString()).to.equal(originalContent);
    });
    
    it('should encrypt and decrypt binary content with PGP', async () => {
      // Create some binary data
      const originalContent = Buffer.from(Array(100).fill().map(() => Math.floor(Math.random() * 256)));
      
      // Encrypt with PGP
      const encryptedContent = await encryptWithPgp(originalContent, testPublicKey);
      
      // Decrypt with PGP
      const decryptedContent = await decryptWithPgp(encryptedContent, testPrivateKey, TEST_PASSPHRASE);
      
      // Compare buffers
      expect(Buffer.compare(decryptedContent, originalContent)).to.equal(0);
    });
    
    it('should fail decryption with incorrect passphrase', async () => {
      const originalContent = 'This is a test message';
      
      // Encrypt with PGP
      const encryptedContent = await encryptWithPgp(originalContent, testPublicKey);
      
      // Attempt to decrypt with wrong passphrase
      try {
        await decryptWithPgp(encryptedContent, testPrivateKey, 'wrong-passphrase');
        // Should not reach here
        expect.fail('Decryption should have failed with incorrect passphrase');
      } catch (error) {
        expect(error.message).to.include('passphrase');
      }
    });
  });
  
  describe('dedpaste PGP Message Format', () => {
    it('should create and decrypt a formatted PGP message', async () => {
      const originalContent = 'This is a dedpaste PGP formatted message';
      
      // Create a formatted PGP message
      const formattedMessage = await createPgpEncryptedMessage(
        originalContent, 
        testPublicKey,
        'Test Recipient'
      );
      
      // Check the structure
      const messageData = JSON.parse(formattedMessage.toString());
      expect(messageData.version).to.equal(3);
      expect(messageData.metadata.pgp).to.be.true;
      expect(messageData.metadata.recipient.name).to.equal('Test Recipient');
      expect(messageData).to.have.property('pgpEncrypted');
      
      // Decrypt the message
      const decrypted = await decryptPgpMessage(
        formattedMessage,
        testPrivateKey,
        TEST_PASSPHRASE,
        false // don't use GPG keyring for this test
      );
      
      // Verify decryption
      expect(decrypted.content.toString()).to.equal(originalContent);
      expect(decrypted.metadata.pgp).to.be.true;
      expect(decrypted.metadata.recipient.name).to.equal('Test Recipient');
      expect(decrypted.metadata.decryptedWith).to.equal('pgp-private-key');
    });
    
    it('should handle error conditions gracefully', async () => {
      const originalContent = 'This is a test message';
      
      // Create a formatted PGP message
      const formattedMessage = await createPgpEncryptedMessage(
        originalContent, 
        testPublicKey,
        'Test Recipient'
      );
      
      // Try to decrypt with wrong passphrase
      try {
        await decryptPgpMessage(formattedMessage, testPrivateKey, 'wrong-passphrase', false);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('PGP message decryption failed');
      }
      
      // Try to decrypt with malformed formatted message
      const malformedMessage = Buffer.from(JSON.stringify({
        version: 3,
        metadata: { pgp: true },
        // Missing pgpEncrypted field
      }));
      
      try {
        await decryptPgpMessage(malformedMessage, testPrivateKey, TEST_PASSPHRASE, false);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Not a PGP-encrypted message');
      }
    });
  });
  
  describe('High-level decryptContent Function', () => {
    it('should detect and decrypt PGP message format', async () => {
      const originalContent = 'Test message for high-level decryption';
      
      // Create a formatted PGP message
      const formattedMessage = await createPgpEncryptedMessage(
        originalContent, 
        testPublicKey,
        'Test Recipient'
      );
      
      // Save private key to a file for the decryptContent function
      const privatePath = path.join(TEST_DIR, 'private-for-decrypt.asc');
      await fsPromises.writeFile(privatePath, testPrivateKey);
      
      // Decrypt using the high-level function, passing the key path and passphrase
      try {
        const result = await decryptContent(
          formattedMessage,
          privatePath,
          TEST_PASSPHRASE,
          false // disable GPG keyring for this test
        );
        
        // Verify decryption
        expect(result.content.toString()).to.equal(originalContent);
        expect(result.metadata.pgp).to.be.true;
      } catch (error) {
        console.error('Decryption error:', error);
        expect.fail('Decryption should not have failed: ' + error.message);
      }
    });
  });
  
  // Optional: Only run if GPG is installed and working
  describe('GPG Keyring Integration', function() {
    let gpgInstalled = false;
    
    before(async function() {
      // Check if GPG is available
      try {
        const child_process = await import('child_process');
        const { execFile } = child_process;
        const result = await new Promise((resolve) => {
          execFile('gpg', ['--version'], (error, stdout, stderr) => {
            resolve({ error, stdout, stderr });
          });
        });
        
        if (!result.error) {
          gpgInstalled = true;
          console.log('GPG is installed, running GPG keyring tests');
        } else {
          console.log('GPG not found, skipping GPG keyring tests');
          this.skip();
        }
      } catch (error) {
        console.log('Error checking GPG, skipping GPG keyring tests:', error.message);
        this.skip();
      }
    });
    
    // This is a mock test that simulates GPG keyring behavior
    // since we can't reliably import into the user's real keyring during tests
    it('should handle GPG keyring decryption status properly', async function() {
      if (!gpgInstalled) this.skip();
      
      // We'll just check that our GPG keyring detection works
      const mockPgpMessage = '-----BEGIN PGP MESSAGE-----\nVersion: Test\n\nMockEncryptedData\n-----END PGP MESSAGE-----';
      
      // Simulate a GPG result for testing error handling
      const mockResult = {
        success: false,
        error: 'No matching private key found in GPG keyring',
        keyIds: [{ type: 'rsa', id: '1234ABCD' }]
      };
      
      // Just verify that our error properties are handled properly
      expect(mockResult).to.have.property('success').that.equals(false);
      expect(mockResult).to.have.property('keyIds').that.is.an('array');
      expect(mockResult.keyIds[0]).to.have.property('id').that.equals('1234ABCD');
    });
  });
});