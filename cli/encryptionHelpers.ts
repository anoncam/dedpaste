// Enhanced encryption helpers for interactive mode
import inquirer from 'inquirer';
import chalk from 'chalk';
import * as unifiedKeyManager from './unifiedKeyManager.js';
import { encryptContent } from './encryptionUtils.js';
import { KeyInfo } from '../src/types/index.js';

// Types for encryption helper functions
export interface EncryptionContinuationResult {
  success: boolean;
  message: string;
  uploadOptions?: UploadOptions;
  content?: string;
}

export interface UploadOptions {
  encrypt: boolean;
  recipient: any; // Using any for compatibility with existing KeyInfo interface
  temp: boolean;
  expiry?: string;
  output: boolean;
  copy: boolean;
}

export interface SafeExportResult {
  success: boolean;
  content?: string;
  timedOut?: boolean;
  error?: string;
}

export interface GpgKeyringCheckResult {
  available: boolean;
  timedOut: boolean;
  error: string | null;
  keys: Array<{
    id: string;
    type: string;
    created: string | null;
    expires: string | null;
    trust: string;
    uids: Array<{ uid?: string; trust?: string }>;
  }>;
  version: string | null;
}

/**
 * Helper function to continue the encryption process with a selected recipient
 * @param recipientId - The ID of the recipient
 * @param message - The message to encrypt
 * @returns Operation result
 */
export async function continueWithEncryption(
  recipientId: string, 
  message: string
): Promise<EncryptionContinuationResult> {
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
    }]) as { isOneTime: boolean };
    
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
    }]) as { expiration: string };
    
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
    }]) as { outputFormat: string };
    
    // Process upload options
    const uploadOptions: UploadOptions = {
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error during encryption:', error);
    return { success: false, message: `Error: ${errorMessage}` };
  }
}

/**
 * Safely export a GPG key with timeout protection
 * @param keyId - The GPG key ID to export
 * @param timeoutMs - Timeout in milliseconds
 * @returns Export result with key content or error
 */
export async function safeExportGpgKey(
  keyId: string, 
  timeoutMs: number = 8000
): Promise<SafeExportResult> {
  try {
    console.log(chalk.blue(`Exporting GPG key ${keyId} with timeout protection...`));
    
    // Set up a timeout for the export operation
    const exportPromise = unifiedKeyManager.exportGpgKey(keyId, { armor: true });
    
    const timeoutPromise = new Promise<null>(resolve => {
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error exporting GPG key:', error);
    return { 
      success: false, 
      error: errorMessage 
    };
  }
}

/**
 * Check GPG keyring with timeout protection
 * @param timeoutMs - Timeout in milliseconds
 * @returns GPG info or timeout result
 */
export async function safeCheckGpgKeyring(timeoutMs: number = 5000): Promise<GpgKeyringCheckResult> {
  try {
    const { checkGpgKeyring } = await import('./keyDiagnostics.js');
    
    // Create a race between the GPG check and a timeout
    const timeoutPromise = new Promise<GpgKeyringCheckResult>(resolve => {
      setTimeout(() => {
        resolve({ available: false, timedOut: true, error: null, keys: [], version: null });
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error in safeCheckGpgKeyring:', error);
    return { 
      available: false, 
      error: errorMessage,
      keys: [],
      timedOut: false,
      version: null
    };
  }
}