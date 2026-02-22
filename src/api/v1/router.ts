/**
 * API v1 Router
 *
 * Handles all /api/v1/ prefixed routes with structured JSON responses,
 * proper HTTP status codes, and validation.
 */

import type { ServiceContainer } from "../../services";
import type { WorkerAnalytics } from "../../analytics";
import {
  validateApiV1CreatePaste,
  checkValidation,
  parseJsonBody,
  successResponse,
  errorResponse,
  notFoundResponse,
  internalErrorResponse,
} from "../../validation";

/** Cloudflare Workers environment bindings */
interface Env {
  PASTE_BUCKET: R2Bucket;
  PASTE_METADATA?: KVNamespace;
  UPLOAD_SESSIONS?: KVNamespace;
}

/** API version info */
const API_VERSION = "v1";
const API_PREFIX = `/api/${API_VERSION}`;

/**
 * Route an API v1 request to the appropriate handler.
 * Returns null if the path does not match any API v1 route.
 */
export async function routeApiV1(
  request: Request,
  _env: Env,
  services: ServiceContainer,
  analytics: WorkerAnalytics | null,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Only handle /api/v1/ routes
  if (!path.startsWith(API_PREFIX)) {
    return null;
  }

  const subPath = path.slice(API_PREFIX.length);

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // Route table
  try {
    // Health check
    if (subPath === "/health" && request.method === "GET") {
      return handleHealth();
    }

    // Paste CRUD
    if (subPath === "/paste" && request.method === "POST") {
      return await handleCreatePaste(request, services, analytics);
    }

    // Get paste by ID
    const pasteMatch = subPath.match(/^\/paste\/([a-zA-Z0-9]{8})$/);
    if (pasteMatch && request.method === "GET") {
      return await handleGetPaste(pasteMatch[1], false, services);
    }

    // Get encrypted paste by ID
    const encPasteMatch = subPath.match(/^\/paste\/e\/([a-zA-Z0-9]{8})$/);
    if (encPasteMatch && request.method === "GET") {
      return await handleGetPaste(encPasteMatch[1], true, services);
    }

    // Delete paste
    const deleteMatch = subPath.match(/^\/paste\/([a-zA-Z0-9]{8})$/);
    if (deleteMatch && request.method === "DELETE") {
      return await handleDeletePaste(deleteMatch[1], services);
    }

    // Paste info (metadata only)
    const infoMatch = subPath.match(/^\/paste\/([a-zA-Z0-9]{8})\/info$/);
    if (infoMatch && request.method === "GET") {
      return await handlePasteInfo(infoMatch[1], services);
    }

    return notFoundResponse(`No API route matches ${request.method} ${subPath}`);
  } catch (error) {
    console.error(`[API v1] Error handling ${request.method} ${subPath}:`, error);
    return internalErrorResponse(
      "An unexpected error occurred while processing your request",
    );
  }
}

// ============================================
// Route Handlers
// ============================================

/**
 * GET /api/v1/health
 * Health check endpoint that verifies service availability.
 */
function handleHealth(): Response {
  return successResponse({
    status: "healthy",
    version: API_VERSION,
    timestamp: new Date().toISOString(),
    services: {
      storage: "available",
      encryption: "available",
    },
  });
}

/**
 * POST /api/v1/paste
 * Create a new paste with full validation and structured response.
 */
async function handleCreatePaste(
  request: Request,
  services: ServiceContainer,
  analytics: WorkerAnalytics | null,
): Promise<Response> {
  // Parse and validate the request body
  const parsed = await parseJsonBody(request);
  if ("error" in parsed) {
    return parsed.error;
  }

  const validation = validateApiV1CreatePaste(parsed.data);
  const validationError = checkValidation(validation);
  if (validationError) {
    return validationError;
  }

  const input = validation.data!;
  const baseUrl = new URL(request.url).origin;

  try {
    const result = await services.paste.createPaste(
      input.content,
      {
        isEncrypted: input.isEncrypted || false,
        isOneTime: input.isOneTime || false,
        contentType: input.contentType || "text/plain",
        filename: input.filename,
        expireDuration: input.expireDuration,
        burnAfterReads: input.burnAfterReads,
      },
      baseUrl,
    );

    // Track paste creation
    if (analytics) {
      await analytics.trackPasteCreated(request, {
        is_encrypted: input.isEncrypted || false,
        is_one_time: input.isOneTime || false,
        content_type: input.contentType || "text/plain",
        size_bytes: new TextEncoder().encode(input.content).length,
      });
    }

    return successResponse(
      {
        id: result.id,
        url: result.url,
        isEncrypted: result.isEncrypted,
        isBurnAfterReading: result.isBurnAfterReading,
        ...(result.expiresAt
          ? { expiresAt: new Date(result.expiresAt).toISOString() }
          : {}),
        ...(result.remainingReads !== undefined
          ? { remainingReads: result.remainingReads }
          : {}),
      },
      201,
    );
  } catch (error) {
    console.error("[API v1] Error creating paste:", error);
    return internalErrorResponse("Failed to create paste");
  }
}

/**
 * GET /api/v1/paste/:id or GET /api/v1/paste/e/:id
 * Retrieve a paste by ID with structured response.
 */
async function handleGetPaste(
  id: string,
  isEncrypted: boolean,
  services: ServiceContainer,
): Promise<Response> {
  try {
    const result = await services.paste.getPaste(id, isEncrypted);

    if (!result) {
      return notFoundResponse("Paste not found or has expired");
    }

    // For API responses, return JSON with content
    const content = await result.arrayBuffer();
    const textContent = new TextDecoder().decode(content);

    return successResponse({
      id,
      content: textContent,
      contentType: result.contentType,
      filename: result.filename || null,
      size: result.size,
      isOneTime: result.isOneTime,
      isEncrypted: result.isEncrypted,
      createdAt: new Date(result.createdAt).toISOString(),
      ...(result.expiresAt
        ? { expiresAt: new Date(result.expiresAt).toISOString() }
        : {}),
      ...(result.remainingReads !== undefined
        ? { remainingReads: result.remainingReads }
        : {}),
    });
  } catch (error) {
    console.error(`[API v1] Error retrieving paste ${id}:`, error);
    return internalErrorResponse("Failed to retrieve paste");
  }
}

/**
 * DELETE /api/v1/paste/:id
 * Delete a paste by ID.
 */
async function handleDeletePaste(
  id: string,
  services: ServiceContainer,
): Promise<Response> {
  try {
    await services.paste.deletePaste(id);

    return successResponse({
      id,
      deleted: true,
    });
  } catch (error) {
    console.error(`[API v1] Error deleting paste ${id}:`, error);
    return internalErrorResponse("Failed to delete paste");
  }
}

/**
 * GET /api/v1/paste/:id/info
 * Get paste metadata without consuming a burn-after-reading read.
 * This is a lightweight endpoint for checking paste existence and metadata.
 */
async function handlePasteInfo(
  id: string,
  services: ServiceContainer,
): Promise<Response> {
  try {
    // Use the storage service directly for a metadata-only check
    const metadata = await services.storage.getMetadata(`reads:${id}`);

    // Basic info response
    const info: Record<string, unknown> = {
      id,
      exists: true,
    };

    if (metadata) {
      const data = JSON.parse(metadata) as {
        remaining: number;
        max: number;
      };
      info.burnAfterReading = true;
      info.remainingReads = data.remaining;
      info.maxReads = data.max;
    }

    return successResponse(info);
  } catch (error) {
    console.error(`[API v1] Error getting paste info ${id}:`, error);
    return internalErrorResponse("Failed to get paste info");
  }
}
