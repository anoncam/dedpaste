/**
 * Large file upload module with multipart support.
 * Handles streaming uploads with progress, resume, and parallel chunk uploads.
 */

import * as fs from "fs";
import * as path from "path";
import { lookup } from "mime-types";
import { Readable } from "stream";
import type {
  LargeUploadOptions,
  UploadProgress,
  MultipartInitResponse,
  PartUploadResponse,
  MultipartCompleteResponse,
  UploadStatusResponse,
  ResumeState,
} from "../src/types/index.js";
import { LARGE_FILE_CONSTANTS } from "../src/types/index.js";
import { ProgressBar, createProgressCallback } from "./progressDisplay.js";
import {
  createResumeState,
  saveResumeState,
  loadResumeState,
  deleteResumeState,
  updateResumeStatePart,
  verifyResumeState,
  verifyServerSession,
  registerInterruptHandler,
  getResumeFilePath,
} from "./resumeState.js";

/**
 * Check if a file should use multipart upload based on size.
 */
export function shouldUseMultipart(filePath: string): boolean {
  const stats = fs.statSync(filePath);
  return stats.size > LARGE_FILE_CONSTANTS.MULTIPART_THRESHOLD;
}

/**
 * Calculate optimal chunk size based on file size.
 * Aims for reasonable number of parts (100-500) while respecting limits.
 */
export function calculateChunkSize(totalSize: number): number {
  // Target around 200 parts for optimal parallelism and progress granularity
  const targetParts = 200;
  let chunkSize = Math.ceil(totalSize / targetParts);

  // Enforce minimum and maximum chunk sizes
  chunkSize = Math.max(chunkSize, LARGE_FILE_CONSTANTS.MIN_CHUNK_SIZE);
  chunkSize = Math.min(chunkSize, LARGE_FILE_CONSTANTS.MAX_CHUNK_SIZE);

  // Round to nearest MB for cleaner numbers
  const MB = 1024 * 1024;
  chunkSize = Math.ceil(chunkSize / MB) * MB;

  return chunkSize;
}

/**
 * Calculate total number of parts for a file.
 */
export function calculateTotalParts(totalSize: number, chunkSize: number): number {
  return Math.ceil(totalSize / chunkSize);
}

/**
 * Upload a large file using multipart upload.
 */
