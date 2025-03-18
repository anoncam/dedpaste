#!/usr/bin/env node

import fetch from 'node-fetch';
import { generateKeyPair, encryptContent, decryptContent } from './cli/encryptionUtils.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createPgpEncryptedMessage } from './cli/pgpUtils.js';

// API URL for testing
const API_URL = process.env.DEDPASTE_API_URL || 'https://paste.d3d.dev';

// Test function to test temporary encrypted pastes
async function testTempEncryptedPaste(usePgp = false) {
  console.log(`\n🔍 Testing ${usePgp ? 'PGP' : 'standard'} encrypted temporary paste...`);
  
  // Create test content
  const testContent = Buffer.from(`Test content for temporary encrypted paste (${Date.now()})`);
  
  // Encrypt the content (we'll use self-encryption for testing)
  let encryptedContent;
  if (usePgp) {
    // For PGP we need a recipient, so we'll create a temporary one
    const tempKeyDir = path.join(os.tmpdir(), 'dedpaste-test-keys');
    fs.mkdirSync(tempKeyDir, { recursive: true });
    
    // Generate a test key pair
    console.log('Generating temporary PGP key pair for testing...');
    const { publicKeyPath, privateKeyPath } = await generateKeyPair(
      tempKeyDir, 'test-user', 'test@example.com'
    );
    
    // Read the keys
    const publicKey = fs.readFileSync(publicKeyPath, 'utf8');
    
    // Encrypt with PGP
    console.log('Encrypting content with PGP...');
    encryptedContent = await createPgpEncryptedMessage(testContent, publicKey, 'test-user');
  } else {
    // Standard encryption
    console.log('Encrypting content with standard RSA/AES...');
    encryptedContent = await encryptContent(testContent);
  }
  
  // Create temporary encrypted paste
  console.log('Creating temporary encrypted paste...');
  const endpoint = '/e/temp';
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: encryptedContent,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create paste: ${response.status} ${response.statusText}`);
  }
  
  const pasteUrl = await response.text();
  console.log(`✅ Temporary encrypted paste created: ${pasteUrl}`);
  
  // First retrieval should succeed
  console.log('\n🔍 First retrieval attempt (should succeed)...');
  const firstResponse = await fetch(pasteUrl);
  
  if (!firstResponse.ok) {
    throw new Error(`First retrieval failed: ${firstResponse.status} ${firstResponse.statusText}`);
  }
  
  console.log(`✅ First retrieval successful (HTTP ${firstResponse.status})`);
  console.log(`   Content-Type: ${firstResponse.headers.get('Content-Type')}`);
  
  // Wait a moment to ensure the paste is deleted on the server
  console.log('\n⏳ Waiting 3 seconds before second retrieval...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Second retrieval should fail with 404 Not Found
  console.log('\n🔍 Second retrieval attempt (should fail with 404)...');
  const secondResponse = await fetch(pasteUrl);
  
  console.log(`   Second retrieval status: HTTP ${secondResponse.status}`);
  
  if (secondResponse.status === 404) {
    console.log('✅ Success: Temporary paste was properly deleted after first view');
    return true;
  } else {
    console.log('❌ Error: Temporary paste was NOT deleted after first view');
    console.log(`   Expected status 404, got ${secondResponse.status}`);
    
    // Get the content to verify
    const content = await secondResponse.text();
    console.log(`   Content length: ${content.length}`);
    
    return false;
  }
}

// Run both tests
async function runTests() {
  try {
    console.log('🧪 Starting temporary encrypted paste tests...');
    
    // Test standard encryption
    const standardResult = await testTempEncryptedPaste(false);
    
    // Test PGP encryption 
    const pgpResult = await testTempEncryptedPaste(true);
    
    // Summarize results
    console.log('\n📊 Test Results:');
    console.log(`   Standard Encryption: ${standardResult ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   PGP Encryption:     ${pgpResult ? '✅ PASS' : '❌ FAIL'}`);
    
  } catch (error) {
    console.error(`❌ Test failed with error: ${error.message}`);
    console.error(error);
  }
}

// Run the tests
runTests();