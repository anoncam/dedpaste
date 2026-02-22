/**
 * Paste Service - Business logic for paste CRUD operations.
 *
 * Handles paste creation, retrieval, deletion, and lifecycle management.
 * Delegates storage operations to the StorageService.
 */

import type {
  IStorageService,
  PasteMetadata,
  StorageGetResult,
} from "./storageService";

/** Options for creating a new paste */
export interface CreatePasteOptions {
  /** Whether the paste is encrypted */
  isEncrypted: boolean;
  /** Whether this is a one-time (self-destructing) paste */
  isOneTime: boolean;
  /** Content type of the paste */
  contentType: string;
  /** Optional filename */
  filename?: string;
  /** Optional expiration duration string (e.g., "1h", "24h", "7d", "30d") */
  expireDuration?: string;
  /** Optional burn-after-reading count */
  burnAfterReads?: number;
}

/** Result of creating a paste */
export interface CreatePasteResult {
  /** The generated paste ID */
  id: string;
  /** The full URL to access the paste */
  url: string;
  /** Expiration timestamp, if set */
  expiresAt?: number;
  /** Whether the paste is encrypted */
  isEncrypted: boolean;
  /** Whether burn-after-reading is active */
  isBurnAfterReading: boolean;
  /** Number of reads remaining (if burn-after-reading) */
  remainingReads?: number;
}

/** Result of retrieving a paste */
export interface GetPasteResult {
  /** The paste content as a ReadableStream */
  body: ReadableStream;
  /** Get the full content as ArrayBuffer */
  arrayBuffer: () => Promise<ArrayBuffer>;
  /** Content type */
  contentType: string;
  /** Filename */
  filename: string;
  /** Size in bytes */
  size: number;
  /** Whether this was a one-time paste */
  isOneTime: boolean;
  /** Whether the paste is encrypted */
  isEncrypted: boolean;
  /** Expiration timestamp, if set */
  expiresAt?: number;
  /** Remaining reads if burn-after-reading */
  remainingReads?: number;
  /** Creation timestamp */
  createdAt: number;
}

/**
 * Interface for the paste service.
 */
export interface IPasteService {
  /**
   * Create a new paste.
   * @param content - The content to store
   * @param options - Creation options
   * @param baseUrl - The base URL for generating paste URLs
   * @returns The created paste info
   */
  createPaste(
    content: ArrayBuffer | string,
    options: CreatePasteOptions,
    baseUrl: string,
  ): Promise<CreatePasteResult>;

  /**
   * Retrieve a paste by ID.
   * @param id - The paste ID
   * @param isEncrypted - Whether to look for it in the encrypted path
   * @returns The paste content and metadata, or null if not found
   */
  getPaste(id: string, isEncrypted: boolean): Promise<GetPasteResult | null>;

  /**
   * Delete a paste by ID.
   * @param id - The paste ID
   */
  deletePaste(id: string): Promise<void>;
}

