import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { createWalletRegistryConfig } from '@moonx/configs';
import { 
  DatabaseManager, 
  RedisManager, 
  createDatabaseConfig, 
  createRedisConfig 
} from '@moonx/infrastructure';
import { createLogger } from '@moonx/common';
import { WalletController } from './controllers/walletController';
import { WalletService } from './services/walletService';
import { ZeroDevClientService } from './services/zeroDevClient';
import { SessionKeyManager } from './services/sessionKeyManager';
import { GasManager } from './services/gasManager';
import { AuthenticatedRequest } from './types';

const logger = createLogger('wallet-registry-server');

// Initialize configuration
const config = createWalletRegistryConfig();

// Create Fastify instance
const fastify = Fastify({
  logger: false, // We use our own logger
  trustProxy: true,
});

// Initialize services
let dbManager: DatabaseManager;
let redisManager: RedisManager;
let gasManager: GasManager;
let zeroDevClient: ZeroDevClientService;
let sessionKeyManager: SessionKeyManager;
let walletService: WalletService;
let walletController: WalletController;

async function setupServices() {
  try {
    // Initialize database using createDatabaseConfig
    const databaseConfig = createDatabaseConfig();
    dbManager = new DatabaseManager(databaseConfig);
    await dbManager.connect();
    logger.info('Database connected successfully');

    // Initialize Redis (optional for this service)
    try {
      const redisConfig = createRedisConfig();
      redisManager = new RedisManager(redisConfig);
      await redisManager.connect();
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.warn('Redis connection failed, continuing without cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Initialize gas manager
    gasManager = new GasManager(dbManager);
    logger.info('Gas manager initialized');

    // Initialize ZeroDev client with gas manager
    zeroDevClient = new ZeroDevClientService({
      projectId: config.get('ZERODEV_PROJECT_ID') as string,
      chain: null, // Will be set per request
    }, gasManager);
    logger.info('ZeroDev client initialized');

    // Initialize managers and services
    sessionKeyManager = new SessionKeyManager(dbManager, zeroDevClient);
    walletService = new WalletService(dbManager, zeroDevClient);
    walletController = new WalletController(walletService, sessionKeyManager);

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

async function setupMiddleware() {
  // Security middleware
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Disable for Swagger UI
  });

  // CORS middleware
  await fastify.register(cors, {
    origin: config.isDevelopment() 
      ? ['http://localhost:3000', 'http://localhost:3001']
      : [config.get('FRONTEND_URL') as string],
    credentials: true,
  });

  // JWT middleware - Use same secret as Auth Service
  await fastify.register(jwt, {
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

  // Swagger documentation (development only)
  if (config.isDevelopment()) {
    await fastify.register(swagger, {
      openapi: {
        openapi: '3.0.0',
        info: {
          title: 'MoonXFarm Wallet Registry API',
          description: 'Account Abstraction wallet management service',
          version: '1.0.0',
        },
        servers: [
          {
            url: `http://${config.get('WALLET_REGISTRY_HOST')}:${config.get('WALLET_REGISTRY_PORT')}`,
            description: 'Development server',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      },
    });

    await fastify.register(swaggerUI, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'full',
        deepLinking: false,
      },
    });
  }
}

// Authentication middleware
async function authMiddleware(request: any, reply: any) {
  try {
    await request.jwtVerify();
    
    // Add user context from JWT payload
    const payload = request.user;
    request.user = {
      userId: payload.userId,
      privyUserId: payload.privyUserId,
      walletAddress: payload.walletAddress,
      email: payload.email,
    } as AuthenticatedRequest;
  } catch (error) {
    logger.warn('Authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    reply.code(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
  }
}

function setupRoutes() {
  // Health check (no auth required)
  fastify.get('/health', walletController.healthCheck.bind(walletController));

  // Validation endpoints (no auth required)
  fastify.post('/validate-address', {
    schema: {
      body: {
        type: 'object',
        required: ['address', 'chainId'],
        properties: {
          address: { type: 'string' },
          chainId: { type: 'number' },
        },
      },
    },
  }, walletController.validateAddress.bind(walletController));

  // Protected routes
  fastify.register(async function (fastify) {
    // Add authentication to all routes in this context
    fastify.addHook('preHandler', authMiddleware);

    // Wallet management routes
    fastify.post('/wallets', {
      schema: {
        body: {
          type: 'object',
          required: ['ownerAddress', 'chainId'],
          properties: {
            ownerAddress: { 
              type: 'string',
              description: 'Privy EOA wallet address (owner of the AA wallet)',
            },
            ownerType: { 
              type: 'string',
              enum: ['privy-social', 'privy-wallet', 'external'],
              default: 'privy-social',
            },
            chainId: { type: 'number' },
            saltNonce: { type: 'string' },
            mode: {
              type: 'string',
              enum: ['custodial', 'hybrid', 'client-controlled'],
              default: 'custodial',
              description: 'Wallet management mode',
            },
          },
        },
      },
    }, walletController.createWallet.bind(walletController));

    fastify.get('/wallets', {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            chainId: { type: 'number' },
            isDeployed: { type: 'boolean' },
          },
        },
      },
    }, walletController.getWallets.bind(walletController));

    // REMOVED: deployWallet endpoint - wallets auto-deploy on creation in custodial mode

    fastify.get('/wallets/:walletId/status', {
      schema: {
        params: {
          type: 'object',
          required: ['walletId'],
          properties: {
            walletId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            checkOnchain: { type: 'string' },
          },
        },
      },
    }, walletController.getWalletStatus.bind(walletController));

    // Session key management routes
    fastify.post('/wallets/:walletId/session-keys', {
      schema: {
        params: {
          type: 'object',
          required: ['walletId'],
          properties: {
            walletId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['permissions'],
          properties: {
            permissions: { type: 'object' },
            expirationDays: { type: 'number' },
          },
        },
      },
    }, walletController.createSessionKey.bind(walletController));

    fastify.get('/wallets/:walletId/session-keys', {
      schema: {
        params: {
          type: 'object',
          required: ['walletId'],
          properties: {
            walletId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            activeOnly: { type: 'string' },
          },
        },
      },
    }, walletController.getSessionKeys.bind(walletController));

    fastify.delete('/session-keys/:sessionKeyId', {
      schema: {
        params: {
          type: 'object',
          required: ['sessionKeyId'],
          properties: {
            sessionKeyId: { type: 'string' },
          },
        },
      },
    }, walletController.revokeSessionKey.bind(walletController));

    // Gas sponsorship status check
    fastify.get('/wallets/:walletId/gas-sponsorship', {
      schema: {
        tags: ['Wallet Management'],
        summary: 'Check gas sponsorship status',
        description: 'Check gas sponsorship availability and remaining budget for a wallet',
        params: {
          type: 'object',
          required: ['walletId'],
          properties: {
            walletId: { type: 'string', description: 'Wallet ID' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  hasSponsorship: { type: 'boolean' },
                  dailyRemaining: { type: 'string' },
                  monthlyRemaining: { type: 'string' },
                  dailyLimit: { type: 'string' },
                  monthlyLimit: { type: 'string' },
                  reason: { type: 'string' },
                },
              },
            },
          },
        },
      },
    }, walletController.checkGasSponsorship.bind(walletController));

    // REMOVED: Multi-chain and batch operations
    // Users create wallets individually as needed
    // Multi-chain wallets can be created by calling /wallets multiple times with different chainIds
  });
}

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method,
  });

  reply.code(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
});

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully`);
  
  try {
    await fastify.close();
    
    if (dbManager) {
      await dbManager.disconnect();
    }
    
    if (redisManager) {
      await redisManager.disconnect();
    }
    
    logger.info('Server shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

// Setup signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
async function start() {
  try {
    await setupServices();
    await setupMiddleware();
    setupRoutes();

    const host = config.get('WALLET_REGISTRY_HOST') as string;
    const port = config.get('WALLET_REGISTRY_PORT') as number;

    await fastify.listen({ host, port });

    logger.info('Wallet Registry server started', {
      port,
      host,
      environment: process.env['NODE_ENV'] || 'development',
    });

    if (config.isDevelopment()) {
      logger.info(`Swagger UI available at: http://${host}:${port}/docs`);
    }
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

// Start the server
start(); 