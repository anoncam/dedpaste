/**
 * Request Validation Schemas
 *
 * Provides type-safe validation for all API request payloads.
 * Uses a lightweight validation approach compatible with Cloudflare Workers
 * without requiring the full Zod runtime.
 */

/** Validation error details */
export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
}

/** Result of a validation operation */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationErrorDetail[];
}

/**
 * Create a successful validation result.
 */
function success<T>(data: T): ValidationResult<T> {
  return { success: true, data };
}

/**
 * Create a failed validation result.
 */
function failure<T>(errors: ValidationErrorDetail[]): ValidationResult<T> {
  return { success: false, errors };
}

// ============================================
// Paste Upload Schemas
// ============================================

/** Valid expiration duration values */
const VALID_EXPIRE_DURATIONS = [
  "5m",
  "15m",
  "30m",
  "1h",
  "6h",
  "12h",
  "24h",
  "48h",
  "7d",
  "14d",
  "30d",
];

/** Maximum paste content size (25MB for direct upload) */
const MAX_PASTE_SIZE = 25 * 1024 * 1024;

/** Maximum burn-after-reading count */
const MAX_BURN_READS = 100;

/** Schema for text upload via API */
export interface TextUploadInput {
  content: string;
  oneTime?: boolean;
  isEncrypted?: boolean;
  expireDuration?: string;
  burnAfterReads?: number;
}

/**
 * Validate a text upload request body.
 */
export function validateTextUpload(
  body: unknown,
): ValidationResult<TextUploadInput> {
  const errors: ValidationErrorDetail[] = [];

  if (typeof body !== "object" || body === null) {
    return failure([
      {
        field: "body",
        message: "Request body must be a JSON object",
        code: "invalid_type",
      },
    ]);
  }

  const obj = body as Record<string, unknown>;

  // content: required string, non-empty
  if (typeof obj.content !== "string") {
    errors.push({
      field: "content",
      message: "Content is required and must be a string",
      code: "required",
    });
  } else if (obj.content.length === 0) {
    errors.push({
      field: "content",
      message: "Content cannot be empty",
      code: "too_small",
    });
  } else if (new TextEncoder().encode(obj.content).length > MAX_PASTE_SIZE) {
    errors.push({
      field: "content",
      message: `Content exceeds maximum size of ${MAX_PASTE_SIZE} bytes`,
      code: "too_big",
    });
  }

  // oneTime: optional boolean
  if (obj.oneTime !== undefined && typeof obj.oneTime !== "boolean") {
    errors.push({
      field: "oneTime",
      message: "oneTime must be a boolean",
      code: "invalid_type",
    });
  }

  // isEncrypted: optional boolean
  if (obj.isEncrypted !== undefined && typeof obj.isEncrypted !== "boolean") {
    errors.push({
      field: "isEncrypted",
      message: "isEncrypted must be a boolean",
      code: "invalid_type",
    });
  }

  // expireDuration: optional string, must be valid duration
  if (obj.expireDuration !== undefined) {
    if (typeof obj.expireDuration !== "string") {
      errors.push({
        field: "expireDuration",
        message: "expireDuration must be a string",
        code: "invalid_type",
      });
    } else if (!isValidDuration(obj.expireDuration)) {
      errors.push({
        field: "expireDuration",
        message: `Invalid duration. Valid options: ${VALID_EXPIRE_DURATIONS.join(", ")}, or a custom duration like "2h", "3d"`,
        code: "invalid_enum_value",
      });
    }
  }

  // burnAfterReads: optional number, must be positive integer
  if (obj.burnAfterReads !== undefined) {
    if (typeof obj.burnAfterReads !== "number") {
      errors.push({
        field: "burnAfterReads",
        message: "burnAfterReads must be a number",
        code: "invalid_type",
      });
    } else if (
      !Number.isInteger(obj.burnAfterReads) ||
      obj.burnAfterReads < 1
    ) {
      errors.push({
        field: "burnAfterReads",
        message: "burnAfterReads must be a positive integer",
        code: "too_small",
      });
    } else if (obj.burnAfterReads > MAX_BURN_READS) {
      errors.push({
        field: "burnAfterReads",
        message: `burnAfterReads cannot exceed ${MAX_BURN_READS}`,
        code: "too_big",
      });
    }
  }

  if (errors.length > 0) {
    return failure(errors);
  }

  return success({
    content: obj.content as string,
    oneTime: (obj.oneTime as boolean) || false,
    isEncrypted: (obj.isEncrypted as boolean) || false,
    expireDuration: obj.expireDuration as string | undefined,
    burnAfterReads: obj.burnAfterReads as number | undefined,
  });
}

// ============================================
// Web Upload Schema
// ============================================

