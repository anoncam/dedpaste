/**
 * Resume state management for interrupted large file uploads.
 * Persists upload state to disk for resume capability.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as os from "os";
import type { ResumeState, UploadStatusResponse } from "../src/types/index.js";

/**
 * Directory for storing resume state files.
 */
const RESUME_DIR = path.join(os.homedir(), ".dedpaste", "uploads");

/**
 * Ensure the resume directory exists.
 */
export function ensureResumeDir(): void {
  if (!fs.existsSync(RESUME_DIR)) {
    fs.mkdirSync(RESUME_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Get the path to a resume state file.
 */
export function getResumeFilePath(sessionId: string): string {
  return path.join(RESUME_DIR, `${sessionId}.json`);
}

/**
 * Calculate MD5 hash of the first 1MB of a file.
 * Used to verify file hasn't changed when resuming.
 */
export async function hashFileHead(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("md5");
    const stream = fs.createReadStream(filePath, {
      start: 0,
      end: 1024 * 1024 - 1, // First 1MB
    });

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/**
 * Save resume state to disk.
 */
export async function saveResumeState(state: ResumeState): Promise<string> {
  ensureResumeDir();

  const filePath = getResumeFilePath(state.sessionId);
  state.lastUpdatedAt = Date.now();

  await fs.promises.writeFile(filePath, JSON.stringify(state, null, 2), {
    mode: 0o600,
  });

  return filePath;
}

/**
 * Load resume state from disk.
 */
export async function loadResumeState(
  sessionIdOrPath: string,
): Promise<ResumeState | null> {
  let filePath: string;

  // Check if it's a path or session ID
  if (
    sessionIdOrPath.includes(path.sep) ||
    sessionIdOrPath.endsWith(".json")
  ) {
    filePath = sessionIdOrPath;
  } else {
    filePath = getResumeFilePath(sessionIdOrPath);
  }

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    return JSON.parse(content) as ResumeState;
  } catch (error) {
    console.error(`Failed to load resume state from ${filePath}:`, error);
    return null;
  }
}

/**
 * Delete resume state file.
 */
export async function deleteResumeState(sessionId: string): Promise<void> {
  const filePath = getResumeFilePath(sessionId);
  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
  }
}

/**
 * List all resume state files.
 */
export async function listResumeStates(): Promise<ResumeState[]> {
  ensureResumeDir();

  const files = await fs.promises.readdir(RESUME_DIR);
  const states: ResumeState[] = [];

  for (const file of files) {
    if (file.endsWith(".json")) {
      const state = await loadResumeState(path.join(RESUME_DIR, file));
      if (state) {
        states.push(state);
      }
    }
  }

  return states;
}

/**
 * Clean up expired or completed resume states.
 */
export async function cleanupResumeStates(maxAgeMs: number): Promise<number> {
  const states = await listResumeStates();
  let cleaned = 0;
  const now = Date.now();

  for (const state of states) {
    const age = now - state.createdAt;
    if (age > maxAgeMs) {
      await deleteResumeState(state.sessionId);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Verify a resume state is valid for the given file.
 * Checks that the file exists and hasn't changed.
 */
export async function verifyResumeState(
  state: ResumeState,
): Promise<{ valid: boolean; error?: string }> {
  // Check file exists
  if (!fs.existsSync(state.filePath)) {
    return { valid: false, error: "File not found" };
  }

  // Check file size matches
  const stats = fs.statSync(state.filePath);
  if (stats.size !== state.totalSize) {
    return {
      valid: false,
      error: `File size changed (expected ${state.totalSize}, got ${stats.size})`,
    };
  }

  // Check file hash
  const currentHash = await hashFileHead(state.filePath);
  if (currentHash !== state.fileHash) {
    return { valid: false, error: "File content has changed" };
  }

  return { valid: true };
}

/**
 * Verify session is still valid on the server.
 */
export async function verifyServerSession(
  state: ResumeState,
): Promise<{ valid: boolean; serverState?: UploadStatusResponse; error?: string }> {
  try {
    const response = await fetch(
      `${state.apiUrl}/upload/${state.sessionId}/status`,
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return {
        valid: false,
        error: (body as { error?: string }).error || `Server returned ${response.status}`,
      };
    }

    const serverState = (await response.json()) as UploadStatusResponse;
    return { valid: serverState.isValid, serverState };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to contact server: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Create initial resume state for a new upload.
 */
export async function createResumeState(
  sessionId: string,
  filePath: string,
  options: {
    apiUrl: string;
    chunkSize: number;
    isEncrypted: boolean;
    isOneTime: boolean;
    filename: string;
    contentType: string;
    encryptedKey?: string;
  },
): Promise<ResumeState> {
  const stats = fs.statSync(filePath);
  const fileHash = await hashFileHead(filePath);

  const state: ResumeState = {
    sessionId,
    filePath: path.resolve(filePath),
    fileHash,
    totalSize: stats.size,
    chunkSize: options.chunkSize,
    uploadedParts: [],
    isEncrypted: options.isEncrypted,
    encryptedKey: options.encryptedKey,
    createdAt: Date.now(),
    lastUpdatedAt: Date.now(),
    apiUrl: options.apiUrl,
    isOneTime: options.isOneTime,
    filename: options.filename,
    contentType: options.contentType,
  };

  return state;
}

/**
 * Update resume state with a newly uploaded part.
 */
export async function updateResumeStatePart(
  state: ResumeState,
  partNumber: number,
  etag: string,
): Promise<void> {
  // Add part if not already present
  const existingIndex = state.uploadedParts.findIndex(
    (p) => p.partNumber === partNumber,
  );
  if (existingIndex >= 0) {
    state.uploadedParts[existingIndex] = { partNumber, etag };
  } else {
    state.uploadedParts.push({ partNumber, etag });
  }

  // Sort parts by number
  state.uploadedParts.sort((a, b) => a.partNumber - b.partNumber);

  // Save updated state
  await saveResumeState(state);
}

/**
 * Format resume state for display.
 */
export function formatResumeState(state: ResumeState): string {
  const uploadedParts = state.uploadedParts.length;
  const totalParts = Math.ceil(state.totalSize / state.chunkSize);
  const uploadedBytes = state.uploadedParts.length * state.chunkSize;
  const percent = ((uploadedParts / totalParts) * 100).toFixed(1);
  const age = Date.now() - state.createdAt;
  const ageStr = formatDuration(age);

  return [
    `Session: ${state.sessionId}`,
    `File: ${state.filePath}`,
    `Progress: ${uploadedParts}/${totalParts} parts (${percent}%)`,
    `Size: ${formatBytes(uploadedBytes)} / ${formatBytes(state.totalSize)}`,
    `Started: ${ageStr} ago`,
    `Encrypted: ${state.isEncrypted ? "Yes" : "No"}`,
    `One-time: ${state.isOneTime ? "Yes" : "No"}`,
  ].join("\n");
}

/**
 * Format bytes to human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Format duration in milliseconds to human-readable string.
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Register SIGINT handler for graceful interruption.
 * Returns a function to remove the handler.
 */
export function registerInterruptHandler(
  state: ResumeState,
  onInterrupt?: () => void,
): () => void {
  const handler = async () => {
    console.log("\n⚠️  Upload interrupted. Saving state for resume...");
    await saveResumeState(state);
    const resumeFile = getResumeFilePath(state.sessionId);
    console.log(`Resume with: dedpaste upload --resume "${resumeFile}"`);
    if (onInterrupt) {
      onInterrupt();
    }
    process.exit(1);
  };

  process.on("SIGINT", handler);

  return () => {
    process.removeListener("SIGINT", handler);
  };
}
