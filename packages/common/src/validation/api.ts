import { z } from 'zod';
import { PositiveIntSchema, NonNegativeIntSchema } from './base';

/**
 * API-specific validation schemas
 */

/**
 * Pagination parameters validation schema
 */
export const PaginationParamsSchema = z.object({
  page: PositiveIntSchema.optional().default(1),
  limit: PositiveIntSchema.max(100, 'Limit cannot exceed 100').optional().default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

/**
 * Filter parameters validation schema
 */
export const FilterParamsSchema = z.object({
  status: z.array(z.string()).optional(),
  type: z.array(z.string()).optional(),
  chainId: z.array(z.number().int()).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

/**
 * API error validation schema
 */
export const ApiErrorSchema = z.object({
  code: z.string().min(1, 'Error code required'),
  message: z.string().min(1, 'Error message required'),
  details: z.any().optional(),
});

/**
 * Pagination info validation schema
 */
export const PaginationInfoSchema = z.object({
  page: PositiveIntSchema,
  limit: PositiveIntSchema,
  total: NonNegativeIntSchema,
  pages: NonNegativeIntSchema,
});

/**
 * API response validation schema
 */
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: ApiErrorSchema.optional(),
    meta: z.object({
      pagination: PaginationInfoSchema.optional(),
      timestamp: z.string().datetime(),
    }).optional(),
  });

/**
 * ID parameter validation schema
 */
export const IdParamSchema = z.object({
  id: z.string().min(1, 'ID parameter required'),
});

/**
 * Address parameter validation schema
 */
export const AddressParamSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid address parameter'),
});

/**
 * Chain ID parameter validation schema
 */
export const ChainIdParamSchema = z.object({
  chainId: z.coerce.number().int().positive('Invalid chain ID'),
});
