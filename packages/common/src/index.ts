/**
 * @moonx/common - Shared utilities and types for MoonXFarm DEX
 * 
 * This package provides:
 * - Structured logging with Winston
 * - Custom error classes
 * - Type definitions
 * - Utility functions
 * - Constants and configuration
 * 
 * Note: Environment validation is now handled by @moonx-farm/configs package
 * Use createConfig() from @moonx-farm/configs for environment management
 */

// Logging
export * from './logger';

// Error handling
export * from './errors';

// Type definitions
export * from './types';

// Utilities
export * from './utils';

// Constants
export * from './constants';

// Re-export commonly used external dependencies
export { z } from 'zod';
export { nanoid } from 'nanoid';
export { ethers } from 'ethers'; 