/** Duration parsing map */
const DURATION_MAP: Record<string, number> = {
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Parse a duration string like "1h", "24h", "7d", "30d" into milliseconds.
 * @param duration - The duration string
 * @returns Milliseconds, or null if invalid
 */
export function parseDuration(duration: string): number | null {
  const match = duration.match(/^(\d+)([mhdw])$/);
  if (!match) {
    return null;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multiplier = DURATION_MAP[unit];

  if (!multiplier || value <= 0) {
    return null;
  }

  return value * multiplier;
}

/**
 * Generate a random alphanumeric ID.
 * @param length - The length of the ID (default 8)
 */
function generateId(length = 8): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Concrete implementation of the paste service.
 */
export class PasteService implements IPasteService {
  private storage: IStorageService;

  constructor(storage: IStorageService) {
    this.storage = storage;
  }

  async createPaste(
    content: ArrayBuffer | string,
    options: CreatePasteOptions,
    baseUrl: string,
  ): Promise<CreatePasteResult> {
    const id = generateId();

    // Compute expiration if specified
    let expiresAt: number | undefined;
    if (options.expireDuration) {
      const durationMs = parseDuration(options.expireDuration);
      if (durationMs) {
        expiresAt = Date.now() + durationMs;
      }
    }

    // Ensure encrypted content uses application/json content type
    const adjustedContentType = options.isEncrypted
      ? "application/json"
      : options.contentType;

    const metadata: PasteMetadata = {
      contentType: adjustedContentType,
      isOneTime: options.isOneTime,
      createdAt: Date.now(),
      filename: options.filename || undefined,
      expiresAt,
      remainingReads: options.burnAfterReads,
      maxReads: options.burnAfterReads,
    };

    // Store the paste
    await this.storage.putPaste(id, content, metadata);

    // Set up burn-after-reading tracking if specified
    if (
      options.burnAfterReads &&
      options.burnAfterReads > 0 &&
      "setupBurnAfterReading" in this.storage
    ) {
      await (
        this.storage as { setupBurnAfterReading: (id: string, maxReads: number) => Promise<void> }
      ).setupBurnAfterReading(id, options.burnAfterReads);
    }

    // Build the URL
    const url = this.buildPasteUrl(
      id,
      baseUrl,
      options.isEncrypted,
      options.contentType,
      options.filename,
    );

    console.log(
      `[PasteService] Created paste ${id}, encrypted=${options.isEncrypted}, ` +
        `oneTime=${options.isOneTime}, expires=${expiresAt || "never"}, ` +
        `burnReads=${options.burnAfterReads || "unlimited"}`,
    );

    return {
      id,
      url,
      expiresAt,
      isEncrypted: options.isEncrypted,
      isBurnAfterReading: !!options.burnAfterReads,
      remainingReads: options.burnAfterReads,
    };
  }

  async getPaste(
    id: string,
    isEncrypted: boolean,
  ): Promise<GetPasteResult | null> {
    // Check for one-time paste first
    if (this.storage.isOneTimePasteViewed(id)) {
      return null;
    }

    const result = await this.storage.getOneTimePaste(id);
    if (result) {
      // This is a one-time paste, mark as viewed
      await this.storage.markOneTimePasteViewed(id);

      // Get the content before deletion
      const content = await result.arrayBuffer();

      // Delete the one-time paste
      await this.storage.deleteOneTimePaste(id);

      let contentType = result.metadata.contentType;
      if (isEncrypted && contentType !== "application/json") {
        contentType = "application/json";
      }

      return {
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(content));
            controller.close();
          },
        }),
        arrayBuffer: async () => content,
        contentType,
        filename: result.metadata.filename || "",
        size: result.size,
        isOneTime: true,
        isEncrypted,
        expiresAt: result.metadata.expiresAt,
        remainingReads: result.metadata.remainingReads,
        createdAt: result.metadata.createdAt,
      };
    }

    // Try regular paste
    const paste = await this.storage.getPaste(id);
    if (!paste) {
      return null;
    }

    // Handle burn-after-reading
    if (paste.metadata.remainingReads !== undefined) {
      const remaining = await this.storage.decrementReads(id);
      if (remaining === 0) {
        // Last read - still return content but it's been deleted
        const content = await paste.arrayBuffer();
        let contentType = paste.metadata.contentType;
        if (isEncrypted && contentType !== "application/json") {
          contentType = "application/json";
        }
        return {
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(content));
              controller.close();
            },
          }),
          arrayBuffer: async () => content,
          contentType,
          filename: paste.metadata.filename || "",
          size: paste.size,
          isOneTime: false,
          isEncrypted,
          expiresAt: paste.metadata.expiresAt,
          remainingReads: 0,
          createdAt: paste.metadata.createdAt,
        };
      }
    }

    let contentType = paste.metadata.contentType;
    if (isEncrypted && contentType !== "application/json") {
      contentType = "application/json";
    }

    return {
      body: paste.body,
      arrayBuffer: () => paste.arrayBuffer(),
      contentType,
      filename: paste.metadata.filename || "",
      size: paste.size,
      isOneTime: paste.metadata.isOneTime,
      isEncrypted,
      expiresAt: paste.metadata.expiresAt,
      remainingReads: paste.metadata.remainingReads,
      createdAt: paste.metadata.createdAt,
    };
  }

  async deletePaste(id: string): Promise<void> {
    await this.storage.deletePaste(id);
  }

  /**
   * Build the full URL for a paste.
   */
  private buildPasteUrl(
    id: string,
    baseUrl: string,
    isEncrypted: boolean,
    contentType: string,
    filename?: string,
  ): string {
    if (filename) {
      const encodedFilename = encodeURIComponent(filename);
      return isEncrypted
        ? `${baseUrl}/e/${id}/${encodedFilename}`
        : `${baseUrl}/${id}/${encodedFilename}`;
    }

    // For text pastes without filename, add .txt extension
    const extension = contentType === "text/plain" ? "/paste.txt" : "";
    return isEncrypted
      ? `${baseUrl}/e/${id}${extension}`
      : `${baseUrl}/${id}${extension}`;
  }
}
