import { z } from 'zod';

// Analytics Query Schema
export const analyticsQuerySchema = z.object({
  timeframe: z.enum(['24h', '7d', '30d', '90d', '1y', 'all']).default('30d'),
  groupBy: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  chainId: z.coerce.number().int().positive().optional(),
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
});

// Volume Analytics Schema
export const volumeAnalyticsSchema = z.object({
  timeframe: z.enum(['24h', '7d', '30d', '90d', '1y']).default('30d'),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
  chainId: z.coerce.number().int().positive().optional()
});

// Fee Analytics Schema
export const feeAnalyticsSchema = z.object({
  timeframe: z.enum(['24h', '7d', '30d', '90d', '1y']).default('30d'),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
  feeType: z.enum(['gas', 'trading', 'all']).default('all')
});

// Token Performance Schema
export const tokenPerformanceSchema = z.object({
  timeframe: z.enum(['24h', '7d', '30d', '90d', '1y']).default('30d'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sortBy: z.enum(['volume', 'trades', 'pnl']).default('volume'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Chain Usage Schema
export const chainUsageSchema = z.object({
  timeframe: z.enum(['24h', '7d', '30d', '90d', '1y']).default('30d'),
  includeTestnets: z.coerce.boolean().default(false)
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
export type VolumeAnalytics = z.infer<typeof volumeAnalyticsSchema>;
export type FeeAnalytics = z.infer<typeof feeAnalyticsSchema>;
export type TokenPerformance = z.infer<typeof tokenPerformanceSchema>;
export type ChainUsage = z.infer<typeof chainUsageSchema>; 