// Shared type definitions for DedPaste

// Key types
export interface KeyInfo {
  type: "self" | "friend" | "pgp" | "keybase" | "github" | "gpg";
  name: string;
  path: string | { public: string; private: string };
  public?: string;
  private?: string;
  fingerprint: string;
  username?: string;
  email?: string;
  created?: string | Date;
  lastUsed?: string | Date | null;
  addedDate?: string;
  lastFetched?: string;
  id?: string;
  source?: "self" | "friend" | "pgp" | "keybase" | "github" | "gpg";
  expires?: string | Date;
  trust?: string;
  uids?: Array<{ uid?: string; trust?: string }>;
}

export interface KeyDatabase {
  keys: {
    self: KeyInfo | null;
    friends: Record<string, KeyInfo>;
    pgp: Record<string, KeyInfo>;
    keybase: Record<string, KeyInfo>;
    github: Record<string, KeyInfo>;
  };
  groups?: Record<string, string[]>;
  default_friend: string | null;
  last_used: string | null;
}

// Encryption types
export interface EncryptionResult {
  encryptedContent: string;
  encryptionKey?: string;
  recipientInfo?: RecipientInfo;
}

export interface RecipientInfo {
  type: "self" | "friend" | "pgp" | "keybase" | "github";
  name: string;
  fingerprint: string;
  username?: string;
  email?: string;
}

// Recipient resolution types
export interface ResolvedRecipient {
  type: "self" | "friend" | "pgp" | "keybase" | "github" | "group";
  identifier: string;  // Normalized identifier (e.g., "github:username")
  originalInput: string;  // What the user typed
  keyInfo?: KeyInfo;  // Resolved key info (not present for groups)
  members?: string[];  // For groups: list of member identifiers
  autoFetched?: boolean;  // True if key was fetched remotely
}

export interface DecryptionResult {
  decryptedContent: string;
  senderInfo?: RecipientInfo;
}

// Paste types
export interface PasteOptions {
  file?: string;
  encrypt?: boolean;
  for?: string;
  temp?: boolean;
  expires?: string;
  copy?: boolean;
  raw?: boolean;
  silent?: boolean;
  output?: string;
  burn?: boolean;
  /** Burn-after-reading count: number of reads before auto-deletion */
  burnCount?: number;
  password?: string;
  /** Expiration duration (e.g., "1h", "24h", "7d", "30d") */
  expire?: string;
}

export interface PasteResponse {
  url: string;
  id: string;
  expiresAt?: string;
  encrypted?: boolean;
  requiresPassword?: boolean;
  /** Whether burn-after-reading is active */
  isBurnAfterReading?: boolean;
  /** Remaining reads before auto-deletion */
  remainingReads?: number;
}

// ============================================
// API v1 Response Types
// ============================================

/** Standard API v1 response wrapper */
export interface ApiV1Response<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{
      field: string;
      message: string;
      code: string;
    }>;
  };
}

/** API v1 paste creation response */
export interface ApiV1PasteCreated {
  id: string;
  url: string;
  isEncrypted: boolean;
  isBurnAfterReading: boolean;
  expiresAt?: string;
  remainingReads?: number;
}

/** API v1 paste retrieval response */
export interface ApiV1PasteData {
  id: string;
  content: string;
  contentType: string;
  filename: string | null;
  size: number;
  isOneTime: boolean;
  isEncrypted: boolean;
  createdAt: string;
  expiresAt?: string;
  remainingReads?: number;
}

/** API v1 health check response */
export interface ApiV1HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  timestamp: string;
  services: {
    storage: "available" | "unavailable";
    encryption: "available" | "unavailable";
  };
}

// ============================================
// Paste Lifecycle Types
// ============================================

/** Valid expiration duration presets */
export type ExpirationPreset = "1h" | "6h" | "12h" | "24h" | "48h" | "7d" | "14d" | "30d";

/** Paste lifecycle configuration */
export interface PasteLifecycle {
  /** When the paste expires (ISO 8601) */
  expiresAt?: string;
  /** Number of reads remaining for burn-after-reading */
  remainingReads?: number;
  /** Maximum reads for burn-after-reading */
  maxReads?: number;
  /** Whether the paste is a one-time paste */
  isOneTime: boolean;
}

// PGP types
export interface PgpKeyInfo {
  fingerprint: string;
  email?: string;
  created?: Date;
  expires?: Date;
  algorithm?: string;
  bits?: number;
}

export interface PgpSearchResult {
  keyId: string;
  fingerprint: string;
  email: string;
  name: string;
  created: Date;
  expires?: Date;
}