/** Schema for web file upload */
export interface WebUploadInput {
  file: File;
  oneTime: boolean;
  expireDuration?: string;
  burnAfterReads?: number;
}

/**
 * Validate a web file upload request (FormData).
 */
export function validateWebUpload(
  formData: FormData,
): ValidationResult<WebUploadInput> {
  const errors: ValidationErrorDetail[] = [];

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    errors.push({
      field: "file",
      message: "A file is required",
      code: "required",
    });
  } else if (file.size === 0) {
    errors.push({
      field: "file",
      message: "File cannot be empty",
      code: "too_small",
    });
  } else if (file.size > MAX_PASTE_SIZE) {
    errors.push({
      field: "file",
      message: `File exceeds maximum size of ${MAX_PASTE_SIZE} bytes. Use multipart upload for larger files.`,
      code: "too_big",
    });
  }

  const oneTimeStr = formData.get("oneTime");
  const oneTime = oneTimeStr === "true";

  const expireDuration = formData.get("expireDuration") as string | null;
  if (expireDuration && !isValidDuration(expireDuration)) {
    errors.push({
      field: "expireDuration",
      message: `Invalid duration. Valid options: ${VALID_EXPIRE_DURATIONS.join(", ")}`,
      code: "invalid_enum_value",
    });
  }

  const burnAfterReadsStr = formData.get("burnAfterReads") as string | null;
  let burnAfterReads: number | undefined;
  if (burnAfterReadsStr) {
    burnAfterReads = parseInt(burnAfterReadsStr, 10);
    if (isNaN(burnAfterReads) || burnAfterReads < 1) {
      errors.push({
        field: "burnAfterReads",
        message: "burnAfterReads must be a positive integer",
        code: "invalid_type",
      });
    } else if (burnAfterReads > MAX_BURN_READS) {
      errors.push({
        field: "burnAfterReads",
        message: `burnAfterReads cannot exceed ${MAX_BURN_READS}`,
        code: "too_big",
      });
    }
  }

  if (errors.length > 0) {
    return failure(errors);
  }

  return success({
    file: file as File,
    oneTime,
    expireDuration: expireDuration || undefined,
    burnAfterReads,
  });
}

// ============================================
// Multipart Upload Schemas
// ============================================

/** Schema for multipart upload init request */
export interface MultipartInitInput {
  filename: string;
  contentType: string;
  totalSize: number;
  totalParts: number;
  isOneTime?: boolean;
  isEncrypted?: boolean;
  encryptionMetadata?: Record<string, unknown>;
}

/**
 * Validate a multipart upload init request.
 */
export function validateMultipartInit(
  body: unknown,
): ValidationResult<MultipartInitInput> {
  const errors: ValidationErrorDetail[] = [];

  if (typeof body !== "object" || body === null) {
    return failure([
      {
        field: "body",
        message: "Request body must be a JSON object",
        code: "invalid_type",
      },
    ]);
  }

  const obj = body as Record<string, unknown>;

  // filename: required string
  if (typeof obj.filename !== "string" || obj.filename.length === 0) {
    errors.push({
      field: "filename",
      message: "filename is required",
      code: "required",
    });
  }

  // contentType: required string
  if (typeof obj.contentType !== "string" || obj.contentType.length === 0) {
    errors.push({
      field: "contentType",
      message: "contentType is required",
      code: "required",
    });
  }

  // totalSize: required positive number
  if (typeof obj.totalSize !== "number" || obj.totalSize <= 0) {
    errors.push({
      field: "totalSize",
      message: "totalSize must be a positive number",
      code: "invalid_type",
    });
  }

  // totalParts: required positive integer
  if (
    typeof obj.totalParts !== "number" ||
    !Number.isInteger(obj.totalParts) ||
    obj.totalParts < 1
  ) {
    errors.push({
      field: "totalParts",
      message: "totalParts must be a positive integer",
      code: "invalid_type",
    });
  }

  if (errors.length > 0) {
    return failure(errors);
  }

  return success({
    filename: obj.filename as string,
    contentType: obj.contentType as string,
    totalSize: obj.totalSize as number,
    totalParts: obj.totalParts as number,
    isOneTime: (obj.isOneTime as boolean) || false,
    isEncrypted: (obj.isEncrypted as boolean) || false,
    encryptionMetadata: obj.encryptionMetadata as
      | Record<string, unknown>
      | undefined,
  });
}

// ============================================
// API v1 Schemas
// ============================================

/** Schema for API v1 paste creation */
export interface ApiV1CreatePasteInput {
  content: string;
  contentType?: string;
  filename?: string;
  isOneTime?: boolean;
  isEncrypted?: boolean;
  expireDuration?: string;
  burnAfterReads?: number;
}

