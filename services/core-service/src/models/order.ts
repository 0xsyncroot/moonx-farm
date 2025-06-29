import { DatabaseManager } from '@moonx/infrastructure';

export interface Order {
  id: string;
  userId: string;
  orderId: string; // Unique order identifier
  type: 'LIMIT' | 'DCA';
  status: 'PENDING' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'EXPIRED';
  
  // Token details
  fromToken: string; // Contract address
  toToken: string;
  fromChain: number;
  toChain: number;
  
  // Order parameters
  inputAmount: string; // Original amount to trade
  targetPrice?: string; // For limit orders
  frequency?: number; // For DCA orders (in hours)
  executionCount?: number; // For DCA orders
  maxExecutions?: number; // For DCA orders
  
  // Execution details
  executedAmount: string; // Amount already executed
  receivedAmount: string; // Amount received so far
  averagePrice: string; // Average execution price
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  lastExecutedAt?: Date;
  
  // Blockchain details
  transactionHash?: string;
  contractAddress?: string; // Smart contract handling the order
  
  // Metadata
  slippage: number;
  gasPrice?: string;
  metadata?: Record<string, any>;
}

export interface OrderExecution {
  id: string;
  orderId: string; // Reference to orders.id (UUID)
  executionIndex: number;
  
  inputAmount: string;
  outputAmount: string;
  executionPrice: string;
  
  transactionHash: string;
  blockNumber: number;
  gasUsed: string;
  gasFee: string;
  
  executedAt: Date;
  metadata?: Record<string, any>;
}

export class OrderModel {
  constructor(private db: DatabaseManager) {}

