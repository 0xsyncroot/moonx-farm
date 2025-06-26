/**
 * @moonx/common validation module
 * 
 * Provides comprehensive validation schemas and utilities for MoonXFarm DEX
 * Built with Zod for runtime type safety and validation
 */

// Base validation schemas
export * from './base';

// Blockchain-specific validations
export * from './blockchain';

// Trading-specific validations
export * from './trading';

// Order-specific validations
export * from './orders';

// API-specific validations
export * from './api';

// Validation utilities and helpers
export * from './utils';

// Re-export zod for convenience
export { z } from 'zod';
