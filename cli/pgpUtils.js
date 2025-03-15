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
    // Parse the PGP key
    const publicKey = await openpgp.readKey({ armoredKey: pgpKeyString });
    
    // Extract the key data
    // Note: We need to get the primary key because a PGP key can have multiple subkeys
    const primaryKey = publicKey.keyPacket;
    
    // Check if it's an RSA key (type 1)
    if (primaryKey.algorithm !== 1) {
      throw new Error(`Unsupported key algorithm. Only RSA keys are supported for conversion.`);
    }
    
    // Extract the RSA components (n = modulus, e = exponent)
    const n = primaryKey.mpi[0].toString(16); // Convert to hex
    const e = primaryKey.mpi[1].toString(16); // Convert to hex
    
    // Format as ASN.1 DER structure for RSA public key
    // This follows the structure defined in RFC 3447 for RSA public keys
    const der = formatRsaPublicKeyToDer(n, e);
    
    // Base64 encode the DER and format as PEM
    const base64Der = Buffer.from(der).toString('base64');
    const pemKey = [
      '-----BEGIN PUBLIC KEY-----',
      ...base64Der.match(/.{1,64}/g), // Split into 64-character lines
      '-----END PUBLIC KEY-----'
    ].join('\n');
    
    return pemKey;
  } catch (error) {
    throw new Error(`Failed to convert PGP key to PEM: ${error.message}`);
  }
}

/**
 * Format RSA key components into DER format
 * @param {string} modulus - Key modulus in hex
 * @param {string} exponent - Key exponent in hex
 * @returns {Buffer} - DER formatted key
 */
function formatRsaPublicKeyToDer(modulus, exponent) {
  // Convert hex strings to Buffers
  const modulusBuffer = Buffer.from(modulus, 'hex');
  const exponentBuffer = Buffer.from(exponent, 'hex');
  
  // Create ASN.1 DER encoding for RSA public key
  // RSA public key is: SEQUENCE { modulus INTEGER, publicExponent INTEGER }
  
  // Prepare the modulus (ensure it has a leading zero if the high bit is set)
  let modulusDer = Buffer.from([0x02]); // INTEGER tag
  if (modulusBuffer[0] & 0x80) {
    const modulusLength = Buffer.from([modulusBuffer.length + 1]); // Length + 1 for the extra zero
    const modulusValue = Buffer.concat([Buffer.from([0x00]), modulusBuffer]); // Add leading zero
    modulusDer = Buffer.concat([modulusDer, modulusLength, modulusValue]);
  } else {
    const modulusLength = Buffer.from([modulusBuffer.length]); // Length
    modulusDer = Buffer.concat([modulusDer, modulusLength, modulusBuffer]);
  }
  
  // Prepare the exponent
  let exponentDer = Buffer.from([0x02]); // INTEGER tag
  if (exponentBuffer[0] & 0x80) {
    const exponentLength = Buffer.from([exponentBuffer.length + 1]); // Length + 1 for the extra zero
    const exponentValue = Buffer.concat([Buffer.from([0x00]), exponentBuffer]); // Add leading zero
    exponentDer = Buffer.concat([exponentDer, exponentLength, exponentValue]);
  } else {
    const exponentLength = Buffer.from([exponentBuffer.length]); // Length
    exponentDer = Buffer.concat([exponentDer, exponentLength, exponentBuffer]);
  }
  
  // Combine modulus and exponent into a SEQUENCE
  const rsaPublicKey = Buffer.concat([modulusDer, exponentDer]);
  const rsaPublicKeyLength = Buffer.from([rsaPublicKey.length]);
  const rsaPublicKeySequence = Buffer.concat([Buffer.from([0x30]), rsaPublicKeyLength, rsaPublicKey]); // SEQUENCE tag
  
  // RSA OID: 1.2.840.113549.1.1.1
  const rsaOid = Buffer.from([0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x01, 0x01]); // OID tag + length + value
  const nullParams = Buffer.from([0x05, 0x00]); // NULL tag + zero length
  
  // Combine OID and params into a SEQUENCE
  const algorithmIdentifier = Buffer.concat([rsaOid, nullParams]);
  const algorithmIdentifierLength = Buffer.from([algorithmIdentifier.length]);
  const algorithmIdentifierSequence = Buffer.concat([Buffer.from([0x30]), algorithmIdentifierLength, algorithmIdentifier]); // SEQUENCE tag
  
  // BIT STRING wrapping for the public key
  const bitStringTag = Buffer.from([0x03]); // BIT STRING tag
  const unusedBits = Buffer.from([0x00]); // Zero unused bits
  const keyWithUnused = Buffer.concat([unusedBits, rsaPublicKeySequence]);
  const bitStringLength = Buffer.from([keyWithUnused.length]);
  const bitString = Buffer.concat([bitStringTag, bitStringLength, keyWithUnused]);
  
  // Final SEQUENCE containing algorithmIdentifier and bitString
  const subjectPublicKeyInfo = Buffer.concat([algorithmIdentifierSequence, bitString]);
  const subjectPublicKeyInfoLength = Buffer.from([subjectPublicKeyInfo.length]);
  const subjectPublicKeyInfoSequence = Buffer.concat([Buffer.from([0x30]), subjectPublicKeyInfoLength, subjectPublicKeyInfo]); // SEQUENCE tag
  
  return subjectPublicKeyInfoSequence;
}

