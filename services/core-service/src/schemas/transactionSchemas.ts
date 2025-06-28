import { z } from 'zod';
import { TransactionType, TransactionStatus } from '../types';

// Transaction Creation Schema
export const createTransactionSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
  chainId: z.number().int().positive(),
  type: z.nativeEnum(TransactionType),
  gasUsed: z.string().regex(/^\d+$/, 'Invalid gas amount').optional(),
  gasPrice: z.string().regex(/^\d+$/, 'Invalid gas price').optional(),
  gasFeeUSD: z.number().nonnegative().optional(),
  blockNumber: z.number().int().positive().optional(),
  timestamp: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional()
});

// Transaction Update Schema
export const updateTransactionSchema = z.object({
  status: z.nativeEnum(TransactionStatus).optional(),
  gasUsed: z.string().regex(/^\d+$/, 'Invalid gas amount').optional(),
  gasPrice: z.string().regex(/^\d+$/, 'Invalid gas price').optional(),
  gasFeeUSD: z.number().nonnegative().optional(),
  blockNumber: z.number().int().positive().optional(),
  timestamp: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional()
});

// Transaction Filters Schema
export const transactionFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['timestamp', 'gasFeeUSD', 'blockNumber']).default('timestamp'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  chainId: z.coerce.number().int().positive().optional(),
  type: z.nativeEnum(TransactionType).optional(),
  status: z.nativeEnum(TransactionStatus).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional()
});

// Route Parameters Schema
export const transactionParamsSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash')
});

export type CreateTransactionRequest = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionRequest = z.infer<typeof updateTransactionSchema>;
export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;
export type TransactionParams = z.infer<typeof transactionParamsSchema>; 