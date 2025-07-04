import { DatabaseManager, RedisManager } from '@moonx-farm/infrastructure';
import { OrderModel, Order, OrderExecution } from '../models/order';
import { CreateOrderRequest, UpdateOrderRequest, CreateOrderExecutionRequest } from '../schemas/orderSchemas';

export class OrderService {
  private orderModel: OrderModel;

  constructor(
    private db: DatabaseManager,
    private redis: RedisManager
  ) {
    this.orderModel = new OrderModel(db);
  }

  /**
   * Create a new order (limit or DCA)
   */
  async createOrder(userId: string, orderData: CreateOrderRequest): Promise<Order> {
    // Validate that order ID is unique for this user
    const existingOrder = await this.orderModel.getOrderById(orderData.orderId, userId);
    if (existingOrder) {
      throw new Error(`Order with ID ${orderData.orderId} already exists for this user`);
    }

    // Set default values based on order type
    const orderToCreate: Omit<Order, 'id' | 'createdAt' | 'updatedAt'> = {
      orderId: orderData.orderId,
      userId,
      type: orderData.type,
      status: 'PENDING' as const,
      fromToken: orderData.fromToken,
      toToken: orderData.toToken,
      fromChain: orderData.fromChain,
      toChain: orderData.toChain,
      inputAmount: orderData.inputAmount,
      executedAmount: '0',
      receivedAmount: '0',
      averagePrice: '0',
      slippage: orderData.slippage,
      metadata: orderData.metadata || {}
    };

    // Add optional properties only if they have values
    if (orderData.targetPrice !== undefined) {
      orderToCreate.targetPrice = orderData.targetPrice;
    }
    
    if (orderData.frequency !== undefined) {
      orderToCreate.frequency = orderData.frequency;
    }
    
    if (orderData.maxExecutions !== undefined) {
      orderToCreate.maxExecutions = orderData.maxExecutions;
    }
    
    if (orderData.expiresAt !== undefined) {
      orderToCreate.expiresAt = new Date(orderData.expiresAt);
    }
    
    if (orderData.gasPrice !== undefined) {
      orderToCreate.gasPrice = orderData.gasPrice;
    }

    if (orderData.contractAddress !== undefined) {
      orderToCreate.contractAddress = orderData.contractAddress;
    }

    // Set execution count for DCA orders
    if (orderData.type === 'DCA') {
      orderToCreate.executionCount = 0;
    }

    const createdOrder = await this.orderModel.createOrder(orderToCreate);

    // Cache the order for quick access
    await this.cacheOrder(createdOrder);

    // Invalidate user's order list cache
    await this.invalidateUserOrdersCache(userId);

    return createdOrder;
  }

  /**
   * Get all orders for a user with filtering and pagination
   */
  async getUserOrders(
    userId: string, 
    options: {
      limit?: number;
      offset?: number;
      status?: string;
      type?: string;
    } = {}
  ): Promise<{ orders: Order[]; total: number }> {
    const { limit = 50, offset = 0, status, type } = options;

    // Try to get from cache first for active orders
    if (!status && !type && offset === 0 && limit <= 50) {
      const cached = await this.getCachedUserOrders(userId);
      if (cached) {
        return {
          orders: cached.slice(0, limit),
          total: cached.length
        };
      }
    }

    // Get from database with filtering
    let orders: Order[];
    if (status || type) {
      const filterOptions: { status?: string; type?: string; limit: number; offset: number } = {
        limit, 
        offset 
      };
      if (status) filterOptions.status = status;
      if (type) filterOptions.type = type;
      
      orders = await this.getFilteredOrders(userId, filterOptions);
    } else {
      orders = await this.orderModel.getOrdersByUser(userId, limit, offset);
    }

    // Get total count (could be optimized with a separate count query)
    const allOrders = await this.orderModel.getOrdersByUser(userId, 1000, 0);
    const total = allOrders.length;

    // Cache the results if it's a basic query
    if (!status && !type && offset === 0) {
      await this.cacheUserOrders(userId, orders);
    }

    return { orders, total };
  }

  /**
   * Get active orders for a user (PENDING, PARTIALLY_FILLED)
   */
  async getActiveOrders(userId: string): Promise<Order[]> {
    // Try cache first
    const cacheKey = `active_orders:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const orders = await this.orderModel.getActiveOrdersByUser(userId);

    // Cache for 1 minute (active orders change frequently)
    await this.redis.set(cacheKey, JSON.stringify(orders));
    await this.redis.expire(cacheKey, 60);

    return orders;
  }

  /**
   * Get order details with execution history
   */
  async getOrderDetails(orderId: string, userId: string): Promise<{
    order: Order;
    executions: OrderExecution[];
  }> {
    // Try cache first
    const cacheKey = `order_details:${orderId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      // Verify user access
      if (data.order.userId === userId) {
        return data;
      }
    }

    const order = await this.orderModel.getOrderById(orderId, userId);
    if (!order) {
      throw new Error('Order not found');
    }

    const executions = await this.orderModel.getOrderExecutions(order.id); // Use internal ID

    const result = { order, executions };

    // Cache for 5 minutes
    await this.redis.set(cacheKey, JSON.stringify(result));
    await this.redis.expire(cacheKey, 300);

    return result;
  }