  async createOrder(order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<Order> {
    const query = `
      INSERT INTO orders (
        user_id, order_id, type, status, from_token, to_token, from_chain, to_chain,
        input_amount, target_price, frequency, execution_count, max_executions,
        executed_amount, received_amount, average_price, expires_at, slippage,
        transaction_hash, contract_address, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      ) RETURNING *
    `;

    const values = [
      order.userId,
      order.orderId,
      order.type,
      order.status,
      order.fromToken,
      order.toToken,
      order.fromChain,
      order.toChain,
      order.inputAmount,
      order.targetPrice || null,
      order.frequency || null,
      order.executionCount || 0,
      order.maxExecutions || null,
      order.executedAmount || '0',
      order.receivedAmount || '0',
      order.averagePrice || '0',
      order.expiresAt || null,
      order.slippage,
      order.transactionHash || null,
      order.contractAddress || null,
      JSON.stringify(order.metadata || {})
    ];

    const result = await this.db.query(query, values);
    return this.mapRowToOrder(result.rows[0]);
  }

  async getOrdersByUser(userId: string, limit = 50, offset = 0): Promise<Order[]> {
    const query = `
      SELECT * FROM orders 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    
    const result = await this.db.query(query, [userId, limit, offset]);
    return result.rows.map(row => this.mapRowToOrder(row));
  }

  async getActiveOrdersByUser(userId: string): Promise<Order[]> {
    const query = `
      SELECT * FROM orders 
      WHERE user_id = $1 AND status IN ('PENDING', 'PARTIALLY_FILLED')
      ORDER BY created_at DESC
    `;
    
    const result = await this.db.query(query, [userId]);
    return result.rows.map(row => this.mapRowToOrder(row));
  }

  async getOrderById(orderId: string, userId: string): Promise<Order | null> {
    const query = `
      SELECT * FROM orders 
      WHERE order_id = $1 AND user_id = $2
    `;
    
    const result = await this.db.query(query, [orderId, userId]);
    return result.rows[0] ? this.mapRowToOrder(result.rows[0]) : null;
  }

  async updateOrderStatus(
    orderId: string, 
    userId: string, 
    updates: {
      status?: Order['status'];
      executedAmount?: string;
      receivedAmount?: string;
      averagePrice?: string;
      transactionHash?: string;
      lastExecutedAt?: Date;
      metadata?: Record<string, any>;
    }
  ): Promise<Order | null> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramCount++}`);
      values.push(updates.status);
    }
    if (updates.executedAmount !== undefined) {
      setClauses.push(`executed_amount = $${paramCount++}`);
      values.push(updates.executedAmount);
    }
    if (updates.receivedAmount !== undefined) {
      setClauses.push(`received_amount = $${paramCount++}`);
      values.push(updates.receivedAmount);
    }
    if (updates.averagePrice !== undefined) {
      setClauses.push(`average_price = $${paramCount++}`);
      values.push(updates.averagePrice);
    }
    if (updates.transactionHash !== undefined) {
      setClauses.push(`transaction_hash = $${paramCount++}`);
      values.push(updates.transactionHash);
    }
    if (updates.lastExecutedAt !== undefined) {
      setClauses.push(`last_executed_at = $${paramCount++}`);
      values.push(updates.lastExecutedAt);
    }
    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${paramCount++}`);
      values.push(JSON.stringify(updates.metadata));
    }

    values.push(orderId, userId);

    const query = `
      UPDATE orders 
      SET ${setClauses.join(', ')}
      WHERE order_id = $${paramCount++} AND user_id = $${paramCount++}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    return result.rows[0] ? this.mapRowToOrder(result.rows[0]) : null;
  }

  async cancelOrder(orderId: string, userId: string): Promise<Order | null> {
    return this.updateOrderStatus(orderId, userId, { 
      status: 'CANCELLED',
      lastExecutedAt: new Date()
    });
  }

  async createOrderExecution(execution: Omit<OrderExecution, 'id'>): Promise<OrderExecution> {
    const query = `
      INSERT INTO order_executions (
        order_id, execution_index, input_amount, output_amount, execution_price,
        transaction_hash, block_number, gas_used, gas_fee, executed_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      execution.orderId,
      execution.executionIndex,
      execution.inputAmount,
      execution.outputAmount,
      execution.executionPrice,
      execution.transactionHash,
      execution.blockNumber,
      execution.gasUsed,
      execution.gasFee,
      execution.executedAt,
      JSON.stringify(execution.metadata || {})
    ];

    const result = await this.db.query(query, values);
    return this.mapRowToOrderExecution(result.rows[0]);
  }

  async getOrderExecutions(orderId: string): Promise<OrderExecution[]> {
    const query = `
      SELECT * FROM order_executions 
      WHERE order_id = $1 
      ORDER BY execution_index ASC
    `;
    
    const result = await this.db.query(query, [orderId]);
    return result.rows.map(row => this.mapRowToOrderExecution(row));
  }

  private mapRowToOrder(row: any): Order {
    return {
      id: row.id,
      userId: row.user_id,
      orderId: row.order_id,
      type: row.type,
      status: row.status,
      fromToken: row.from_token,
      toToken: row.to_token,
      fromChain: row.from_chain,
      toChain: row.to_chain,
      inputAmount: row.input_amount,
      targetPrice: row.target_price,
      frequency: row.frequency,
      executionCount: row.execution_count,
      maxExecutions: row.max_executions,
      executedAmount: row.executed_amount,
      receivedAmount: row.received_amount,
      averagePrice: row.average_price,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
      lastExecutedAt: row.last_executed_at,
      transactionHash: row.transaction_hash,
      contractAddress: row.contract_address,
      slippage: row.slippage,
      metadata: JSON.parse(row.metadata || '{}')
    };
  }

  private mapRowToOrderExecution(row: any): OrderExecution {
    return {
      id: row.id,
      orderId: row.order_id,
      executionIndex: row.execution_index,
      inputAmount: row.input_amount,
      outputAmount: row.output_amount,
      executionPrice: row.execution_price,
      transactionHash: row.transaction_hash,
      blockNumber: row.block_number,
      gasUsed: row.gas_used,
      gasFee: row.gas_fee,
      executedAt: row.executed_at,
      metadata: JSON.parse(row.metadata || '{}')
    };
  }
} 