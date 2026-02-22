/**
 * Storage Service - Abstraction layer over R2 and KV storage.
 *
 * Provides a clean interface for paste storage operations,
 * abstracting away the details of R2 object storage and KV metadata.
 */

/** Metadata stored alongside each paste in R2 custom metadata */
export interface PasteMetadata {
  contentType: string;
  isOneTime: boolean;
  createdAt: number;
  filename?: string;
  /** Expiration timestamp in milliseconds since epoch. Undefined means no expiration. */
  expiresAt?: number;
  /** For burn-after-reading: number of reads remaining. Undefined means unlimited reads. */
  remainingReads?: number;
  /** Total read count for burn-after-reading tracking */
  maxReads?: number;
}

/** Result of a storage get operation */
export interface StorageGetResult {
  body: ReadableStream;
  arrayBuffer: () => Promise<ArrayBuffer>;
  metadata: PasteMetadata;
  size: number;
}

/** Prefix used for one-time paste keys */
const ONE_TIME_PREFIX = "onetime-";

/** KV key for the viewed-pastes registry */
const VIEWED_PASTES_KEY = "viewed_pastes_registry";

/** Cloudflare Workers environment bindings */
export interface StorageEnv {
  PASTE_BUCKET: R2Bucket;
  PASTE_METADATA?: KVNamespace;
  UPLOAD_SESSIONS?: KVNamespace;
}

/**
 * Interface for the storage service.
 * All paste storage operations go through this interface.
 */
export interface IStorageService {
  /**
   * Store a paste in R2 with metadata.
   * @param id - The paste ID (without prefix)
   * @param content - The paste content as ArrayBuffer or string
   * @param metadata - Metadata to store alongside the paste
   * @returns The storage key used
   */
  putPaste(
    id: string,
    content: ArrayBuffer | string,
    metadata: PasteMetadata,
  ): Promise<string>;

  /**
   * Retrieve a paste from R2.
   * @param id - The paste ID (without prefix)
   * @returns The paste content and metadata, or null if not found
   */
  getPaste(id: string): Promise<StorageGetResult | null>;

  /**
   * Retrieve a one-time paste from R2.
   * Returns the paste if it exists and has not yet been viewed.
   * @param id - The paste ID (without one-time prefix)
   * @returns The paste content and metadata, or null if not found
   */
  getOneTimePaste(id: string): Promise<StorageGetResult | null>;

  /**
   * Delete a paste from R2.
   * @param id - The paste ID (with or without prefix)
   */
  deletePaste(id: string): Promise<void>;

  /**
   * Delete a one-time paste from R2 with verification.
   * Makes multiple deletion attempts and verifies removal.
   * @param id - The paste ID (without one-time prefix)
   * @returns Whether deletion was verified
   */
  deleteOneTimePaste(id: string): Promise<boolean>;

  /**
   * Check if a one-time paste has already been viewed.
   * @param id - The paste ID (without one-time prefix)
   */
  isOneTimePasteViewed(id: string): boolean;

  /**
   * Mark a one-time paste as viewed.
   * @param id - The paste ID (without one-time prefix)
   */
  markOneTimePasteViewed(id: string): Promise<void>;

  /**
   * Store metadata in KV (optional enhancement).
   * @param key - The KV key
   * @param value - The value to store
   * @param ttlSeconds - Optional TTL in seconds
   */
  putMetadata(key: string, value: string, ttlSeconds?: number): Promise<void>;

  /**
   * Get metadata from KV.
   * @param key - The KV key
   */
  getMetadata(key: string): Promise<string | null>;

  /**
   * Delete metadata from KV.
   * @param key - The KV key
   */
  deleteMetadata(key: string): Promise<void>;

  /**
   * Decrement remaining reads for a paste. Returns the new count.
   * If the count reaches 0, the paste should be deleted.
   * @param id - The paste ID
   * @returns The updated remaining reads count, or -1 if not a burn-after-reading paste
   */
  decrementReads(id: string): Promise<number>;
}

/** Tracker for viewed one-time pastes (in-memory) */
interface ViewedPasteTracker {
  [key: string]: {
    viewedAt: number;
    deleted: boolean;
    attempts: number;
  };
}

/**
 * Concrete implementation of the storage service using R2 and KV.
 */
