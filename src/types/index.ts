// Shared type definitions for DedPaste

// Key types
export interface KeyInfo {
  type: 'self' | 'friend' | 'pgp' | 'keybase' | 'gpg';
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
  id?: string;
  source?: 'self' | 'friend' | 'pgp' | 'keybase' | 'gpg';
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
  };
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
  type: 'self' | 'friend' | 'pgp' | 'keybase';
  name: string;
  fingerprint: string;
  username?: string;
  email?: string;
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
  password?: string;
}

export interface PasteResponse {
  url: string;
  id: string;
  expiresAt?: string;
  encrypted?: boolean;
  requiresPassword?: boolean;
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

// Interactive mode types
export interface InteractiveChoice {
  name: string;
  value: string;
  short?: string;
}

export interface KeyManagementAction {
  action: 'list' | 'add' | 'remove' | 'export' | 'generate' | 'import';
  keyType?: 'friend' | 'pgp' | 'keybase';
  keyName?: string;
  keyData?: string;
}

// Error types
export class DedPasteError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'DedPasteError';
  }
}

export class ValidationError extends DedPasteError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends DedPasteError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class EncryptionError extends DedPasteError {
  constructor(message: string) {
    super(message, 'ENCRYPTION_ERROR', 500);
    this.name = 'EncryptionError';
  }
}

export class StorageError extends DedPasteError {
  constructor(message: string) {
    super(message, 'STORAGE_ERROR', 500);
    this.name = 'StorageError';
  }
}

export class RateLimitError extends DedPasteError {
  constructor(message: string) {
    super(message, 'RATE_LIMIT_ERROR', 429);
    this.name = 'RateLimitError';
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
  theme?: 'dark' | 'light' | 'auto';
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
  status: 'ok' | 'warning' | 'error';
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
  type: 'rsa' | 'dsa' | 'elgamal' | 'ecdh' | 'ecdsa' | 'eddsa' | string;
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
  source: 'self' | 'friend' | 'pgp' | 'keybase' | 'gpg';
}

export interface ImportKeyOptions {
  source: 'file' | 'pgp-server' | 'keybase' | 'gpg-keyring' | 'gpg-import' | 'paste';
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