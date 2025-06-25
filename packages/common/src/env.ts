import { z } from 'zod';

/**
 * Base environment validation schema
 * Each service can extend this with their specific requirements
 */
export const BaseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // Database
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  
  // Kafka
  KAFKA_BROKERS: z.string().optional(),
  KAFKA_CLIENT_ID: z.string().default('moonx-farm'),
  
  // Security
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ENCRYPTION_KEY: z.string().length(32, 'ENCRYPTION_KEY must be exactly 32 characters'),
  
  // Blockchain Networks
  BASE_RPC_URL: z.string().url().optional(),
  BASE_TESTNET_RPC_URL: z.string().url().optional(),
  BSC_RPC_URL: z.string().url().optional(),
  BSC_TESTNET_RPC_URL: z.string().url().optional(),
});

export type BaseEnv = z.infer<typeof BaseEnvSchema>;

/**
 * Validates environment variables with a given schema
 * @param schema - Zod schema to validate against
 * @param source - Environment source (defaults to process.env)
 * @returns Validated environment variables
 * @throws Error if validation fails
 */
export function validateEnv<T extends z.ZodSchema>(
  schema: T,
  source: Record<string, string | undefined> = process.env
): z.infer<T> {
  try {
    return schema.parse(source);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(
        (err) => `${err.path.join('.')}: ${err.message}`
      );
      
      throw new Error(
        `Environment validation failed:\n${errorMessages.join('\n')}`
      );
    }
    throw error;
  }
}

/**
 * Creates an environment validator function for a service
 * @param serviceSchema - Service-specific schema that extends BaseEnvSchema
 * @returns Validated environment variables
 * 
 * @example
 * const AuthServiceEnvSchema = BaseEnvSchema.extend({
 *   PRIVY_APP_ID: z.string(),
 *   PRIVY_APP_SECRET: z.string(),
 *   AUTH_SERVICE_PORT: z.coerce.number().default(3002)
 * });
 * 
 * export const env = createEnvValidator(AuthServiceEnvSchema);
 */
export function createEnvValidator<T extends z.ZodSchema>(serviceSchema: T) {
  return validateEnv(serviceSchema);
}

/**
 * Checks if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Checks if running in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Checks if running in staging mode
 */
export function isStaging(): boolean {
  return process.env.NODE_ENV === 'staging';
}

/**
 * Gets the current environment
 */
export function getCurrentEnv(): 'development' | 'staging' | 'production' {
  return (process.env.NODE_ENV as any) || 'development';
} 