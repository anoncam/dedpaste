/**
 * Service Layer - Central export and factory for all services.
 *
 * Provides dependency injection by constructing services with their
 * dependencies and exposing a single ServiceContainer.
 */

import {
  StorageService,
  type IStorageService,
  type StorageEnv,
} from "./storageService";
import { PasteService, type IPasteService } from "./pasteService";
import {
  EncryptionService,
  type IEncryptionService,
} from "./encryptionService";

// Re-export all service types and interfaces
export type { IStorageService, StorageEnv, StorageGetResult, PasteMetadata } from "./storageService";
export type {
  IPasteService,
  CreatePasteOptions,
  CreatePasteResult,
  GetPasteResult,
} from "./pasteService";
export type { IEncryptionService, EncryptedPayload } from "./encryptionService";
export { StorageService } from "./storageService";
export { PasteService, parseDuration } from "./pasteService";
export { EncryptionService } from "./encryptionService";

/**
 * Container for all services, constructed with environment bindings.
 * This is the main entry point for dependency injection in the worker.
 */
export interface ServiceContainer {
  storage: IStorageService & { initialize: () => Promise<void>; setupBurnAfterReading: (id: string, maxReads: number) => Promise<void> };
  paste: IPasteService;
  encryption: IEncryptionService;
}

/**
 * Create a ServiceContainer with all services wired together.
 * Call `services.storage.initialize()` before first use to load KV state.
 *
 * @param env - Cloudflare Workers environment bindings
 * @returns A fully configured ServiceContainer
 */
export function createServices(env: StorageEnv): ServiceContainer {
  const storage = new StorageService(env);
  const paste = new PasteService(storage);
  const encryption = new EncryptionService();

  return {
    storage,
    paste,
    encryption,
  };
}
