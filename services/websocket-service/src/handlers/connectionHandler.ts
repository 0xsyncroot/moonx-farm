import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '@moonx-farm/common';
import { connectionManager } from '../services/connectionManager';
import { authService } from '../middleware/authMiddleware';
import { routeMessage } from './messageHandlers';
import { communicationService } from '../services/communicationService';
import { 
  WebSocketClient, 
  WebSocketMessage, 
  WebSocketContext,
  AuthResult,
  JsonRpcMessage,
  JsonRpcRequest,
  JsonRpcValidator,
  JsonRpcMethods,
  AuthenticateParams,
  AuthenticationResult,
  AutoSubscriptionResult
} from '../types';

const logger = createLogger('connection-handler');

export class WebSocketConnectionHandler {
  private pendingConnections = new Map<string, { 
    socket: any; 
    request: any; 
    connectedAt: number;
  }>();
  private authTimeout = 10000; // 10 seconds timeout for authentication

  constructor() {
    this.setupAuthTimeout();
  }

  /**
   * Handle new WebSocket connection (unauthenticated)
   */
  handleConnection(socket: any, request: any): void {
    // Apply connection rate limiting (async)
    this.processConnection(socket, request);
  }

  /**
   * Process WebSocket connection after rate limiting
   */
  private processConnection(socket: any, request: any): void {
    try {
      // Generate temporary connection ID
      const tempId = uuidv4();
      
      // Store pending connection
      this.pendingConnections.set(tempId, {
        socket: socket,
        request,
        connectedAt: Date.now()
      });

      logger.info('WebSocket connection established, waiting for authentication', {
        tempId,
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });

      // Setup message handler for authentication
      socket.on('message', async (data: Buffer) => {
        await this.handleAuthenticationMessage(data, tempId, request);
      });

      socket.on('close', () => {
        this.pendingConnections.delete(tempId);
      });

      socket.on('error', (error: Error) => {
        logger.error('WebSocket error during pending auth', { 
          tempId, 
          error: error.message 
        });
        this.pendingConnections.delete(tempId);
      });

      // Send welcome message requesting authentication (JSON-RPC 2.0)
      const welcomeMessage = communicationService.createAuthRequiredMessage(
        this.authTimeout,
        tempId
      );

      socket.send(JSON.stringify(welcomeMessage));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to handle WebSocket connection', { 
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      try {
        socket.close(1011, 'Internal server error');
      } catch (closeError) {
        logger.error('Failed to close connection after error', { 
          message: closeError instanceof Error ? closeError.message : String(closeError)
        });
      }
    }
  }

