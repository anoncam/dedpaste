#!/usr/bin/env node

import fetch from 'node-fetch';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { homedir } from 'os';

// Get the paste ID from command line arguments
const pasteId = process.argv[2];
if (!pasteId) {
  console.error('Please provide a paste ID');
  process.exit(1);
}

// Default API URL - can be changed via environment variable
const API_URL = process.env.DEDPASTE_API_URL || 'https://paste.d3d.dev';

// Path to key database
const KEY_DB_PATH = path.join(homedir(), '.dedpaste', 'keydb.json');

// Load key database
async function loadKeyDatabase() {
  try {
    return JSON.parse(await fsPromises.readFile(KEY_DB_PATH, 'utf8'));
  } catch (error) {
    console.error(`Error loading key database: ${error.message}`);
    return null;
  }
}

// Fetch and display paste metadata with fingerprint comparison
async function debugPasteMetadata(id) {
  try {
    // Load key database to compare fingerprints
    const keyDb = await loadKeyDatabase();
    if (!keyDb) {
      console.error('Could not load key database for fingerprint comparison');
      process.exit(1);
    }

    // Get self fingerprint
    const selfFingerprint = keyDb.keys.self ? keyDb.keys.self.fingerprint : null;
    
    // Determine the URL to fetch
    const fetchUrl = `${API_URL}/e/${id}`;
    
    // Fetch the paste
    console.log(`Fetching encrypted paste from ${fetchUrl}`);
    const response = await fetch(fetchUrl);
    
    if (!response.ok) {
      console.error(`Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(errorText);
      process.exit(1);
    }
    
    // Get the content
    const content = await response.arrayBuffer();
    const contentBuffer = Buffer.from(content);
    
    // Parse the encrypted data to extract metadata
    try {
      const encryptedData = JSON.parse(contentBuffer.toString());
      
      console.log('\nEncrypted Paste Metadata:');
      console.log('------------------------');
      
      // Display version
      console.log(`Version: ${encryptedData.version}`);
      
      // Display metadata if available
      if (encryptedData.metadata) {
        console.log('\nMetadata:');
        
        if (encryptedData.metadata.sender) {
          console.log(`Sender: ${encryptedData.metadata.sender}`);
        }
        
        if (encryptedData.metadata.recipient) {
          console.log('\nRecipient:');
          console.log(`  Type: ${encryptedData.metadata.recipient.type}`);
          if (encryptedData.metadata.recipient.name) {
            console.log(`  Name: ${encryptedData.metadata.recipient.name}`);
          }
          
          const pasteFingerprint = encryptedData.metadata.recipient.fingerprint;
          if (pasteFingerprint) {
            console.log(`  Fingerprint: ${pasteFingerprint}`);
            
            // Compare with self fingerprint
            if (selfFingerprint) {
              console.log(`\nYour fingerprint: ${selfFingerprint}`);
              if (pasteFingerprint === selfFingerprint) {
                console.log('\n✅ FINGERPRINT MATCH: This paste was encrypted with your public key!');
                console.log('   The name mismatch is causing the decryption error.');
              } else {
                console.log('\n❌ FINGERPRINT MISMATCH: This paste was not encrypted with your public key.');
                
                // Check if it matches any friend's fingerprint
                let matchFound = false;
                for (const [friendName, friendData] of Object.entries(keyDb.keys.friends || {})) {
                  if (friendData.fingerprint === pasteFingerprint) {
                    console.log(`   It matches the fingerprint of your friend: ${friendName}`);
                    matchFound = true;
                    break;
                  }
                }
                
                if (!matchFound) {
                  console.log('   It does not match any fingerprint in your key database.');
                }
              }
            } else {
              console.log('\nCould not find your fingerprint for comparison.');
            }
          }
        }
        
        if (encryptedData.metadata.timestamp) {
          console.log(`\nTimestamp: ${encryptedData.metadata.timestamp}`);
          console.log(`Created: ${new Date(encryptedData.metadata.timestamp).toLocaleString()}`);
        }
      } else {
        console.log('No metadata available (likely a version 1 encrypted paste)');
      }
      
    } catch (error) {
      console.error(`Error parsing encrypted data: ${error.message}`);
      console.error('This might not be a valid encrypted paste');
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

// Run the function
debugPasteMetadata(pasteId);