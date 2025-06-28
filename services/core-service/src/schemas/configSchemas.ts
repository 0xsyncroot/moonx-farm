import { z } from 'zod';

// User Config Update Schema
export const updateUserConfigSchema = z.object({
  slippageTolerance: z.number().min(0.1).max(50).optional(),
  gasMode: z.enum(['slow', 'standard', 'fast']).optional(),
  defaultChainId: z.number().int().positive().optional(),
  enableNotifications: z.boolean().optional(),
  enableAnalytics: z.boolean().optional(),
  preferredCurrency: z.enum(['USD', 'EUR', 'GBP', 'JPY', 'ETH', 'BTC']).optional(),
  theme: z.enum(['light', 'dark', 'auto']).optional()
});

// Platform Config Response Schema
export const platformConfigSchema = z.object({
  supportedChains: z.array(z.object({
    chainId: z.number(),
    name: z.string(),
    rpcUrl: z.string(),
    explorer: z.string(),
    nativeCurrency: z.object({
      name: z.string(),
      symbol: z.string(),
      decimals: z.number()
    })
  })),
  supportedTokens: z.array(z.object({
    address: z.string(),
    symbol: z.string(),
    name: z.string(),
    decimals: z.number(),
    chainId: z.number(),
    logoURI: z.string().optional()
  })),
  tradingLimits: z.object({
    minTradeUSD: z.number(),
    maxTradeUSD: z.number(),
    dailyLimitUSD: z.number(),
    monthlyLimitUSD: z.number()
  }),
  fees: z.object({
    swapFeePercentage: z.number(),
    gasMultiplier: z.number()
  })
});

// Trading Limits Schema
export const tradingLimitsSchema = z.object({
  chainId: z.coerce.number().int().positive().optional(),
  userTier: z.enum(['basic', 'premium', 'vip']).optional()
});

export type UpdateUserConfigRequest = z.infer<typeof updateUserConfigSchema>;
export type PlatformConfig = z.infer<typeof platformConfigSchema>;
export type TradingLimitsQuery = z.infer<typeof tradingLimitsSchema>; 