  /**
   * Update order status and execution details
   */
  async updateOrder(orderId: string, userId: string, updates: UpdateOrderRequest): Promise<Order> {
    const updateData: {
      status?: Order['status'];
      executedAmount?: string;
      receivedAmount?: string;
      averagePrice?: string;
      transactionHash?: string;
      lastExecutedAt?: Date;
      metadata?: Record<string, any>;
    } = {};

    // Only include defined properties
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.executedAmount !== undefined) updateData.executedAmount = updates.executedAmount;
    if (updates.receivedAmount !== undefined) updateData.receivedAmount = updates.receivedAmount;
    if (updates.averagePrice !== undefined) updateData.averagePrice = updates.averagePrice;
    if (updates.transactionHash !== undefined) updateData.transactionHash = updates.transactionHash;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

    if (updates.status) {
      updateData.lastExecutedAt = new Date();
    }

    const updatedOrder = await this.orderModel.updateOrderStatus(orderId, userId, updateData);

    if (!updatedOrder) {
      throw new Error('Order not found or update failed');
    }

    // Update cache
    await this.cacheOrder(updatedOrder);

    // Invalidate related caches
    await this.invalidateOrderCaches(orderId, userId);

    return updatedOrder;
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, userId: string): Promise<Order> {
    const order = await this.orderModel.getOrderById(orderId, userId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === 'FILLED' || order.status === 'CANCELLED') {
      throw new Error(`Cannot cancel order with status: ${order.status}`);
    }

    const cancelledOrder = await this.orderModel.cancelOrder(orderId, userId);
    if (!cancelledOrder) {
      throw new Error('Failed to cancel order');
    }

    // Update cache
    await this.cacheOrder(cancelledOrder);

    // Invalidate related caches
    await this.invalidateOrderCaches(orderId, userId);

    return cancelledOrder;
  }

  /**
   * Record an order execution (when order is executed on-chain)
   */
  async recordExecution(orderId: string, userId: string, executionData: CreateOrderExecutionRequest): Promise<{
    execution: OrderExecution;
    updatedOrder: Order;
  }> {
    // Verify order exists and belongs to user
    const order = await this.orderModel.getOrderById(orderId, userId);
    if (!order) {
      throw new Error('Order not found');
    }

    // Create execution record
    const executionToCreate: Omit<OrderExecution, 'id'> = {
      orderId: order.id, // Use internal UUID ID
      executionIndex: executionData.executionIndex,
      inputAmount: executionData.inputAmount,
      outputAmount: executionData.outputAmount,
      executionPrice: executionData.executionPrice,
      transactionHash: executionData.transactionHash,
      blockNumber: executionData.blockNumber,
      gasUsed: executionData.gasUsed,
      gasFee: executionData.gasFee,
      executedAt: new Date(),
      metadata: executionData.metadata || {}
    };

    const execution = await this.orderModel.createOrderExecution(executionToCreate);

    // Calculate updated order values
    const newExecutedAmount = (parseFloat(order.executedAmount) + parseFloat(executionData.inputAmount)).toString();
    const newReceivedAmount = (parseFloat(order.receivedAmount) + parseFloat(executionData.outputAmount)).toString();
    
    // Calculate new average price
    const totalValue = parseFloat(order.averagePrice) * parseFloat(order.executedAmount) + 
                       parseFloat(executionData.executionPrice) * parseFloat(executionData.inputAmount);
    const newAveragePrice = totalValue > 0 ? (totalValue / parseFloat(newExecutedAmount)).toString() : '0';

    // Determine new status
    let newStatus: Order['status'] = order.status;
    const executionRatio = parseFloat(newExecutedAmount) / parseFloat(order.inputAmount);
    
    if (executionRatio >= 0.99) { // 99% executed = filled
      newStatus = 'FILLED';
    } else if (parseFloat(newExecutedAmount) > 0) {
      newStatus = 'PARTIALLY_FILLED';
    }

    // Update DCA execution count
    const newExecutionCount = order.type === 'DCA' ? (order.executionCount || 0) + 1 : order.executionCount;

    // Update order with execution data
    const updatedOrder = await this.orderModel.updateOrderStatus(orderId, userId, {
      status: newStatus,
      executedAmount: newExecutedAmount,
      receivedAmount: newReceivedAmount,
      averagePrice: newAveragePrice,
      transactionHash: executionData.transactionHash,
      lastExecutedAt: new Date(),
      metadata: {
        ...order.metadata,
        executionCount: newExecutionCount,
        lastExecution: {
          blockNumber: executionData.blockNumber,
          gasUsed: executionData.gasUsed,
          gasFee: executionData.gasFee
        }
      }
    });

    if (!updatedOrder) {
      throw new Error('Failed to update order after execution');
    }

    // Invalidate all related caches
    await this.invalidateOrderCaches(orderId, userId);

    return { execution, updatedOrder };
  }

  /**
   * Get order statistics for a user
   */
  async getOrderStats(userId: string): Promise<{
    total: number;
    pending: number;
    filled: number;
    cancelled: number;
    totalVolume: string;
    avgOrderSize: string;
  }> {
    const cacheKey = `order_stats:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        console.warn(`Failed to parse cached order stats for ${userId}:`, error);
        await this.redis.del(cacheKey); // Clear corrupted cache
        // Continue to generate fresh stats
      }
    }

    const allOrders = await this.orderModel.getOrdersByUser(userId, 1000, 0);

    const stats = {
      total: allOrders.length,
      pending: allOrders.filter(o => o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED').length,
      filled: allOrders.filter(o => o.status === 'FILLED').length,
      cancelled: allOrders.filter(o => o.status === 'CANCELLED').length,
      totalVolume: allOrders.reduce((sum, o) => sum + parseFloat(o.executedAmount || '0'), 0).toString(),
      avgOrderSize: '0'
    };

    if (stats.total > 0) {
      stats.avgOrderSize = (parseFloat(stats.totalVolume) / stats.total).toString();
    }

    // Cache for 10 minutes
    const cleanStats = JSON.parse(JSON.stringify(stats)); // Ensure clean serialization
    await this.redis.set(cacheKey, JSON.stringify(cleanStats));
    await this.redis.expire(cacheKey, 600);

    return stats;
  }

  // Cache management methods
  private async cacheOrder(order: Order): Promise<void> {
    const cacheKey = `order:${order.orderId}`;
    // Check if order has any methods that would cause [object Object] issue
    const cleanOrder = JSON.parse(JSON.stringify(order)); // Deep clone to remove any methods
    await this.redis.set(cacheKey, JSON.stringify(cleanOrder));
    await this.redis.expire(cacheKey, 300); // 5 minutes
  }

  private async cacheUserOrders(userId: string, orders: Order[]): Promise<void> {
    const cacheKey = `user_orders:${userId}`;
    // Clean the orders array to prevent [object Object] issue
    const cleanOrders = orders.map(order => JSON.parse(JSON.stringify(order)));
    await this.redis.set(cacheKey, JSON.stringify(cleanOrders));
    await this.redis.expire(cacheKey, 120); // 2 minutes
  }

  private async getCachedUserOrders(userId: string): Promise<Order[] | null> {
    const cacheKey = `user_orders:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (!cached) return null;
    
    try {
      return JSON.parse(cached);
    } catch (error) {
      console.warn(`Failed to parse cached user orders for ${userId}:`, error);
      await this.redis.del(cacheKey); // Clear corrupted cache
      return null;
    }
  }

  private async invalidateOrderCaches(orderId: string, userId: string): Promise<void> {
    const keys = [
      `order:${orderId}`,
      `order_details:${orderId}`,
      `user_orders:${userId}`,
      `active_orders:${userId}`,
      `order_stats:${userId}`
    ];

    await Promise.all(keys.map(key => this.redis.del(key)));
  }

  private async invalidateUserOrdersCache(userId: string): Promise<void> {
    const keys = [
      `user_orders:${userId}`,
      `active_orders:${userId}`,
      `order_stats:${userId}`
    ];

    await Promise.all(keys.map(key => this.redis.del(key)));
  }

  private async getFilteredOrders(
    userId: string, 
    filters: { status?: string; type?: string; limit: number; offset: number }
  ): Promise<Order[]> {
    // This is a simplified implementation - in production you'd want proper SQL filtering
    const allOrders = await this.orderModel.getOrdersByUser(userId, 1000, 0);
    
    let filtered = allOrders;
    
    if (filters.status) {
      filtered = filtered.filter(order => order.status === filters.status);
    }
    
    if (filters.type) {
      filtered = filtered.filter(order => order.type === filters.type);
    }

    return filtered.slice(filters.offset, filters.offset + filters.limit);
  }
} 