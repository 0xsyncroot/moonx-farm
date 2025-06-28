import { z } from 'zod';

// Portfolio Filters Schema
export const portfolioFiltersSchema = z.object({
  chainId: z.coerce.number().int().positive().optional(),
  minValueUSD: z.coerce.number().nonnegative().optional(),
  showZeroBalances: z.coerce.boolean().default(false)
});

// Portfolio Sync Schema
export const portfolioSyncSchema = z.object({
  chainIds: z.array(z.number().int().positive()).optional(),
  forceRefresh: z.boolean().default(false)
});

// Position Update Schema
export const updatePositionSchema = z.object({
  balance: z.string().regex(/^\d+$/, 'Invalid balance format').optional(),
  avgBuyPrice: z.number().nonnegative().optional(),
  currentPrice: z.number().nonnegative().optional()
});

// P&L Request Schema
export const pnlRequestSchema = z.object({
  timeframe: z.enum(['24h', '7d', '30d', '90d', '1y', 'all']).default('30d'),
  chainId: z.coerce.number().int().positive().optional(),
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
});

// Performance Metrics Schema
export const performanceFiltersSchema = z.object({
  timeframe: z.enum(['24h', '7d', '30d', '90d', '1y']).default('30d'),
  groupBy: z.enum(['day', 'week', 'month']).default('day')
});

export type PortfolioFilters = z.infer<typeof portfolioFiltersSchema>;
export type PortfolioSyncRequest = z.infer<typeof portfolioSyncSchema>;
export type UpdatePositionRequest = z.infer<typeof updatePositionSchema>;
export type PnLRequest = z.infer<typeof pnlRequestSchema>;
export type PerformanceFilters = z.infer<typeof performanceFiltersSchema>; 