export class StorageService implements IStorageService {
  private env: StorageEnv;
  private viewedPastes: ViewedPasteTracker = {};

  constructor(env: StorageEnv) {
    this.env = env;
  }

  /**
   * Initialize the service by loading viewed paste state from KV.
   */
  async initialize(): Promise<void> {
    if (this.env.PASTE_METADATA) {
      try {
        const stored = await this.env.PASTE_METADATA.get(VIEWED_PASTES_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as ViewedPasteTracker;
          Object.assign(this.viewedPastes, parsed);
        }
      } catch (error) {
        console.log(
          "[StorageService] Optional paste metadata storage not available:",
          error,
        );
      }
    }
  }

  /** Build the storage key for one-time pastes */
  private oneTimeKey(id: string): string {
    return `${ONE_TIME_PREFIX}${id}`;
  }

  async putPaste(
    id: string,
    content: ArrayBuffer | string,
    metadata: PasteMetadata,
  ): Promise<string> {
    const key = metadata.isOneTime ? this.oneTimeKey(id) : id;

    await this.env.PASTE_BUCKET.put(key, content, {
      customMetadata: metadata as unknown as Record<string, string>,
    });

    console.log(
      `[StorageService] Created paste ${key}, isOneTime=${metadata.isOneTime}`,
    );

    return key;
  }

  async getPaste(id: string): Promise<StorageGetResult | null> {
    // First try one-time paste
    const oneTimeResult = await this.getOneTimePaste(id);
    if (oneTimeResult) {
      return oneTimeResult;
    }

    // Then try regular paste
    const object = await this.env.PASTE_BUCKET.get(id);
    if (!object) {
      return null;
    }

    const metadata = this.extractMetadata(object);

    // Check if paste has expired
    if (metadata.expiresAt && Date.now() > metadata.expiresAt) {
      // Paste has expired, delete it and return null
      await this.env.PASTE_BUCKET.delete(id);
      console.log(`[StorageService] Paste ${id} has expired, deleting`);
      return null;
    }

    return {
      body: object.body,
      arrayBuffer: () => object.arrayBuffer(),
      metadata,
      size: object.size,
    };
  }

  async getOneTimePaste(id: string): Promise<StorageGetResult | null> {
    const key = this.oneTimeKey(id);

    // Check if already viewed in memory
    if (this.isOneTimePasteViewed(id)) {
      return null;
    }

    const object = await this.env.PASTE_BUCKET.get(key);
    if (!object) {
      return null;
    }

    const metadata = this.extractMetadata(object);
    // Ensure the isOneTime flag is set
    metadata.isOneTime = true;

    // Check if paste has expired
    if (metadata.expiresAt && Date.now() > metadata.expiresAt) {
      await this.env.PASTE_BUCKET.delete(key);
      console.log(
        `[StorageService] One-time paste ${id} has expired, deleting`,
      );
      return null;
    }

    return {
      body: object.body,
      arrayBuffer: () => object.arrayBuffer(),
      metadata,
      size: object.size,
    };
  }

  async deletePaste(id: string): Promise<void> {
    await this.env.PASTE_BUCKET.delete(id);
  }

  async deleteOneTimePaste(id: string): Promise<boolean> {
    const key = this.oneTimeKey(id);

    try {
      // First deletion attempt
      await this.env.PASTE_BUCKET.delete(key);
      console.log(`[StorageService] First deletion attempt for ${key}`);

      // Small delay for propagation
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Second deletion attempt
      await this.env.PASTE_BUCKET.delete(key);

      // Verify deletion
      const check = await this.env.PASTE_BUCKET.get(key);
      if (!check) {
        console.log(
          `[StorageService] Successfully deleted one-time paste ${key}`,
        );
        if (key in this.viewedPastes) {
          this.viewedPastes[key].deleted = true;
          this.viewedPastes[key].attempts++;
        }
        await this.persistViewedPastes();
        return true;
      }

      // Force another attempt
      await this.env.PASTE_BUCKET.delete(key);
      if (key in this.viewedPastes) {
        this.viewedPastes[key].deleted = false;
        this.viewedPastes[key].attempts++;
      }
      await this.persistViewedPastes();
      return false;
    } catch (error) {
      console.error(
        `[StorageService] Error deleting one-time paste ${key}: ${error}`,
      );
      return false;
    }
  }