/**
 * Import personal PGP key for dedpaste use
 * @param {string} pgpPrivateKeyString - PGP private key 
 * @param {string} passphrase - Passphrase for the PGP key
 * @returns {Promise<Object>} - Key paths and info
 */
async function importPgpPrivateKey(pgpPrivateKeyString, passphrase) {
  try {
    // Decrypt the PGP private key
    const privateKey = await openpgp.decryptKey({
      privateKey: await openpgp.readPrivateKey({ armoredKey: pgpPrivateKeyString }),
      passphrase
    });
    
    // Extract the key ID
    const keyId = privateKey.getKeyId().toHex();
    
    // Extract user information
    const userId = privateKey.users[0].userId;
    const name = userId.name || 'unknown';
    const email = userId.email || null;
    
    // Get the primary key packet
    const primaryKey = privateKey.keyPacket;
    
    // Check if it's an RSA key
    if (primaryKey.algorithm !== 1) {
      throw new Error(`Unsupported key algorithm. Only RSA keys are supported for conversion.`);
    }
    
    // Extract the RSA components from the private key
    // n = modulus, e = public exponent, d = private exponent, p and q = prime factors,
    // u = multiplicative inverse of p mod q
    const n = primaryKey.mpi[0].toString(16); // modulus
    const e = primaryKey.mpi[1].toString(16); // public exponent
    const d = primaryKey.mpi[2].toString(16); // private exponent
    const p = primaryKey.mpi[3].toString(16); // prime1
    const q = primaryKey.mpi[4].toString(16); // prime2
    const u = primaryKey.mpi[5].toString(16); // coefficient
    
    // Calculate additional components required for PKCS#8
    // We need dp and dq, which are d mod (p-1) and d mod (q-1)
    const bigD = BigInt('0x' + d);
    const bigP = BigInt('0x' + p);
    const bigQ = BigInt('0x' + q);
    
    const dp = (bigD % (bigP - 1n)).toString(16);
    const dq = (bigD % (bigQ - 1n)).toString(16);
    
    // Format as PKCS#8 private key
    const pemKey = formatRsaPrivateKeyToPem(n, e, d, p, q, dp, dq, u);

    // Return the converted key info
    return {
      keyId,
      name,
      email,
      privateKey: pemKey,
      publicKey: await convertPgpKeyToPem(pgpPrivateKeyString)
    };
  } catch (error) {
    throw new Error(`Failed to import PGP private key: ${error.message}`);
  }
}

/**
 * Format RSA private key components into PEM format
 * @param {string} n - Modulus in hex
 * @param {string} e - Public exponent in hex
 * @param {string} d - Private exponent in hex
 * @param {string} p - First prime factor in hex
 * @param {string} q - Second prime factor in hex
 * @param {string} dp - d mod (p-1) in hex
 * @param {string} dq - d mod (q-1) in hex
 * @param {string} u - Coefficient (inverse of q mod p) in hex
 * @returns {string} - PEM formatted private key
 */
