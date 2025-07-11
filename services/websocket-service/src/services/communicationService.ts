import { createLogger } from '@moonx-farm/common';
import { 
  JsonRpcMessageBuilder,
  JsonRpcValidator,
  JsonRpcErrorCodes,
  JsonRpcMessageHelper,
  JsonRpcMessage,
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcResponse,
  JsonRpcErrorResponse,
  JsonRpcId,
  JsonRpcParams
} from '@moonx-farm/shared';
import { 
  WebSocketClient,
  JsonRpcMethods,
  MoonxErrorCodes,
  AuthenticateParams,
  AuthenticationResult,
  SubscriptionParams,
  SubscriptionResult,
  AutoSubscriptionResult,
  PriceUpdateParams,
  OrderUpdateParams,
  PortfolioUpdateParams,
  HeartbeatParams
} from '../types';

const logger = createLogger('communication-service');

/**
 * Communication Service Interface
 * Provides standardized JSON-RPC 2.0 message handling for WebSocket communication
 */
export interface ICommunicationService {
  // Message Creation
  createAuthRequiredMessage(timeout: number, tempId?: string): JsonRpcNotification;
  createAuthenticateRequest(token: string, id?: JsonRpcId): JsonRpcRequest;
  createAuthSuccessResponse(result: AuthenticationResult, id: JsonRpcId): JsonRpcResponse;
  createAuthFailedError(error: string, id: JsonRpcId): JsonRpcErrorResponse;
  
  // Subscription Messages
  createSubscribeRequest(channel: string, params?: Record<string, any>, id?: JsonRpcId): JsonRpcRequest;
  createSubscriptionResponse(channel: string, subscribed: boolean, id: JsonRpcId): JsonRpcResponse;
  createAutoSubscribedNotification(result: AutoSubscriptionResult): JsonRpcNotification;
  
  // Real-time Data Messages
  createPriceUpdateNotification(params: PriceUpdateParams): JsonRpcNotification;
  createOrderUpdateNotification(params: OrderUpdateParams): JsonRpcNotification;
  createPortfolioUpdateNotification(params: PortfolioUpdateParams): JsonRpcNotification;
  
  // Connection Messages
  createHeartbeatRequest(clientTime?: number, id?: JsonRpcId): JsonRpcRequest;
  createPongResponse(id: JsonRpcId): JsonRpcResponse;
  
  // Error Messages
  createErrorResponse(code: number, message: string, id: JsonRpcId, data?: any): JsonRpcErrorResponse;
  
  // Message Validation & Parsing
  parseMessage(rawMessage: string): JsonRpcMessage | null;
  validateMessage(message: any): boolean;
  
  // Message Sending
  sendMessage(client: WebSocketClient, message: JsonRpcMessage): Promise<boolean>;
  broadcastNotification(clients: WebSocketClient[], notification: JsonRpcNotification): Promise<void>;
}

/**
 * WebSocket Communication Service Implementation
 */
export class WebSocketCommunicationService implements ICommunicationService {
  
  // Authentication Messages
  createAuthRequiredMessage(timeout: number, tempId?: string): JsonRpcNotification {
    return JsonRpcMessageHelper.createNotification(
      JsonRpcMethods.AUTH_REQUIRED,
      {
        message: 'Authentication required',
        timeout,
        tempId
      }
    );
  }

  createAuthenticateRequest(token: string, id?: JsonRpcId): JsonRpcRequest {
    const params: AuthenticateParams = { token };
    return JsonRpcMessageHelper.createRequest(
      JsonRpcMethods.AUTHENTICATE,
      params,
      id
    );
  }

  createAuthSuccessResponse(result: AuthenticationResult, id: JsonRpcId): JsonRpcResponse {
    return JsonRpcMessageHelper.createResponse(result, id);
  }

  createAuthFailedError(error: string, id: JsonRpcId): JsonRpcErrorResponse {
    return JsonRpcMessageHelper.createError(
      MoonxErrorCodes.AUTH_FAILED,
      'Authentication failed',
      id,
      { error }
    );
  }

  // Subscription Messages
  createSubscribeRequest(channel: string, params?: Record<string, any>, id?: JsonRpcId): JsonRpcRequest {
    const subscriptionParams: SubscriptionParams = { channel, params };
    return JsonRpcMessageHelper.createRequest(
      JsonRpcMethods.SUBSCRIBE,
      subscriptionParams,
      id
    );
  }

  createSubscriptionResponse(channel: string, subscribed: boolean, id: JsonRpcId): JsonRpcResponse {
    const result: SubscriptionResult = {
      channel,
      subscribed,
      timestamp: Date.now()
    };
    return JsonRpcMessageHelper.createResponse(result, id);
  }

  createAutoSubscribedNotification(result: AutoSubscriptionResult): JsonRpcNotification {
    return JsonRpcMessageHelper.createNotification(
      JsonRpcMethods.AUTO_SUBSCRIBED,
      result
    );
  }

  // Real-time Data Messages
  createPriceUpdateNotification(params: PriceUpdateParams): JsonRpcNotification {
    return JsonRpcMessageHelper.createNotification(
      JsonRpcMethods.PRICE_UPDATE,
      params
    );
  }

