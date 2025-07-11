import { createLogger } from '@moonx-farm/common';
import { 
  JsonRpcMessageHelper,
  JsonRpcMessage,
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcResponse,
  JsonRpcErrorResponse,
  JsonRpcId,
  JsonRpcValidator,
  JsonRpcErrorCodes
} from '@moonx-farm/shared';
import { connectionManager } from '../services/connectionManager';
import { communicationService } from '../services/communicationService';
import { 
  WebSocketClient, 
  WebSocketContext, 
  WebSocketMessage,
  JsonRpcMethods,
  MoonxErrorCodes,
  SubscriptionParams,
  SubscriptionResult,
  HeartbeatParams 
} from '../types';

const logger = createLogger('message-handlers');

/**
 * JSON-RPC Message Handler type
 */
type JsonRpcMessageHandler = (
  message: JsonRpcRequest | JsonRpcNotification,
  context: WebSocketContext
) => Promise<void>;

/**
 * Validate channel name for subscription
 */
function isValidChannelName(channel: string): boolean {
  // Allow predefined channels
  const validChannels = [
    'prices',
    'orders', 
    'portfolio',
    'trades',
    'chain_stats',
    'bridge_stats',
    'stats_overview'
  ];
  
  if (validChannels.includes(channel)) {
    return true;
  }
  
  // Allow user-specific channels (user:userId pattern)
  if (channel.startsWith('user:') && channel.length > 5) {
    return true;
  }
  
  // Allow notification channels (notifications:userId pattern)
  if (channel.startsWith('notifications:') && channel.length > 14) {
    return true;
  }
  
  return false;
}

/**
 * Main message router - dispatches JSON-RPC messages to appropriate handlers
 */
export async function routeMessage(message: JsonRpcMessage, context: WebSocketContext): Promise<void> {
  try {
    
    // Update metrics - skip for JSON-RPC as it has different format
    // connectionManager.emit('message:received', message, context);
    
    const method = 'method' in message ? message.method : 'response';
    const messageId = 'id' in message ? message.id : null;
    
    logger.debug('Processing JSON-RPC message', {
      method,
      id: messageId,
      clientId: context.client.id,
      userId: context.client.userId
    });

    // Only handle requests and notifications (not responses)
    if ('method' in message) {
      const handler = messageHandlers[message.method];
      if (handler) {
        await handler(message, context);
      } else {
        await handleUnknownMethod(message, context);
      }
    } else {
      logger.debug('Received response message (ignoring)', {
        id: messageId,
        clientId: context.client.id
      });
    }
    
  } catch (error) {
    logger.error('Failed to route JSON-RPC message', { 
      error: error instanceof Error ? error.message : String(error), 
      messageId: 'id' in message ? message.id : null,
      clientId: context.client.id 
    });
    
    if ('method' in message && 'id' in message && message.id) {
      await sendErrorResponse(
        context, 
        message.id,
        JsonRpcErrorCodes.INTERNAL_ERROR,
        'Failed to process message'
      );
    }
  }
}

/**
 * Handle subscription requests
 */