function formatRsaPrivateKeyToPem(n, e, d, p, q, dp, dq, u) {
  // For simplicity and reliability in a production environment,
  // we'll use the Node.js crypto module to generate a PEM key from
  // the extracted components
  
  // Convert hex strings to Buffers and BigInts for crypto operations
  const modulusBuffer = Buffer.from(n, 'hex');
  const publicExponentBuffer = Buffer.from(e, 'hex');
  const privateExponentBuffer = Buffer.from(d, 'hex');
  const prime1Buffer = Buffer.from(p, 'hex');
  const prime2Buffer = Buffer.from(q, 'hex');
  const exponent1Buffer = Buffer.from(dp, 'hex');
  const exponent2Buffer = Buffer.from(dq, 'hex');
  const coefficientBuffer = Buffer.from(u, 'hex');
  
  // Since Node.js crypto doesn't provide a direct way to create a key from components,
  // we need to format the components into a PKCS#1 RSAPrivateKey structure
  
  // Format ASN.1 DER for each component
  function formatDerInteger(buffer) {
    const tag = Buffer.from([0x02]); // INTEGER tag
    
    // Add leading zero if high bit is set
    let value = buffer;
    if (buffer[0] & 0x80) {
      value = Buffer.concat([Buffer.from([0x00]), buffer]);
    }
    
    // Calculate length
    let length;
    if (value.length < 128) {
      length = Buffer.from([value.length]);
    } else {
      // Handle longer lengths
      const lenBytes = Math.ceil(Math.log2(value.length) / 8);
      length = Buffer.alloc(lenBytes + 1);
      length[0] = 0x80 | lenBytes;
      value.length.toString(16).padStart(lenBytes * 2, '0').match(/.{2}/g).forEach((hex, i) => {
        length[i + 1] = parseInt(hex, 16);
      });
    }
    
    return Buffer.concat([tag, length, value]);
  }
  
  // ASN.1 DER encoding for PKCS#1 RSAPrivateKey
  // RSAPrivateKey ::= SEQUENCE {
  //   version           Version,
  //   modulus           INTEGER,  -- n
  //   publicExponent    INTEGER,  -- e
  //   privateExponent   INTEGER,  -- d
  //   prime1            INTEGER,  -- p
  //   prime2            INTEGER,  -- q
  //   exponent1         INTEGER,  -- d mod (p-1)
  //   exponent2         INTEGER,  -- d mod (q-1)
  //   coefficient       INTEGER,  -- (inverse of q) mod p
  //   otherPrimeInfos   OtherPrimeInfos OPTIONAL
  // }
  
  // Version (always 0 for two-prime RSA)
  const version = formatDerInteger(Buffer.from([0x00]));
  
  // Format all integers
  const modulusDer = formatDerInteger(modulusBuffer);
  const publicExponentDer = formatDerInteger(publicExponentBuffer);
  const privateExponentDer = formatDerInteger(privateExponentBuffer);
  const prime1Der = formatDerInteger(prime1Buffer);
  const prime2Der = formatDerInteger(prime2Buffer);
  const exponent1Der = formatDerInteger(exponent1Buffer);
  const exponent2Der = formatDerInteger(exponent2Buffer);
  const coefficientDer = formatDerInteger(coefficientBuffer);
  
  // Combine all elements into a SEQUENCE
  const sequence = Buffer.concat([
    version, 
    modulusDer, 
    publicExponentDer, 
    privateExponentDer, 
    prime1Der, 
    prime2Der, 
    exponent1Der, 
    exponent2Der, 
    coefficientDer
  ]);
  
  // Calculate sequence length
  let sequenceLength;
  if (sequence.length < 128) {
    sequenceLength = Buffer.from([sequence.length]);
  } else {
    // Handle longer lengths
    const lenBytes = Math.ceil(Math.log2(sequence.length) / 8);
    sequenceLength = Buffer.alloc(lenBytes + 1);
    sequenceLength[0] = 0x80 | lenBytes;
    sequence.length.toString(16).padStart(lenBytes * 2, '0').match(/.{2}/g).forEach((hex, i) => {
      sequenceLength[i + 1] = parseInt(hex, 16);
    });
  }
  
  // Add SEQUENCE tag and length
  const der = Buffer.concat([Buffer.from([0x30]), sequenceLength, sequence]);
  
  // Base64 encode and format as PEM
  const base64 = der.toString('base64');
  const pemLines = ['-----BEGIN RSA PRIVATE KEY-----'];
  // Split base64 into 64-character lines
  for (let i = 0; i < base64.length; i += 64) {
    pemLines.push(base64.substring(i, i + 64));
  }
  pemLines.push('-----END RSA PRIVATE KEY-----');
  
  return pemLines.join('\n');
}

/**
 * Directly encrypt content using PGP
 * @param {Buffer|string} content - Content to encrypt
 * @param {string} pgpPublicKeyString - PGP public key in armored format
 * @returns {Promise<Buffer>} - PGP encrypted content
 */
async function encryptWithPgp(content, pgpPublicKeyString) {
  try {
    // Read the public key
    const publicKey = await openpgp.readKey({ armoredKey: pgpPublicKeyString });
    
    // Convert Buffer to string if needed for openpgp compatibility
    let message;
    if (Buffer.isBuffer(content)) {
      // For binary data, use openpgp.Message.fromBinary
      message = await openpgp.createMessage({ binary: content });
    } else {
      // For text, use openpgp.Message.fromText
      message = await openpgp.createMessage({ text: content.toString() });
    }
    
    // Encrypt the content
    const encrypted = await openpgp.encrypt({
      message,
      encryptionKeys: publicKey,
      format: 'armored'
    });
    
    // Return the encrypted content as a buffer
    return Buffer.from(encrypted);
  } catch (error) {
    throw new Error(`PGP encryption failed: ${error.message}`);
  }
}

