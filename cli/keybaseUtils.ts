// Keybase integration utilities
import fetch from 'node-fetch';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { addFriendKey } from './keyManager.js';
import { importPgpKey } from './pgpUtils.js';
import { KeybaseUser, KeybaseProof } from '../src/types/index.js';

// Keybase API URL
const KEYBASE_API_URL = 'https://keybase.io/_/api/1.0';

// Keybase API response types
interface KeybaseApiStatus {
  code: number;
  desc?: string;
  name?: string;
}

interface KeybaseApiResponse<T = any> {
  status: KeybaseApiStatus;
  them?: T;
}

interface KeybaseUserData {
  id: string;
  basics?: {
    username: string;
    ctime?: number;
    mtime?: number;
    id_version?: number;
    track_version?: number;
    last_id_change?: number;
    username_cased?: string;
  };
  profile?: {
    mtime?: number;
    full_name?: string;
    location?: string;
    bio?: string;
  };
  public_keys?: {
    primary?: {
      kid: string;
      key_fingerprint: string;
      key_bits?: number;
      key_algo?: number;
      signing_kid?: string;
      key_level?: number;
      etime?: number;
      eldest_kid?: string;
      bundle: string;
      mtime?: number;
      ctime?: number;
      ukbid?: string;
      key_type?: number;
      key_id?: string;
    };
    all_bundles?: string[];
  };
  proofs_summary?: {
    by_presentation_group?: Record<string, {
      tag: string;
      id: string;
      proof_type: string;
      nametag: string;
      state: number;
      proof_url?: string;
      sig_id?: string;
      proof_id?: string;
      human_url?: string;
      service_url?: string;
      presentation_group?: string;
      presentation_tag?: string;
    }[]>;
    all?: Array<{
      proof_type: string;
      nametag: string;
      state: number;
      proof_url?: string;
      sig_id?: string;
      proof_id?: string;
      human_url?: string;
      service_url?: string;
      presentation_group?: string;
      presentation_tag?: string;
    }>;
  };
  cryptocurrency_addresses?: Record<string, Array<{
    address: string;
    sig_id?: string;
  }>>;
  sigs?: {
    last?: {
      sig_id?: string;
      seqno?: number;
      payload_hash?: string;
    };
  };
  devices?: Record<string, {
    type: string;
    ctime: number;
    mtime: number;
    name: string;
    status: number;
    keys?: Array<{
      kid: string;
      key_role: number;
      sig_id: string;
    }>;
  }>;
}

interface KeybaseProofSummary {
  by_presentation_group?: Record<string, KeybaseProof[]>;
  all?: KeybaseProof[];
}

interface AddKeybaseKeyResult {
  name: string;
  username: string;
  keybaseUser: string;
  email?: string;
  keyId: string;
  path: string;
}

/**
 * Fetch user information from Keybase
 * @param username - Keybase username
 * @returns User information
 */
async function fetchKeybaseUser(username: string): Promise<KeybaseUserData> {
  try {
    const url = `${KEYBASE_API_URL}/user/lookup.json?username=${encodeURIComponent(username)}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Keybase API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as KeybaseApiResponse<KeybaseUserData>;
    
    if (!data.status || data.status.code !== 0) {
      throw new Error(`Keybase API error: ${data.status?.desc || 'Unknown error'}`);
    }
    
    if (!data.them) {
      throw new Error(`User '${username}' not found on Keybase`);
    }
    
    return data.them;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch Keybase user: ${message}`);
  }
}

/**
 * Fetch public key for a Keybase user
 * @param username - Keybase username
 * @returns PGP public key text
 */
async function fetchKeybasePgpKey(username: string): Promise<string> {
  try {
    const url = `${KEYBASE_API_URL}/user/lookup.json?username=${encodeURIComponent(username)}&fields=public_keys`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Keybase API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as KeybaseApiResponse<KeybaseUserData>;
    
    if (!data.status || data.status.code !== 0) {
      throw new Error(`Keybase API error: ${data.status?.desc || 'Unknown error'}`);
    }
    
    if (!data.them) {
      throw new Error(`User '${username}' not found on Keybase`);
    }
    
    const publicKeys = data.them.public_keys;
    
    // Check for PGP key
    if (!publicKeys || !publicKeys.primary || !publicKeys.primary.bundle) {
      throw new Error(`No PGP key found for user '${username}'`);
    }
    
    return publicKeys.primary.bundle;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch Keybase PGP key: ${message}`);
  }
}

/**
 * Verify a Keybase user's proofs
 * @param username - Keybase username
 * @returns Verification results
 */
async function verifyKeybaseProofs(username: string): Promise<KeybaseProofSummary> {
  try {
    const url = `${KEYBASE_API_URL}/user/lookup.json?username=${encodeURIComponent(username)}&fields=proofs_summary`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Keybase API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as KeybaseApiResponse<KeybaseUserData>;
    
    if (!data.them || !data.them.proofs_summary) {
      throw new Error(`No proofs found for user '${username}'`);
    }
    
    // Return the proof summary
    return data.them.proofs_summary as KeybaseProofSummary;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to verify Keybase proofs: ${message}`);
  }
}

/**
 * Add a Keybase user's PGP key to friend list
 * @param username - Keybase username
 * @param friendName - Optional custom name for the friend
 * @param verify - Whether to verify proofs 
 * @returns Result with key details
 */
async function addKeybaseKey(
  username: string, 
  friendName: string | null = null, 
  verify: boolean = true
): Promise<AddKeybaseKeyResult> {
  try {
    // Verify the user's proofs if requested
    if (verify) {
      const proofs = await verifyKeybaseProofs(username);
      
      // Check if user has at least one verified proof
      const hasVerifiedProofs = Object.values(proofs.all || []).some(
        (proof: any) => proof.state === 1
      );
      
      if (!hasVerifiedProofs) {
        throw new Error(`User '${username}' has no verified proofs on Keybase. Use verify=false to bypass this check.`);
      }
    }
    
    // Fetch the user's PGP key
    const pgpKey = await fetchKeybasePgpKey(username);
    
    // Import and parse the key
    const keyInfo = await importPgpKey(pgpKey);
    
    // Use provided name or derive from key
    const name = friendName || `keybase:${username}`;
    
    // Store the key in friends directory
    const result = await addFriendKey(name, pgpKey);
    
    return {
      name,
      username,
      keybaseUser: username,
      email: keyInfo.email ?? undefined,
      keyId: keyInfo.keyId,
      path: result
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to add Keybase key: ${message}`);
  }
}

// Export functions
export {
  fetchKeybaseUser,
  fetchKeybasePgpKey,
  verifyKeybaseProofs,
  addKeybaseKey,
  // Export types for use in other modules
  type KeybaseUserData,
  type KeybaseProofSummary,
  type AddKeybaseKeyResult
};