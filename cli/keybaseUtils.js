// Keybase integration utilities
import fetch from 'node-fetch';
import { addFriendKey } from './keyManager.js';
import { importPgpKey } from './pgpUtils.js';
// Keybase API URL
const KEYBASE_API_URL = 'https://keybase.io/_/api/1.0';
/**
 * Fetch user information from Keybase
 * @param username - Keybase username
 * @returns User information
 */
async function fetchKeybaseUser(username) {
    try {
        const url = `${KEYBASE_API_URL}/user/lookup.json?username=${encodeURIComponent(username)}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Keybase API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (!data.status || data.status.code !== 0) {
            throw new Error(`Keybase API error: ${data.status?.desc || 'Unknown error'}`);
        }
        if (!data.them) {
            throw new Error(`User '${username}' not found on Keybase`);
        }
        return data.them;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to fetch Keybase user: ${message}`);
    }
}
/**
 * Fetch public key for a Keybase user
 * @param username - Keybase username
 * @returns PGP public key text
 */
async function fetchKeybasePgpKey(username) {
    try {
        const url = `${KEYBASE_API_URL}/user/lookup.json?username=${encodeURIComponent(username)}&fields=public_keys`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Keybase API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to fetch Keybase PGP key: ${message}`);
    }
}
/**
 * Verify a Keybase user's proofs
 * @param username - Keybase username
 * @returns Verification results
 */
async function verifyKeybaseProofs(username) {
    try {
        const url = `${KEYBASE_API_URL}/user/lookup.json?username=${encodeURIComponent(username)}&fields=proofs_summary`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Keybase API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (!data.them || !data.them.proofs_summary) {
            throw new Error(`No proofs found for user '${username}'`);
        }
        // Return the proof summary
        return data.them.proofs_summary;
    }
    catch (error) {
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
async function addKeybaseKey(username, friendName = null, verify = true) {
    try {
        // Verify the user's proofs if requested
        if (verify) {
            const proofs = await verifyKeybaseProofs(username);
            // Check if user has at least one verified proof
            const hasVerifiedProofs = Object.values(proofs.all || []).some((proof) => proof.state === 1);
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to add Keybase key: ${message}`);
    }
}
// Export functions
export { fetchKeybaseUser, fetchKeybasePgpKey, verifyKeybaseProofs, addKeybaseKey };
