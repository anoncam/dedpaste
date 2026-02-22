/**
 * Validation Middleware
 *
 * Provides middleware functions that validate incoming requests
 * and return clear error responses when validation fails.
 */

import type { ValidationResult, ValidationErrorDetail } from "./schemas";

/** Standard JSON error response format */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ValidationErrorDetail[];
  };
}

/** Standard JSON success response format */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/** Union type for API responses */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Create a JSON error response with CORS headers.
 */
export function errorResponse(
  statusCode: number,
  code: string,
  message: string,
  details?: ValidationErrorDetail[],
): Response {
  const body: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };

  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/**
 * Create a JSON success response with CORS headers.
 */
export function successResponse<T>(data: T, statusCode = 200): Response {
  const body: ApiSuccessResponse<T> = {
    success: true,
    data,
  };

  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/**
 * Check a validation result and return an error response if it failed.
 * Returns null if validation passed, allowing the caller to continue.
 */
export function checkValidation<T>(
  result: ValidationResult<T>,
): Response | null {
  if (!result.success) {
    const message =
      result.errors?.map((e) => `${e.field}: ${e.message}`).join("; ") ||
      "Validation failed";

    return errorResponse(
      400,
      "VALIDATION_ERROR",
      message,
      result.errors,
    );
  }
  return null;
}

/**
 * Parse a JSON request body safely.
 * Returns an error response if parsing fails.
 */
export async function parseJsonBody(
  request: Request,
): Promise<{ data: unknown } | { error: Response }> {
  try {
    const data = await request.json();
    return { data };
  } catch {
    return {
      error: errorResponse(
        400,
        "INVALID_JSON",
        "Request body must be valid JSON",
      ),
    };
  }
}

/**
 * Validate that the request method matches expectations.
 */
export function validateMethod(
  request: Request,
  allowed: string[],
): Response | null {
  if (!allowed.includes(request.method)) {
    return errorResponse(
      405,
      "METHOD_NOT_ALLOWED",
      `Method ${request.method} not allowed. Allowed: ${allowed.join(", ")}`,
    );
  }
  return null;
}

/**
 * Create a 404 Not Found response.
 */
export function notFoundResponse(message = "Resource not found"): Response {
  return errorResponse(404, "NOT_FOUND", message);
}

/**
 * Create a 500 Internal Server Error response.
 */
export function internalErrorResponse(
  message = "Internal server error",
): Response {
  return errorResponse(500, "INTERNAL_ERROR", message);
}
