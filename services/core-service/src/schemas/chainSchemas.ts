import { z } from 'zod';

// Chain Enums
export const NetworkTypeSchema = z.enum(['mainnet', 'testnet']);
export const ChainStatusSchema = z.enum(['active', 'inactive', 'maintenance']);

// Ethereum Address Validation
const EthereumAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format');

// Hex Color Validation
const HexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format (#RRGGBB)');

// URL Validation
const UrlSchema = z.string().url('Invalid URL format');

// Native Currency Schema
export const NativeCurrencySchema = z.object({
  name: z.string().min(1, 'Currency name is required'),
  symbol: z.string().min(1, 'Currency symbol is required').max(10, 'Currency symbol too long'),
  decimals: z.number().int().min(0).max(18, 'Decimals must be between 0 and 18')
});

// RPC Providers Schema
export const RpcProvidersSchema = z.object({
  primary: UrlSchema,
  secondary: UrlSchema.optional(),
  fallback: UrlSchema.optional()
});

// Aggregator Provider Schema
export const AggregatorProviderSchema = z.object({
  enabled: z.boolean(),
  functionName: z.string().min(1, 'Function name is required'),
  priority: z.number().int().min(1, 'Priority must be positive')
});

// Aggregator Providers Schema (flexible - any aggregator names allowed)
export const AggregatorProvidersSchema = z.record(z.string(), AggregatorProviderSchema);

// Chain Config Schema
export const ChainConfigSchema = z.object({
  gasLimit: z.number().int().min(21000).optional(),
  blockTime: z.number().min(0.1).optional(),
  maxGasPrice: z.string().regex(/^\d+$/, 'Max gas price must be a valid integer').optional()
}).and(z.record(z.string(), z.any()));

// Create Chain Request Schema
export const CreateChainRequestSchema = z.object({
  chainId: z.number().int().min(1, 'Chain ID must be positive'),
  name: z.string().min(1, 'Chain name is required').max(100, 'Chain name too long'),
  shortName: z.string().min(1, 'Short name is required').max(20, 'Short name too long'),
  networkType: NetworkTypeSchema,
  rpcProviders: RpcProvidersSchema,
  aggregatorProviders: AggregatorProvidersSchema.optional(),
  explorerUrls: z.array(UrlSchema).min(1, 'At least one explorer URL is required'),
  nativeCurrency: NativeCurrencySchema,
  iconUrl: UrlSchema.optional(),
  brandColor: HexColorSchema.optional(),
  active: z.boolean().optional(),
  status: ChainStatusSchema.optional(),
  priority: z.number().int().min(0).optional(),
  isTestnet: z.boolean().optional(),
  diamondContractAddress: EthereumAddressSchema.optional(),
  chainConfig: ChainConfigSchema.optional(),
  faucetUrls: z.array(UrlSchema).optional(),
  docsUrl: UrlSchema.optional(),
  websiteUrl: UrlSchema.optional()
}).refine((data) => {
  // Auto-set isTestnet based on networkType if not provided
  if (data.isTestnet === undefined) {
    data.isTestnet = data.networkType === 'testnet';
  }
  return true;
});

// Update Chain Request Schema
export const UpdateChainRequestSchema = z.object({
  chainId: z.number().int().min(1, 'Chain ID must be positive').optional(),
  name: z.string().min(1, 'Chain name is required').max(100, 'Chain name too long').optional(),
  shortName: z.string().min(1, 'Short name is required').max(20, 'Short name too long').optional(),
  networkType: NetworkTypeSchema.optional(),
  rpcProviders: RpcProvidersSchema.optional(),
  aggregatorProviders: AggregatorProvidersSchema.optional(),
  explorerUrls: z.array(UrlSchema).min(1, 'At least one explorer URL is required').optional(),
  nativeCurrency: NativeCurrencySchema.optional(),
  iconUrl: UrlSchema.optional(),
  brandColor: HexColorSchema.optional(),
  active: z.boolean().optional(),
  status: ChainStatusSchema.optional(),
  priority: z.number().int().min(0).optional(),
  isTestnet: z.boolean().optional(),
  diamondContractAddress: EthereumAddressSchema.optional(),
  chainConfig: ChainConfigSchema.optional(),
  faucetUrls: z.array(UrlSchema).optional(),
  docsUrl: UrlSchema.optional(),
  websiteUrl: UrlSchema.optional()
});

// Chain Response Schema
export const ChainResponseSchema = z.object({
  id: z.string().uuid(),
  chainId: z.number(),
  name: z.string(),
  shortName: z.string(),
  networkType: NetworkTypeSchema,
  rpcProviders: RpcProvidersSchema,
  aggregatorProviders: AggregatorProvidersSchema,
  explorerUrls: z.array(z.string()),
  nativeCurrency: NativeCurrencySchema,
  iconUrl: z.string().optional(),
  brandColor: z.string().optional(),
  active: z.boolean(),
  status: ChainStatusSchema,
  priority: z.number(),
  isTestnet: z.boolean(),
  diamondContractAddress: z.string().optional(),
  chainConfig: ChainConfigSchema,
  faucetUrls: z.array(z.string()).optional(),
  docsUrl: z.string().optional(),
  websiteUrl: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// Chain Statistics Schema
export const ChainStatsSchema = z.object({
  total: z.number(),
  active: z.number(),
  inactive: z.number(),
  mainnet: z.number(),
  testnet: z.number()
});

// Query Parameters Schemas
export const GetChainsQuerySchema = z.object({
  networkType: NetworkTypeSchema.optional(),
  status: ChainStatusSchema.optional(),
  active: z.string().regex(/^(true|false)$/).transform(val => val === 'true').optional(),
  isTestnet: z.string().regex(/^(true|false)$/).transform(val => val === 'true').optional()
});

// Route Parameters Schema
export const ChainParamsSchema = z.object({
  id: z.string().uuid('Invalid chain ID format')
});

export const ChainIdParamsSchema = z.object({
  chainId: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1))
});

// Response Schemas
export const ChainListResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    chains: z.array(ChainResponseSchema)
  }),
  message: z.string().optional(),
  timestamp: z.string().datetime()
});

