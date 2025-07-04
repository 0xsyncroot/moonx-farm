import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { logger } from '../utils/logger';

export const createSocketServer = (httpServer: any) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:3000',
        'http://localhost:3001'
      ],
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT || '60000'),
    pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL || '25000'),
    maxHttpBufferSize: parseInt(process.env.SOCKET_MAX_BUFFER_SIZE || '1048576'),
    allowEIO3: true, // Mobile compatibility
    cookie: false,
    serveClient: false,
    allowRequest: (req, callback) => {
      // Optional: Add custom validation here
      callback(null, true);
    }
  });

  // Redis adapter for horizontal scaling
  if (process.env.REDIS_URL) {
    try {
      const pubClient = createClient({ url: process.env.REDIS_URL });
      const subClient = pubClient.duplicate();
      
      io.adapter(createAdapter(pubClient, subClient));
      
      pubClient.on('error', (err) => {
        logger.error('Redis pub client error:', err);
      });
      
      subClient.on('error', (err) => {
        logger.error('Redis sub client error:', err);
      });
      
      logger.info('Socket.IO Redis adapter configured');
    } catch (error) {
      logger.error('Failed to configure Redis adapter:', error);
    }
  }

  // Socket.IO middleware for authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }
    
    // TODO: Validate JWT token
    // For now, just pass through
    next();
  });

  // Connection event handlers
  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);
    
    socket.on('error', (error) => {
      logger.error(`Socket error (${socket.id}):`, error);
    });
    
    socket.on('disconnect', (reason) => {
      logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
    });
  });

  return io;
};

export default createSocketServer; 