import { FastifyRequest, FastifyReply } from 'fastify';
import { OrderService } from '../services/orderService';
import { ApiResponse } from '../types';
import { createLogger } from '@moonx-farm/common';
import { 
  CreateOrderRequestSchema, 
  UpdateOrderRequestSchema,
  CreateOrderExecutionRequestSchema,
  GetOrdersQuerySchema,
  OrderParamsSchema,
  CreateOrderRequest,
  UpdateOrderRequest,
  CreateOrderExecutionRequest,
  GetOrdersQuery,
  OrderParams
} from '../schemas/orderSchemas';

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

export class OrderController {
  constructor(private orderService: OrderService) {}

  /**
   * POST /orders - Create a new order (limit or DCA)
   */
  async createOrder(
    request: FastifyRequest<{ Body: CreateOrderRequest }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user?.id;
      if (!userId) {
        reply.status(401).send(createErrorResponse('Authentication required'));
        return;
      }

      const orderData = CreateOrderRequestSchema.parse(request.body);
      const order = await this.orderService.createOrder(userId, orderData);

      logger.info('Order created successfully', { 
        userId, 
        orderId: order.orderId, 
        type: order.type 
      });

      reply.status(201).send(createSuccessResponse(
        { order }, 
        'Order created successfully'
      ));
    } catch (error) {
      const logContext: any = {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      if (request.user?.id) {
        logContext.userId = request.user.id;
      }
      
      logger.error('Error creating order', logContext);
      
      if (error instanceof Error && error.message.includes('already exists')) {
        reply.status(409).send(createErrorResponse(error.message));
        return;
      }

      reply.status(500).send(createErrorResponse('Failed to create order'));
    }
  }

  /**
   * GET /orders - Get user orders with filtering and pagination
   */
  async getOrders(
    request: FastifyRequest<{ Querystring: GetOrdersQuery }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user?.id;
      if (!userId) {
        reply.status(401).send(createErrorResponse('Authentication required'));
        return;
      }

      const query = GetOrdersQuerySchema.parse(request.query);
      
      // Create options object with only defined properties
      const options: { limit: number; offset: number; status?: string; type?: string } = {
        limit: query.limit,
        offset: query.offset
      };
      
      if (query.status !== undefined) {
        options.status = query.status;
      }
      
      if (query.type !== undefined) {
        options.type = query.type;
      }
      
      const result = await this.orderService.getUserOrders(userId, options);

      logger.debug('Orders fetched successfully', { 
        userId, 
        count: result.orders.length,
        total: result.total 
      });

      reply.send(createSuccessResponse({
        orders: result.orders,
        total: result.total,
        limit: query.limit,
        offset: query.offset,
        hasMore: (query.offset + query.limit) < result.total
      }, `Retrieved ${result.orders.length} orders`));
    } catch (error) {
      const logContext: any = {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      if (request.user?.id) {
        logContext.userId = request.user.id;
      }
      
      logger.error('Error fetching orders', logContext);
      reply.status(500).send(createErrorResponse('Failed to fetch orders'));
    }
  }

  /**
   * GET /orders/active - Get active orders for user
   */
  async getActiveOrders(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user?.id;
      if (!userId) {
        reply.status(401).send(createErrorResponse('Authentication required'));
        return;
      }

      const orders = await this.orderService.getActiveOrders(userId);

      logger.debug('Active orders fetched successfully', { 
        userId, 
        count: orders.length 
      });

      reply.send(createSuccessResponse(
        { orders }, 
        `Found ${orders.length} active orders`
      ));
    } catch (error) {
      const logContext: any = {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      if (request.user?.id) {
        logContext.userId = request.user.id;
      }
      
      logger.error('Error fetching active orders', logContext);
      reply.status(500).send(createErrorResponse('Failed to fetch active orders'));
    }
  }

  /**
   * GET /orders/:orderId - Get order details with execution history
   */
  async getOrderDetails(
    request: FastifyRequest<{ Params: OrderParams }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user?.id;
      if (!userId) {
        reply.status(401).send(createErrorResponse('Authentication required'));
        return;
      }

      const params = OrderParamsSchema.parse(request.params);
      const result = await this.orderService.getOrderDetails(params.orderId, userId);

      logger.debug('Order details fetched successfully', { 
        userId, 
        orderId: params.orderId,
        executionCount: result.executions.length
      });

      reply.send(createSuccessResponse(
        result, 
        `Order details retrieved with ${result.executions.length} executions`
      ));
    } catch (error) {
      const logContext: any = {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      if (request.user?.id) {
        logContext.userId = request.user.id;
      }
      if ((request.params as any)?.orderId) {
        logContext.orderId = (request.params as any).orderId;
      }
      
      logger.error('Error fetching order details', logContext);
      
      if (error instanceof Error && error.message === 'Order not found') {
        reply.status(404).send(createErrorResponse('Order not found'));
        return;
      }

      reply.status(500).send(createErrorResponse('Failed to fetch order details'));
    }
  }