export async function handleSubscribe(
  message: JsonRpcRequest | JsonRpcNotification,
  context: WebSocketContext
): Promise<void> {
  try {
    logger.info('🔔 [SUBSCRIBE DEBUG] Subscription request received', {
      clientId: context.client.id,
      userId: context.client.userId,
      messageId: 'id' in message ? message.id : 'notification',
      messageParams: message.params
    });

    const params = message.params as SubscriptionParams;
    
    if (!params?.channel) {
      logger.error('❌ [SUBSCRIBE DEBUG] No channel parameter', {
        clientId: context.client.id,
        params
      });
      
      if ('id' in message && message.id) {
        await sendErrorResponse(
          context,
          message.id,
          JsonRpcErrorCodes.INVALID_PARAMS,
          'Channel parameter is required'
        );
      }
      return;
    }

    const { channel, params: subscriptionParams } = params;
    
    logger.info('🔍 [SUBSCRIBE DEBUG] Validating channel', {
      clientId: context.client.id,
      channel,
      subscriptionParams
    });
    
    // Validate channel name
    if (!isValidChannelName(channel)) {
      logger.error('❌ [SUBSCRIBE DEBUG] Invalid channel name', {
        clientId: context.client.id,
        channel
      });
      
      if ('id' in message && message.id) {
        await sendErrorResponse(
          context,
          message.id,
          JsonRpcErrorCodes.INVALID_PARAMS,
          `Invalid channel name: ${channel}`
        );
      }
      return;
    }
    
    logger.info('📝 [SUBSCRIBE DEBUG] Adding client to subscription', {
      clientId: context.client.id,
      channel
    });
    
    // Add client to subscription
    await connectionManager.addToSubscription(context.client.id, channel as any);
    
    logger.info('✅ [SUBSCRIBE DEBUG] Successfully added to subscription', {
      clientId: context.client.id,
      channel
    });
    
    // Send confirmation for requests
    if ('id' in message && message.id) {
      const response = communicationService.createSubscriptionResponse(
        channel,
        true,
        message.id
      );
      await sendMessage(context, response);
      
      logger.info('📤 [SUBSCRIBE DEBUG] Confirmation sent', {
        clientId: context.client.id,
        channel,
        messageId: message.id
      });
    }
    
    logger.info('🎉 [SUBSCRIBE DEBUG] Client subscribed to channel successfully', {
      clientId: context.client.id,
      userId: context.client.userId,
      channel,
      params: subscriptionParams
    });
    
  } catch (error) {
    logger.error('❌ [SUBSCRIBE DEBUG] Failed to handle subscription', { 
      error: error instanceof Error ? error.message : String(error), 
      clientId: context.client.id,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    if ('id' in message && message.id) {
      await sendErrorResponse(
        context,
        message.id,
        JsonRpcErrorCodes.INTERNAL_ERROR,
        'Failed to subscribe to channel'
      );
    }
  }
}

/**
 * Handle unsubscription requests
 */
export async function handleUnsubscribe(
  message: JsonRpcRequest | JsonRpcNotification,
  context: WebSocketContext
): Promise<void> {
  try {
    const params = message.params as { channel: string };
    
    if (!params?.channel) {
      if ('id' in message && message.id) {
        await sendErrorResponse(
          context,
          message.id,
          JsonRpcErrorCodes.INVALID_PARAMS,
          'Channel parameter is required'
        );
      }
      return;
    }

    const { channel } = params;
    
    // Remove client from subscription
    await connectionManager.removeFromSubscription(context.client.id, channel as any);
    
    // Send confirmation for requests
    if ('id' in message && message.id) {
      const response = communicationService.createSubscriptionResponse(
        channel,
        false,
        message.id
      );
      await sendMessage(context, response);
    }
    
    logger.info('Client unsubscribed from channel', {
      clientId: context.client.id,
      userId: context.client.userId,
      channel
    });
    
  } catch (error) {
    logger.error('Failed to handle unsubscription', { 
      error: error instanceof Error ? error.message : String(error), 
      clientId: context.client.id 
    });
    
    if ('id' in message && message.id) {
      await sendErrorResponse(
        context,
        message.id,
        JsonRpcErrorCodes.INTERNAL_ERROR,
        'Failed to unsubscribe from channel'
      );
    }
  }
}

/**
 * Handle heartbeat/ping messages
 */
export async function handleHeartbeat(
  message: JsonRpcRequest | JsonRpcNotification,
  context: WebSocketContext
): Promise<void> {
  try {
    const params = message.params as HeartbeatParams;
    
    // Update client's last ping time
    await connectionManager.updateClientPing(context.client.id);
    
    // Send pong response for requests
    if ('id' in message && message.id) {
      const response = communicationService.createPongResponse(message.id);
      await sendMessage(context, response);
    }
    
    logger.debug('Heartbeat processed', {
      clientId: context.client.id,
      clientTimestamp: params?.timestamp,
      latency: params?.timestamp ? Date.now() - params.timestamp : 0
    });
    
  } catch (error) {
    logger.error('Failed to handle heartbeat', { 
      error: error instanceof Error ? error.message : String(error), 
      clientId: context.client.id 
    });
  }
}

/**
 * Handle unknown method
 */
export async function handleUnknownMethod(
  message: JsonRpcRequest | JsonRpcNotification,
  context: WebSocketContext
): Promise<void> {
  logger.warn('Unknown JSON-RPC method received', {
    method: message.method,
    clientId: context.client.id,
    userId: context.client.userId
  });
  
  if ('id' in message && message.id) {
    await sendErrorResponse(
      context,
      message.id,
      JsonRpcErrorCodes.METHOD_NOT_FOUND,
      `Unknown method: ${message.method}`
    );
  }
}

/**
 * Send error response to client
 */
export async function sendErrorResponse(
  context: WebSocketContext,
  id: JsonRpcId,
  code: number,
  message: string,
  data?: any
): Promise<void> {
  const errorResponse = JsonRpcMessageHelper.createError(code, message, id, data);
  await sendMessage(context, errorResponse);
}

/**
 * Send message to client
 */
export async function sendMessage(context: WebSocketContext, message: JsonRpcMessage): Promise<void> {
  try {
    if (context.client.socket.readyState === 1) { // WebSocket.OPEN
      const payload = JsonRpcMessageHelper.serializeMessage(message);
      context.client.socket.send(payload);
      
      // Skip connectionManager.emit for JsonRpcMessage compatibility
      // connectionManager.emit('message:sent', message, context.client.id);
      
      logger.debug('JSON-RPC message sent to client', {
        id: 'id' in message ? message.id : null,
        method: 'method' in message ? message.method : 'response',
        clientId: context.client.id
      });
    } else {
      logger.warn('Cannot send message to closed connection', {
        clientId: context.client.id,
        state: context.client.socket.readyState
      });
    }
  } catch (error) {
    logger.error('Failed to send message to client', {
      error: error instanceof Error ? error.message : String(error),
      messageId: 'id' in message ? message.id : null,
      clientId: context.client.id
    });
  }
}

/**
 * JSON-RPC Message handlers registry
 */
export const messageHandlers: Record<string, JsonRpcMessageHandler> = {
  [JsonRpcMethods.SUBSCRIBE]: handleSubscribe,
  [JsonRpcMethods.UNSUBSCRIBE]: handleUnsubscribe,
  [JsonRpcMethods.HEARTBEAT]: handleHeartbeat,
  
  // Note: Server-initiated methods (price_update, order_update, portfolio_update) 
  // are handled by Kafka consumer, not by client messages
};

/**
 * Register custom message handler
 */
export function registerMessageHandler(method: string, handler: JsonRpcMessageHandler): void {
  messageHandlers[method] = handler;
  logger.info('JSON-RPC message handler registered', { method });
}

/**
 * Unregister message handler
 */
export function unregisterMessageHandler(method: string): void {
  delete messageHandlers[method];
  logger.info('JSON-RPC message handler unregistered', { method });
}

// Legacy broadcast functions removed - use Kafka consumer routing instead
// All notifications are now handled by Kafka events and routing rules 