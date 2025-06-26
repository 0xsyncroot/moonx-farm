import { z } from 'zod';
import { VALIDATION } from '../constants';
import { AddressSchema, NumericStringSchema, DateSchema } from './base';
import { ChainIdSchema, TokenInfoSchema, RouteStepSchema } from './blockchain';

/**
 * Trading-specific validation schemas
 */

/**
 * Amount validation with min/max checks
 */
export const AmountSchema = NumericStringSchema
  .refine(
    (val) => parseFloat(val) >= parseFloat(VALIDATION.MIN_ORDER_AMOUNT),
    `Amount must be at least ${VALIDATION.MIN_ORDER_AMOUNT}`
  )
  .refine(
    (val) => parseFloat(val) <= parseFloat(VALIDATION.MAX_ORDER_AMOUNT),
    `Amount must not exceed ${VALIDATION.MAX_ORDER_AMOUNT}`
  );

/**
 * Slippage validation schema (0.1% to 50%)
 */
export const SlippageSchema = z
  .number()
  .min(0.1, 'Minimum slippage is 0.1%')
  .max(50, 'Maximum slippage is 50%');

/**
 * Price validation schema
 */
export const PriceSchema = NumericStringSchema
  .refine((val) => parseFloat(val) > 0, 'Price must be positive');

/**
 * Quote request validation schema
 */
export const QuoteRequestSchema = z.object({
  chainId: ChainIdSchema,
  tokenIn: AddressSchema,
  tokenOut: AddressSchema,
  amountIn: AmountSchema,
  slippage: SlippageSchema.optional().default(2),
  userAddress: AddressSchema.optional(),
});

/**
 * Quote response validation schema
 */
export const QuoteResponseSchema = z.object({
  tokenIn: TokenInfoSchema,
  tokenOut: TokenInfoSchema,
  amountIn: NumericStringSchema,
  amountOut: NumericStringSchema,
  amountOutMin: NumericStringSchema,
  priceImpact: z.number().min(0).max(100),
  fee: NumericStringSchema,
  gas: NumericStringSchema,
  route: z.array(RouteStepSchema),
  aggregator: z.string().min(1, 'Aggregator required'),
  validUntil: DateSchema,
});

/**
 * Swap request validation schema
 */
export const SwapRequestSchema = z.object({
  quote: QuoteResponseSchema,
  userAddress: AddressSchema,
  deadline: DateSchema.optional(),
  referrer: AddressSchema.optional(),
});

/**
 * Swap response validation schema
 */
export const SwapResponseSchema = z.object({
  transaction: z.object({
    to: AddressSchema,
    data: z.string().min(1, 'Transaction data required'),
    value: NumericStringSchema,
    gasLimit: NumericStringSchema,
  }),
  quote: QuoteResponseSchema,
});
