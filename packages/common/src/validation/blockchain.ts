import { z } from 'zod';
import { ChainId } from '../types';
import { AddressSchema, UrlSchema, NonNegativeIntSchema } from './base';

/**
 * Blockchain-specific validation schemas
 */

/**
 * Chain ID validation schema
 */
export const ChainIdSchema = z.union([
  z.literal(8453),   // Base Mainnet
  z.literal(84532),  // Base Sepolia
  z.literal(56),     // BSC Mainnet
  z.literal(97),     // BSC Testnet
]) as z.ZodSchema<ChainId>;

/**
 * Token information validation schema
 */
export const TokenInfoSchema = z.object({
  address: AddressSchema,
  symbol: z.string().min(1, 'Symbol required').max(10, 'Symbol too long'),
  name: z.string().min(1, 'Name required').max(50, 'Name too long'),
  decimals: NonNegativeIntSchema.max(18, 'Invalid decimals'),
  chainId: ChainIdSchema,
  logoUri: UrlSchema.optional(),
  coingeckoId: z.string().optional(),
});

/**
 * Network configuration validation schema
 */
export const NetworkConfigSchema = z.object({
  chainId: ChainIdSchema,
  name: z.string().min(1, 'Network name required'),
  rpcUrls: z.array(UrlSchema).min(1, 'At least one RPC URL required'),
  privateRpcUrl: UrlSchema.optional(),
  blockExplorer: UrlSchema,
  nativeCurrency: z.object({
    name: z.string().min(1, 'Currency name required'),
    symbol: z.string().min(1, 'Currency symbol required'),
    decimals: NonNegativeIntSchema.max(18, 'Invalid currency decimals'),
  }),
  isTestnet: z.boolean(),
});

/**
 * User validation schema
 */
export const UserSchema = z.object({
  id: z.string().min(1, 'User ID required'),
  address: AddressSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Smart wallet validation schema
 */
export const SmartWalletSchema = z.object({
  id: z.string().min(1, 'Wallet ID required'),
  userId: z.string().min(1, 'User ID required'),
  address: AddressSchema,
  chainId: ChainIdSchema,
  factory: AddressSchema,
  implementation: AddressSchema,
  salt: z.string().min(1, 'Salt required'),
  isDeployed: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Session key validation schema
 */
export const SessionKeySchema = z.object({
  id: z.string().min(1, 'Session key ID required'),
  walletId: z.string().min(1, 'Wallet ID required'),
  keyAddress: AddressSchema,
  permissions: z.array(z.string()),
  expiresAt: z.date(),
  isActive: z.boolean(),
  createdAt: z.date(),
});

/**
 * Route step validation schema
 */
export const RouteStepSchema = z.object({
  protocol: z.string().min(1, 'Protocol required'),
  pool: z.string().min(1, 'Pool required'),
  tokenIn: AddressSchema,
  tokenOut: AddressSchema,
  amountIn: z.string().min(1, 'Amount in required'),
  amountOut: z.string().min(1, 'Amount out required'),
  fee: z.string().optional(),
});