  isOneTimePasteViewed(id: string): boolean {
    const key = this.oneTimeKey(id);
    return key in this.viewedPastes;
  }

  async markOneTimePasteViewed(id: string): Promise<void> {
    const key = this.oneTimeKey(id);
    this.viewedPastes[key] = {
      viewedAt: Date.now(),
      deleted: false,
      attempts: 0,
    };
    await this.persistViewedPastes();
  }

  async putMetadata(
    key: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<void> {
    if (!this.env.PASTE_METADATA) {
      return;
    }
    try {
      const options: KVNamespacePutOptions = {};
      if (ttlSeconds) {
        options.expirationTtl = ttlSeconds;
      }
      await this.env.PASTE_METADATA.put(key, value, options);
    } catch (error) {
      console.log(`[StorageService] KV put failed for ${key}: ${error}`);
    }
  }

  async getMetadata(key: string): Promise<string | null> {
    if (!this.env.PASTE_METADATA) {
      return null;
    }
    try {
      return await this.env.PASTE_METADATA.get(key);
    } catch (error) {
      console.log(`[StorageService] KV get failed for ${key}: ${error}`);
      return null;
    }
  }

  async deleteMetadata(key: string): Promise<void> {
    if (!this.env.PASTE_METADATA) {
      return;
    }
    try {
      await this.env.PASTE_METADATA.delete(key);
    } catch (error) {
      console.log(`[StorageService] KV delete failed for ${key}: ${error}`);
    }
  }

  async decrementReads(id: string): Promise<number> {
    // Look for the paste's metadata in KV to track reads
    const metadataKey = `reads:${id}`;
    const stored = await this.getMetadata(metadataKey);

    if (!stored) {
      return -1; // Not a burn-after-reading paste
    }

    const data = JSON.parse(stored) as {
      remaining: number;
      max: number;
    };
    data.remaining = Math.max(0, data.remaining - 1);

    if (data.remaining <= 0) {
      // Delete the paste and its metadata
      await this.deletePaste(id);
      await this.deleteMetadata(metadataKey);
      console.log(
        `[StorageService] Burn-after-reading paste ${id} exhausted, deleting`,
      );
      return 0;
    }

    await this.putMetadata(metadataKey, JSON.stringify(data));
    return data.remaining;
  }

  /**
   * Set up burn-after-reading tracking for a paste.
   * @param id - The paste ID
   * @param maxReads - Maximum number of reads allowed
   */
  async setupBurnAfterReading(id: string, maxReads: number): Promise<void> {
    const metadataKey = `reads:${id}`;
    const data = { remaining: maxReads, max: maxReads };
    await this.putMetadata(metadataKey, JSON.stringify(data));
  }

  /** Extract PasteMetadata from an R2 object */
  private extractMetadata(object: R2Object | R2ObjectBody): PasteMetadata {
    try {
      const custom = object.customMetadata as unknown as Record<
        string,
        string
      >;
      return {
        contentType: custom?.contentType || "text/plain",
        isOneTime: custom?.isOneTime === "true",
        createdAt: Number(custom?.createdAt) || Date.now(),
        filename: custom?.filename || undefined,
        expiresAt: custom?.expiresAt ? Number(custom.expiresAt) : undefined,
        remainingReads: custom?.remainingReads
          ? Number(custom.remainingReads)
          : undefined,
        maxReads: custom?.maxReads ? Number(custom.maxReads) : undefined,
      } as PasteMetadata;
    } catch (err) {
      console.error(`[StorageService] Error extracting metadata: ${err}`);
      return {
        contentType: "text/plain",
        isOneTime: false,
        createdAt: Date.now(),
      };
    }
  }

  /** Persist the viewed pastes tracker to KV */
  private async persistViewedPastes(): Promise<void> {
    if (this.env.PASTE_METADATA) {
      try {
        await this.env.PASTE_METADATA.put(
          VIEWED_PASTES_KEY,
          JSON.stringify(this.viewedPastes),
        );
      } catch (error) {
        console.log(
          `[StorageService] Failed to persist viewed pastes: ${error}`,
        );
      }
    }
  }
}
