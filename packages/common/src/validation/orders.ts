import { z } from 'zod';
import { VALIDATION } from '../constants';
import { AddressSchema, TransactionHashSchema, DateSchema } from './base';
import { ChainIdSchema, TokenInfoSchema } from './blockchain';
import { AmountSchema, PriceSchema, SlippageSchema } from './trading';

/**
 * Order-specific validation schemas
 */

/**
 * Order status validation schema
 */
export const OrderStatusSchema = z.enum([
  'pending',
  'filled', 
  'partially_filled',
  'cancelled',
  'expired',
  'failed'
]);

/**
 * Order side validation schema
 */
export const OrderSideSchema = z.enum(['buy', 'sell']);

/**
 * Order type validation schema
 */
export const OrderTypeSchema = z.enum(['market', 'limit', 'dca']);

/**
 * Base order validation schema
 */
const BaseOrderSchema = z.object({
  id: z.string().min(1, 'Order ID required'),
  userId: z.string().min(1, 'User ID required'),
  walletAddress: AddressSchema,
  chainId: ChainIdSchema,
  type: OrderTypeSchema,
  status: OrderStatusSchema,
  side: OrderSideSchema,
  
  // Token information
  tokenIn: TokenInfoSchema,
  tokenOut: TokenInfoSchema,
  amountIn: AmountSchema,
  amountOut: z.string().optional(),
  
  // Execution data
  executedAt: DateSchema.optional(),
  transactionHash: TransactionHashSchema.optional(),
  gasUsed: z.string().optional(),
  
  // Metadata
  createdAt: DateSchema,
  updatedAt: DateSchema,
  metadata: z.record(z.any()).optional(),
});

/**
 * Market order validation schema
 */
export const MarketOrderSchema = BaseOrderSchema.extend({
  type: z.literal('market'),
  slippage: SlippageSchema,
  deadline: DateSchema,
});

/**
 * Limit order validation schema
 */
export const LimitOrderSchema = BaseOrderSchema.extend({
  type: z.literal('limit'),
  price: PriceSchema,
  expiresAt: DateSchema.optional(),
});

/**
 * DCA order validation schema
 */
export const DCAOrderSchema = BaseOrderSchema.extend({
  type: z.literal('dca'),
  frequency: z.number()
    .int('Frequency must be an integer')
    .min(VALIDATION.MIN_DCA_FREQUENCY, `Minimum frequency is ${VALIDATION.MIN_DCA_FREQUENCY} seconds`)
    .max(VALIDATION.MAX_DCA_FREQUENCY, `Maximum frequency is ${VALIDATION.MAX_DCA_FREQUENCY} seconds`),
  totalExecutions: z.number()
    .int('Total executions must be an integer')
    .min(1, 'At least 1 execution required')
    .max(VALIDATION.MAX_DCA_EXECUTIONS, `Maximum ${VALIDATION.MAX_DCA_EXECUTIONS} executions allowed`),
  executedCount: z.number()
    .int('Executed count must be an integer')
    .min(0, 'Executed count cannot be negative'),
  nextExecutionAt: DateSchema,
  isActive: z.boolean(),
});

/**
 * Order union schema with discriminated union
 */
export const OrderSchema = z.discriminatedUnion('type', [
  MarketOrderSchema,
  LimitOrderSchema,
  DCAOrderSchema,
]);

/**
 * Order creation request schema
 */
export const CreateOrderRequestSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('market'),
    tokenIn: AddressSchema,
    tokenOut: AddressSchema,
    amountIn: AmountSchema,
    slippage: SlippageSchema,
    deadline: DateSchema.optional(),
  }),
  z.object({
    type: z.literal('limit'),
    tokenIn: AddressSchema,
    tokenOut: AddressSchema,
    amountIn: AmountSchema,
    price: PriceSchema,
    expiresAt: DateSchema.optional(),
  }),
  z.object({
    type: z.literal('dca'),
    tokenIn: AddressSchema,
    tokenOut: AddressSchema,
    amountIn: AmountSchema,
    frequency: z.number().int().min(VALIDATION.MIN_DCA_FREQUENCY).max(VALIDATION.MAX_DCA_FREQUENCY),
    totalExecutions: z.number().int().min(1).max(VALIDATION.MAX_DCA_EXECUTIONS),
  }),
]);
