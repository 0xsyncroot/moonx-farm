import { z } from 'zod';
import { ValidationError } from '../errors';

/**
 * Validation utility functions
 */

/**
 * Validates input data against a Zod schema
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validated and transformed data
 * @throws ValidationError if validation fails
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const fields: Record<string, string[]> = {};
    
    result.error.errors.forEach(err => {
      const fieldPath = err.path.join('.');
      if (!fields[fieldPath]) {
        fields[fieldPath] = [];
      }
      fields[fieldPath].push(err.message);
    });
    
    throw new ValidationError('Validation failed', fields);
  }
  
  return result.data;
}

/**
 * Validates input data and returns result without throwing
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validation result object
 */
export function safeValidateInput<T>(
  schema: z.ZodSchema<T>, 
  data: unknown
): { success: true; data: T } | { success: false; errors: any[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
  
  return { success: false, errors };
}

/**
 * Sanitizes a string by trimming whitespace and removing potentially dangerous characters
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>\"'&]/g, '') // Remove potentially dangerous HTML characters
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Validates and sanitizes an amount string
 * @param amount - Amount string to validate
 * @param min - Minimum allowed value (optional)
 * @param max - Maximum allowed value (optional)
 * @returns Sanitized amount string
 * @throws ValidationError if validation fails
 */
export function validateAmount(amount: string, min?: string, max?: string): string {
  // Remove non-numeric characters except decimal point
  const sanitized = amount.replace(/[^0-9.]/g, '');
  const num = parseFloat(sanitized);
  
  if (isNaN(num) || num < 0) {
    throw new ValidationError('Invalid amount format');
  }
  
  if (min && num < parseFloat(min)) {
    throw new ValidationError(`Amount must be at least ${min}`);
  }
  
  if (max && num > parseFloat(max)) {
    throw new ValidationError(`Amount must not exceed ${max}`);
  }
  
  return sanitized;
}

/**
 * Validates an Ethereum address
 * @param address - Address to validate
 * @returns Normalized (lowercase) address
 * @throws ValidationError if invalid
 */
export function validateAddress(address: string): string {
  const normalized = address.toLowerCase();
  
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
    throw new ValidationError('Invalid Ethereum address format');
  }
  
  return normalized;
}

/**
 * Validates a transaction hash
 * @param hash - Transaction hash to validate
 * @returns Normalized (lowercase) hash
 * @throws ValidationError if invalid
 */
export function validateTransactionHash(hash: string): string {
  const normalized = hash.toLowerCase();
  
  if (!/^0x[a-f0-9]{64}$/.test(normalized)) {
    throw new ValidationError('Invalid transaction hash format');
  }
  
  return normalized;
}

/**
 * Validates an email address
 * @param email - Email to validate
 * @returns Normalized (lowercase) email
 * @throws ValidationError if invalid
 */
export function validateEmail(email: string): string {
  const normalized = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(normalized)) {
    throw new ValidationError('Invalid email format');
  }
  
  if (normalized.length > 255) {
    throw new ValidationError('Email address too long');
  }
  
  return normalized;
}

/**
 * Validates pagination parameters
 * @param params - Pagination parameters
 * @returns Validated pagination parameters
 */
export function validatePagination(params: {
  page?: number;
  limit?: number;
}): { page: number; limit: number } {
  const page = Math.max(1, Math.floor(params.page || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(params.limit || 20)));
  
  return { page, limit };
}

/**
 * Creates a custom validation error with field-specific details
 * @param message - Main error message
 * @param field - Field that failed validation
 * @param code - Error code (optional)
 * @returns ValidationError instance
 */
export function createFieldValidationError(
  message: string,
  field: string,
  code?: string
): ValidationError {
  return new ValidationError(message, {
    [field]: [message]
  }, {
    code: code || 'FIELD_VALIDATION_ERROR',
  });
}

/**
 * Validates that a date is in the future
 * @param date - Date to validate
 * @param fieldName - Name of the field being validated
 * @returns The validated date
 * @throws ValidationError if date is not in the future
 */
export function validateFutureDate(date: Date, fieldName: string = 'date'): Date {
  const now = new Date();
  
  if (date <= now) {
    throw createFieldValidationError(
      `${fieldName} must be in the future`,
      fieldName,
      'FUTURE_DATE_REQUIRED'
    );
  }
  
  return date;
}

/**
 * Validates that a date is not too far in the future
 * @param date - Date to validate
 * @param maxDaysInFuture - Maximum days in the future allowed
 * @param fieldName - Name of the field being validated
 * @returns The validated date
 * @throws ValidationError if date is too far in the future
 */
export function validateMaxFutureDate(
  date: Date,
  maxDaysInFuture: number,
  fieldName: string = 'date'
): Date {
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + maxDaysInFuture);
  
  if (date > maxDate) {
    throw createFieldValidationError(
      `${fieldName} cannot be more than ${maxDaysInFuture} days in the future`,
      fieldName,
      'MAX_FUTURE_DATE_EXCEEDED'
    );
  }
  
  return date;
}

/**
 * Type guard to check if a value is a valid chain ID
 * @param value - Value to check
 * @returns True if value is a valid chain ID
 */
export function isValidChainId(value: unknown): value is 8453 | 84532 | 56 | 97 {
  return [8453, 84532, 56, 97].includes(value as number);
}

/**
 * Type guard to check if a value is a valid order type
 * @param value - Value to check
 * @returns True if value is a valid order type
 */
export function isValidOrderType(value: unknown): value is 'market' | 'limit' | 'dca' {
  return ['market', 'limit', 'dca'].includes(value as string);
}

/**
 * Type guard to check if a value is a valid order status
 * @param value - Value to check
 * @returns True if value is a valid order status
 */
export function isValidOrderStatus(
  value: unknown
): value is 'pending' | 'filled' | 'partially_filled' | 'cancelled' | 'expired' | 'failed' {
  return ['pending', 'filled', 'partially_filled', 'cancelled', 'expired', 'failed']
    .includes(value as string);
}
