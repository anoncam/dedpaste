// Recipient resolution utilities
import { getKey } from './keyManager.js';
import { getGroup, groupExists } from './groupManager.js';
import type { ResolvedRecipient, KeyInfo } from '../src/types/index.js';

/**
 * Normalize recipient prefix to full form
 * gh: -> github:
 * kb: -> keybase:
 */
function normalizePrefix(input: string): string {
  // Short prefix mappings
  const prefixMap: Record<string, string> = {
    'gh:': 'github:',
    'kb:': 'keybase:',
  };

  for (const [shortPrefix, longPrefix] of Object.entries(prefixMap)) {
    if (input.startsWith(shortPrefix)) {
      return input.replace(shortPrefix, longPrefix);
    }
  }

  return input;
}

/**
 * Detect recipient type from input pattern
 */
function detectRecipientType(input: string): {
  type: 'github' | 'keybase' | 'pgp' | 'friend' | 'group' | 'unknown';
  identifier: string;
} {
  // Check for explicit prefixes
  if (input.startsWith('github:')) {
    return { type: 'github', identifier: input };
  }
  if (input.startsWith('keybase:')) {
    return { type: 'keybase', identifier: input };
  }
  if (input.startsWith('pgp:')) {
    return { type: 'pgp', identifier: input.replace('pgp:', '') };
  }
  if (input.startsWith('friend:')) {
    return { type: 'friend', identifier: input.replace('friend:', '') };
  }

  // Pattern-based detection
  // Email address pattern (contains @ with domain)
  if (input.includes('@') && input.includes('.')) {
    return { type: 'pgp', identifier: input };
  }

  // Fingerprint pattern (0x followed by hex)
  if (input.startsWith('0x') && /^0x[0-9A-Fa-f]+$/.test(input)) {
    return { type: 'pgp', identifier: input };
  }

  // Otherwise, could be a group or friend name
  return { type: 'unknown', identifier: input };
}

/**
 * Resolve a single recipient
 *
 * Resolution order:
 * 1. Check if it's a group
 * 2. Normalize prefix (gh: -> github:, kb: -> keybase:)
 * 3. Try to find key in any key store
 * 4. If github:/keybase: prefix and not found, offer to fetch (set autoFetched flag)
 * 5. If still not found, throw error with suggestions
 */
