/**
 * Encryption Service - Server-side encryption utilities.
 *
 * Note: DedPaste uses client-side end-to-end encryption. The server
 * never sees unencrypted content. This service provides utilities for:
 * - Detecting encrypted content
 * - Validating encryption metadata
 * - Generating IDs and tokens using the Web Crypto API
 */

/** Encryption metadata structure (matches what the CLI produces) */
export interface EncryptedPayload {
  /** Encryption format version */
  version: number;
  /** Encrypted symmetric key (base64) */
  encryptedKey: string;
  /** Initialization vector (base64) */
  iv: string;
  /** Authentication tag (base64) */
  authTag: string;
  /** Encrypted content (base64) */
  encryptedContent: string;
}

/**
 * Interface for the encryption service.
 */
export interface IEncryptionService {
  /**
   * Check if content appears to be encrypted in the DedPaste format.
   * @param content - The content to check (as string)
   * @returns Whether the content looks like a DedPaste encrypted payload
   */
  isEncryptedPayload(content: string): boolean;

  /**
   * Validate the structure of an encrypted payload.
   * @param content - The content to validate
   * @returns An error message if invalid, or null if valid
   */
  validateEncryptedPayload(content: string): string | null;

  /**
   * Generate a cryptographically random token using Web Crypto API.
   * @param length - The length in bytes (default 32)
   * @returns A hex-encoded random string
   */
  generateToken(length?: number): string;

  /**
   * Generate a SHA-256 hash of the given data using Web Crypto API.
   * @param data - The data to hash
   * @returns The hex-encoded hash
   */
  hash(data: string): Promise<string>;
}

/**
 * Concrete implementation of the encryption service.
 */
export class EncryptionService implements IEncryptionService {
  isEncryptedPayload(content: string): boolean {
    try {
      const parsed = JSON.parse(content);
      return (
        typeof parsed === "object" &&
        parsed !== null &&
        "version" in parsed &&
        "encryptedKey" in parsed &&
        "iv" in parsed &&
        "encryptedContent" in parsed
      );
    } catch {
      return false;
    }
  }

  validateEncryptedPayload(content: string): string | null {
    try {
      const parsed = JSON.parse(content);

      if (typeof parsed !== "object" || parsed === null) {
        return "Encrypted payload must be a JSON object";
      }

      if (typeof parsed.version !== "number") {
        return "Missing or invalid 'version' field";
      }

      if (parsed.version < 1 || parsed.version > 4) {
        return `Unsupported encryption version: ${parsed.version}`;
      }

      if (typeof parsed.encryptedKey !== "string" || !parsed.encryptedKey) {
        return "Missing or invalid 'encryptedKey' field";
      }

      // Version 4 (streaming) has different structure
      if (parsed.version === 4) {
        if (!parsed.metadata || typeof parsed.metadata !== "object") {
          return "Version 4 payload missing 'metadata' field";
        }
        return null;
      }

      if (typeof parsed.iv !== "string" || !parsed.iv) {
        return "Missing or invalid 'iv' field";
      }

      if (
        typeof parsed.encryptedContent !== "string" ||
        !parsed.encryptedContent
      ) {
        return "Missing or invalid 'encryptedContent' field";
      }

      return null;
    } catch {
      return "Content is not valid JSON";
    }
  }

  generateToken(length = 32): string {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async hash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const buffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
}
