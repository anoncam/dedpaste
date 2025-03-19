import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import functions from CLI for testing
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = path.join(__dirname, '..', 'cli', 'index.js');

// Mock functions to avoid direct imports
// In a real implementation, you would refactor the CLI to export these functions
const mockEncryptionFunctions = {
  // Generate a temporary key pair for testing
  generateTestKeyPair: () => {
    return crypto.generateKeyPairSync('rsa', {
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
  },

  // Simplified version of the encryption function from cli/index.js
  encryptContent: (content, publicKey) => {
    // Generate a random symmetric key
    const symmetricKey = crypto.randomBytes(32); // 256 bits for AES-256
    const iv = crypto.randomBytes(16); // 128 bits for AES IV
    
    // Encrypt the content with the symmetric key
    const cipher = crypto.createCipheriv('aes-256-gcm', symmetricKey, iv);
    let encryptedContent = cipher.update(content);
    encryptedContent = Buffer.concat([encryptedContent, cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    // Encrypt the symmetric key with the public key
    const encryptedSymmetricKey = crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      },
      symmetricKey
    );
    
    // Combine everything into a single structure
    const encryptedData = {
      version: 1, // For future compatibility
      encryptedKey: encryptedSymmetricKey.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      encryptedContent: encryptedContent.toString('base64')
    };
    
    // Return as JSON string
    return Buffer.from(JSON.stringify(encryptedData));
  },

  // Simplified version of the decryption function from cli/index.js
  decryptContent: (encryptedBuffer, privateKey) => {
    // Parse the encrypted data
    const encryptedData = JSON.parse(encryptedBuffer.toString());
    
    // Check version for compatibility
    if (encryptedData.version !== 1) {
      throw new Error(`Unsupported encryption version: ${encryptedData.version}`);
    }
    
    // Decrypt the symmetric key with the private key
    const encryptedSymmetricKey = Buffer.from(encryptedData.encryptedKey, 'base64');
    const symmetricKey = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      },
      encryptedSymmetricKey
    );
    
    // Decrypt the content with the symmetric key
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');
    const encryptedContent = Buffer.from(encryptedData.encryptedContent, 'base64');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', symmetricKey, iv);
    decipher.setAuthTag(authTag);
    let decryptedContent = decipher.update(encryptedContent);
    decryptedContent = Buffer.concat([decryptedContent, decipher.final()]);
    
    return decryptedContent;
  }
};

