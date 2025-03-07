#!/usr/bin/env node

import fetch from 'node-fetch';
import crypto from 'crypto';

// Default API URL - can be changed via environment variable
const API_URL = process.env.DEDPASTE_API_URL || 'https://paste.d3d.dev';

// Function to create a temporary paste
async function createTempPaste(content) {
  const response = await fetch(`${API_URL}/temp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: content,
  });
  
  return await response.text();
}

// Function to fetch a paste
async function fetchPaste(url) {
  const response = await fetch(url);
  
  if (response.status === 404) {
    return { status: 404, content: 'Not found' };
  }
  
  return { 
    status: response.status,
    content: await response.text(),
    headers: Object.fromEntries(response.headers.entries())
  };
}

// Main function to test temporary paste functionality
async function testTempPaste() {
  console.log('Creating temporary paste...');
  const uniqueContent = `Test content ${crypto.randomBytes(8).toString('hex')}`;
  console.log(`Content: ${uniqueContent}`);
  
  const pasteUrl = await createTempPaste(uniqueContent);
  console.log(`Paste URL: ${pasteUrl}`);
  
  console.log('\nFetching paste for the first time...');
  const firstFetch = await fetchPaste(pasteUrl);
  console.log(`Status: ${firstFetch.status}`);
  console.log(`Content: ${firstFetch.content}`);
  console.log('Headers:', firstFetch.headers);
  
  console.log('\nWaiting 5 seconds...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('\nFetching paste for the second time...');
  const secondFetch = await fetchPaste(pasteUrl);
  console.log(`Status: ${secondFetch.status}`);
  console.log(`Content: ${secondFetch.content}`);
  
  if (secondFetch.status === 404) {
    console.log('\nSUCCESS: Temporary paste was deleted after viewing.');
  } else {
    console.log('\nFAILURE: Temporary paste still accessible after viewing.');
  }
}

// Debug fingerprints for encrypted pastes
async function debugPasteFingerprint(id) {
  try {
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
      console.log(JSON.stringify(encryptedData, null, 2));
    } catch (error) {
      console.error(`Error parsing encrypted data: ${error.message}`);
      console.error('This might not be a valid encrypted paste');
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

// Handle command-line arguments
const command = process.argv[2];
const arg = process.argv[3];

if (command === 'test-temp') {
  testTempPaste().catch(error => {
    console.error('Error:', error);
  });
} else if (command === 'debug-fingerprint' && arg) {
  debugPasteFingerprint(arg).catch(error => {
    console.error('Error:', error);
  });
} else {
  console.log('Usage:');
  console.log('  node debug-paste.js test-temp             Test temporary paste deletion');
  console.log('  node debug-paste.js debug-fingerprint ID  Debug encrypted paste fingerprint');
}