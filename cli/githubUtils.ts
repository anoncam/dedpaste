// GitHub integration utilities
import fetch from 'node-fetch';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { importPgpKey } from './pgpUtils.js';
import { addGitHubKey as addGitHubKeyToManager } from './keyManager.js';
import type { GitHubUser } from '../src/types/index.js';

// GitHub URLs
const GITHUB_BASE_URL = 'https://github.com';
const GITHUB_API_URL = 'https://api.github.com';

/**
 * Fetch GitHub user's GPG public keys
 * Uses the simple .gpg endpoint for direct PGP import
 * @param username GitHub username
 * @returns PGP armored public key data
 */
export async function fetchGitHubGpgKey(username: string): Promise<string> {
  const url = `${GITHUB_BASE_URL}/${username}.gpg`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          `GitHub user "${username}" not found or has no GPG keys.\n` +
          `Users can add GPG keys at https://github.com/settings/keys`
        );
      }
      throw new Error(`Failed to fetch GPG key: ${response.status} ${response.statusText}`);
    }

    const keyData = await response.text();

    if (!keyData || keyData.trim().length === 0) {
      throw new Error(
        `User "${username}" has no GPG keys on GitHub.\n` +
        `GPG keys can be added at https://github.com/settings/keys`
      );
    }

    // Validate it looks like a PGP key
    if (!keyData.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----')) {
      throw new Error(
        `Invalid GPG key data received for user "${username}". ` +
        `Please ensure the user has a valid GPG key on GitHub.`
      );
    }

    return keyData;
  } catch (error: any) {
    if (error.message.includes('fetch failed') || error.code === 'ENOTFOUND') {
      throw new Error(
        `Network error: Unable to connect to GitHub. ` +
        `Please check your internet connection.`
      );
    }
    throw error;
  }
}

/**
 * Fetch GitHub user metadata
 * @param username GitHub username
 * @returns User information
 */
export async function fetchGitHubUser(username: string): Promise<GitHubUser> {
  const url = `${GITHUB_API_URL}/users/${username}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`GitHub user "${username}" not found`);
      }
      throw new Error(`Failed to fetch user info: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();

    return {
      username: data.login,
      name: data.name || undefined,
      bio: data.bio || undefined,
      location: data.location || undefined,
      publicRepos: data.public_repos,
      followers: data.followers,
      following: data.following,
      createdAt: data.created_at ? new Date(data.created_at) : undefined,
      updatedAt: data.updated_at ? new Date(data.updated_at) : undefined
    };
  } catch (error: any) {
    if (error.message.includes('fetch failed') || error.code === 'ENOTFOUND') {
      throw new Error(
        `Network error: Unable to connect to GitHub API. ` +
        `Please check your internet connection.`
      );
    }
    throw error;
  }
}

/**
 * Verify GitHub user exists and is active
 * @param username GitHub username
 * @returns true if user exists and is valid
 */
export async function verifyGitHubUser(username: string): Promise<boolean> {
  try {
    const user = await fetchGitHubUser(username);
    return !!user.username;
  } catch (error) {
    return false;
  }
}

/**
 * Main function: Fetch and add GitHub GPG key to local storage
 * @param username GitHub username
 * @param customName Optional custom name for the key
 * @param verify Whether to verify the user first
 * @param silent Whether to suppress console output
 */
export async function addGitHubKey(
  username: string,
  customName?: string,
  verify: boolean = false,
  silent: boolean = false
): Promise<{ name: string; fingerprint: string; email?: string }> {
  // Validate username
  if (!username || username.trim().length === 0) {
    throw new Error('GitHub username cannot be empty');
  }

  // Sanitize username (GitHub usernames are alphanumeric + hyphens)
  const sanitizedUsername = username.trim();
  if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(sanitizedUsername)) {
    throw new Error(
      `Invalid GitHub username: "${username}". ` +
      `Usernames can only contain alphanumeric characters and hyphens.`
    );
  }

  // Optional verification
  if (verify && !silent) {
    console.log(`Verifying GitHub user: ${sanitizedUsername}...`);
    const isValid = await verifyGitHubUser(sanitizedUsername);
    if (!isValid) {
      throw new Error(`Cannot verify GitHub user: ${sanitizedUsername}`);
    }
    console.log(`✓ User verified`);
  }

  // Fetch GPG key
  const gpgKeyData = await fetchGitHubGpgKey(sanitizedUsername);

  // Import and validate PGP key
  const keyInfo = await importPgpKey(gpgKeyData);

  // Generate key name
  const keyName = customName || `github:${sanitizedUsername}`;

  // Map the PGP key info to GitHub key format
  // importPgpKey returns keyId, but we use it as fingerprint for GitHub keys
  const githubKeyInfo = {
    fingerprint: keyInfo.keyId,
    email: keyInfo.email ?? undefined
  };

  // Add to key manager
  await addGitHubKeyToManager(keyName, sanitizedUsername, githubKeyInfo, gpgKeyData);

  if (!silent) {
    console.log(`✓ GitHub key added: ${keyName}`);
    console.log(`  Fingerprint: ${githubKeyInfo.fingerprint}`);
    if (githubKeyInfo.email) {
      console.log(`  Email: ${githubKeyInfo.email}`);
    }
  }

  return {
    name: keyName,
    fingerprint: githubKeyInfo.fingerprint,
    email: githubKeyInfo.email
  };
}

/**
 * Fetch GitHub key just-in-time (used during encryption)
 * Checks if key exists in database, fetches if not or if stale
 * @param username GitHub username (without github: prefix)
 * @param silent Whether to suppress console output
 * @param forceRefresh Whether to force refresh even if cached
 * @returns Key name and metadata
 */
export async function ensureGitHubKey(
  username: string,
  silent: boolean = false,
  forceRefresh: boolean = false
): Promise<{ name: string; fingerprint: string; email?: string }> {
  const keyName = `github:${username}`;

  // Check if key already exists
  const { getKey } = await import('./keyManager.js');
  const existingKey = await getKey('github', keyName);

  if (existingKey && !forceRefresh) {
    // Check if key is stale (older than 24 hours)
    const lastFetched = existingKey.lastFetched ? new Date(existingKey.lastFetched) : null;
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    const isStale = lastFetched ? (now.getTime() - lastFetched.getTime() > maxAge) : true;

    if (!isStale) {
      return {
        name: keyName,
        fingerprint: existingKey.fingerprint,
        email: existingKey.email
      };
    }
  }

  return await addGitHubKey(username, undefined, false, silent);
}