/**
 * Directly decrypt content using PGP
 * @param {Buffer|string} encryptedContent - PGP encrypted content
 * @param {string} pgpPrivateKeyString - PGP private key in armored format
 * @param {string} passphrase - Passphrase for the private key
 * @returns {Promise<Buffer>} - Decrypted content
 */
async function decryptWithPgp(encryptedContent, pgpPrivateKeyString, passphrase) {
  try {
    // Decode encrypted content if it's a buffer
    const encryptedMessage = await openpgp.readMessage({
      armoredMessage: encryptedContent.toString()
    });
    
    // Read and decrypt the private key
    const privateKey = await openpgp.decryptKey({
      privateKey: await openpgp.readPrivateKey({ armoredKey: pgpPrivateKeyString }),
      passphrase
    });
    
    // Decrypt the content
    const { data, signatures } = await openpgp.decrypt({
      message: encryptedMessage,
      decryptionKeys: privateKey
    });
    
    // Check signatures if available
    if (signatures && signatures.length > 0) {
      console.log('Message was signed');
      // In a full implementation, we would verify signatures here
    }
    
    // Return the decrypted content
    return Buffer.from(data);
  } catch (error) {
    throw new Error(`PGP decryption failed: ${error.message}`);
  }
}

/**
 * Creates a formatted JSON structure for dedpaste with PGP encrypted content
 * @param {Buffer|string} content - Content to encrypt
 * @param {string} pgpPublicKeyString - PGP public key in armored format
 * @param {string} recipientName - Name of the recipient
 * @returns {Promise<Buffer>} - Formatted encrypted data for dedpaste
 */
async function createPgpEncryptedMessage(content, pgpPublicKeyString, recipientName) {
  try {
    // Parse recipient key to get metadata
    const publicKey = await openpgp.readKey({ armoredKey: pgpPublicKeyString });
    const keyId = publicKey.getKeyId().toHex();
    const userId = publicKey.users[0]?.userId || {};
    const name = userId.name || recipientName || 'unknown';
    const email = userId.email || null;
    
    // Encrypt the content directly with PGP
    const encryptedContent = await encryptWithPgp(content, pgpPublicKeyString);
    
    // Create a structured format compatible with dedpaste
    const encryptedData = {
      version: 3, // New version for PGP format
      metadata: {
        sender: 'self',
        recipient: {
          type: 'pgp',
          name: recipientName || name,
          email: email,
          keyId: keyId,
          fingerprint: keyId, // Using keyId as fingerprint for compatibility
        },
        pgp: true,
        timestamp: new Date().toISOString()
      },
      // Store encrypted PGP message directly
      pgpEncrypted: encryptedContent.toString('base64')
    };
    
    // Return as JSON string
    return Buffer.from(JSON.stringify(encryptedData));
  } catch (error) {
    throw new Error(`PGP encryption formatting failed: ${error.message}`);
  }
}

/**
 * Decrypt PGP-formatted dedpaste content
 * @param {Buffer} encryptedBuffer - Encrypted dedpaste content
 * @param {string} pgpPrivateKeyString - PGP private key
 * @param {string} passphrase - Passphrase for the private key
 * @returns {Promise<Object>} - Decrypted content with metadata
 */
async function decryptPgpMessage(encryptedBuffer, pgpPrivateKeyString, passphrase) {
  try {
    // Parse the encrypted data
    const encryptedData = JSON.parse(encryptedBuffer.toString());
    
    // Check if it's a PGP-formatted message (version 3)
    if (encryptedData.version !== 3 || !encryptedData.pgpEncrypted) {
      throw new Error('Not a PGP-encrypted message');
    }
    
    // Extract the PGP encrypted content
    const pgpMessage = Buffer.from(encryptedData.pgpEncrypted, 'base64').toString();
    
    // Decrypt with PGP
    const decryptedContent = await decryptWithPgp(pgpMessage, pgpPrivateKeyString, passphrase);
    
    // Return the result
    return {
      content: decryptedContent,
      metadata: encryptedData.metadata
    };
  } catch (error) {
    throw new Error(`PGP message decryption failed: ${error.message}`);
  }
}

// Export functions
export {
  fetchPgpKey,
  importPgpKey,
  addPgpKeyFromServer,
  convertPgpKeyToPem,
  importPgpPrivateKey,
  encryptWithPgp,
  decryptWithPgp,
  createPgpEncryptedMessage,
  decryptPgpMessage
};