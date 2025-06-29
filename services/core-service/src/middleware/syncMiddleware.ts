import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticatedRequest } from './authMiddleware';
import { AutoSyncService } from '../services/autoSyncService';

export class SyncMiddleware {
  constructor(private autoSyncService: AutoSyncService) {}

  // Middleware to auto-trigger sync on user access
  async autoTriggerSync(request: AuthenticatedRequest, reply: FastifyReply): Promise<void> {
    try {
      // Only trigger for authenticated users
      if (!request.user) {
        return;
      }

      const userId = request.user.id;
      const walletAddress = request.user.walletAddress;

      // Trigger auto sync in background (don't wait)
      setImmediate(async () => {
        try {
          await this.autoSyncService.onUserAccess(userId, walletAddress);
        } catch (error) {
          console.error('Auto sync trigger failed:', error);
        }
      });

    } catch (error) {
      console.error('Sync middleware error:', error);
      // Don't fail the request if sync trigger fails
    }
  }

  // Specific triggers for different events
  async onUserLogin(userId: string, walletAddress: string): Promise<void> {
    try {
      await this.autoSyncService.onUserLogin(userId, walletAddress);
    } catch (error) {
      console.error('Login sync trigger failed:', error);
    }
  }

  async onUserTrade(userId: string, walletAddress: string): Promise<void> {
    try {
      await this.autoSyncService.onUserTrade(userId, walletAddress);
    } catch (error) {
      console.error('Trade sync trigger failed:', error);
    }
  }
}
 