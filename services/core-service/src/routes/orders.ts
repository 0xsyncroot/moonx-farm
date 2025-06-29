import { FastifyInstance } from 'fastify';
import { OrderService } from '../services/orderService';
import { OrderController } from '../controllers/orderController';
import '../types/fastify'; // Import type extensions
import { 
  CreateOrderRequestSchema, 
  UpdateOrderRequestSchema,
  CreateOrderExecutionRequestSchema,
  GetOrdersQuerySchema,
  OrderParamsSchema
} from '../schemas/orderSchemas';
import { createFastifySchema } from '../utils/schemaTransform';

export async function orderRoutes(fastify: FastifyInstance) {
  // Initialize services
  const orderService = new OrderService(
    fastify.databaseManager,
    fastify.redisManager
  );
  const orderController = new OrderController(orderService);

  // Create order
  fastify.post('/orders', {
    schema: createFastifySchema({
      body: CreateOrderRequestSchema,
      tags: ['Orders'],
      summary: 'Create a new limit or DCA order',
      description: 'Create a new limit order or DCA (Dollar Cost Averaging) order for automated trading'
    })
  }, orderController.createOrder.bind(orderController));

  // Get orders with filtering
  fastify.get('/orders', {
    schema: createFastifySchema({
      querystring: GetOrdersQuerySchema,
      tags: ['Orders'],
      summary: 'Get user orders with filtering and pagination',
      description: 'Retrieve user orders with optional filtering by status, type, and pagination'
    })
  }, orderController.getOrders.bind(orderController));

  // Get active orders
  fastify.get('/orders/active', {
    schema: createFastifySchema({
      tags: ['Orders'],
      summary: 'Get active orders for user',
      description: 'Get all active orders (PENDING, PARTIALLY_FILLED) for the authenticated user'
    })
  }, orderController.getActiveOrders.bind(orderController));

  // Get order statistics
  fastify.get('/orders/stats', {
    schema: createFastifySchema({
      tags: ['Orders'],
      summary: 'Get order statistics for user',
      description: 'Get comprehensive order statistics including total orders, volume, success rates'
    })
  }, orderController.getOrderStats.bind(orderController));

  // Get order details
  fastify.get('/orders/:orderId', {
    schema: createFastifySchema({
      params: OrderParamsSchema,
      tags: ['Orders'],
      summary: 'Get order details with execution history',
      description: 'Get detailed information about a specific order including execution history'
    })
  }, orderController.getOrderDetails.bind(orderController));

  // Update order
  fastify.put('/orders/:orderId', {
    schema: createFastifySchema({
      params: OrderParamsSchema,
      body: UpdateOrderRequestSchema,
      tags: ['Orders'],
      summary: 'Update order status or details',
      description: 'Update order status, execution details, or metadata'
    })
  }, orderController.updateOrder.bind(orderController));

  // Cancel order
  fastify.delete('/orders/:orderId', {
    schema: createFastifySchema({
      params: OrderParamsSchema,
      tags: ['Orders'],
      summary: 'Cancel an order',
      description: 'Cancel an order (soft delete - updates status to CANCELLED for audit purposes)'
    })
  }, orderController.cancelOrder.bind(orderController));

  // Record execution
  fastify.post('/orders/:orderId/executions', {
    schema: createFastifySchema({
      params: OrderParamsSchema,
      body: CreateOrderExecutionRequestSchema,
      tags: ['Orders'],
      summary: 'Record an order execution',
      description: 'Record an on-chain execution of an order with transaction details'
    })
  }, orderController.recordExecution.bind(orderController));
} 