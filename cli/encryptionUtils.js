// Enhanced encryption and decryption utilities
import crypto from 'crypto';
import { promises as fsPromises } from 'fs';
import { getKey, updateLastUsed } from './keyManager.js';

// Encrypt content for a specific recipient
async function encryptContent(content, recipientName = null) {
  try {
    let publicKey;
    let recipientInfo;
    
    if (recipientName) {
      // Encrypt for a friend
      const friendKey = await getKey('friend', recipientName);
      if (!friendKey) {
        throw new Error(`Friend "${recipientName}" not found in key database`);
      }
      
      publicKey = await fsPromises.readFile(friendKey.public, 'utf8');
      recipientInfo = {
        type: 'friend',
        name: recipientName,
        fingerprint: friendKey.fingerprint
      };
      
      // Update last used timestamp
      await updateLastUsed(recipientName);
    } else {
      // Encrypt for self
      const selfKey = await getKey('self');
      if (!selfKey) {
        throw new Error('No personal key found. Generate one first.');
      }
      
      publicKey = await fsPromises.readFile(selfKey.public, 'utf8');
      recipientInfo = {
        type: 'self',
        fingerprint: selfKey.fingerprint
      };
    }
    
    // Generate a random symmetric key
    const symmetricKey = crypto.randomBytes(32); // 256 bits for AES-256
    const iv = crypto.randomBytes(16); // 128 bits for AES IV
    
    // Encrypt the content with the symmetric key
    const cipher = crypto.createCipheriv('aes-256-gcm', symmetricKey, iv);
    let encryptedContent = cipher.update(content);
    encryptedContent = Buffer.concat([encryptedContent, cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    // Encrypt the symmetric key with the recipient's public key
    const encryptedSymmetricKey = crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      },
      symmetricKey
    );
    
    // Combine everything into a single structure with metadata
    const encryptedData = {
      version: 2, // New version with metadata
      metadata: {
        sender: 'self',
        recipient: recipientInfo,
        timestamp: new Date().toISOString()
      },
      encryptedKey: encryptedSymmetricKey.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      encryptedContent: encryptedContent.toString('base64')
    };
    
    // Return as JSON string
    return Buffer.from(JSON.stringify(encryptedData));
  } catch (error) {
    throw new Error(`Encryption error: ${error.message}`);
  }
}

// Decrypt content
async function decryptContent(encryptedBuffer) {
  try {
    // Parse the encrypted data
    const encryptedData = JSON.parse(encryptedBuffer.toString());
    
    // Handle different versions
    if (encryptedData.version === 1) {
      // Legacy format - try to decrypt with personal key
      return decryptLegacyContent(encryptedData);
    } else if (encryptedData.version === 2) {
      // New format with metadata
      return decryptV2Content(encryptedData);
    } else {
      throw new Error(`Unsupported encryption version: ${encryptedData.version}`);
    }
  } catch (error) {
    throw new Error(`Decryption error: ${error.message}`);
  }
}

// Decrypt legacy content (version 1)
async function decryptLegacyContent(encryptedData) {
  // Get personal private key
  const selfKey = await getKey('self');
  if (!selfKey) {
    throw new Error('No personal key found for decryption');
  }
  
  const privateKey = await fsPromises.readFile(selfKey.private, 'utf8');
  
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
  
  return {
    content: decryptedContent,
    metadata: { version: 1, legacy: true }
  };
}

// Decrypt version 2 content
async function decryptV2Content(encryptedData) {
  const metadata = encryptedData.metadata;
  let privateKey;
  
  // Determine which key to use
  if (metadata.recipient.type === 'self') {
    // Encrypted for self
    const selfKey = await getKey('self');
    if (!selfKey) {
      throw new Error('No personal key found for decryption');
    }
    privateKey = await fsPromises.readFile(selfKey.private, 'utf8');
  } else if (metadata.recipient.type === 'friend' && metadata.recipient.name === 'self') {
    // Encrypted by a friend for us
    const selfKey = await getKey('self');
    if (!selfKey) {
      throw new Error('No personal key found for decryption');
    }
    privateKey = await fsPromises.readFile(selfKey.private, 'utf8');
  } else {
    throw new Error(`This paste was encrypted for ${metadata.recipient.name}, not for you`);
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
  
  return {
    content: decryptedContent,
    metadata: encryptedData.metadata
  };
}

// Export functions
export {
  encryptContent,
  decryptContent
};