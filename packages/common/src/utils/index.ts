import { ethers } from 'ethers';
import { nanoid } from 'nanoid';
import { ChainId } from '../types';
import { REGEX, VALIDATION } from '../constants';

// =====================
// String Utilities
// =====================

/**
 * Capitalizes the first letter of a string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Converts string to camelCase
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Converts string to snake_case
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Truncates string to specified length with ellipsis
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

/**
 * Truncates Ethereum address for display
 */
export function truncateAddress(address: string, startLength = 6, endLength = 4): string {
  if (address.length < startLength + endLength) return address;
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}

// =====================
// Number & BigNumber Utilities
// =====================

/**
 * Formats a number with commas for display
 */
export function formatNumber(num: number | string, decimals = 2): string {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(n);
}

/**
 * Formats token amount from wei to human readable
 */
export function formatTokenAmount(
  amount: string | ethers.BigNumberish,
  decimals = 18,
  displayDecimals = 4
): string {
  try {
    const formatted = ethers.formatUnits(amount, decimals);
    const num = parseFloat(formatted);
    
    if (num === 0) return '0';
    if (num < 0.0001) return '<0.0001';
    
    return formatNumber(num, displayDecimals);
  } catch (error) {
    return '0';
  }
}

/**
 * Parses token amount from human readable to wei
 */
export function parseTokenAmount(amount: string, decimals = 18): string {
  try {
    return ethers.parseUnits(amount, decimals).toString();
  } catch (error) {
    throw new Error(`Invalid amount: ${amount}`);
  }
}

/**
 * Formats percentage for display
 */
export function formatPercentage(value: number, decimals = 2): string {
  return `${formatNumber(value, decimals)}%`;
}

/**
 * Formats USD amount for display
 */
export function formatUSD(amount: number | string, decimals = 2): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Calculates percentage change between two values
 */
export function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

// =====================
// Validation Utilities
// =====================

/**
 * Validates Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return REGEX.ETHEREUM_ADDRESS.test(address);
}

/**
 * Validates transaction hash
 */
export function isValidTransactionHash(hash: string): boolean {
  return REGEX.TRANSACTION_HASH.test(hash);
}

/**
 * Validates email address
 */
export function isValidEmail(email: string): boolean {
  return REGEX.EMAIL.test(email);
}

/**
 * Validates numeric string
 */
export function isValidNumericString(value: string): boolean {
  return REGEX.NUMERIC_STRING.test(value);
}

/**
 * Validates order amount
 */
export function isValidOrderAmount(amount: string): boolean {
  if (!isValidNumericString(amount)) return false;
  
  const num = parseFloat(amount);
  const min = parseFloat(VALIDATION.MIN_ORDER_AMOUNT);
  const max = parseFloat(VALIDATION.MAX_ORDER_AMOUNT);
  
  return num >= min && num <= max;
}

/**
 * Validates slippage percentage
 */
export function isValidSlippage(slippage: number): boolean {
  return slippage >= 0.1 && slippage <= 50;
}

// =====================
// Date & Time Utilities
// =====================

/**
 * Formats date for display
 */
export function formatDate(date: Date | string, format = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  switch (format) {
    case 'short':
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    case 'long':
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    case 'time':
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    case 'datetime':
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    default:
      return d.toISOString();
  }
}

/**
 * Returns time ago string (e.g., "2 hours ago")
 */
export function timeAgo(date: Date | string): string {
  const now = new Date();
  const then = typeof date === 'string' ? new Date(date) : date;
  const diff = now.getTime() - then.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

/**
 * Adds seconds to a date
 */
export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

// =====================
// Object Utilities
// =====================

/**
 * Deep clones an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Removes undefined/null values from object
 */
export function cleanObject<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: Partial<T> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      cleaned[key as keyof T] = value;
    }
  }
  
  return cleaned;
}

/**
 * Picks specified keys from object
 */
export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  
  return result;
}

/**
 * Omits specified keys from object
 */
export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  
  for (const key of keys) {
    delete result[key];
  }
  
  return result;
}

// =====================
// Array Utilities
// =====================

/**
 * Chunks array into smaller arrays of specified size
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  
  return chunks;
}

/**
 * Removes duplicates from array
 */
export function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

/**
 * Groups array by a key function
 */
export function groupBy<T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  const groups = {} as Record<K, T[]>;
  
  for (const item of array) {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  }
  
  return groups;
}

// =====================
// Async Utilities
// =====================

/**
 * Creates a delay/sleep function
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries an async function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      const delayMs = baseDelay * Math.pow(2, attempt - 1);
      await delay(delayMs);
    }
  }
  
  throw lastError!;
}

/**
 * Creates a timeout wrapper for promises
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    ),
  ]);
}

// =====================
// ID Generation
// =====================

/**
 * Generates a random ID
 */
export function generateId(length = 12): string {
  return nanoid(length);
}

/**
 * Generates a trace ID for request tracking
 */
export function generateTraceId(): string {
  return nanoid(16);
}

// =====================
// Network Utilities
// =====================

/**
 * Gets network name from chain ID
 */
export function getNetworkName(chainId: ChainId): string {
  switch (chainId) {
    case 8453:
      return 'Base';
    case 84532:
      return 'Base Sepolia';
    case 56:
      return 'BSC';
    case 97:
      return 'BSC Testnet';
    default:
      return 'Unknown';
  }
}

/**
 * Checks if chain ID is a testnet
 */
export function isTestnet(chainId: ChainId): boolean {
  return chainId === 84532 || chainId === 97;
}

/**
 * Gets explorer URL for address or transaction
 */
export function getExplorerUrl(
  chainId: ChainId,
  hash: string,
  type: 'address' | 'tx' = 'tx'
): string {
  const baseUrls = {
    8453: 'https://basescan.org',
    84532: 'https://sepolia.basescan.org',
    56: 'https://bscscan.com',
    97: 'https://testnet.bscscan.com',
  };
  
  const baseUrl = baseUrls[chainId];
  return `${baseUrl}/${type}/${hash}`;
} 