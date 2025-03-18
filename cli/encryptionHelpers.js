// Enhanced encryption helpers for interactive mode
import inquirer from 'inquirer';
import chalk from 'chalk';
import * as unifiedKeyManager from './unifiedKeyManager.js';
import { encryptContent } from './encryptionUtils.js';

/**
 * Helper function to continue the encryption process with a selected recipient
 * @param {string} recipientId - The ID of the recipient
 * @param {string} message - The message to encrypt
 * @returns {Promise<Object>} - Operation result
 */
export async function continueWithEncryption(recipientId, message) {
  try {
    // Get the recipient key
    const recipientKey = await unifiedKeyManager.getKey(recipientId);
    
    if (!recipientKey) {
      return { success: false, message: 'Recipient key not found' };
    }
    
    // Temporary paste options
    const { isOneTime } = await inquirer.prompt([{
      type: 'confirm',
      name: 'isOneTime',
      message: 'Should this paste be viewable only once?',
      default: false
    }]);
    
    // Paste expiration options
    const { expiration } = await inquirer.prompt([{
      type: 'list',
      name: 'expiration',
      message: 'When should this paste expire?',
      choices: [
        { name: 'Never', value: 'never' },
        { name: '1 hour', value: '1h' },
        { name: '1 day', value: '1d' },
        { name: '1 week', value: '1w' },
        { name: '1 month', value: '1m' }
      ],
      default: 'never'
    }]);
    
    // Output format options
    const { outputFormat } = await inquirer.prompt([{
      type: 'list',
      name: 'outputFormat',
      message: 'How do you want to receive the result?',
      choices: [
        { name: 'Get URL only', value: 'url' },
        { name: 'Get URL and copy to clipboard', value: 'clipboard' },
        { name: 'Get encrypted content and URL', value: 'both' }
      ],
      default: 'url'
    }]);
    
    // Process upload options
    const uploadOptions = {
      encrypt: true,
      recipient: recipientKey,
      temp: isOneTime,
      expiry: expiration !== 'never' ? expiration : undefined,
      output: outputFormat !== 'url',
      copy: outputFormat === 'clipboard'
    };
    
    console.log(chalk.blue('\nEncrypting and uploading your paste...'));
    
    return {
      success: true,
      message: 'Paste sent successfully',
      uploadOptions,
      content: message
    };
  } catch (error) {
    console.error('Error during encryption:', error);
    return { success: false, message: `Error: ${error.message}` };
  }
}

/**
 * Safely export a GPG key with timeout protection
 * @param {string} keyId - The GPG key ID to export
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Object>} - Export result with key content or error
 */
export async function safeExportGpgKey(keyId, timeoutMs = 8000) {
  try {
    console.log(chalk.blue(`Exporting GPG key ${keyId} with timeout protection...`));
    
    // Set up a timeout for the export operation
    const exportPromise = unifiedKeyManager.exportGpgKey(keyId, { armor: true });
    
    const timeoutPromise = new Promise(resolve => {
      setTimeout(() => {
        resolve(null);
      }, timeoutMs);
    });
    
    // Race the export against the timeout
    const keyContent = await Promise.race([exportPromise, timeoutPromise]);
    
    if (keyContent === null) {
      console.log(chalk.yellow('GPG key export timed out'));
      return { success: false, timedOut: true };
    }
    
    if (!keyContent) {
      console.log(chalk.yellow('Failed to export GPG key - no content returned'));
      return { success: false, error: 'No key content returned' };
    }
    
    return { 
      success: true, 
      content: keyContent 
    };
  } catch (error) {
    console.error('Error exporting GPG key:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}
/**
 * Check GPG keyring with timeout protection
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Object>} - GPG info or timeout result
 */
export async function safeCheckGpgKeyring(timeoutMs = 5000) {
  try {
    const { checkGpgKeyring } = await import('./keyDiagnostics.js');
    
    // Create a race between the GPG check and a timeout
    const timeoutPromise = new Promise(resolve => {
      setTimeout(() => {
        resolve({ available: false, timedOut: true });
      }, timeoutMs);
    });
    
    // Race the actual check against the timeout
    const result = await Promise.race([checkGpgKeyring(), timeoutPromise]);
    
    // Normalize the result to ensure it has a consistent structure
    return {
      available: !!result.available,
      timedOut: !!result.timedOut,
      error: result.error || null,
      keys: Array.isArray(result.keys) ? result.keys : [],
      version: result.version || null
    };
  } catch (error) {
    console.error('Error in safeCheckGpgKeyring:', error);
    return { 
      available: false, 
      error: error.message,
      keys: [],
      timedOut: false,
      version: null
    };
  }
}
