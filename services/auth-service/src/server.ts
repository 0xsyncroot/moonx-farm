import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { createAuthServiceConfig } from '@moonx-farm/configs';
import { createLogger } from '@moonx-farm/common';
import { 
  DatabaseManager, 
  RedisManager, 
  createDatabaseConfig, 
  createRedisConfig 
} from '@moonx-farm/infrastructure';

import { authRoutes } from './controllers/authController';
import { sessionRoutes } from './controllers/sessionController';
import { userRoutes } from './controllers/userController';

import { authMiddleware } from './middleware/authMiddleware';
import { errorHandler } from './middleware/errorHandler';
import { registerLoggingPlugins } from './middleware/requestLogger';

import { JwtService } from './services/jwtService';
import { DatabaseService } from './services/databaseService';
import { RedisService } from './services/redisService';

import { HealthResponseSchema, ErrorResponseSchema } from './schemas';

const config = createAuthServiceConfig();
const logger = createLogger('auth-service');

/**
 * Build Fastify server with all plugins and routes
 */
async function buildServer(): Promise<FastifyInstance> {
  // Fix MaxListenersExceededWarning
  process.setMaxListeners(20);
  
  const server = Fastify({
    logger: config.isDevelopment() ? {
      level: config.get('LOG_LEVEL'),
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    } : {
      level: config.get('LOG_LEVEL'),
      // Production logging without pino-pretty
    },
    ajv: {
      customOptions: {
        strict: false
      }
    },
    trustProxy: true,
  });

  // Register Swagger for API documentation (development only)
  if (config.isDevelopment()) {
    await server.register(swagger, {
      mode: 'dynamic',
      openapi: {
        info: {
          title: 'MoonX Farm Auth Service API',
          description: `
Authentication and user management service for MoonX Farm platform.

This service handles:
- User authentication via Privy (Google, TikTok, Telegram, X, Farcaster)
- JWT token management (access & refresh tokens)
- User profile management
- Session management
- User authorization

## Authentication Flow
1. User initiates login via Privy
2. Frontend receives Privy token
3. Frontend sends Privy token to \`/auth/login\`
4. Service validates with Privy and returns JWT tokens
5. Use JWT access token for subsequent API calls
6. Refresh tokens when access token expires
          `,
          version: '1.0.0',
          contact: {
            name: 'MoonX Farm Team',
            email: 'dev@moonxfarm.com'
          },
          license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT'
          }
        },
        servers: [
          {
            url: `http://${config.get('AUTH_SERVICE_HOST')}:${config.get('AUTH_SERVICE_PORT')}`,
            description: 'Development server'
          }
        ],
        components: {
          securitySchemes: {
            BearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
              description: 'JWT access token obtained from login endpoint'
            }
          }
        },
        tags: [
          { name: 'Health', description: 'Service health and monitoring endpoints' },
          { name: 'Authentication', description: 'User authentication and token management' },
          { name: 'User Management', description: 'User profile and account management' },
          { name: 'Session Management', description: 'User session management and security' }
        ]
      }
    });

    await server.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
      transformSpecification: (swaggerObject) => {
        return swaggerObject;
      },
      transformSpecificationClone: true
    });

    logger.info('📚 Swagger UI enabled at /docs');
    
    // Export OpenAPI spec as JSON
    server.get('/openapi.json', {
      schema: {
        hide: true // Hide from swagger docs
      }
    }, async () => {
      return server.swagger();
    });
  }

  // Register plugins
  await server.register(helmet, {
    contentSecurityPolicy: false,
  });

  await server.register(cors, {
    origin: config.isDevelopment() 
      ? ['http://localhost:3000', 'http://localhost:3001']
      : [config.get('FRONTEND_URL') as string],
    credentials: true,
  });

  await server.register(rateLimit, {
    max: 10000,
    timeWindow: '15 minutes',
    keyGenerator: (request) => {
      return request.ip;
    },
  });

  // JWT plugin
  await server.register(jwt, {
    secret: config.get('JWT_SECRET') as string,
    sign: {
      expiresIn: config.get('JWT_EXPIRES_IN') as string,
      issuer: config.get('JWT_ISSUER') as string,
      audience: config.get('JWT_AUDIENCE') as string,
    },
    verify: {
      issuer: config.get('JWT_ISSUER') as string,
      audience: config.get('JWT_AUDIENCE') as string,
    },
  });

  // Initialize infrastructure managers (internal to server)
  const databaseConfig = createDatabaseConfig();
  const redisConfig = createRedisConfig();
  
  const databaseManager = new DatabaseManager(databaseConfig);
  const redisManager = new RedisManager(redisConfig);

  // Initialize domain services using infrastructure managers
  const dbService = new DatabaseService(databaseManager);
  const redisService = new RedisService(redisManager);

  // Connect through domain services (they manage infrastructure internally)
  await dbService.connect();
  await redisService.ping(); // Ensure Redis is ready
  
  logger.info('✅ Auth services connected and ready');

  // Initialize JWT service
  const jwtConfig = {
    jwtSecret: config.get('JWT_SECRET') as string,
    jwtExpiresIn: config.get('JWT_EXPIRES_IN') as string,
    jwtRefreshExpiresIn: config.get('JWT_REFRESH_EXPIRES_IN') as string,
    jwtIssuer: config.get('JWT_ISSUER') as string,
    jwtAudience: config.get('JWT_AUDIENCE') as string,
  };
  const jwtService = new JwtService(server, jwtConfig);

  // Register services in Fastify context - Controllers only see domain services
  server.decorate('db', dbService);
  server.decorate('redisService', redisService);
  server.decorate('jwtService', jwtService);
  server.decorate('config', config);

  // Register logging plugins
  await registerLoggingPlugins(server);

  // Register error handler
  server.setErrorHandler(errorHandler);

  // Health check using domain services
  server.get('/health', {
    schema: {
      tags: ['Health'],
      summary: 'Health check',
      description: 'Returns service health status and dependencies',
      response: {
        200: HealthResponseSchema,
        503: HealthResponseSchema
      }
    }
  }, async () => {
    const dbHealthy = dbService.isHealthy();
    const redisHealthy = await redisService.ping();
    
    return {
      status: dbHealthy && redisHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'auth-service',
      version: process.env['npm_package_version'] || '1.0.0',
      services: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        redis: redisHealthy ? 'healthy' : 'unhealthy',
        jwt: 'healthy',
      },
      poolStats: dbService.getPoolStats(),
    };
  });

  // Register routes
  await server.register(authRoutes, { prefix: '/api/v1/auth' });
  await server.register(sessionRoutes, { prefix: '/api/v1/session' });
  await server.register(userRoutes, { prefix: '/api/v1/user' });

  // Graceful shutdown through domain services
  server.addHook('onClose', async () => {
    logger.info('Shutting down auth services...');
    await Promise.allSettled([
      dbService.disconnect(),
      // Redis shutdown is handled by dbService.disconnect() -> infrastructure manager
    ]);
    logger.info('Auth services shut down completed');
  });

  return server;
}

/**
 * Start the server
 */
async function start() {
  try {
    const server = await buildServer();
    
    const host = config.get('AUTH_SERVICE_HOST') as string;
    const port = config.get('AUTH_SERVICE_PORT') as number;

    await server.listen({ host, port });
    
    logger.info(`🚀 Auth Service running on http://${host}:${port}`);
    logger.info(`📋 Health check: http://${host}:${port}/health`);
    logger.info(`🔑 Auth endpoint: http://${host}:${port}/api/v1/auth`);
    
    if (config.isDevelopment()) {
      logger.info(`📚 API Documentation: http://${host}:${port}/docs`);
      logger.info(`📄 OpenAPI Spec: http://${host}:${port}/openapi.json`);
    }

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, shutting down gracefully...`);
        await server.close();
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('❌ Failed to start server:', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  start();
}

export { buildServer, start };

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    db: DatabaseService;
    redisService: RedisService;
    jwtService: JwtService;
    config: ReturnType<typeof createAuthServiceConfig>;
  }
}