/**
 * Validate an API v1 paste creation request.
 */
export function validateApiV1CreatePaste(
  body: unknown,
): ValidationResult<ApiV1CreatePasteInput> {
  const errors: ValidationErrorDetail[] = [];

  if (typeof body !== "object" || body === null) {
    return failure([
      {
        field: "body",
        message: "Request body must be a JSON object",
        code: "invalid_type",
      },
    ]);
  }

  const obj = body as Record<string, unknown>;

  // content: required string, non-empty
  if (typeof obj.content !== "string") {
    errors.push({
      field: "content",
      message: "content is required and must be a string",
      code: "required",
    });
  } else if (obj.content.length === 0) {
    errors.push({
      field: "content",
      message: "content cannot be empty",
      code: "too_small",
    });
  } else if (new TextEncoder().encode(obj.content).length > MAX_PASTE_SIZE) {
    errors.push({
      field: "content",
      message: `content exceeds maximum size of ${MAX_PASTE_SIZE} bytes`,
      code: "too_big",
    });
  }

  // contentType: optional string
  if (obj.contentType !== undefined && typeof obj.contentType !== "string") {
    errors.push({
      field: "contentType",
      message: "contentType must be a string",
      code: "invalid_type",
    });
  }

  // filename: optional string
  if (obj.filename !== undefined && typeof obj.filename !== "string") {
    errors.push({
      field: "filename",
      message: "filename must be a string",
      code: "invalid_type",
    });
  }

  // isOneTime: optional boolean
  if (obj.isOneTime !== undefined && typeof obj.isOneTime !== "boolean") {
    errors.push({
      field: "isOneTime",
      message: "isOneTime must be a boolean",
      code: "invalid_type",
    });
  }

  // isEncrypted: optional boolean
  if (obj.isEncrypted !== undefined && typeof obj.isEncrypted !== "boolean") {
    errors.push({
      field: "isEncrypted",
      message: "isEncrypted must be a boolean",
      code: "invalid_type",
    });
  }

  // expireDuration: optional valid duration
  if (obj.expireDuration !== undefined) {
    if (typeof obj.expireDuration !== "string") {
      errors.push({
        field: "expireDuration",
        message: "expireDuration must be a string",
        code: "invalid_type",
      });
    } else if (!isValidDuration(obj.expireDuration)) {
      errors.push({
        field: "expireDuration",
        message: `Invalid duration format. Use format like "1h", "24h", "7d". Valid presets: ${VALID_EXPIRE_DURATIONS.join(", ")}`,
        code: "invalid_enum_value",
      });
    }
  }

  // burnAfterReads: optional positive integer
  if (obj.burnAfterReads !== undefined) {
    if (typeof obj.burnAfterReads !== "number") {
      errors.push({
        field: "burnAfterReads",
        message: "burnAfterReads must be a number",
        code: "invalid_type",
      });
    } else if (
      !Number.isInteger(obj.burnAfterReads) ||
      obj.burnAfterReads < 1
    ) {
      errors.push({
        field: "burnAfterReads",
        message: "burnAfterReads must be a positive integer (1 or more)",
        code: "too_small",
      });
    } else if (obj.burnAfterReads > MAX_BURN_READS) {
      errors.push({
        field: "burnAfterReads",
        message: `burnAfterReads cannot exceed ${MAX_BURN_READS}`,
        code: "too_big",
      });
    }
  }

  if (errors.length > 0) {
    return failure(errors);
  }

  return success({
    content: obj.content as string,
    contentType: (obj.contentType as string) || "text/plain",
    filename: obj.filename as string | undefined,
    isOneTime: (obj.isOneTime as boolean) || false,
    isEncrypted: (obj.isEncrypted as boolean) || false,
    expireDuration: obj.expireDuration as string | undefined,
    burnAfterReads: obj.burnAfterReads as number | undefined,
  });
}

// ============================================
// Helpers
// ============================================

/**
 * Check if a duration string is valid.
 * Accepts preset values or custom format like "2h", "3d", "15m".
 */
function isValidDuration(duration: string): boolean {
  // Accept preset values
  if (VALID_EXPIRE_DURATIONS.includes(duration)) {
    return true;
  }
  // Accept custom format: positive integer followed by m, h, d, or w
  const match = duration.match(/^(\d+)([mhdw])$/);
  if (!match) {
    return false;
  }
  const value = parseInt(match[1], 10);
  return value > 0 && value <= 365; // Cap at 365 days for "d" unit
}

/**
 * Format validation errors into a human-readable error response.
 */
export function formatValidationErrors(
  errors: ValidationErrorDetail[],
): string {
  return errors.map((e) => `${e.field}: ${e.message}`).join("; ");
}
