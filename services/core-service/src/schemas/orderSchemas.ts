import { z } from 'zod';

// Order Type and Status Enums
export const OrderTypeSchema = z.enum(['LIMIT', 'DCA']);
export const OrderStatusSchema = z.enum(['PENDING', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'EXPIRED']);

// Create Order Request Schema
export const CreateOrderRequestSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  type: OrderTypeSchema,
  fromToken: z.string().min(1, 'From token address is required'),
  toToken: z.string().min(1, 'To token address is required'),
  fromChain: z.number().int().positive('From chain ID must be positive'),
  toChain: z.number().int().positive('To chain ID must be positive'),
  inputAmount: z.string().regex(/^\d+(\.\d+)?$/, 'Input amount must be a valid number'),
  slippage: z.number().min(0).max(100, 'Slippage must be between 0 and 100'),
  
  // Optional fields based on order type
  targetPrice: z.string().regex(/^\d+(\.\d+)?$/, 'Target price must be a valid number').optional(),
  frequency: z.number().int().positive('Frequency must be positive (in hours)').optional(),
  maxExecutions: z.number().int().positive('Max executions must be positive').optional(),
  expiresAt: z.string().datetime().optional(),
  
  // Optional metadata
  contractAddress: z.string().optional(),
  gasPrice: z.string().optional(),
  metadata: z.record(z.any()).optional()
}).refine((data) => {
  // Limit orders must have target price
  if (data.type === 'LIMIT' && !data.targetPrice) {
    return false;
  }
  // DCA orders must have frequency and max executions
  if (data.type === 'DCA' && (!data.frequency || !data.maxExecutions)) {
    return false;
  }
  return true;
}, {
  message: 'LIMIT orders require targetPrice, DCA orders require frequency and maxExecutions'
});

// Update Order Request Schema
export const UpdateOrderRequestSchema = z.object({
  status: OrderStatusSchema.optional(),
  executedAmount: z.string().regex(/^\d+(\.\d+)?$/, 'Executed amount must be a valid number').optional(),
  receivedAmount: z.string().regex(/^\d+(\.\d+)?$/, 'Received amount must be a valid number').optional(),
  averagePrice: z.string().regex(/^\d+(\.\d+)?$/, 'Average price must be a valid number').optional(),
  transactionHash: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

// Order Response Schema
export const OrderResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  orderId: z.string(),
  type: OrderTypeSchema,
  status: OrderStatusSchema,
  
  fromToken: z.string(),
  toToken: z.string(),
  fromChain: z.number(),
  toChain: z.number(),
  
  inputAmount: z.string(),
  targetPrice: z.string().nullable(),
  frequency: z.number().nullable(),
  executionCount: z.number(),
  maxExecutions: z.number().nullable(),
  
  executedAmount: z.string(),
  receivedAmount: z.string(),
  averagePrice: z.string(),
  
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  lastExecutedAt: z.string().datetime().nullable(),
  
  transactionHash: z.string().nullable(),
  contractAddress: z.string().nullable(),
  slippage: z.number(),
  gasPrice: z.string().nullable(),
  metadata: z.record(z.any())
});

// Order Execution Schema
export const OrderExecutionSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  executionIndex: z.number(),
  inputAmount: z.string(),
  outputAmount: z.string(),
  executionPrice: z.string(),
  transactionHash: z.string(),
  blockNumber: z.number(),
  gasUsed: z.string(),
  gasFee: z.string(),
  executedAt: z.string().datetime(),
  metadata: z.record(z.any())
});

// Create Order Execution Request Schema
export const CreateOrderExecutionRequestSchema = z.object({
  executionIndex: z.number().int().min(0),
  inputAmount: z.string().regex(/^\d+(\.\d+)?$/, 'Input amount must be a valid number'),
  outputAmount: z.string().regex(/^\d+(\.\d+)?$/, 'Output amount must be a valid number'),
  executionPrice: z.string().regex(/^\d+(\.\d+)?$/, 'Execution price must be a valid number'),
  transactionHash: z.string().min(1, 'Transaction hash is required'),
  blockNumber: z.number().int().positive('Block number must be positive'),
  gasUsed: z.string().regex(/^\d+$/, 'Gas used must be a valid integer'),
  gasFee: z.string().regex(/^\d+(\.\d+)?$/, 'Gas fee must be a valid number'),
  metadata: z.record(z.any()).optional()
});

// Query Parameters Schemas
export const GetOrdersQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).default('50'),
  offset: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0)).default('0'),
  status: OrderStatusSchema.optional(),
  type: OrderTypeSchema.optional()
});

// Route Parameters Schema
export const OrderParamsSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required')
});

// Response Schemas
export const OrderListResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    orders: z.array(OrderResponseSchema),
    total: z.number(),
    limit: z.number(),
    offset: z.number()
  })
});

export const OrderDetailResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    order: OrderResponseSchema,
    executions: z.array(OrderExecutionSchema)
  })
});

export const CreateOrderResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    order: OrderResponseSchema
  })
});

export const UpdateOrderResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    order: OrderResponseSchema
  })
});

export const OrderExecutionResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    execution: OrderExecutionSchema
  })
});

// Type exports
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;
export type UpdateOrderRequest = z.infer<typeof UpdateOrderRequestSchema>;
export type CreateOrderExecutionRequest = z.infer<typeof CreateOrderExecutionRequestSchema>;
export type GetOrdersQuery = z.infer<typeof GetOrdersQuerySchema>;
export type OrderParams = z.infer<typeof OrderParamsSchema>;
export type OrderResponse = z.infer<typeof OrderResponseSchema>;
export type OrderExecutionResponse = z.infer<typeof OrderExecutionSchema>; 