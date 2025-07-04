// WebSocket Gateway - Refactored with Dependency Injection
// Following patterns from auth-service and notification-hub

import { Server, ServerOptions } from 'socket.io';
import { createServer } from 'http';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { createAdapter } from '@socket.io/redis-adapter';
import { logger } from '@moonx-farm/common';
import { ServiceContainer } from './container';
import { isValidRoomName, ALL_SUBSCRIPTION_TYPES } from '../types';

// Socket interface extension
declare module 'socket.io' {
  interface Socket {
    userId?: string;
    userRole?: string;
    user?: any;
    authenticated?: boolean;
    connectionTime?: Date;
    lastActivity?: Date;
    clientIP?: string;
  }
}

// Gateway event handlers interface
interface GatewayEventHandlers {
  onConnection(socket: any): Promise<void>;
  onDisconnection(socket: any, reason: string): Promise<void>;
  onMessage(socket: any, event: string, data: any): Promise<void>;
  onError(socket: any, error: Error): Promise<void>;
}

// Gateway configuration interface
interface GatewayConfig {
  server: {
    port: number;
    host: string;
  };
  socket: {
    pingTimeout: number;
    pingInterval: number;
    maxHttpBufferSize: number;
    maxDisconnectionDuration: number;
    transports: string[];
  };
  cors: {
    allowedOrigins: string[];
    allowedMethods: string[];
    credentials: boolean;
  };
}

export class WebSocketGateway implements GatewayEventHandlers {
  private app: FastifyInstance;
  private httpServer: any;
  private io!: Server;
  private services: ServiceContainer;
  private isRunning = false;

  constructor(services: ServiceContainer) {
    this.services = services;
    this.app = Fastify({ logger: false, trustProxy: true });
    this.httpServer = createServer();
  }

  // === INITIALIZATION ===
  
  async initialize(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Gateway is already running');
    }

