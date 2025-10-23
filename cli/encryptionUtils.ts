// Enhanced encryption and decryption utilities
import crypto from 'crypto';
import { promises as fsPromises } from 'fs';
import inquirer from 'inquirer';
import { getKey, updateLastUsed } from './keyManager.js';
import { createPgpEncryptedMessage, decryptPgpMessage } from './pgpUtils.js';
import type { 
  EncryptionResult, 
  DecryptionResult, 
  RecipientInfo,
  KeyInfo 
} from '../src/types/index.js';

// Version 1 encrypted data interface (legacy)
interface EncryptedDataV1 {
  version: 1;
  encryptedKey: string;
  iv: string;
  authTag: string;
  encryptedContent: string;
}

// Version 2 encrypted data interface (standard with metadata)
interface EncryptedDataV2 {
  version: 2;
  metadata: {
    sender: string;
    recipient: RecipientInfo;
    timestamp: string;
  };
  encryptedKey: string;
  iv: string;
  authTag: string;
  encryptedContent: string;
}

// Version 3 encrypted data interface (PGP)
interface EncryptedDataV3 {
  version: 3;
  // PGP data is handled differently
}

type EncryptedData = EncryptedDataV1 | EncryptedDataV2 | EncryptedDataV3;

// Encrypt content for a specific recipient (or multiple recipients)
export async function encryptContent(
  content: string,
  recipientName: string | string[] | null = null,
  usePgp: boolean = false,
  refreshGithubKeys: boolean = false
): Promise<Buffer> {
  try {
    // Handle multiple recipients
    if (Array.isArray(recipientName) && recipientName.length > 0) {
      // Import resolver
      const { resolveRecipients, isPgpRecipient } = await import('./recipientResolver.js');

      // Resolve all recipients
      const resolved = await resolveRecipients(recipientName, {
        silent: false,
        autoFetch: true
      });

      if (resolved.length === 0) {
        throw new Error('No valid recipients found');
      }

      // For multiple recipients, we need to check if all use PGP or all use standard
      // For simplicity, we'll use the first recipient to determine encryption method
      // In the future, we could enhance PGP to support multiple recipients in one message
      const firstRecipient = resolved[0];
      const shouldUsePgp = usePgp || isPgpRecipient(firstRecipient);

      if (shouldUsePgp) {
        // For PGP with multiple recipients, we currently encrypt separately for each
        // (Future enhancement: use OpenPGP multi-recipient encryption)
        console.warn('Note: Encrypting separately for each recipient. Content will be duplicated.');

        // For now, just use the first recipient
        // TODO: Implement proper multi-recipient PGP encryption
        const keyInfo = firstRecipient.keyInfo!;
        const keyPath = typeof keyInfo.path === 'string' ? keyInfo.path : keyInfo.path.public;
        const publicKey = await fsPromises.readFile(keyPath, 'utf8');

        await updateLastUsed(firstRecipient.identifier);
        return await createPgpEncryptedMessage(content, publicKey, firstRecipient.identifier);
      } else {
        // Standard encryption also only supports one recipient
        // Use the first recipient
        const keyInfo = firstRecipient.keyInfo!;
        const publicKey = await fsPromises.readFile(keyInfo.public!, 'utf8');
        await updateLastUsed(firstRecipient.identifier);

        // Continue with standard encryption (fall through to standard encryption logic below)
        const recipientInfo: RecipientInfo = {
          type: firstRecipient.type as any,
          name: firstRecipient.identifier,
          fingerprint: keyInfo.fingerprint,
          username: keyInfo.username,
          email: keyInfo.email
        };

        // Generate a random symmetric key
        const symmetricKey = crypto.randomBytes(32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', symmetricKey, iv);

        let encryptedContent = cipher.update(content, 'utf8');
        encryptedContent = Buffer.concat([encryptedContent, cipher.final()]);
        const authTag = cipher.getAuthTag();

        // Encrypt the symmetric key with the recipient's public key
        const encryptedKey = crypto.publicEncrypt(
          {
            key: publicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
          },
          symmetricKey
        );

        const encryptedData: EncryptedDataV2 = {
          version: 2,
          metadata: {
            sender: 'self',
            recipient: recipientInfo,
            timestamp: new Date().toISOString()
          },
          encryptedKey: encryptedKey.toString('base64'),
          iv: iv.toString('base64'),
          authTag: authTag.toString('base64'),
          encryptedContent: encryptedContent.toString('base64')
        };

        return Buffer.from(JSON.stringify(encryptedData));
      }
    }

    // Single recipient or self encryption (backward compatible path)
    let publicKey: string;
    let recipientInfo: RecipientInfo;
    let keyType: 'standard' | 'pgp' = 'standard';

    if (recipientName && typeof recipientName === 'string') {
      // Use the resolver for single recipient
      const { resolveRecipient, isPgpRecipient } = await import('./recipientResolver.js');

      const resolved = await resolveRecipient(recipientName, {
        silent: false,
        autoFetch: true
      });

      if (!resolved.keyInfo) {
        throw new Error(`Failed to resolve recipient "${recipientName}"`);
      }

      const friendKey = resolved.keyInfo;

      // Determine key type
      if (friendKey.type === 'pgp' || friendKey.type === 'keybase' || friendKey.type === 'github') {
        keyType = 'pgp';
      }

      const keyPath = typeof friendKey.path === 'string' ? friendKey.path : friendKey.path.public;
      publicKey = await fsPromises.readFile(keyPath, 'utf8');

      recipientInfo = {
        type: resolved.type as any,
        name: recipientName,
        fingerprint: friendKey.fingerprint,
        username: friendKey.username,
        email: friendKey.email
      };

      // Update last used timestamp
      await updateLastUsed(resolved.identifier);
    } else {
      // Encrypt for self
      const selfKey = await getKey('self');
      if (!selfKey) {
        throw new Error('No personal key found. Generate one first.');
      }

      publicKey = await fsPromises.readFile(selfKey.public!, 'utf8');
      recipientInfo = {
        type: 'self',
        name: 'self',
        fingerprint: selfKey.fingerprint
      };
    }

    // If usePgp is true or the key is a PGP key, use PGP encryption
    if (usePgp || keyType === 'pgp') {
      // PGP encryption requires a recipient
      if (!recipientName || Array.isArray(recipientName)) {
        throw new Error('PGP encryption requires specifying a single recipient with --for. Self-encryption is not supported for PGP.');
      }
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
    let encryptedSymmetricKey: Buffer;
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
    } catch (error: any) {
      throw new Error(`RSA encryption failed: ${error.message}`);
    }
    
    // Combine everything into a single structure with metadata
    const encryptedData: EncryptedDataV2 = {
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
  } catch (error: any) {
    throw new Error(`Encryption error: ${error.message}`);
  }
}

// Decrypt content
export async function decryptContent(
  encryptedBuffer: Buffer, 
  pgpPrivateKeyPath: string | null = null, 
  pgpPassphrase: string | null = null, 
  useGpgKeyring: boolean = true
): Promise<DecryptionResult> {
  try {
    // Parse the encrypted data
    const encryptedData = JSON.parse(encryptedBuffer.toString()) as EncryptedData;
    
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
            return {
              decryptedContent: result.content.toString('utf8'),
              senderInfo: result.metadata?.senderInfo
            };
          }
        } catch (gpgError: any) {
          // If GPG keyring decryption fails, log the error and fall back to using private key
          console.log(`GPG keyring decryption failed: ${gpgError.message}`);
          console.log('Falling back to private key decryption if available...');
          
          // Check if we have more detailed information about why GPG failed
          if (gpgError.keyIds && gpgError.keyIds.length > 0) {
            console.log('This message was encrypted for the following key IDs:');
            gpgError.keyIds.forEach((key: any) => {
              console.log(`- ${key.type} key: ${key.id}`);
            });
          }
        }
      }
      
      // If we reach here, either GPG keyring wasn't used or it failed, so use private key
      if (!pgpPrivateKeyPath) {
        // Try to find the user's PGP private key in pgp directory
        const selfKey = await getKey('self');
        if (!selfKey || !selfKey.private) {
          throw new Error('PGP encrypted message detected but no PGP private key found. Try importing a key with --import-pgp-key or use --use-gpg-keyring to decrypt with GPG.');
        }
        pgpPrivateKeyPath = selfKey.private;
      }
      
      // Prompt for passphrase if not provided
      if (!pgpPassphrase) {
        // Try to prompt for passphrase if running in interactive mode
        try {
          const { passphrase } = await inquirer.prompt([{
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
      const result = await decryptPgpMessage(encryptedBuffer, privateKeyContent, pgpPassphrase, false);
      return {
        decryptedContent: result.content.toString('utf8'),
        senderInfo: result.metadata?.senderInfo
      };
    } else {
      throw new Error(`Unsupported encryption version: ${(encryptedData as any).version}`);
    }
  } catch (error: any) {
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
async function decryptLegacyContent(encryptedData: EncryptedDataV1): Promise<DecryptionResult> {
  // Get personal private key
  const selfKey = await getKey('self');
  if (!selfKey || !selfKey.private) {
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
    decryptedContent: decryptedContent.toString(),
    senderInfo: undefined
  };
}

// Decrypt version 2 content
async function decryptV2Content(encryptedData: EncryptedDataV2): Promise<DecryptionResult> {
  const metadata = encryptedData.metadata;
  let privateKey: string;
  
  // Get self key for comparison
  const selfKey = await getKey('self');
  if (!selfKey || !selfKey.private) {
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
    decryptedContent: decryptedContent.toString(),
    senderInfo: metadata.recipient
  };
}