  createOrderUpdateNotification(params: OrderUpdateParams): JsonRpcNotification {
    return JsonRpcMessageHelper.createNotification(
      JsonRpcMethods.ORDER_UPDATE,
      params
    );
  }

  createPortfolioUpdateNotification(params: PortfolioUpdateParams): JsonRpcNotification {
    return JsonRpcMessageHelper.createNotification(
      JsonRpcMethods.PORTFOLIO_UPDATE,
      params
    );
  }

  // Connection Messages
  createHeartbeatRequest(clientTime?: number, id?: JsonRpcId): JsonRpcRequest {
    const params: HeartbeatParams = {
      timestamp: Date.now(),
      clientTime
    };
    return JsonRpcMessageHelper.createRequest(
      JsonRpcMethods.HEARTBEAT,
      params,
      id
    );
  }

  createPongResponse(id: JsonRpcId): JsonRpcResponse {
    return JsonRpcMessageHelper.createResponse(
      { timestamp: Date.now() },
      id
    );
  }

  // Error Messages
  createErrorResponse(code: number, message: string, id: JsonRpcId, data?: any): JsonRpcErrorResponse {
    return JsonRpcMessageHelper.createError(code, message, id, data);
  }

  // Message Parsing & Validation
  parseMessage(rawMessage: string): JsonRpcMessage | null {
    try {
      const parsed = JsonRpcMessageHelper.parseMessage(rawMessage);
      
      if (!parsed) {
        logger.warn('Invalid JSON-RPC message received', { message: rawMessage });
        return null;
      }

      if (!JsonRpcValidator.isValidMessage(parsed)) {
        logger.warn('Invalid JSON-RPC format', { message: rawMessage });
        return null;
      }

      return parsed;
    } catch (error) {
      logger.error('Failed to parse JSON-RPC message', { 
        error: error instanceof Error ? error.message : String(error),
        rawMessage 
      });
      return null;
    }
  }

  validateMessage(message: any): boolean {
    return JsonRpcValidator.isValidMessage(message);
  }

  // Message Sending
  async sendMessage(client: WebSocketClient, message: JsonRpcMessage): Promise<boolean> {
    try {
      const serialized = JsonRpcMessageHelper.serializeMessage(message);
      
      if (client.socket.readyState === 1) { // WebSocket.OPEN
        client.socket.send(serialized);
        
        logger.debug('Message sent to client', {
          clientId: client.id,
          userId: client.userId,
          method: 'method' in message ? message.method : 'response',
          messageSize: serialized.length
        });
        
        return true;
      } else {
        logger.warn('Cannot send message - WebSocket not open', {
          clientId: client.id,
          readyState: client.socket.readyState
        });
        return false;
      }
    } catch (error) {
      logger.error('Failed to send message to client', {
        clientId: client.id,
        error: error instanceof Error ? error.message : String(error),
        message
      });
      return false;
    }
  }

  async broadcastNotification(clients: WebSocketClient[], notification: JsonRpcNotification): Promise<void> {
    if (clients.length === 0) {
      logger.debug('No clients to broadcast to');
      return;
    }

    const serialized = JsonRpcMessageHelper.serializeMessage(notification);
    const promises = clients.map(async (client) => {
      try {
        if (client.socket.readyState === 1) {
          client.socket.send(serialized);
          return true;
        }
        return false;
      } catch (error) {
        logger.error('Failed to broadcast to client', {
          clientId: client.id,
          error: error instanceof Error ? error.message : String(error)
        });
        return false;
      }
    });

    const results = await Promise.allSettled(promises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
    
    logger.info('Broadcast completed', {
      method: notification.method,
      totalClients: clients.length,
      successCount,
      failedCount: clients.length - successCount
    });
  }

  // Utility Methods
  createSystemNotification(message: string, data?: any): JsonRpcNotification {
    return JsonRpcMessageHelper.createNotification(
      JsonRpcMethods.SYSTEM_ALERT,
      {
        message,
        timestamp: Date.now(),
        data
      }
    );
  }

  createUserNotification(userId: string, message: string, type: string = 'info', data?: any): JsonRpcNotification {
    return JsonRpcMessageHelper.createNotification(
      JsonRpcMethods.NOTIFICATION,
      {
        userId,
        type,
        message,
        timestamp: Date.now(),
        data
      }
    );
  }

  // Common Error Responses - using shared functions
  createParseErrorResponse(id: JsonRpcId = null): JsonRpcErrorResponse {
    return JsonRpcMessageHelper.createParseErrorResponse(id);
  }

  createInvalidRequestError(id: JsonRpcId = null): JsonRpcErrorResponse {
    return JsonRpcMessageHelper.createInvalidRequestError(id);
  }

  createMethodNotFoundError(method: string, id: JsonRpcId): JsonRpcErrorResponse {
    return JsonRpcMessageHelper.createMethodNotFoundError(method, id);
  }

  createInvalidParamsError(id: JsonRpcId): JsonRpcErrorResponse {
    return JsonRpcMessageHelper.createInvalidParamsError(id);
  }

  createRateLimitError(id: JsonRpcId): JsonRpcErrorResponse {
    return JsonRpcMessageHelper.createError(
      MoonxErrorCodes.RATE_LIMITED,
      'Rate limit exceeded',
      id
    );
  }
}

// Export singleton instance
export const communicationService = new WebSocketCommunicationService(); 