// Keybase types
export interface KeybaseUser {
  username: string;
  fullName?: string;
  bio?: string;
  location?: string;
  publicKeys?: {
    primary?: {
      keyFingerprint: string;
      bundle: string;
    };
  };
  proofs?: KeybaseProof[];
}

export interface KeybaseProof {
  proofType: string;
  nametag: string;
  state: number;
  serviceUrl?: string;
  proofUrl?: string;
  humanUrl?: string;
}

// GitHub types
export interface GitHubUser {
  username: string;
  name?: string;
  bio?: string;
  location?: string;
  publicRepos?: number;
  followers?: number;
  following?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface GitHubKeyInfo {
  id: number;
  key: string;
  title?: string;
  createdAt?: Date;
}

// Interactive mode types
export interface InteractiveChoice {
  name: string;
  value: string;
  short?: string;
}

export interface KeyManagementAction {
  action: "list" | "add" | "remove" | "export" | "generate" | "import";
  keyType?: "friend" | "pgp" | "keybase";
  keyName?: string;
  keyData?: string;
}

// Error types
export class DedPasteError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "DedPasteError";
  }
}

export class ValidationError extends DedPasteError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends DedPasteError {
  constructor(message: string) {
    super(message, "AUTHENTICATION_ERROR", 401);
    this.name = "AuthenticationError";
  }
}

export class EncryptionError extends DedPasteError {
  constructor(message: string) {
    super(message, "ENCRYPTION_ERROR", 500);
    this.name = "EncryptionError";
  }
}

export class StorageError extends DedPasteError {
  constructor(message: string) {
    super(message, "STORAGE_ERROR", 500);
    this.name = "StorageError";
  }
}

export class RateLimitError extends DedPasteError {
  constructor(message: string) {
    super(message, "RATE_LIMIT_ERROR", 429);
    this.name = "RateLimitError";
  }
}

// API types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// Configuration types
export interface DedPasteConfig {
  apiUrl: string;
  keyDir: string;
  defaultExpiry?: string;
  defaultEncryption?: boolean;
  theme?: "dark" | "light" | "auto";
  editor?: {
    theme?: string;
    fontSize?: number;
    wordWrap?: boolean;
  };
}

// Service types for future service layer
export interface IPasteService {
  create(content: string, options?: PasteOptions): Promise<PasteResponse>;
  get(idOrUrl: string): Promise<string>;
  delete(id: string): Promise<void>;
}

export interface IEncryptionService {
  encrypt(content: string, recipientName?: string): Promise<EncryptionResult>;
  decrypt(encryptedContent: string): Promise<DecryptionResult>;
}

export interface IKeyService {
  generateKeyPair(): Promise<KeyInfo>;
  addKey(type: string, name: string, keyData: string): Promise<KeyInfo>;
  getKey(type: string, name: string): Promise<KeyInfo | null>;
  removeKey(type: string, name: string): Promise<void>;
  listKeys(type?: string): Promise<KeyInfo[]>;
}

