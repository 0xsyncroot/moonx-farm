import { z } from 'zod';
import { REGEX } from '../constants';

/**
 * Base validation schemas for common data types
 */

/**
 * Ethereum address validation schema
 */
export const AddressSchema = z
  .string()
  .regex(REGEX.ETHEREUM_ADDRESS, 'Invalid Ethereum address format')
  .transform((val) => val.toLowerCase());

/**
 * Transaction hash validation schema
 */
export const TransactionHashSchema = z
  .string()
  .regex(REGEX.TRANSACTION_HASH, 'Invalid transaction hash format')
  .transform((val) => val.toLowerCase());

/**
 * Numeric string validation schema
 */
export const NumericStringSchema = z
  .string()
  .regex(REGEX.NUMERIC_STRING, 'Invalid numeric format')
  .refine((val) => parseFloat(val) >= 0, 'Value must be non-negative');

/**
 * UUID validation schema
 */
export const UUIDSchema = z
  .string()
  .regex(REGEX.UUID, 'Invalid UUID format');

/**
 * Email validation schema
 */
export const EmailSchema = z
  .string()
  .email('Invalid email format')
  .max(255, 'Email too long');

/**
 * URL validation schema
 */
export const UrlSchema = z
  .string()
  .url('Invalid URL format');

/**
 * Positive integer schema
 */
export const PositiveIntSchema = z
  .number()
  .int('Must be an integer')
  .positive('Must be positive');

/**
 * Non-negative integer schema
 */
export const NonNegativeIntSchema = z
  .number()
  .int('Must be an integer')
  .min(0, 'Must be non-negative');

/**
 * Date validation schema (accepts Date objects or ISO strings)
 */
export const DateSchema = z.union([
  z.date(),
  z.string().datetime().transform((str) => new Date(str)),
]);

/**
 * Optional string that trims whitespace
 */
export const TrimmedStringSchema = z
  .string()
  .transform((str) => str.trim())
  .optional();

/**
 * Required string that trims whitespace
 */
export const RequiredTrimmedStringSchema = z
  .string()
  .min(1, 'Field is required')
  .transform((str) => str.trim());