    try {
      logger.info('🚀 Initializing WebSocket Gateway...');
      
      // Setup Fastify plugins
      await this.setupFastify();
      
      // Setup Socket.IO
      await this.setupSocketIO();
      
      // Setup routes
      this.setupRoutes();
      
      // Setup Redis adapter
      await this.setupRedisAdapter();
      
      // Setup middleware
      this.setupSocketMiddleware();
      
      // Setup event handlers
      this.setupEventHandlers();
      
      logger.info('✅ WebSocket Gateway initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize WebSocket Gateway:', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  // === FASTIFY SETUP ===
  
  private async setupFastify(): Promise<void> {
    const corsOrigins = this.services.config.get('CORS_ORIGINS') || '*';
    const corsMethods = this.services.config.get('CORS_METHODS') || 'GET,POST';
    const corsCredentials = this.services.config.get('CORS_CREDENTIALS') || true;
    
    // Register plugins
    await this.app.register(helmet, {
      contentSecurityPolicy: false,
    });

    await this.app.register(cors, {
      origin: corsOrigins.split(','),
      methods: corsMethods.split(','),
      credentials: corsCredentials,
    });
    
    logger.info('🌐 Fastify configured');
  }

  // === SOCKET.IO SETUP ===
  
  private async setupSocketIO(): Promise<void> {
    const corsOrigins = this.services.config.get('CORS_ORIGINS') || '*';
    const corsMethods = this.services.config.get('CORS_METHODS') || 'GET,POST';
    const corsCredentials = this.services.config.get('CORS_CREDENTIALS') || true;
    const transports = this.services.config.get('TRANSPORTS') || 'websocket,polling';
    const pingTimeout = this.services.config.get('PING_TIMEOUT') || 60000;
    const pingInterval = this.services.config.get('PING_INTERVAL') || 25000;
    const maxHttpBufferSize = this.services.config.get('MAX_HTTP_BUFFER_SIZE') || 1000000;
    const maxDisconnectionDuration = this.services.config.get('MAX_DISCONNECTION_DURATION') || 180000;
    
    this.io = new Server(this.httpServer, {
      cors: {
        origin: corsOrigins.split(','),
        methods: corsMethods.split(','),
        credentials: corsCredentials
      },
      transports: transports.split(','),
      pingTimeout: pingTimeout,
      pingInterval: pingInterval,
      maxHttpBufferSize: maxHttpBufferSize,
      allowEIO3: true,
      connectionStateRecovery: {
        maxDisconnectionDuration: maxDisconnectionDuration,
        skipMiddlewares: true
      }
    } as any);
    
    logger.info('🔌 Socket.IO configured');
  }

  // === REDIS ADAPTER SETUP ===
  
  private async setupRedisAdapter(): Promise<void> {
    try {
      const redisClient = this.services.redisManager.getClient();
      const subClient = redisClient.duplicate();
      
      await subClient.connect();
      this.io.adapter(createAdapter(redisClient, subClient));
      
      logger.info('📡 Redis adapter configured');
    } catch (error) {
      logger.error('❌ Redis adapter setup failed:', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  // === SOCKET MIDDLEWARE SETUP ===
  
  private setupSocketMiddleware(): void {
    // IP extraction
    this.io.use((socket, next) => {
      socket.clientIP = socket.handshake.address;
      next();
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        await this.services.socketMiddleware.authenticate(socket, next);
      } catch (error) {
        logger.error('Authentication middleware error:', { error: error instanceof Error ? error.message : String(error) });
        next(new Error('Authentication failed'));
      }
    });

    // Rate limiting - DISABLED for maximum performance
    // Note: Rate limiting has been completely removed for DEX real-time requirements

    // Connection validation - SIMPLIFIED for maximum performance
    // Note: Connection validation has been simplified for DEX real-time requirements

    logger.info('🛡️ Socket middleware configured');
  }

  // === EVENT HANDLERS SETUP ===
  
  private setupEventHandlers(): void {
    this.io.on('connection', this.onConnection.bind(this));
    this.io.on('error', this.onError.bind(this));
    
    logger.info('📡 Event handlers configured');
  }

  // === ROUTES SETUP ===
  
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', async (request, reply) => {
      try {
        const health = await this.services.healthService.getHealthStatus();
        const status = health.status === 'healthy' ? 200 : 503;
        reply.status(status).send(health);
      } catch (error) {
        reply.status(503).send({ 
          status: 'error', 
          message: 'Health check failed',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Metrics
    this.app.get('/metrics', async (request, reply) => {
      try {
        const metrics = await this.services.prometheusMetrics.getMetrics();
        reply.type('text/plain').send(metrics);
      } catch (error) {
        reply.status(500).send({ error: 'Metrics unavailable' });
      }
    });

    // Connection stats
    this.app.get('/stats', async (request, reply) => {
      try {
        const stats = await this.services.connectionManager.getDetailedStats();
        reply.send(stats);
      } catch (error) {
        reply.status(500).send({ error: 'Stats unavailable' });
      }
    });

    // Load balancer info
    this.app.get('/load-balancer', async (request, reply) => {
      try {
        const status = await this.services.loadBalancer.getStatus();
        reply.send(status);
      } catch (error) {
        reply.status(500).send({ error: 'Load balancer info unavailable' });
      }
    });

    logger.info('🛣️ Routes configured');
  }

  // === EVENT HANDLER IMPLEMENTATIONS ===
  
  async onConnection(socket: any): Promise<void> {
    const userId = socket.userId;
    const connectionId = socket.id;
    
    logger.info('🔗 New connection', {
      connectionId,
      userId,
      userAgent: socket.handshake.headers['user-agent'],
      ip: socket.handshake.address
    });

    try {
      // Initialize connection metadata
      socket.connectionTime = new Date();
      socket.lastActivity = new Date();
      socket.authenticated = true;

      // Register with connection manager
      await this.services.connectionManager.addConnection(socket);
      
      // Update load balancer
      await this.services.loadBalancer.registerConnection(connectionId);
      
      // Update metrics
      this.services.prometheusMetrics.incrementConnections();
      
      // Setup connection-specific handlers
      this.setupConnectionHandlers(socket);
      
      // Send welcome message
      socket.emit('connected', {
        connectionId,
        timestamp: new Date().toISOString(),
        serverVersion: process.env['npm_package_version'] || '1.0.0'
      });
      
    } catch (error) {
      logger.error('❌ Connection setup failed:', { error: error instanceof Error ? error.message : String(error) });
      socket.emit('error', { message: 'Connection setup failed' });
      socket.disconnect(true);
    }
  }

  async onDisconnection(socket: any, reason: string): Promise<void> {
    const userId = socket.userId;
    const connectionId = socket.id;
    
    logger.info('🔌 Connection closed', {
      connectionId,
      userId,
      reason,
      duration: socket.connectionTime ? Date.now() - socket.connectionTime.getTime() : 0
    });

    try {
      // Clean up connection
      await this.services.connectionManager.removeConnection(connectionId);
      await this.services.loadBalancer.unregisterConnection(connectionId);
      
      // Update metrics
      this.services.prometheusMetrics.decrementConnections();
      
    } catch (error) {
      logger.error('❌ Disconnection cleanup failed:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  async onMessage(socket: any, event: string, data: any): Promise<void> {
    socket.lastActivity = new Date();
    await this.services.connectionManager.updateLastActivity(socket.id);
    
    // Route message through message router
    if (this.services.messageRouter) {
      await this.services.messageRouter.routeMessage(socket, event, data);
    }
  }

  async onError(socket: any, error: Error): Promise<void> {
    logger.error('❌ Socket error', {
      connectionId: socket.id,
      userId: socket.userId,
      error: error.message
    });
    
    this.services.prometheusMetrics.incrementErrors();
  }

  // === CONNECTION-SPECIFIC HANDLERS ===
  
  private setupConnectionHandlers(socket: any): void {
    // Room management
    socket.on('join_room', async (data: { room: string }) => {
      if (this.isValidRoomName(data.room)) {
        await socket.join(data.room);
        await this.services.connectionManager.addToRoom(socket.id, data.room);
        socket.emit('room_joined', { room: data.room });
      } else {
        socket.emit('error', { message: 'Invalid room name' });
      }
    });

    socket.on('leave_room', async (data: { room: string }) => {
      await socket.leave(data.room);
      await this.services.connectionManager.removeFromRoom(socket.id, data.room);
      socket.emit('room_left', { room: data.room });
    });

    // Subscription management
    socket.on('subscribe', async (data: { types: string[] }) => {
      const validTypes = this.validateSubscriptionTypes(data.types);
      await this.services.connectionManager.updateSubscriptions(socket.id, validTypes);
      socket.emit('subscribed', { types: validTypes });
    });

    // Heartbeat
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Disconnect handler
    socket.on('disconnect', (reason: string) => {
      this.onDisconnection(socket, reason);
    });
  }

  // === HELPER METHODS ===
  
  private isValidRoomName(room: string): boolean {
    return isValidRoomName(room);
  }

  private validateSubscriptionTypes(types: string[]): string[] {
    return types.filter(type => ALL_SUBSCRIPTION_TYPES.includes(type));
  }

  // === SERVER CONTROL ===
  
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Gateway is already running');
    }

    const port = this.services.config.get('WEBSOCKET_GATEWAY_PORT') || 8080;
    const host = this.services.config.get('WEBSOCKET_GATEWAY_HOST') || 'localhost';

    try {
      await this.app.listen({ port, host });
      this.isRunning = true;
      logger.info(`🌐 WebSocket Gateway listening on ${host}:${port}`);
      logger.info(`📊 Health check: http://${host}:${port}/health`);
    } catch (error) {
      logger.error('Failed to start WebSocket Gateway:', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('🛑 Stopping WebSocket Gateway...');

    try {
      // Close Socket.IO
      this.io.close();
      
      // Close Fastify server
      await this.app.close();
      
      this.isRunning = false;
      logger.info('✅ WebSocket Gateway stopped successfully');
    } catch (error) {
      logger.error('❌ Error stopping WebSocket Gateway:', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  // === GETTERS ===
  
  getSocketIO(): Server {
    return this.io;
  }

  getApp(): FastifyInstance {
    return this.app;
  }

  isGatewayRunning(): boolean {
    return this.isRunning;
  }
} 