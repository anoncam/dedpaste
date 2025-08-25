// Shared type definitions for DedPaste
// Error types
export class DedPasteError extends Error {
    constructor(message, code, statusCode) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.name = 'DedPasteError';
    }
}
export class ValidationError extends DedPasteError {
    constructor(message) {
        super(message, 'VALIDATION_ERROR', 400);
        this.name = 'ValidationError';
    }
}
export class AuthenticationError extends DedPasteError {
    constructor(message) {
        super(message, 'AUTHENTICATION_ERROR', 401);
        this.name = 'AuthenticationError';
    }
}
export class EncryptionError extends DedPasteError {
    constructor(message) {
        super(message, 'ENCRYPTION_ERROR', 500);
        this.name = 'EncryptionError';
    }
}
export class StorageError extends DedPasteError {
    constructor(message) {
        super(message, 'STORAGE_ERROR', 500);
        this.name = 'StorageError';
    }
}
export class RateLimitError extends DedPasteError {
    constructor(message) {
        super(message, 'RATE_LIMIT_ERROR', 429);
        this.name = 'RateLimitError';
    }
}