export const ChainDetailResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    chain: ChainResponseSchema
  }),
  message: z.string().optional(),
  timestamp: z.string().datetime()
});

export const CreateChainResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    chain: ChainResponseSchema
  }),
  message: z.string().optional(),
  timestamp: z.string().datetime()
});

export const UpdateChainResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    chain: ChainResponseSchema
  }),
  message: z.string().optional(),
  timestamp: z.string().datetime()
});

export const DeleteChainResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    deleted: z.boolean()
  }),
  message: z.string().optional(),
  timestamp: z.string().datetime()
});

export const ChainStatsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    stats: ChainStatsSchema
  }),
  message: z.string().optional(),
  timestamp: z.string().datetime()
});

export const RefreshCacheResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    refreshed: z.boolean()
  }),
  message: z.string().optional(),
  timestamp: z.string().datetime()
});

// Admin API Key Header Schema
export const AdminHeaderSchema = z.object({
  'x-api-key': z.string().min(1, 'Admin API key is required')
});

// Error Response Schema
export const ChainErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  data: z.any().optional(),
  timestamp: z.string().datetime()
});

// Type exports
export type CreateChainRequest = z.infer<typeof CreateChainRequestSchema>;
export type UpdateChainRequest = z.infer<typeof UpdateChainRequestSchema>;
export type ChainResponse = z.infer<typeof ChainResponseSchema>;
export type ChainStats = z.infer<typeof ChainStatsSchema>;
export type GetChainsQuery = z.infer<typeof GetChainsQuerySchema>;
export type ChainParams = z.infer<typeof ChainParamsSchema>;
export type ChainIdParams = z.infer<typeof ChainIdParamsSchema>;
export type NativeCurrency = z.infer<typeof NativeCurrencySchema>;
export type RpcProviders = z.infer<typeof RpcProvidersSchema>;
export type AggregatorProvider = z.infer<typeof AggregatorProviderSchema>;
export type AggregatorProviders = z.infer<typeof AggregatorProvidersSchema>;
export type ChainConfig = z.infer<typeof ChainConfigSchema>;
export type AdminHeader = z.infer<typeof AdminHeaderSchema>; 