import { FastifyRequest, FastifyReply } from 'fastify';
import { ChainService } from '../services/chainService';
import { ApiResponse } from '../types';
import { createLogger } from '@moonx-farm/common';
import { 
  CreateChainRequestSchema, 
  UpdateChainRequestSchema,
  GetChainsQuerySchema,
  ChainParamsSchema,
  ChainIdParamsSchema,
  CreateChainRequest,
  UpdateChainRequest,
  GetChainsQuery,
  ChainParams,
  ChainIdParams
} from '../schemas/chainSchemas';

const logger = createLogger('core-service');

// Helper functions for standardized API responses
function createSuccessResponse<T>(data: T, message?: string): ApiResponse<T> {
  const response: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };
  
  if (message) {
    response.message = message;
  }
  
  return response;
}

function createErrorResponse(error: string): ApiResponse {
  return {
    success: false,
    error,
    timestamp: new Date().toISOString()
  };
}

function createValidationErrorResponse(error: string, details?: any): ApiResponse {
  return {
    success: false,
    error,
    data: details,
    timestamp: new Date().toISOString()
  };
}

export class ChainController {
  constructor(private chainService: ChainService) {}

  /**
   * POST /admin/chains - Create a new chain (admin only)
   */
  async createChain(
    request: FastifyRequest<{ Body: CreateChainRequest }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const chainData = CreateChainRequestSchema.parse(request.body);
      const chain = await this.chainService.createChain(chainData);

      logger.info('Chain created successfully', { 
        chainId: chain.chainId, 
        name: chain.name 
      });

      reply.status(201).send(createSuccessResponse(
        { chain }, 
        'Chain created successfully'
      ));
    } catch (error) {
      logger.error('Error creating chain', {
        error: error instanceof Error ? error.message : 'Unknown error',
        body: request.body
      });
      
      if (error instanceof Error && error.message.includes('already exists')) {
        reply.status(409).send(createErrorResponse(error.message));
        return;
      }

      reply.status(500).send(createErrorResponse('Failed to create chain'));
    }
  }

  /**
   * GET /chains - Get all chains with optional filtering (public)
   */
  async getAllChains(
    request: FastifyRequest<{ Querystring: GetChainsQuery }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const query = GetChainsQuerySchema.parse(request.query);
      
      let chains;
      if (query.networkType) {
        chains = await this.chainService.getChainsByNetworkType(query.networkType);
      } else {
        chains = await this.chainService.getAllChains();
      }

      // Apply additional filters
      if (query.status) {
        chains = chains.filter(chain => chain.status === query.status);
      }
      if (query.active !== undefined) {
        chains = chains.filter(chain => chain.active === query.active);
      }
      if (query.isTestnet !== undefined) {
        chains = chains.filter(chain => chain.isTestnet === query.isTestnet);
      }

      logger.debug('Chains fetched successfully', { 
        count: chains.length,
        filters: query
      });

      reply.send(createSuccessResponse(
        { chains }, 
        `Retrieved ${chains.length} chains`
      ));
    } catch (error) {
      logger.error('Error fetching chains', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: request.query
      });
      reply.status(500).send(createErrorResponse('Failed to fetch chains'));
    }
  }

  /**
   * GET /chains/active - Get active chains only (public)
   */
  async getActiveChains(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const chains = await this.chainService.getActiveChains();

      logger.debug('Active chains fetched successfully', { 
        count: chains.length 
      });

      reply.send(createSuccessResponse(
        { chains }, 
        `Found ${chains.length} active chains`
      ));
    } catch (error) {
      logger.error('Error fetching active chains', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      reply.status(500).send(createErrorResponse('Failed to fetch active chains'));
    }
  }

  /**
   * GET /chains/stats - Get chain statistics (public)
   */
  async getChainStats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const stats = await this.chainService.getChainStats();

      logger.debug('Chain stats fetched successfully', stats);

      reply.send(createSuccessResponse(
        { stats }, 
        'Chain statistics retrieved successfully'
      ));
    } catch (error) {
      logger.error('Error fetching chain stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      reply.status(500).send(createErrorResponse('Failed to fetch chain statistics'));
    }
  }

  /**
   * GET /chains/:id - Get chain by UUID (public)
   */
  async getChainById(
    request: FastifyRequest<{ Params: ChainParams }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = ChainParamsSchema.parse(request.params);
      const chain = await this.chainService.getChainById(id);

      if (!chain) {
        reply.status(404).send(createErrorResponse(`Chain with ID ${id} not found`));
        return;
      }

      logger.debug('Chain fetched successfully', { 
        id, 
        chainId: chain.chainId,
        name: chain.name 
      });

      reply.send(createSuccessResponse(
        { chain }, 
        'Chain retrieved successfully'
      ));
    } catch (error) {
      logger.error('Error fetching chain by ID', {
        error: error instanceof Error ? error.message : 'Unknown error',
        id: request.params.id
      });
      reply.status(500).send(createErrorResponse('Failed to fetch chain'));
    }
  }

  /**
   * GET /chains/chain-id/:chainId - Get chain by chain ID (public)
   */
  async getChainByChainId(
    request: FastifyRequest<{ Params: ChainIdParams }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { chainId } = ChainIdParamsSchema.parse(request.params);
      const chain = await this.chainService.getChainByChainId(chainId);

      if (!chain) {
        reply.status(404).send(createErrorResponse(`Chain with chain ID ${chainId} not found`));
        return;
      }

      logger.debug('Chain fetched by chain ID successfully', { 
        chainId,
        name: chain.name 
      });

      reply.send(createSuccessResponse(
        { chain }, 
        'Chain retrieved successfully'
      ));
    } catch (error) {
      logger.error('Error fetching chain by chain ID', {
        error: error instanceof Error ? error.message : 'Unknown error',
        chainId: request.params.chainId
      });
      reply.status(500).send(createErrorResponse('Failed to fetch chain'));
    }
  }

  /**
   * PUT /admin/chains/:id - Update chain (admin only)
   */
  async updateChain(
    request: FastifyRequest<{ 
      Params: ChainParams; 
      Body: UpdateChainRequest 
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = ChainParamsSchema.parse(request.params);
      const updates = UpdateChainRequestSchema.parse(request.body);
      
      const updatedChain = await this.chainService.updateChain(id, updates);

      if (!updatedChain) {
        reply.status(404).send(createErrorResponse(`Chain with ID ${id} not found`));
        return;
      }

      logger.info('Chain updated successfully', { 
        id, 
        chainId: updatedChain.chainId,
        name: updatedChain.name 
      });

      reply.send(createSuccessResponse(
        { chain: updatedChain }, 
        'Chain updated successfully'
      ));
    } catch (error) {
      logger.error('Error updating chain', {
        error: error instanceof Error ? error.message : 'Unknown error',
        id: request.params.id,
        body: request.body
      });
      
      if (error instanceof Error && error.message.includes('already exists')) {
        reply.status(409).send(createErrorResponse(error.message));
        return;
      }

      reply.status(500).send(createErrorResponse('Failed to update chain'));
    }
  }

  /**
   * DELETE /admin/chains/:id - Delete chain (admin only)
   */
  async deleteChain(
    request: FastifyRequest<{ Params: ChainParams }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = ChainParamsSchema.parse(request.params);
      const deleted = await this.chainService.deleteChain(id);

      if (!deleted) {
        reply.status(404).send(createErrorResponse(`Chain with ID ${id} not found`));
        return;
      }

      logger.info('Chain deleted successfully', { id });

      reply.send(createSuccessResponse(
        { deleted: true }, 
        'Chain deleted successfully'
      ));
    } catch (error) {
      logger.error('Error deleting chain', {
        error: error instanceof Error ? error.message : 'Unknown error',
        id: request.params.id
      });
      reply.status(500).send(createErrorResponse('Failed to delete chain'));
    }
  }

  /**
   * POST /admin/chains/refresh-cache - Refresh chain cache (admin only)
   */
  async refreshCache(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      await this.chainService.refreshCache();

      logger.info('Chain cache refreshed successfully');

      reply.send(createSuccessResponse(
        { refreshed: true }, 
        'Chain cache refreshed successfully'
      ));
    } catch (error) {
      logger.error('Error refreshing chain cache', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      reply.status(500).send(createErrorResponse('Failed to refresh chain cache'));
    }
  }
} 