export async function uploadLargeFile(
  filePath: string,
  options: LargeUploadOptions,
): Promise<string> {
  const {
    apiUrl,
    chunkSize: customChunkSize,
    isOneTime = false,
    isEncrypted = false,
    showProgress = true,
    maxConcurrent = LARGE_FILE_CONSTANTS.MAX_CONCURRENT_UPLOADS,
    onProgress,
  } = options;

  // Validate file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const stats = fs.statSync(filePath);
  const totalSize = stats.size;
  const filename = path.basename(filePath);
  const contentType = lookup(filePath) || "application/octet-stream";

  // Validate file size
  if (totalSize > LARGE_FILE_CONSTANTS.MAX_FILE_SIZE) {
    throw new Error(
      `File too large. Maximum size is ${LARGE_FILE_CONSTANTS.MAX_FILE_SIZE / (1024 * 1024 * 1024)}GB`,
    );
  }

  // Calculate chunk size
  const chunkSize = customChunkSize || calculateChunkSize(totalSize);
  const totalParts = calculateTotalParts(totalSize, chunkSize);

  // Set up progress tracking
  let progressBar: ProgressBar | undefined;
  let uploadedBytes = 0;

  if (showProgress) {
    progressBar = new ProgressBar();
  }

  const updateProgress = (currentPart: number, partBytes: number = 0) => {
    const progress: UploadProgress = {
      totalBytes: totalSize,
      uploadedBytes: uploadedBytes + partBytes,
      currentPart,
      totalParts,
      speed: 0, // Calculated by progress bar
      eta: 0, // Calculated by progress bar
      percent: ((uploadedBytes + partBytes) / totalSize) * 100,
    };

    if (progressBar) {
      progressBar.update(progress);
    }
    if (onProgress) {
      onProgress(progress);
    }
  };

  // Initialize multipart upload
  const initEndpoint = isEncrypted
    ? `${apiUrl}/e/upload/init`
    : `${apiUrl}/upload/init`;

  const initResponse = await fetch(initEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename,
      contentType: isEncrypted ? "application/json" : contentType,
      totalSize,
      totalParts,
      isOneTime,
      isEncrypted,
    }),
  });

  if (!initResponse.ok) {
    const error = await initResponse.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(
      `Failed to initialize upload: ${(error as { error?: string }).error || initResponse.statusText}`,
    );
  }

  const { sessionId, pasteId } = (await initResponse.json()) as MultipartInitResponse;

  // Create resume state
  const resumeState = await createResumeState(sessionId, filePath, {
    apiUrl,
    chunkSize,
    isEncrypted,
    isOneTime,
    filename,
    contentType,
  });

  // Save initial state
  await saveResumeState(resumeState);

  // Register interrupt handler
  const removeHandler = registerInterruptHandler(resumeState);

  try {
    // Upload parts with concurrency control
    const uploadedParts: Array<{ partNumber: number; etag: string }> = [];
    const partQueue: number[] = [];

    // Build queue of parts to upload
    for (let i = 1; i <= totalParts; i++) {
      partQueue.push(i);
    }

    // Process queue with concurrency limit
    const activeUploads: Map<number, Promise<void>> = new Map();

    const uploadPart = async (partNumber: number): Promise<void> => {
      const start = (partNumber - 1) * chunkSize;
      const end = Math.min(start + chunkSize, totalSize);
      const partSize = end - start;

      // Read chunk from file
      const buffer = Buffer.alloc(partSize);
      const fd = fs.openSync(filePath, "r");
      try {
        fs.readSync(fd, buffer, 0, partSize, start);
      } finally {
        fs.closeSync(fd);
      }

      // Upload with retry
      let lastError: Error | undefined;
      for (
        let attempt = 0;
        attempt <= LARGE_FILE_CONSTANTS.RETRY.MAX_RETRIES;
        attempt++
      ) {
        try {
          const partEndpoint = isEncrypted
            ? `${apiUrl}/e/upload/${sessionId}/part/${partNumber}`
            : `${apiUrl}/upload/${sessionId}/part/${partNumber}`;

          const response = await fetch(partEndpoint, {
            method: "PUT",
            headers: {
              "Content-Type": "application/octet-stream",
              "Content-Length": String(partSize),
            },
            body: buffer,
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({ error: "Unknown error" }));
            throw new Error(
              (error as { error?: string }).error || `HTTP ${response.status}`,
            );
          }

          const { etag } = (await response.json()) as PartUploadResponse;

          // Update state
          uploadedParts.push({ partNumber, etag });
          await updateResumeStatePart(resumeState, partNumber, etag);
          uploadedBytes += partSize;
          updateProgress(partNumber);

          return;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          if (attempt < LARGE_FILE_CONSTANTS.RETRY.MAX_RETRIES) {
            const delay = Math.min(
              LARGE_FILE_CONSTANTS.RETRY.BASE_DELAY_MS *
                Math.pow(LARGE_FILE_CONSTANTS.RETRY.BACKOFF_MULTIPLIER, attempt),
              LARGE_FILE_CONSTANTS.RETRY.MAX_DELAY_MS,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      throw new Error(`Failed to upload part ${partNumber}: ${lastError?.message}`);
    };

    // Process queue
    while (partQueue.length > 0 || activeUploads.size > 0) {
      // Start new uploads up to concurrency limit
      while (partQueue.length > 0 && activeUploads.size < maxConcurrent) {
        const partNumber = partQueue.shift()!;
        const promise = uploadPart(partNumber).finally(() => {
          activeUploads.delete(partNumber);
        });
        activeUploads.set(partNumber, promise);
      }

      // Wait for at least one upload to complete
      if (activeUploads.size > 0) {
        await Promise.race(activeUploads.values());
      }
    }

    // Sort parts by number
    uploadedParts.sort((a, b) => a.partNumber - b.partNumber);

    // Complete the upload
    const completeEndpoint = isEncrypted
      ? `${apiUrl}/e/upload/${sessionId}/complete`
      : `${apiUrl}/upload/${sessionId}/complete`;

    const completeResponse = await fetch(completeEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parts: uploadedParts }),
    });

    if (!completeResponse.ok) {
      const error = await completeResponse.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(
        `Failed to complete upload: ${(error as { error?: string }).error || completeResponse.statusText}`,
      );
    }

    const { url } = (await completeResponse.json()) as MultipartCompleteResponse;

    // Clean up
    removeHandler();
    await deleteResumeState(sessionId);

    if (progressBar) {
      progressBar.complete(totalSize);
    }

    return url;
  } catch (error) {
    removeHandler();
    if (progressBar) {
      progressBar.fail(error instanceof Error ? error.message : "Upload failed");
    }
    throw error;
  }
}

