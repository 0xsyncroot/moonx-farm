// WebSocket Gateway Server
// Simplified startup with essential services

import { logger } from '@moonx-farm/common';
import { Container } from './core/container';
import { WebSocketGateway } from './core/gateway';

async function startServer(): Promise<void> {
  try {
    logger.info('🚀 Starting WebSocket Gateway Server...');
    
    // Initialize container with all services
    const container = new Container();
    const services = await container.initialize();
    
    // Create and start gateway
    const gateway = new WebSocketGateway(services);
    await gateway.initialize();
    await gateway.start();
    
    logger.info('✅ WebSocket Gateway Server started successfully');
    
    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`🛑 Received ${signal}, shutting down gracefully...`);
      
      try {
        await gateway.stop();
        await container.shutdown();
        
        logger.info('✅ WebSocket Gateway Server stopped successfully');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during shutdown:', { 
          error: error instanceof Error ? error.message : String(error) 
        });
        process.exit(1);
      }
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
  } catch (error) {
    logger.error('❌ Failed to start WebSocket Gateway Server:', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    process.exit(1);
  }
}

// Start server
startServer().catch((error) => {
  logger.error('❌ Unhandled error during startup:', error);
  process.exit(1);
}); 