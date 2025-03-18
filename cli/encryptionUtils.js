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
      // Check if the public key is in PEM format
      if (!publicKey.includes('-----BEGIN PUBLIC KEY-----') && 
          !publicKey.includes('-----BEGIN RSA PUBLIC KEY-----')) {
        console.log('Public key is not in expected PEM format, attempting to convert...');
        
        // Try to parse it as a PGP key and extract the RSA key
        if (publicKey.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----')) {
          throw new Error('PGP key detected. For PGP keys, use the --pgp flag to enable PGP encryption mode.');
        } else {
          throw new Error('Unsupported key format. Key must be in PEM format.');
        }
      }
      
      console.log('Using RSA encryption with PEM format public key');
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
async function decryptContent(encryptedBuffer, pgpPrivateKeyPath = null, pgpPassphrase = null, useGpgKeyring = true) {
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
      
      // If using GPG keyring is enabled, try that first without requiring a private key path
      if (useGpgKeyring) {
        try {
          console.log('Attempting to decrypt with system GPG keyring...');
          // We don't need a private key file or passphrase for this method
          const result = await decryptPgpMessage(encryptedBuffer, null, null, true);
          
          // If successful, return the result
          if (result && result.content) {
            return result;
          }
        } catch (gpgError) {
          // If GPG keyring decryption fails, log the error and fall back to using private key
          console.log(`GPG keyring decryption failed: ${gpgError.message}`);
          console.log('Falling back to private key decryption if available...');
          
          // Check if we have more detailed information about why GPG failed
          if (gpgError.keyIds && gpgError.keyIds.length > 0) {
            console.log('This message was encrypted for the following key IDs:');
            gpgError.keyIds.forEach(key => {
              console.log(`- ${key.type} key: ${key.id}`);
            });
          }
        }
      }
      
      // If we reach here, either GPG keyring wasn't used or it failed, so use private key
      if (!pgpPrivateKeyPath) {
        // Try to find the user's PGP private key in pgp directory
        const selfKey = await getKey('self', null, 'pgp');
        if (!selfKey) {
          throw new Error('PGP encrypted message detected but no PGP private key found. Try importing a key with --import-pgp-key or use --use-gpg-keyring to decrypt with GPG.');
        }
        pgpPrivateKeyPath = selfKey.private;
      }
      
      // Prompt for passphrase if not provided
      if (!pgpPassphrase) {
        // Try to prompt for passphrase if running in interactive mode
        try {
          const inquirer = await import('inquirer');
          const { passphrase } = await inquirer.default.prompt([{
            type: 'password',
            name: 'passphrase',
            message: 'Enter PGP key passphrase:',
            mask: '*'
          }]);
          
          pgpPassphrase = passphrase;
        } catch (promptError) {
          // If we can't prompt (e.g., non-interactive environment), throw error
          throw new Error('PGP passphrase required for decryption. Please provide with --pgp-passphrase option.');
        }
      }
      
      // Read the PGP private key
      const privateKeyContent = await fsPromises.readFile(pgpPrivateKeyPath, 'utf8');
      
      // Check for test mode
      if (pgpPassphrase === 'TEST_MODE') {
        console.log('Using TEST_MODE for PGP decryption');
      }
      
      // Decrypt with PGP using the provided private key
      return await decryptPgpMessage(encryptedBuffer, privateKeyContent, pgpPassphrase, false);
    } else {
      throw new Error(`Unsupported encryption version: ${encryptedData.version}`);
    }
  } catch (error) {
    // Enhance error message for common issues
    if (error.message.includes('Unexpected token') || error.message.includes('JSON')) {
      throw new Error('Invalid encrypted message format. This may not be a dedpaste encrypted message.');
    }
    
    if (error.message.includes('Bad passphrase')) {
      throw new Error('Incorrect passphrase for PGP key. Please try again with the correct passphrase.');
    }
    
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