  /**
   * Handle authentication message from client
   */
  private async handleAuthenticationMessage(
    data: Buffer,
    tempId: string,
    request: any
  ): Promise<void> {
    try {
      const pendingConnection = this.pendingConnections.get(tempId);
      if (!pendingConnection) {
        logger.warn('Authentication message from unknown connection', { tempId });
        return;
      }

      const rawMessage = data.toString();
      const message = communicationService.parseMessage(rawMessage);

      // Check if valid JSON-RPC message
      if (!message || !JsonRpcValidator.isRequest(message)) {
        logger.warn('Invalid JSON-RPC message received', { tempId });
        pendingConnection.socket.close(1008, 'Invalid message format');
        return;
      }

      // Only handle auth messages for pending connections
      if (message.method !== JsonRpcMethods.AUTHENTICATE) {
        logger.warn('Expected authentication message', { 
          tempId, 
          receivedMethod: message.method 
        });
        
        const errorResponse = communicationService.createMethodNotFoundError(
          message.method,
          message.id
        );
        pendingConnection.socket.send(JSON.stringify(errorResponse));
        pendingConnection.socket.close(1008, 'Authentication required');
        return;
      }

      const params = message.params as AuthenticateParams;
      const token = params?.token;
      if (!token) {
        logger.warn('No token provided in authentication message', { tempId });
        
        const errorResponse = communicationService.createInvalidParamsError(message.id);
        pendingConnection.socket.send(JSON.stringify(errorResponse));
        pendingConnection.socket.close(1008, 'Authentication token required');
        return;
      }

      // Verify token with auth service
      const authResult: AuthResult = await authService.verifyToken(token);
      
      if (!authResult.success) {
        logger.warn('Authentication failed', {
          tempId,
          error: authResult.error,
          ip: request.ip
        });
        
        // Send auth failure message (JSON-RPC 2.0)
        const failureMessage = communicationService.createAuthFailedError(
          authResult.error || 'Authentication failed',
          message.id
        );

        pendingConnection.socket.send(JSON.stringify(failureMessage));
        pendingConnection.socket.close(1008, authResult.error || 'Authentication failed');
        return;
      }

      // Authentication successful - create authenticated client
      const client: WebSocketClient = {
        id: uuidv4(),
        socket: pendingConnection.socket,
        userId: authResult.userId!,
        userAddress: authResult.userAddress!,
        connectedAt: Date.now(),
        lastPing: Date.now(),
        subscriptions: new Set(),
        metadata: {
          userAgent: request.headers['user-agent'],
          ip: request.ip,
          origin: request.headers.origin
        }
      };

      // Remove from pending connections
      this.pendingConnections.delete(tempId);

      // Add to connection manager
      await connectionManager.addConnection(client);

      logger.info('WebSocket client authenticated successfully', {
        clientId: client.id,
        userId: client.userId,
        userAddress: client.userAddress,
        ip: request.ip
      });

      // Setup authenticated message handlers
      pendingConnection.socket.removeAllListeners('message');
      pendingConnection.socket.on('message', async (data: Buffer) => {
        await this.handleAuthenticatedMessage(data, client, request);
      });

      pendingConnection.socket.on('close', async (code: number, reason: Buffer) => {
        await this.handleConnectionClose(client, code, reason);
      });

      pendingConnection.socket.on('error', (error: Error) => {
        this.handleConnectionError(client, error);
      });

      pendingConnection.socket.on('pong', () => {
        connectionManager.updateClientPing(client.id);
      });

      // Send authentication success message (JSON-RPC 2.0)
      const authResultData: AuthenticationResult = {
        clientId: client.id,
        userId: client.userId,
        userAddress: client.userAddress,
        message: 'Authentication successful'
      };

      const authSuccessMessage = communicationService.createAuthSuccessResponse(
        authResultData,
        message.id
      );

      pendingConnection.socket.send(JSON.stringify(authSuccessMessage));

      // Automatically join default rooms after successful authentication
      await this.joinDefaultRooms(client);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to handle authentication message', { 
        tempId,
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      const pendingConnection = this.pendingConnections.get(tempId);
      this.pendingConnections.delete(tempId);
      
      if (pendingConnection) {
        try {
          pendingConnection.socket.close(1011, 'Authentication error');
        } catch (closeError) {
          logger.error('Failed to close connection in error handler', { 
            tempId, 
            error: closeError instanceof Error ? closeError.message : String(closeError)
          });
        }
      }
    }
  }

  /**
   * Handle WebSocket message from authenticated client (JSON-RPC 2.0)
   */
  private async handleAuthenticatedMessage(
    data: Buffer, 
    client: WebSocketClient, 
    request: any
  ): Promise<void> {
    try {
      const rawMessage = data.toString();
      const message = communicationService.parseMessage(rawMessage);

      // Validate JSON-RPC message
      if (!message) {
        logger.warn('Invalid JSON-RPC message received', { clientId: client.id });
        
        const errorResponse = communicationService.createParseErrorResponse();
        client.socket.send(JSON.stringify(errorResponse));
        return;
      }

      if (!JsonRpcValidator.isValidMessage(message)) {
        logger.warn('Invalid JSON-RPC format', { clientId: client.id });
        
        const errorResponse = communicationService.createInvalidRequestError();
        client.socket.send(JSON.stringify(errorResponse));
        return;
      }

      // Create context
      const context: WebSocketContext = {
        client,
        request
      };

      // Route JSON-RPC message to appropriate handler
      await routeMessage(message as any, context);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to handle JSON-RPC message', { 
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        clientId: client.id 
      });

      // Send JSON-RPC error response
      const errorResponse = communicationService.createErrorResponse(
        -32603, // Internal error
        'MESSAGE_PARSE_ERROR',
        null, // No request ID available
        { error: 'Failed to parse message' }
      );