export async function resolveRecipient(
  input: string,
  options: {
    silent?: boolean;
    autoFetch?: boolean;
  } = {}
): Promise<ResolvedRecipient> {
  const { silent = false, autoFetch = true } = options;

  if (!input || input.trim() === '') {
    throw new Error('Recipient cannot be empty');
  }

  const trimmedInput = input.trim();
  const originalInput = trimmedInput;

  // Step 1: Check if it's a group
  if (await groupExists(trimmedInput)) {
    const members = await getGroup(trimmedInput);
    if (!members || members.length === 0) {
      throw new Error(`Group "${trimmedInput}" exists but has no members`);
    }

    return {
      type: 'group',
      identifier: trimmedInput,
      originalInput,
      members,
    };
  }

  // Step 2: Normalize prefix
  const normalized = normalizePrefix(trimmedInput);

  // Step 3: Detect type and try to find key
  const { type, identifier } = detectRecipientType(normalized);

  // Try to find key in key stores
  let keyInfo: KeyInfo | null = await getKey('any', normalized);

  // Step 4: Handle auto-fetch for GitHub/Keybase
  let autoFetched = false;

  if (!keyInfo && autoFetch) {
    // Check if it's a GitHub key that needs fetching
    if (normalized.startsWith('github:')) {
      const username = normalized.replace('github:', '');

      try {
        if (!silent) {
          console.log(`Fetching GitHub GPG key for user: ${username}...`);
        }

        const { ensureGitHubKey } = await import('./githubUtils.js');
        await ensureGitHubKey(username, silent);

        // Try to get the key again after fetching
        keyInfo = await getKey('any', normalized);
        autoFetched = true;

        if (!silent && keyInfo) {
          console.log(`✓ Successfully fetched key for ${username}`);
        }
      } catch (error: any) {
        throw new Error(
          `Failed to fetch GitHub key for "${username}": ${error.message}\n` +
          `Please verify the username and that they have a GPG key on GitHub.`
        );
      }
    }

    // Check if it's a Keybase key that needs fetching
    if (!keyInfo && normalized.startsWith('keybase:')) {
      const username = normalized.replace('keybase:', '');

      try {
        if (!silent) {
          console.log(`Fetching Keybase PGP key for user: ${username}...`);
        }

        const { addKeybaseKey } = await import('./keybaseUtils.js');
        await addKeybaseKey(username, normalized);

        // Try to get the key again after fetching
        keyInfo = await getKey('any', normalized);
        autoFetched = true;

        if (!silent && keyInfo) {
          console.log(`✓ Successfully fetched key for ${username}`);
        }
      } catch (error: any) {
        throw new Error(
          `Failed to fetch Keybase key for "${username}": ${error.message}\n` +
          `Please verify the username and that they have a PGP key on Keybase.`
        );
      }
    }
  }

  // Step 5: Error if still not found
  if (!keyInfo) {
    // Provide helpful error messages based on type
    let errorMessage = `Recipient "${originalInput}" not found in key database.`;

    if (type === 'github') {
      errorMessage += `\n\nTo add a GitHub user's key, run:\n  dedpaste keys --github ${normalized.replace('github:', '')}`;
    } else if (type === 'keybase') {
      errorMessage += `\n\nTo add a Keybase user's key, run:\n  dedpaste keys --keybase ${normalized.replace('keybase:', '')}`;
    } else if (type === 'pgp') {
      errorMessage += `\n\nTo add a PGP key, run:\n  dedpaste keys --add ${identifier}`;
    } else {
      errorMessage += `\n\nTo list available recipients, run:\n  dedpaste keys --list`;
      errorMessage += `\n\nOr create a group with this name:\n  dedpaste keys --group-create ${trimmedInput} <member1> <member2>`;
    }

    throw new Error(errorMessage);
  }

  // Determine the resolved type from keyInfo
  let resolvedType: 'self' | 'friend' | 'pgp' | 'keybase' | 'github' = 'friend';
  if (keyInfo.type === 'github') {
    resolvedType = 'github';
  } else if (keyInfo.type === 'keybase') {
    resolvedType = 'keybase';
  } else if (keyInfo.type === 'pgp') {
    resolvedType = 'pgp';
  } else if (keyInfo.type === 'self') {
    resolvedType = 'self';
  }

  return {
    type: resolvedType,
    identifier: normalized,
    originalInput,
    keyInfo,
    autoFetched,
  };
}

/**
 * Resolve multiple recipients
 *
 * Handles:
 * - Individual recipients
 * - Groups (which expand to multiple members)
 * - Deduplication
 */
export async function resolveRecipients(
  inputs: string[],
  options: {
    silent?: boolean;
    autoFetch?: boolean;
  } = {}
): Promise<ResolvedRecipient[]> {
  if (!inputs || inputs.length === 0) {
    throw new Error('At least one recipient must be specified');
  }

  const resolved: ResolvedRecipient[] = [];
  const seenIdentifiers = new Set<string>();

  for (const input of inputs) {
    const recipient = await resolveRecipient(input, options);

    // If it's a group, resolve each member
    if (recipient.type === 'group' && recipient.members) {
      for (const member of recipient.members) {
        // Avoid duplicates
        if (seenIdentifiers.has(member)) {
          continue;
        }

        const memberResolved = await resolveRecipient(member, options);
        resolved.push(memberResolved);
        seenIdentifiers.add(memberResolved.identifier);
      }
    } else {
      // Avoid duplicates
      if (seenIdentifiers.has(recipient.identifier)) {
        continue;
      }

      resolved.push(recipient);
      seenIdentifiers.add(recipient.identifier);
    }
  }

  return resolved;
}

/**
 * Check if recipient is likely a PGP-based recipient (GitHub, Keybase, or PGP)
 * This helps determine whether to use PGP encryption or standard encryption
 */
export function isPgpRecipient(recipient: ResolvedRecipient): boolean {
  if (!recipient.keyInfo) {
    return false;
  }

  // GitHub and Keybase always use PGP
  if (recipient.type === 'github' || recipient.type === 'keybase') {
    return true;
  }

  // PGP type explicitly uses PGP
  if (recipient.type === 'pgp') {
    return true;
  }

  // Check if the key file contains PGP format
  // (This would require reading the key file, which we can skip for now)
  // For safety, we'll assume friend keys use standard encryption unless specified

  return false;
}
