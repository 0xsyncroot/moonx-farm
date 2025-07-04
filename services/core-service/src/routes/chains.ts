import { FastifyInstance } from 'fastify';
import { ChainService } from '../services/chainService';
import { ChainController } from '../controllers/chainController';
import { DatabaseService } from '../services/databaseService';
import { CacheService } from '../services/cacheService';
import { AdminMiddleware } from '../middleware/adminMiddleware';
import '../types/fastify'; // Import type extensions
import { 
  CreateChainRequestSchema, 
  UpdateChainRequestSchema,
  GetChainsQuerySchema,
  ChainParamsSchema,
  ChainIdParamsSchema,
  ChainListResponseSchema,
  ChainDetailResponseSchema,
  CreateChainResponseSchema,
  UpdateChainResponseSchema,
  DeleteChainResponseSchema,
  ChainStatsResponseSchema,
  RefreshCacheResponseSchema,
  ChainErrorResponseSchema
} from '../schemas/chainSchemas';
import { createFastifySchema } from '../utils/schemaTransform';

interface ChainRoutesOptions {
  databaseService: DatabaseService;
  cacheService: CacheService;
}

export async function chainRoutes(
  fastify: FastifyInstance, 
  options: ChainRoutesOptions
) {
  // Initialize services
  const chainService = new ChainService(
    options.databaseService,
    options.cacheService
  );
  const chainController = new ChainController(chainService);
  const adminMiddleware = new AdminMiddleware();

  // ADMIN ROUTES (Protected with x-api-key)
  
  // Create chain (Admin only)
  fastify.post('/admin/chains', {
    preHandler: adminMiddleware.authenticate.bind(adminMiddleware),
    schema: createFastifySchema({
      body: CreateChainRequestSchema,
      response: {
        201: CreateChainResponseSchema,
        400: ChainErrorResponseSchema,
        401: ChainErrorResponseSchema,
        409: ChainErrorResponseSchema,
        500: ChainErrorResponseSchema
      },
      tags: ['Admin', 'Chains'],
      summary: 'Create a new blockchain network configuration',
      description: 'Add a new supported blockchain network with comprehensive configuration including RPC providers, aggregator settings, and contract addresses'
    })
  }, async (request, reply) => {
    return chainController.createChain(request as any, reply);
  });

  // Update chain (Admin only)
  fastify.put('/admin/chains/:id', {
    preHandler: adminMiddleware.authenticate.bind(adminMiddleware),
    schema: createFastifySchema({
      params: ChainParamsSchema,
      body: UpdateChainRequestSchema,
      response: {
        200: UpdateChainResponseSchema,
        400: ChainErrorResponseSchema,
        401: ChainErrorResponseSchema,
        404: ChainErrorResponseSchema,
        409: ChainErrorResponseSchema,
        500: ChainErrorResponseSchema
      },
      tags: ['Admin', 'Chains'],
      summary: 'Update blockchain network configuration',
      description: 'Update configuration for an existing blockchain network including status, providers, and settings'
    })
  }, async (request, reply) => {
    return chainController.updateChain(request as any, reply);
  });

  // Delete chain (Admin only)
  fastify.delete('/admin/chains/:id', {
    preHandler: adminMiddleware.authenticate.bind(adminMiddleware),
    schema: createFastifySchema({
      params: ChainParamsSchema,
      response: {
        200: DeleteChainResponseSchema,
        401: ChainErrorResponseSchema,
        404: ChainErrorResponseSchema,
        500: ChainErrorResponseSchema
      },
      tags: ['Admin', 'Chains'],
      summary: 'Delete blockchain network configuration',
      description: 'Remove a blockchain network configuration from the system'
    })
  }, async (request, reply) => {
    return chainController.deleteChain(request as any, reply);
  });

  // Refresh cache (Admin only)
  fastify.post('/admin/chains/refresh-cache', {
    preHandler: adminMiddleware.authenticate.bind(adminMiddleware),
    schema: createFastifySchema({
      response: {
        200: RefreshCacheResponseSchema,
        401: ChainErrorResponseSchema,
        500: ChainErrorResponseSchema
      },
      tags: ['Admin', 'Chains'],
      summary: 'Refresh chain configuration cache',
      description: 'Manually refresh all chain-related caches to force reload from database'
    })
  }, async (request, reply) => {
    return chainController.refreshCache(request, reply);
  });

  // PUBLIC ROUTES (No authentication required)

  // Get all chains with optional filtering
  fastify.get('/chains', {
    schema: createFastifySchema({
      querystring: GetChainsQuerySchema,
      response: {
        200: ChainListResponseSchema,
        400: ChainErrorResponseSchema,
        500: ChainErrorResponseSchema
      },
      tags: ['Public', 'Chains'],
      summary: 'Get all supported blockchain networks',
      description: 'Retrieve list of all supported blockchain networks with optional filtering by network type, status, and other criteria'
    })
  }, async (request, reply) => {
    return chainController.getAllChains(request as any, reply);
  });

  // Get active chains only
  fastify.get('/chains/active', {
    schema: createFastifySchema({
      response: {
        200: ChainListResponseSchema,
        500: ChainErrorResponseSchema
      },
      tags: ['Public', 'Chains'],
      summary: 'Get active blockchain networks',
      description: 'Get only active blockchain networks that are currently available for transactions'
    })
  }, async (request, reply) => {
    return chainController.getActiveChains(request, reply);
  });

  // Get chain statistics
  fastify.get('/chains/stats', {
    schema: createFastifySchema({
      response: {
        200: ChainStatsResponseSchema,
        500: ChainErrorResponseSchema
      },
      tags: ['Public', 'Chains'],
      summary: 'Get blockchain network statistics',
      description: 'Get comprehensive statistics about supported blockchain networks including counts by type and status'
    })
  }, async (request, reply) => {
    return chainController.getChainStats(request, reply);
  });

  // Get chain by UUID
  fastify.get('/chains/:id', {
    schema: createFastifySchema({
      params: ChainParamsSchema,
      response: {
        200: ChainDetailResponseSchema,
        400: ChainErrorResponseSchema,
        404: ChainErrorResponseSchema,
        500: ChainErrorResponseSchema
      },
      tags: ['Public', 'Chains'],
      summary: 'Get blockchain network by UUID',
      description: 'Get detailed information about a specific blockchain network using its internal UUID'
    })
  }, async (request, reply) => {
    return chainController.getChainById(request as any, reply);
  });

  // Get chain by chain ID (more commonly used)
  fastify.get('/chains/chain-id/:chainId', {
    schema: createFastifySchema({
      params: ChainIdParamsSchema,
      response: {
        200: ChainDetailResponseSchema,
        400: ChainErrorResponseSchema,
        404: ChainErrorResponseSchema,
        500: ChainErrorResponseSchema
      },
      tags: ['Public', 'Chains'],
      summary: 'Get blockchain network by chain ID',
      description: 'Get detailed information about a specific blockchain network using its numeric chain ID (e.g., 1 for Ethereum, 56 for BSC)'
    })
  }, async (request, reply) => {
    return chainController.getChainByChainId(request as any, reply);
  });
} 