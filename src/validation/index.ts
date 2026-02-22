/**
 * Validation Module - Central export for all validation utilities.
 */

export type {
  ValidationResult,
  ValidationErrorDetail,
  TextUploadInput,
  WebUploadInput,
  MultipartInitInput,
  ApiV1CreatePasteInput,
} from "./schemas";

export {
  validateTextUpload,
  validateWebUpload,
  validateMultipartInit,
  validateApiV1CreatePaste,
  formatValidationErrors,
} from "./schemas";

export type {
  ApiErrorResponse,
  ApiSuccessResponse,
  ApiResponse,
} from "./middleware";

export {
  errorResponse,
  successResponse,
  checkValidation,
  parseJsonBody,
  validateMethod,
  notFoundResponse,
  internalErrorResponse,
} from "./middleware";