describe('Encryption Functionality', () => {
  let keyPair;
  
  before(() => {
    // Generate a test key pair
    keyPair = mockEncryptionFunctions.generateTestKeyPair();
  });
  
  describe('Unit Tests', () => {
    it('should encrypt and decrypt content correctly', () => {
      const originalContent = Buffer.from('This is a test message');
      
      // Encrypt the content
      const encryptedContent = mockEncryptionFunctions.encryptContent(
        originalContent, 
        keyPair.publicKey
      );
      
      // Verify the encrypted content is different from the original
      expect(encryptedContent.toString()).to.not.equal(originalContent.toString());
      
      // Decrypt the content
      const decryptedContent = mockEncryptionFunctions.decryptContent(
        encryptedContent, 
        keyPair.privateKey
      );
      
      // Verify the decrypted content matches the original
      expect(decryptedContent.toString()).to.equal(originalContent.toString());
    });
    
    it('should handle binary data correctly', () => {
      // Create some binary data (e.g., a small image or binary file)
      const binaryData = crypto.randomBytes(1024); // 1KB of random data
      
      // Encrypt the binary data
      const encryptedContent = mockEncryptionFunctions.encryptContent(
        binaryData, 
        keyPair.publicKey
      );
      
      // Decrypt the content
      const decryptedContent = mockEncryptionFunctions.decryptContent(
        encryptedContent, 
        keyPair.privateKey
      );
      
      // Verify the decrypted content matches the original binary data
      expect(Buffer.compare(decryptedContent, binaryData)).to.equal(0);
    });
    
    it('should fail to decrypt with the wrong key', () => {
      const originalContent = Buffer.from('This is a test message');
      
      // Encrypt the content
      const encryptedContent = mockEncryptionFunctions.encryptContent(
        originalContent, 
        keyPair.publicKey
      );
      
      // Generate a different key pair
      const wrongKeyPair = mockEncryptionFunctions.generateTestKeyPair();
      
      // Attempt to decrypt with the wrong private key should throw an error
      expect(() => {
        mockEncryptionFunctions.decryptContent(
          encryptedContent, 
          wrongKeyPair.privateKey
        );
      }).to.throw();
    });
  });
  
  describe('Security Tests', () => {
    it('should use a different IV for each encryption', () => {
      const content = Buffer.from('Same content');
      
      // Encrypt the same content twice
      const encrypted1 = mockEncryptionFunctions.encryptContent(content, keyPair.publicKey);
      const encrypted2 = mockEncryptionFunctions.encryptContent(content, keyPair.publicKey);
      
      // Parse the encrypted data
      const data1 = JSON.parse(encrypted1.toString());
      const data2 = JSON.parse(encrypted2.toString());
      
      // Verify that the IVs are different
      expect(data1.iv).to.not.equal(data2.iv);
      
      // Verify that the encrypted content is different
      expect(data1.encryptedContent).to.not.equal(data2.encryptedContent);
    });
    
    it('should use a different symmetric key for each encryption', () => {
      const content = Buffer.from('Same content');
      
      // Encrypt the same content twice
      const encrypted1 = mockEncryptionFunctions.encryptContent(content, keyPair.publicKey);
      const encrypted2 = mockEncryptionFunctions.encryptContent(content, keyPair.publicKey);
      
      // Parse the encrypted data
      const data1 = JSON.parse(encrypted1.toString());
      const data2 = JSON.parse(encrypted2.toString());
      
      // Verify that the encrypted symmetric keys are different
      expect(data1.encryptedKey).to.not.equal(data2.encryptedKey);
    });
    
    it('should verify the encrypted data format', () => {
      const content = Buffer.from('Test content');
      
      // Encrypt the content
      const encryptedContent = mockEncryptionFunctions.encryptContent(content, keyPair.publicKey);
      
      // Parse the encrypted data
      const data = JSON.parse(encryptedContent.toString());
      
      // Verify the structure of the encrypted data
      expect(data).to.have.property('version').that.equals(1);
      expect(data).to.have.property('encryptedKey').that.is.a('string');
      expect(data).to.have.property('iv').that.is.a('string');
      expect(data).to.have.property('authTag').that.is.a('string');
      expect(data).to.have.property('encryptedContent').that.is.a('string');
    });
    
    it('should handle key format requirements', () => {
      // This test verifies that the system properly handles different key formats
      
      // Create a mock SSH key
      const mockSshKey = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC0pA7JOJbfJlSr+5hTlR9UBUzL9P+3qFzUx+rKSQoLXvBmJr9D9mJ9lGpOJpErECTwTQJY9Nq1pqCWVUn7SK5K8XJmECJM8j7zOXoNJVN/vBOqwvJXxB9BLuMUOVjYT8s5sTZFgDVUhTzm8L3zcfqzL9KgvQUkTJ4co9n9FXMlw+vuHDJjQbFGzEyxYzEAEKmAl9fbQvTDGirk0k6daeWOL76QPhtUvsyLXueJcnzXzFXqMvXRhGLsWDL0l/vX/Lz9hIrKuMHAUNbSMKxB9fUP/wDzPE4Kzb9QLG+MxWiSPD9wK9yIQADDMU4dNp7fzJQjXaOgYyN3YS4G5K9 user@example.com';
      
      // Verify that the key format detection works
      expect(mockSshKey.startsWith('ssh-rsa ')).to.be.true;
      
      // In a real implementation, we would also test:
      // 1. That the system correctly identifies SSH keys
      // 2. That it offers to generate new keys when an SSH key is detected
      // 3. That the generated keys are in the correct PEM format
    });
  });

  describe('Temporary Paste Integration Tests', () => {
    // Note: These tests are not directly runnable as unit tests
    // They're documented here as integration test examples that should be performed manually
    
    it('should correctly handle encrypted temporary pastes', () => {
      // Integration test steps to manually verify:
      // 1. Create an encrypted temporary paste:
      //    echo "Secret temp content" | dedpaste --encrypt --temp
      // 2. Attempt to view the paste (first view):
      //    dedpaste get <paste-url>
      // 3. Verify it can be decrypted successfully
      // 4. Attempt to view the paste again (second view):
      //    dedpaste get <paste-url>
      // 5. Verify it returns 404 Not Found, confirming one-time paste functionality
      
      // This is a manual test as it requires actual server interaction
      console.log('Manual integration test: temporary encrypted pastes should be deleted after first view');
    });
  });
});

// Note: In a real implementation, you would also add integration tests that:
// 1. Test the CLI commands directly
// 2. Test the server endpoints with encrypted content
// 3. Test the end-to-end workflow from encryption to storage to retrieval to decryption