      try {
        client.socket.send(JSON.stringify(errorResponse));
      } catch (sendError) {
        const sendErrorMessage = sendError instanceof Error ? sendError.message : String(sendError);
        logger.error('Failed to send error response', { 
          message: sendErrorMessage,
          stack: sendError instanceof Error ? sendError.stack : undefined,
          clientId: client.id 
        });
      }
    }
  }

  /**
   * Handle WebSocket connection close
   */
  private async handleConnectionClose(
    client: WebSocketClient, 
    code: number, 
    reason: Buffer
  ): Promise<void> {
    try {
      await connectionManager.removeConnection(client.id);

      logger.info('WebSocket client disconnected', {
        clientId: client.id,
        userId: client.userId,
        code,
        reason: reason.toString()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to handle WebSocket close', { 
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        clientId: client.id 
      });
    }
  }

  /**
   * Handle WebSocket error
   */
  private handleConnectionError(client: WebSocketClient, error: Error): void {
    logger.error('WebSocket error', { 
      error: error.message, 
      clientId: client.id, 
      userId: client.userId 
    });

    connectionManager.emit('error', {
      code: 'WEBSOCKET_ERROR',
      message: error.message,
      details: error
    }, { client, request: null as any });
  }

  /**
   * Automatically join default rooms after successful authentication
   */
  private async joinDefaultRooms(client: WebSocketClient): Promise<void> {
    // Define default rooms for all authenticated users
    const globalRooms = [
      'system_alerts',  // System-wide alerts and notifications
      'chain_stats',   // Chain performance stats
      'bridge_stats'   // Bridge latency stats
    ];

    // Define user-specific rooms
    const userSpecificRooms = [
      `user:${client.userId}`,           // User-specific messages
      `notifications:${client.userId}`  // User notifications
    ];

    const allRooms = [...globalRooms, ...userSpecificRooms];
    
    try {
      // Join each room
      for (const room of allRooms) {
        await connectionManager.addToSubscription(client.id, room as any);
      }

      logger.info('Client joined default rooms', {
        clientId: client.id,
        userId: client.userId,
        userAddress: client.userAddress,
        globalRooms,
        userSpecificRooms,
        totalRooms: allRooms.length
      });

      // Send confirmation message about automatic subscriptions (JSON-RPC 2.0)
      const autoSubscriptionResult: AutoSubscriptionResult = {
        message: 'Automatically subscribed to default channels',
        globalChannels: globalRooms,
        userChannels: userSpecificRooms,
        totalChannels: allRooms.length
      };

      const subscriptionConfirmMessage = communicationService.createAutoSubscribedNotification(
        autoSubscriptionResult
      );

      client.socket.send(JSON.stringify(subscriptionConfirmMessage));

    } catch (error) {
      logger.error('Failed to join default rooms', {
        clientId: client.id,
        userId: client.userId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Setup authentication timeout cleanup
   */
  private setupAuthTimeout(): void {
    setInterval(() => {
      const now = Date.now();
      const toRemove: string[] = [];

      for (const [tempId, pendingConnection] of this.pendingConnections.entries()) {
        if (now - pendingConnection.connectedAt > this.authTimeout) {
          logger.info('Authentication timeout, closing connection', { tempId });
          
          try {
            pendingConnection.socket.close(1008, 'Authentication timeout');
          } catch (error) {
            logger.error('Failed to close timed out connection', { 
              tempId, 
              error: error instanceof Error ? error.message : String(error)
            });
          }
          
          toRemove.push(tempId);
        }
      }

      toRemove.forEach(tempId => this.pendingConnections.delete(tempId));
    }, 5000); // Check every 5 seconds
  }

  /**
   * Get pending connections count (for metrics)
   */
  getPendingConnectionsCount(): number {
    return this.pendingConnections.size;
  }

  /**
   * Shutdown handler
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down WebSocket connection handler');
    
    // Close all pending connections
    for (const [tempId, pendingConnection] of this.pendingConnections.entries()) {
      try {
        pendingConnection.socket.close(1001, 'Server shutting down');
      } catch (error) {
        logger.error('Failed to close pending connection', { tempId, error });
      }
    }
    this.pendingConnections.clear();
  }
}

// Export singleton instance
export const connectionHandler = new WebSocketConnectionHandler(); 