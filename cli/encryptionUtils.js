// Enhanced encryption and decryption utilities
import crypto from 'crypto';
import { promises as fsPromises } from 'fs';
import { getKey, updateLastUsed } from './keyManager.js';
import { createPgpEncryptedMessage, decryptPgpMessage } from './pgpUtils.js';

// Encrypt content for a specific recipient
async function encryptContent(content, recipientName = null, usePgp = false) {
  try {
    let publicKey;
    let recipientInfo;
    let keyType = 'standard';
    
    if (recipientName) {
      // Try to find the key in any key store (friend, PGP, or Keybase)
      const friendKey = await getKey('any', recipientName);
      if (!friendKey) {
        throw new Error(`Recipient "${recipientName}" not found in key database`);
      }
      
      if (friendKey.type === 'pgp') {
        keyType = 'pgp';
        publicKey = await fsPromises.readFile(friendKey.path, 'utf8');
        
        recipientInfo = {
          type: 'pgp',
          name: recipientName,
          fingerprint: friendKey.fingerprint,
          email: friendKey.email
        };
      } else if (friendKey.type === 'keybase') {
        keyType = 'pgp'; // Keybase keys are also PGP keys
        publicKey = await fsPromises.readFile(friendKey.path, 'utf8');
        
        recipientInfo = {
          type: 'keybase',
          name: recipientName,
          fingerprint: friendKey.fingerprint,
          username: friendKey.username,
          email: friendKey.email
        };
      } else {
        // Standard RSA key
        publicKey = await fsPromises.readFile(friendKey.public, 'utf8');
        recipientInfo = {
          type: 'friend',
          name: recipientName,
          fingerprint: friendKey.fingerprint
        };
      }
      
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
    
    // If usePgp is true or the key is a PGP key, use PGP encryption
    if (usePgp || keyType === 'pgp') {
      return await createPgpEncryptedMessage(content, publicKey, recipientName);
    }
    
    // Otherwise use standard RSA/AES hybrid encryption
    // Generate a random symmetric key
    const symmetricKey = crypto.randomBytes(32); // 256 bits for AES-256
    const iv = crypto.randomBytes(16); // 128 bits for AES IV
    
    // Encrypt the content with the symmetric key
    const cipher = crypto.createCipheriv('aes-256-gcm', symmetricKey, iv);
    let encryptedContent = cipher.update(content);
    encryptedContent = Buffer.concat([encryptedContent, cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    // Encrypt the symmetric key with the recipient's public key
    let encryptedSymmetricKey;
    try {
      encryptedSymmetricKey = crypto.publicEncrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        },
        symmetricKey
      );
    } catch (error) {
      throw new Error(`RSA encryption failed: ${error.message}`);
    }
    
    // Combine everything into a single structure with metadata
    const encryptedData = {
      version: 2, // Standard version with metadata
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
async function decryptContent(encryptedBuffer, pgpPrivateKeyPath = null, pgpPassphrase = null) {
  try {
    // Parse the encrypted data
    const encryptedData = JSON.parse(encryptedBuffer.toString());
    
    // Handle different versions
    if (encryptedData.version === 1) {
      // Legacy format - try to decrypt with personal key
      return decryptLegacyContent(encryptedData);
    } else if (encryptedData.version === 2) {
      // Standard format with metadata
      return decryptV2Content(encryptedData);
    } else if (encryptedData.version === 3) {
      // PGP encrypted format
      if (!pgpPrivateKeyPath) {
        // Try to find the user's PGP private key in pgp directory
        const selfKey = await getKey('self', null, 'pgp');
        if (!selfKey) {
          throw new Error('PGP encrypted message detected but no PGP private key found.');
        }
        pgpPrivateKeyPath = selfKey.private;
      }
      
      // Prompt for passphrase if not provided
      if (!pgpPassphrase) {
        // In a CLI context, we'd prompt for the passphrase
        // For now we'll throw an error requesting it
        throw new Error('PGP passphrase required for decryption. Please provide with --pgp-passphrase option.');
      }
      
      // Read the PGP private key
      const privateKeyContent = await fsPromises.readFile(pgpPrivateKeyPath, 'utf8');
      
      // Decrypt with PGP
      return await decryptPgpMessage(encryptedBuffer, privateKeyContent, pgpPassphrase);
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
  
  // Get self key for comparison
  const selfKey = await getKey('self');
  if (!selfKey) {
    throw new Error('No personal key found for decryption');
  }
  
  // Determine which key to use
  if (metadata.recipient.type === 'self') {
    // Encrypted for self
    privateKey = await fsPromises.readFile(selfKey.private, 'utf8');
  } else if (metadata.recipient.type === 'friend' && metadata.recipient.name === 'self') {
    // Encrypted by a friend for us
    privateKey = await fsPromises.readFile(selfKey.private, 'utf8');
  } else if (metadata.recipient.fingerprint && metadata.recipient.fingerprint === selfKey.fingerprint) {
    // Fingerprint matches our key, even if the name doesn't match
    console.log(`Note: This paste was labeled for "${metadata.recipient.name}" but the fingerprint matches your key.`);
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