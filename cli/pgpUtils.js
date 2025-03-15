// PGP integration utilities
import * as openpgp from 'openpgp';
import fetch from 'node-fetch';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { addFriendKey, DEFAULT_KEY_DIR } from './keyManager.js';

// PGP keyserver URLs
const PGP_KEYSERVERS = [
  'https://keys.openpgp.org',
  'https://keyserver.ubuntu.com',
  'https://pgp.mit.edu'
];

/**
 * Fetch a PGP key from keyservers using email or key ID
 * @param {string} identifier - Email address or key ID
 * @returns {Promise<string>} - The PGP public key
 */
async function fetchPgpKey(identifier) {
  const errors = [];
  
  // Try each keyserver in sequence
  for (const server of PGP_KEYSERVERS) {
    try {
      const url = `${server}/pks/lookup?op=get&options=mr&search=${encodeURIComponent(identifier)}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const text = await response.text();
        // Check if response contains a valid PGP key
        if (text.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----')) {
          return text;
        } else {
          errors.push(`Server ${server} returned invalid key data`);
        }
      } else {
        errors.push(`Server ${server} returned: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      errors.push(`Error from ${server}: ${error.message}`);
    }
  }
  
  throw new Error(`Failed to fetch PGP key from all servers: ${errors.join('; ')}`);
}

/**
 * Import a PGP key and convert it to RSA format for dedpaste
 * @param {string} pgpKeyString - PGP public key text 
 * @returns {Promise<Object>} - Key info including name, email, keyId
 */
async function importPgpKey(pgpKeyString) {
  try {
    // Read the PGP key
    const publicKey = await openpgp.readKey({ armoredKey: pgpKeyString });
    
    // Extract user information
    const userId = publicKey.users[0].userId;
    const name = userId.name || 'unknown';
    const email = userId.email || null;
    const comment = userId.comment || null;
    
    // Get key ID
    const keyId = publicKey.getKeyId().toHex();
    
    // For now, simply store the PGP key as is
    // In a real implementation, we might want to extract the RSA key
    // or have dedicated PGP encryption/decryption
    
    return {
      type: 'pgp',
      name,
      email,
      comment,
      keyId,
      key: pgpKeyString
    };
  } catch (error) {
    throw new Error(`Failed to import PGP key: ${error.message}`);
  }
}

/**
 * Add a PGP key from a keyserver to the friend list
 * @param {string} identifier - Email or key ID to search for
 * @param {string} [friendName] - Optional custom name for the friend
 * @returns {Promise<Object>} - Result with key details
 */
async function addPgpKeyFromServer(identifier, friendName = null) {
  try {
    // Fetch the key from keyservers
    const pgpKeyString = await fetchPgpKey(identifier);
    
    // Import and parse the key
    const keyInfo = await importPgpKey(pgpKeyString);
    
    // Use provided name or derive from key
    const name = friendName || keyInfo.name || keyInfo.email || keyInfo.keyId;
    
    // Store the key in friends directory
    const result = await addFriendKey(name, pgpKeyString);
    
    return {
      name,
      email: keyInfo.email,
      keyId: keyInfo.keyId,
      path: result
    };
  } catch (error) {
    throw new Error(`Failed to add PGP key: ${error.message}`);
  }
}

/**
 * Convert PGP key to format usable with dedpaste
 * @param {string} pgpKeyString - PGP public key 
 * @returns {Promise<string>} - Converted key in PEM format
 */
async function convertPgpKeyToPem(pgpKeyString) {
  try {
    // This is a placeholder that would need a proper implementation
    // to extract the actual RSA key from the PGP key and format it as PEM
    
    // In a real implementation, we would:
    // 1. Parse the PGP key
    // 2. Extract the RSA public key component
    // 3. Format it as a PEM key that's compatible with crypto.publicEncrypt
    
    // For now, returning a placeholder to indicate this needs implementation
    throw new Error('PGP to PEM conversion not fully implemented yet');
  } catch (error) {
    throw new Error(`Failed to convert PGP key to PEM: ${error.message}`);
  }
}

/**
 * Import personal PGP key for dedpaste use
 * @param {string} pgpPrivateKeyString - PGP private key 
 * @param {string} passphrase - Passphrase for the PGP key
 * @returns {Promise<Object>} - Key paths and info
 */
async function importPgpPrivateKey(pgpPrivateKeyString, passphrase) {
  try {
    // This would need to:
    // 1. Decrypt the PGP private key
    // 2. Extract the RSA component
    // 3. Store it in the proper format for dedpaste
    
    // For now, just a placeholder
    throw new Error('PGP private key import not fully implemented yet');
  } catch (error) {
    throw new Error(`Failed to import PGP private key: ${error.message}`);
  }
}

// Export functions
export {
  fetchPgpKey,
  importPgpKey,
  addPgpKeyFromServer,
  convertPgpKeyToPem,
  importPgpPrivateKey
};