export interface IStorageService {
  save(key: string, data: any): Promise<void>;
  load(key: string): Promise<any>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

// Enhanced interactive mode types
export interface DiagnosticsOptions {
  includeGpg?: boolean;
  includePgp?: boolean;
  includeKeybase?: boolean;
}

export interface DiagnosticsResult {
  status: "ok" | "warning" | "error";
  errors: string[];
  warnings: string[];
  keyDatabase: KeyDatabase | null;
  filesystemChecks: {
    directories: Record<string, DirectoryInfo>;
    files: Record<string, FileInfo>;
  };
  keyStats: {
    self: boolean;
    friends: number;
    pgp: number;
    keybase: number;
    total: number;
  };
  gpgKeyring: {
    available: boolean;
    version: string | null;
    keys: GpgKeyInfo[];
  };
}

export interface DirectoryInfo {
  exists: boolean;
  readable?: boolean;
  writable?: boolean;
  path: string;
}

export interface FileInfo {
  exists: boolean;
  readable?: boolean;
  writable?: boolean;
  size?: number;
  modified?: Date;
  path: string;
}

export interface GpgKeyInfo {
  id: string;
  fingerprint?: string;
  name?: string;
  email?: string;
  uids: Array<{ uid: string; trust?: string }>;
  created?: Date;
  expires?: Date;
  type: "rsa" | "dsa" | "elgamal" | "ecdh" | "ecdsa" | "eddsa" | string;
  trust?: string;
}

export interface GpgInfo {
  available: boolean;
  version?: string;
  keys: GpgKeyInfo[];
  error?: string;
  timedOut?: boolean;
}

export interface SearchOptions {
  includeGpg?: boolean;
  includePgp?: boolean;
  includeKeybase?: boolean;
}

export interface KeySearchResult extends KeyInfo {
  source: "self" | "friend" | "pgp" | "keybase" | "github" | "gpg";
}

export interface ImportKeyOptions {
  source:
    | "file"
    | "pgp-server"
    | "keybase"
    | "github"
    | "gpg-keyring"
    | "gpg-import"
    | "paste";
  file?: string;
  content?: string;
  name?: string;
  email?: string;
  keyId?: string;
  username?: string;
  verify?: boolean;
}

export interface OperationResult {
  success: boolean;
  message?: string;
  error?: string;
  type?: string;
  name?: string;
  fingerprint?: string;
  email?: string;
  username?: string;
  path?: string;
  keyId?: string;
  output?: string;
  privateKeyPath?: string;
  publicKeyPath?: string;
  content?: string;
  recipient?: string | null;
  temp?: boolean;
  pgp?: boolean;
}

export interface DecryptionOptions {
  password?: string;
  keyId?: string;
  private?: boolean;
}

// ============================================
// Large File / Multipart Upload Types
// ============================================

/**
 * Server-side upload session stored in KV.
 * Tracks the state of an in-progress multipart upload.
 */
export interface UploadSession {
  /** R2 multipart upload ID (from createMultipartUpload) */
  uploadId: string;
  /** R2 object key (the paste ID, possibly with onetime- prefix) */
  key: string;
  /** Original filename from client */
  filename: string;
  /** MIME content type */
  contentType: string;
  /** Total file size in bytes */
  totalSize: number;
  /** Expected number of parts */
  totalParts: number;
  /** Parts that have been successfully uploaded */
  uploadedParts: UploadedPart[];
  /** Whether this is a one-time paste */
  isOneTime: boolean;
  /** Whether the content is encrypted */
  isEncrypted: boolean;
  /** Session creation timestamp (ms since epoch) */
  createdAt: number;
  /** Session expiration timestamp (ms since epoch) */
  expiresAt: number;
  /** Encryption metadata for encrypted uploads */
  encryptionMetadata?: EncryptedFileHeader;
}

/**
 * Information about a successfully uploaded part.
 */
export interface UploadedPart {
  /** Part number (1-indexed, as per S3/R2 spec) */
  partNumber: number;
  /** ETag returned by R2 for this part */
  etag: string;
  /** Size of this part in bytes */
  size: number;
}

/**
 * Request body for initializing a multipart upload.
 */
export interface MultipartInitRequest {
  /** Original filename */
  filename: string;
  /** MIME content type */
  contentType: string;
  /** Total file size in bytes */
  totalSize: number;
  /** Expected number of parts */
  totalParts: number;
  /** Whether this is a one-time paste */
  isOneTime?: boolean;
  /** Whether the content is encrypted */
  isEncrypted?: boolean;
  /** Encryption metadata for encrypted uploads */
  encryptionMetadata?: EncryptedFileHeader;
}

/**
 * Response from initializing a multipart upload.
 */
export interface MultipartInitResponse {
  /** Session ID for subsequent operations */
  sessionId: string;
  /** R2 upload ID (exposed for debugging) */
  uploadId: string;
  /** The paste ID that will be used in the final URL */
  pasteId: string;
  /** When this session expires */
  expiresAt: string;
}

/**
 * Response from uploading a single part.
 */
export interface PartUploadResponse {
  /** ETag for this part (required for completion) */
  etag: string;
  /** Part number that was uploaded */
  partNumber: number;
}

/**
 * Request body for completing a multipart upload.
 */
export interface MultipartCompleteRequest {
  /** List of parts with their ETags */
  parts: Array<{ partNumber: number; etag: string }>;
}

/**
 * Response from completing a multipart upload.
 */
export interface MultipartCompleteResponse {
  /** Full URL to access the paste */
  url: string;
  /** The paste ID */
  id: string;
  /** Total size in bytes */
  size: number;
}

/**
 * Response from the upload status endpoint.
 */
export interface UploadStatusResponse {
  /** Session ID */
  sessionId: string;
  /** The paste ID */
  pasteId: string;
  /** Total expected parts */
  totalParts: number;
  /** Parts that have been uploaded */
  uploadedParts: UploadedPart[];
  /** Total bytes uploaded so far */
  uploadedBytes: number;
  /** Total file size */
  totalSize: number;
  /** When this session expires */
  expiresAt: string;
  /** Whether the session is still valid */
  isValid: boolean;
}

// ============================================
// Streaming Encryption Types (v4)
// ============================================

/**
 * Header for streaming encrypted files (v4 format).
 * Stored as the first part of the multipart upload.
 */
export interface EncryptedFileHeader {
  /** Version identifier (4 for streaming encryption) */
  version: 4;
  /** Metadata about the encrypted file */
  metadata: {
    /** Sender identifier */
    sender?: string;
    /** Recipient information */
    recipient?: RecipientInfo;
    /** Encryption timestamp */
    timestamp: string;
    /** Total number of encrypted chunks */
    totalChunks: number;
    /** Original (unencrypted) file size */
    originalSize: number;
    /** Size of each chunk before encryption */
    chunkSize: number;
    /** Original filename */
    filename?: string;
  };
  /** Symmetric key encrypted with recipient's public key (base64) */
  encryptedKey: string;
}

/**
 * Per-chunk encryption header (prepended to each encrypted chunk).
 * Total header size: 36 bytes (16 + 16 + 4)
 */
export interface EncryptedChunkHeader {
  /** Initialization vector (16 bytes) */
  iv: Uint8Array;
  /** Authentication tag (16 bytes) */
  authTag: Uint8Array;
  /** Length of encrypted data (4 bytes, big-endian uint32) */
  encryptedLength: number;
}

// ============================================
// CLI Resume State Types
// ============================================

/**
 * State saved to disk for resuming interrupted uploads.
 * Stored in ~/.dedpaste/uploads/<sessionId>.json
 */
export interface ResumeState {
  /** Server session ID */
  sessionId: string;
  /** Path to the file being uploaded */
  filePath: string;
  /** MD5 hash of first 1MB (to verify file hasn't changed) */
  fileHash: string;
  /** Total file size in bytes */
  totalSize: number;
  /** Chunk size used for this upload */
  chunkSize: number;
  /** Parts that have been uploaded */
  uploadedParts: Array<{ partNumber: number; etag: string }>;
  /** Whether this is an encrypted upload */
  isEncrypted: boolean;
  /** For encrypted uploads: the encrypted symmetric key */
  encryptedKey?: string;
  /** Session creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  lastUpdatedAt: number;
  /** API URL used for this upload */
  apiUrl: string;
  /** Whether this is a one-time paste */
  isOneTime: boolean;
  /** Original filename */
  filename: string;
  /** Content type */
  contentType: string;
}

/**
 * Progress information during upload.
 */
export interface UploadProgress {
  /** Total file size in bytes */
  totalBytes: number;
  /** Bytes uploaded so far */
  uploadedBytes: number;
  /** Current part being uploaded */
  currentPart: number;
  /** Total number of parts */
  totalParts: number;
  /** Upload speed in bytes per second */
  speed: number;
  /** Estimated time remaining in seconds */
  eta: number;
  /** Percentage complete (0-100) */
  percent: number;
}

/**
 * Options for large file uploads.
 */
export interface LargeUploadOptions {
  /** API URL to upload to */
  apiUrl: string;
  /** Chunk size in bytes (default: 10MB, min: 5MB) */
  chunkSize?: number;
  /** Whether this is a one-time paste */
  isOneTime?: boolean;
  /** Whether to encrypt the content */
  isEncrypted?: boolean;
  /** Recipient for encryption */
  recipient?: string;
  /** Path to resume state file (for resuming) */
  resumeFile?: string;
  /** Whether to show progress (default: true) */
  showProgress?: boolean;
  /** Maximum concurrent uploads (default: 4) */
  maxConcurrent?: number;
  /** Callback for progress updates */
  onProgress?: (progress: UploadProgress) => void;
}

/**
 * Configuration constants for large file uploads.
 */
export const LARGE_FILE_CONSTANTS = {
  /** Default chunk size: 10MB */
  DEFAULT_CHUNK_SIZE: 10 * 1024 * 1024,
  /** Minimum chunk size: 5MB (R2 requirement) */
  MIN_CHUNK_SIZE: 5 * 1024 * 1024,
  /** Maximum chunk size: 100MB */
  MAX_CHUNK_SIZE: 100 * 1024 * 1024,
  /** Threshold for using multipart upload: 50MB */
  MULTIPART_THRESHOLD: 50 * 1024 * 1024,
  /** Maximum file size: 5GB */
  MAX_FILE_SIZE: 5 * 1024 * 1024 * 1024,
  /** Maximum concurrent part uploads */
  MAX_CONCURRENT_UPLOADS: 4,
  /** Session TTL: 24 hours in milliseconds */
  SESSION_TTL_MS: 24 * 60 * 60 * 1000,
  /** Retry configuration */
  RETRY: {
    MAX_RETRIES: 3,
    BASE_DELAY_MS: 1000,
    MAX_DELAY_MS: 30000,
    BACKOFF_MULTIPLIER: 2,
  },
} as const;
