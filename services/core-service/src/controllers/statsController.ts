import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StatsService } from '../services/statsService';
import { createLoggerForAnyService } from '@moonx-farm/common';
import { ApiResponse } from '../types';
import {
  GetStatsRequest,
  GetStatsResponse,
  GetAlertsRequest,
  GetAlertsResponse,
  GetAggregatedStatsRequest,
  GetAggregatedStatsResponse,
  StatsOverview,
  GetBridgeStatsRequest,
  GetBridgeStatsResponse
} from '../types/stats';

const logger = createLoggerForAnyService('stats-controller');

export class StatsController {
  private statsService: StatsService;

  constructor(statsService: StatsService) {
    this.statsService = statsService;
  }

  async registerRoutes(fastify: FastifyInstance) {
    // Chain performance stats
    fastify.get('/stats/chain', async (request: FastifyRequest<{
      Querystring: {
        chainIds?: string;
        status?: 'healthy' | 'degraded' | 'unhealthy';
        startTime?: string;
        endTime?: string;
        limit?: number;
        offset?: number;
      }
    }>, reply: FastifyReply) => {
      try {
        const query = request.query;
        
        const statsRequest: GetStatsRequest & { status?: 'healthy' | 'degraded' | 'unhealthy' } = {
          chainIds: query.chainIds ? query.chainIds.split(',').map(id => parseInt(id.trim())) : undefined,
          startTime: query.startTime,
          endTime: query.endTime,
          limit: query.limit || 100,
          offset: query.offset || 0,
          status: query.status
        };

        const response = await this.statsService.getChainStats(statsRequest);
        
        const apiResponse: ApiResponse<GetStatsResponse> = {
          success: true,
          data: response,
          timestamp: new Date().toISOString()
        };

        reply.code(200).send(apiResponse);
      } catch (error) {
        logger.error('Error getting chain stats', { error, query: request.query });
        
        const apiResponse: ApiResponse<null> = {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get chain stats',
          timestamp: new Date().toISOString()
        };

        reply.code(500).send(apiResponse);
      }
    });

    // Bridge latency stats
    fastify.get('/stats/bridge', async (request: FastifyRequest<{
      Querystring: {
        bridgeIds?: string;
        chainIds?: string;
        status?: 'optimal' | 'slow' | 'down';
        startTime?: string;
        endTime?: string;
        limit?: number;
        offset?: number;
      }
    }>, reply: FastifyReply) => {
      try {
        const query = request.query;
        
        const statsRequest: GetBridgeStatsRequest & { 
          chainIds?: number[]; 
          status?: 'optimal' | 'slow' | 'down';
          startTime?: string;
          endTime?: string;
        } = {
          bridgeIds: query.bridgeIds ? query.bridgeIds.split(',').map(id => id.trim()) : undefined,
          chainIds: query.chainIds ? query.chainIds.split(',').map(id => parseInt(id.trim())) : undefined,
          status: query.status,
          startTime: query.startTime,
          endTime: query.endTime,
          limit: query.limit || 100,
          offset: query.offset || 0
        };

        const response = await this.statsService.getBridgeStats(statsRequest);
        
        const apiResponse: ApiResponse<GetBridgeStatsResponse> = {
          success: true,
          data: response,
          timestamp: new Date().toISOString()
        };

        reply.code(200).send(apiResponse);
      } catch (error) {
        logger.error('Error getting bridge stats', { error, query: request.query });
        
        const apiResponse: ApiResponse<null> = {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get bridge stats',
          timestamp: new Date().toISOString()
        };

        reply.code(500).send(apiResponse);
      }
    });

    // All stats (chain + bridge)
    fastify.get('/stats/all', async (request: FastifyRequest<{
      Querystring: {
        chainIds?: string;
        bridgeIds?: string;
        startTime?: string;
        endTime?: string;
        limit?: number;
        offset?: number;
      }
    }>, reply: FastifyReply) => {
      try {
        const query = request.query;
        
        const statsRequest: GetStatsRequest & { 
          bridgeIds?: string[];
        } = {
          chainIds: query.chainIds ? query.chainIds.split(',').map(id => parseInt(id.trim())) : undefined,
          bridgeIds: query.bridgeIds ? query.bridgeIds.split(',').map(id => id.trim()) : undefined,
          startTime: query.startTime,
          endTime: query.endTime,
          limit: query.limit || 100,
          offset: query.offset || 0
        };

        const response = await this.statsService.getAllStats(statsRequest);
        
        const apiResponse: ApiResponse<GetStatsResponse> = {
          success: true,
          data: response,
          timestamp: new Date().toISOString()
        };

        reply.code(200).send(apiResponse);
      } catch (error) {
        logger.error('Error getting all stats', { error, query: request.query });
        
        const apiResponse: ApiResponse<null> = {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get all stats',
          timestamp: new Date().toISOString()
        };

        reply.code(500).send(apiResponse);
      }
    });

    // Alerts
    fastify.get('/stats/alerts', async (request: FastifyRequest<{
      Querystring: {
        chainIds?: string;
        bridgeIds?: string;
        severity?: 'low' | 'medium' | 'high' | 'critical';
        resolved?: boolean;
        startTime?: string;
        endTime?: string;
        limit?: number;
        offset?: number;
      }
    }>, reply: FastifyReply) => {
      try {
        const query = request.query;
        
        const alertsRequest: GetAlertsRequest = {
          chainIds: query.chainIds ? query.chainIds.split(',').map(id => parseInt(id.trim())) : undefined,
          bridgeIds: query.bridgeIds ? query.bridgeIds.split(',').map(id => id.trim()) : undefined,
          severity: query.severity,
          resolved: query.resolved,
          startTime: query.startTime,
          endTime: query.endTime,
          limit: query.limit || 50,
          offset: query.offset || 0
        };

        const response = await this.statsService.getAlerts(alertsRequest);
        
        const apiResponse: ApiResponse<GetAlertsResponse> = {
          success: true,
          data: response,
          timestamp: new Date().toISOString()
        };

        reply.code(200).send(apiResponse);
      } catch (error) {
        logger.error('Error getting alerts', { error, query: request.query });
        
        const apiResponse: ApiResponse<null> = {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get alerts',
          timestamp: new Date().toISOString()
        };

        reply.code(500).send(apiResponse);
      }
    });

    // Stats overview
    fastify.get('/stats/overview', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const response = await this.statsService.getStatsOverview();
        
        const apiResponse: ApiResponse<StatsOverview> = {
          success: true,
          data: response,
          timestamp: new Date().toISOString()
        };

        reply.code(200).send(apiResponse);
      } catch (error) {
        logger.error('Error getting stats overview', { error });
        
        const apiResponse: ApiResponse<null> = {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get stats overview',
          timestamp: new Date().toISOString()
        };

        reply.code(500).send(apiResponse);
      }
    });

    // Aggregated stats
    fastify.get('/stats/aggregated', async (request: FastifyRequest<{
      Querystring: {
        timeframe: 'hour' | 'day' | 'week' | 'month';
      }
    }>, reply: FastifyReply) => {
      try {
        const query = request.query;
        
        if (!query.timeframe) {
          const apiResponse: ApiResponse<null> = {
            success: false,
            error: 'timeframe parameter is required',
            timestamp: new Date().toISOString()
          };
          
          reply.code(400).send(apiResponse);
          return;
        }

        const aggregatedRequest: GetAggregatedStatsRequest = {
          timeframe: query.timeframe
        };

        const response = await this.statsService.getAggregatedStats(aggregatedRequest);
        
        const apiResponse: ApiResponse<GetAggregatedStatsResponse> = {
          success: true,
          data: response,
          timestamp: new Date().toISOString()
        };

        reply.code(200).send(apiResponse);
      } catch (error) {
        logger.error('Error getting aggregated stats', { error, query: request.query });
        
        const apiResponse: ApiResponse<null> = {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get aggregated stats',
          timestamp: new Date().toISOString()
        };

        reply.code(500).send(apiResponse);
      }
    });

    // Stats service health check
    fastify.get('/stats/health', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const health = await this.statsService.healthCheck();
        
        const apiResponse: ApiResponse<typeof health> = {
          success: true,
          data: health,
          timestamp: new Date().toISOString()
        };

        // Return 503 if not healthy
        const statusCode = health.connected ? 200 : 503;
        reply.code(statusCode).send(apiResponse);
      } catch (error) {
        logger.error('Error checking stats health', { error });
        
        const apiResponse: ApiResponse<null> = {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to check stats health',
          timestamp: new Date().toISOString()
        };

        reply.code(500).send(apiResponse);
      }
    });

    logger.info('Stats controller routes registered');
  }
} 