  /**
   * PUT /orders/:orderId - Update order status/details
   */
  async updateOrder(
    request: FastifyRequest<{ 
      Params: OrderParams; 
      Body: UpdateOrderRequest 
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user?.id;
      if (!userId) {
        reply.status(401).send(createErrorResponse('Authentication required'));
        return;
      }

      const params = OrderParamsSchema.parse(request.params);
      const updates = UpdateOrderRequestSchema.parse(request.body);
      
      const order = await this.orderService.updateOrder(params.orderId, userId, updates);

      logger.info('Order updated successfully', { 
        userId, 
        orderId: params.orderId,
        status: order.status
      });

      reply.send(createSuccessResponse(
        { order }, 
        `Order ${params.orderId} updated successfully`
      ));
    } catch (error) {
      const logContext: any = {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      if (request.user?.id) {
        logContext.userId = request.user.id;
      }
      if ((request.params as any)?.orderId) {
        logContext.orderId = (request.params as any).orderId;
      }
      
      logger.error('Error updating order', logContext);
      
      if (error instanceof Error && error.message.includes('not found')) {
        reply.status(404).send(createErrorResponse('Order not found'));
        return;
      }

      reply.status(500).send(createErrorResponse('Failed to update order'));
    }
  }

  /**
   * DELETE /orders/:orderId - Cancel an order (soft delete - updates status to CANCELLED)
   * Note: This does NOT physically delete the order from database, 
   * only updates status to maintain order history for audit purposes
   */
  async cancelOrder(
    request: FastifyRequest<{ Params: OrderParams }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user?.id;
      if (!userId) {
        reply.status(401).send(createErrorResponse('Authentication required'));
        return;
      }

      const params = OrderParamsSchema.parse(request.params);
      const order = await this.orderService.cancelOrder(params.orderId, userId);

      logger.info('Order cancelled successfully', { 
        userId, 
        orderId: params.orderId,
        previousStatus: 'PENDING/PARTIALLY_FILLED'
      });

      reply.send(createSuccessResponse(
        { order }, 
        'Order cancelled successfully. Order history preserved for audit purposes.'
      ));
    } catch (error) {
      const logContext: any = {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      if (request.user?.id) {
        logContext.userId = request.user.id;
      }
      if ((request.params as any)?.orderId) {
        logContext.orderId = (request.params as any).orderId;
      }
      
      logger.error('Error cancelling order', logContext);
      
      if (error instanceof Error) {
        if (error.message === 'Order not found') {
          reply.status(404).send(createErrorResponse('Order not found'));
          return;
        }
        if (error.message.includes('Cannot cancel')) {
          reply.status(400).send(createErrorResponse(error.message));
          return;
        }
      }

      reply.status(500).send(createErrorResponse('Failed to cancel order'));
    }
  }

  /**
   * POST /orders/:orderId/executions - Record order execution
   */
  async recordExecution(
    request: FastifyRequest<{ 
      Params: OrderParams; 
      Body: CreateOrderExecutionRequest 
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user?.id;
      if (!userId) {
        reply.status(401).send(createErrorResponse('Authentication required'));
        return;
      }

      const params = OrderParamsSchema.parse(request.params);
      const executionData = CreateOrderExecutionRequestSchema.parse(request.body);
      
      const result = await this.orderService.recordExecution(
        params.orderId, 
        userId, 
        executionData
      );

      logger.info('Order execution recorded successfully', { 
        userId, 
        orderId: params.orderId,
        executionIndex: executionData.executionIndex,
        transactionHash: executionData.transactionHash,
        outputAmount: executionData.outputAmount
      });

      reply.status(201).send(createSuccessResponse(
        result, 
        `Execution ${executionData.executionIndex} recorded for order ${params.orderId}`
      ));
    } catch (error) {
      const logContext: any = {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      if (request.user?.id) {
        logContext.userId = request.user.id;
      }
      if ((request.params as any)?.orderId) {
        logContext.orderId = (request.params as any).orderId;
      }
      
      logger.error('Error recording execution', logContext);
      
      if (error instanceof Error && error.message === 'Order not found') {
        reply.status(404).send(createErrorResponse('Order not found'));
        return;
      }

      reply.status(500).send(createErrorResponse('Failed to record execution'));
    }
  }

  /**
   * GET /orders/stats - Get order statistics for user
   */
  async getOrderStats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user?.id;
      if (!userId) {
        reply.status(401).send(createErrorResponse('Authentication required'));
        return;
      }

      const stats = await this.orderService.getOrderStats(userId);

      logger.debug('Order stats fetched successfully', { 
        userId, 
        totalOrders: stats.total,
        totalVolume: stats.totalVolume
      });

      reply.send(createSuccessResponse(
        { stats }, 
        `Order statistics retrieved for ${stats.total} total orders`
      ));
    } catch (error) {
      const logContext: any = {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      if (request.user?.id) {
        logContext.userId = request.user.id;
      }
      
      logger.error('Error fetching order stats', logContext);
      reply.status(500).send(createErrorResponse('Failed to fetch order statistics'));
    }
  }
} 