/**
 * Resume an interrupted upload.
 */
export async function resumeUpload(
  resumeFileOrId: string,
  options: Partial<LargeUploadOptions> = {},
): Promise<string> {
  // Load resume state
  const resumeState = await loadResumeState(resumeFileOrId);
  if (!resumeState) {
    throw new Error(`Resume state not found: ${resumeFileOrId}`);
  }

  // Verify file hasn't changed
  const fileCheck = await verifyResumeState(resumeState);
  if (!fileCheck.valid) {
    throw new Error(`Cannot resume: ${fileCheck.error}`);
  }

  // Verify server session is still valid
  const serverCheck = await verifyServerSession(resumeState);
  if (!serverCheck.valid) {
    throw new Error(`Cannot resume: ${serverCheck.error}`);
  }

  const {
    showProgress = true,
    maxConcurrent = LARGE_FILE_CONSTANTS.MAX_CONCURRENT_UPLOADS,
    onProgress,
  } = options;

  const { sessionId, filePath, chunkSize, totalSize, isEncrypted, apiUrl } =
    resumeState;

  const totalParts = calculateTotalParts(totalSize, chunkSize);

  // Calculate already uploaded bytes
  let uploadedBytes = resumeState.uploadedParts.length * chunkSize;
  // Adjust for last part potentially being smaller
  const lastUploadedPart = Math.max(
    ...resumeState.uploadedParts.map((p) => p.partNumber),
    0,
  );
  if (lastUploadedPart === totalParts) {
    const lastPartSize = totalSize - (totalParts - 1) * chunkSize;
    uploadedBytes = (totalParts - 1) * chunkSize + lastPartSize;
  }

  // Set up progress tracking
  let progressBar: ProgressBar | undefined;

  if (showProgress) {
    progressBar = new ProgressBar();
    console.log(
      `Resuming upload: ${resumeState.uploadedParts.length}/${totalParts} parts already uploaded`,
    );
  }

  const updateProgress = (currentPart: number, partBytes: number = 0) => {
    const progress: UploadProgress = {
      totalBytes: totalSize,
      uploadedBytes: uploadedBytes + partBytes,
      currentPart,
      totalParts,
      speed: 0,
      eta: 0,
      percent: ((uploadedBytes + partBytes) / totalSize) * 100,
    };

    if (progressBar) {
      progressBar.update(progress);
    }
    if (onProgress) {
      onProgress(progress);
    }
  };

  // Register interrupt handler
  const removeHandler = registerInterruptHandler(resumeState);

  try {
    // Build queue of parts that still need to be uploaded
    const uploadedPartNumbers = new Set(
      resumeState.uploadedParts.map((p) => p.partNumber),
    );
    const partQueue: number[] = [];

    for (let i = 1; i <= totalParts; i++) {
      if (!uploadedPartNumbers.has(i)) {
        partQueue.push(i);
      }
    }

    // Upload remaining parts
    const activeUploads: Map<number, Promise<void>> = new Map();

    const uploadPart = async (partNumber: number): Promise<void> => {
      const start = (partNumber - 1) * chunkSize;
      const end = Math.min(start + chunkSize, totalSize);
      const partSize = end - start;

      // Read chunk from file
      const buffer = Buffer.alloc(partSize);
      const fd = fs.openSync(filePath, "r");
      try {
        fs.readSync(fd, buffer, 0, partSize, start);
      } finally {
        fs.closeSync(fd);
      }

      // Upload with retry
      let lastError: Error | undefined;
      for (
        let attempt = 0;
        attempt <= LARGE_FILE_CONSTANTS.RETRY.MAX_RETRIES;
        attempt++
      ) {
        try {
          const partEndpoint = isEncrypted
            ? `${apiUrl}/e/upload/${sessionId}/part/${partNumber}`
            : `${apiUrl}/upload/${sessionId}/part/${partNumber}`;

          const response = await fetch(partEndpoint, {
            method: "PUT",
            headers: {
              "Content-Type": "application/octet-stream",
              "Content-Length": String(partSize),
            },
            body: buffer,
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({ error: "Unknown error" }));
            throw new Error(
              (error as { error?: string }).error || `HTTP ${response.status}`,
            );
          }

          const { etag } = (await response.json()) as PartUploadResponse;

          // Update state
          await updateResumeStatePart(resumeState, partNumber, etag);
          uploadedBytes += partSize;
          updateProgress(partNumber);

          return;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          if (attempt < LARGE_FILE_CONSTANTS.RETRY.MAX_RETRIES) {
            const delay = Math.min(
              LARGE_FILE_CONSTANTS.RETRY.BASE_DELAY_MS *
                Math.pow(LARGE_FILE_CONSTANTS.RETRY.BACKOFF_MULTIPLIER, attempt),
              LARGE_FILE_CONSTANTS.RETRY.MAX_DELAY_MS,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      throw new Error(`Failed to upload part ${partNumber}: ${lastError?.message}`);
    };

    // Process queue
    while (partQueue.length > 0 || activeUploads.size > 0) {
      while (partQueue.length > 0 && activeUploads.size < maxConcurrent) {
        const partNumber = partQueue.shift()!;
        const promise = uploadPart(partNumber).finally(() => {
          activeUploads.delete(partNumber);
        });
        activeUploads.set(partNumber, promise);
      }

      if (activeUploads.size > 0) {
        await Promise.race(activeUploads.values());
      }
    }

    // Build complete parts list
    const allParts = resumeState.uploadedParts
      .map((p) => ({ partNumber: p.partNumber, etag: p.etag }))
      .sort((a, b) => a.partNumber - b.partNumber);

    // Complete the upload
    const completeEndpoint = isEncrypted
      ? `${apiUrl}/e/upload/${sessionId}/complete`
      : `${apiUrl}/upload/${sessionId}/complete`;

    const completeResponse = await fetch(completeEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parts: allParts }),
    });

    if (!completeResponse.ok) {
      const error = await completeResponse.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(
        `Failed to complete upload: ${(error as { error?: string }).error || completeResponse.statusText}`,
      );
    }

    const { url } = (await completeResponse.json()) as MultipartCompleteResponse;

    // Clean up
    removeHandler();
    await deleteResumeState(sessionId);

    if (progressBar) {
      progressBar.complete(totalSize);
    }

    return url;
  } catch (error) {
    removeHandler();
    if (progressBar) {
      progressBar.fail(error instanceof Error ? error.message : "Upload failed");
    }
    throw error;
  }
}

/**
 * Abort an in-progress upload.
 */
export async function abortUpload(
  resumeFileOrId: string,
): Promise<void> {
  const resumeState = await loadResumeState(resumeFileOrId);
  if (!resumeState) {
    console.log("Resume state not found - may already be cleaned up");
    return;
  }

  try {
    const abortEndpoint = resumeState.isEncrypted
      ? `${resumeState.apiUrl}/e/upload/${resumeState.sessionId}/abort`
      : `${resumeState.apiUrl}/upload/${resumeState.sessionId}/abort`;

    await fetch(abortEndpoint, { method: "POST" });
  } catch (error) {
    // Ignore abort errors
  }

  await deleteResumeState(resumeState.sessionId);
  console.log("Upload aborted and cleaned up");
}

/**
 * Get upload status from server.
 */
export async function getUploadStatus(
  apiUrl: string,
  sessionId: string,
  isEncrypted: boolean = false,
): Promise<UploadStatusResponse> {
  const statusEndpoint = isEncrypted
    ? `${apiUrl}/e/upload/${sessionId}/status`
    : `${apiUrl}/upload/${sessionId}/status`;

  const response = await fetch(statusEndpoint);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(
      (error as { error?: string }).error || `HTTP ${response.status}`,
    );
  }

  return (await response.json()) as UploadStatusResponse;
}
