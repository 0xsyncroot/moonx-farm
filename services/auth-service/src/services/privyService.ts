import { PrivyClient } from '@privy-io/server-auth';
import { createLogger, LogContext } from '@moonx-farm/common';

const logger = createLogger('privy-service');

// Interface phù hợp với Privy social authentication
export interface PrivyLinkedAccount {
  type: 'email' | 'phone' | 'wallet' | 'google_oauth' | 'twitter_oauth' | 'discord_oauth' | 'github_oauth' | 'linkedin_oauth' | 'spotify_oauth' | 'instagram_oauth' | 'tiktok_oauth' | 'apple_oauth' | 'farcaster' | 'telegram';
  address?: string;
  email?: string;
  phone?: string;
  name?: string;
  username?: string;
  subject?: string;
  // Social-specific fields
  profilePictureUrl?: string;
  socialId?: string;
}

export interface PrivyUser {
  id: string;
  createdAt: string;
  linkedAccounts: PrivyLinkedAccount[];
  mfaMethods: any[];
}

export interface VerifyTokenResult {
  userId: string;
  user: PrivyUser;
  // Optional fields phù hợp với social login - có thể undefined
  walletAddress?: string | undefined;
  email?: string | undefined;
  socialProfile?: {
    provider: string;
    username?: string;
    displayName?: string;
    profilePictureUrl?: string;
  } | undefined;
}

export class PrivyService {
  private privy: PrivyClient;
  private config: any;

  constructor(config: any) {
    this.config = config;
    
    // Initialize PrivyClient using config (with validation)
    const appId = config.get('PRIVY_APP_ID');
    const appSecret = config.get('PRIVY_APP_SECRET');
    
    this.privy = new PrivyClient(appId, appSecret);
  }

  /**
   * Verify Privy access token từ social authentication
   */
  async verifyToken(accessToken: string): Promise<VerifyTokenResult> {
    try {
      // Verify token và get claims
      const claims = await this.privy.verifyAuthToken(accessToken);

      if (!claims || !claims.userId) {
        throw new Error('Invalid token claims');
      }

      // Get user data từ Privy
      const privyUser = await this.privy.getUser(claims.userId);

      if (!privyUser) {
        throw new Error('User not found in Privy');
      }

      // Convert Privy User to our interface
      const user: PrivyUser = {
        id: privyUser.id,
        createdAt: privyUser.createdAt ? privyUser.createdAt.toISOString() : new Date().toISOString(),
        linkedAccounts: (privyUser.linkedAccounts || []).map((account: any) => ({
          type: account.type,
          address: account.address,
          email: account.email,
          phone: account.phone,
          name: account.name,
          username: account.username,
          subject: account.subject,
          profilePictureUrl: account.profilePictureUrl,
          socialId: account.subject || account.socialId
        })),
        mfaMethods: []
      };

      // Extract thông tin social và wallet từ linked accounts
      const walletAccount = user.linkedAccounts.find(
        (account: PrivyLinkedAccount) => account.type === 'wallet'
      );
      
      const emailAccount = user.linkedAccounts.find(
        (account: PrivyLinkedAccount) => account.type === 'email'
      );

      // Get primary social account (ưu tiên các social login phổ biến)
      const socialPriority = ['google_oauth', 'twitter_oauth', 'farcaster', 'telegram', 'tiktok_oauth', 'discord_oauth'];
      const socialAccount = socialPriority
        .map(type => user.linkedAccounts.find(acc => acc.type === type))
        .find(acc => acc !== undefined);

      const result: VerifyTokenResult = {
        userId: user.id,
        user,
        walletAddress: walletAccount?.address,
        email: emailAccount?.email || socialAccount?.email,
        socialProfile: socialAccount ? {
          provider: socialAccount.type.replace('_oauth', ''),
          ...(socialAccount.username && { username: socialAccount.username }),
          ...(socialAccount.name && { displayName: socialAccount.name }),
          ...(socialAccount.profilePictureUrl && { profilePictureUrl: socialAccount.profilePictureUrl })
        } : undefined
      };

      logger.debug('Token verified successfully', {
        userId: user.id,
        hasWallet: !!walletAccount,
        hasEmail: !!emailAccount,
        hasSocial: !!socialAccount,
        socialProvider: socialAccount?.type
      });

      return result;
      
    } catch (error) {
      const errorContext: LogContext = {
        action: 'verify-privy-token',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      logger.error('Token verification failed:', errorContext);
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get user by Privy user ID
   */
  async getUserById(userId: string): Promise<PrivyUser> {
    try {
      const privyUser = await this.privy.getUser(userId);

      if (!privyUser) {
        throw new Error('User not found');
      }

      const user: PrivyUser = {
        id: privyUser.id,
        createdAt: privyUser.createdAt ? privyUser.createdAt.toISOString() : new Date().toISOString(),
        linkedAccounts: (privyUser.linkedAccounts || []).map((account: any) => ({
          type: account.type,
          address: account.address,
          email: account.email,
          phone: account.phone,
          name: account.name,
          username: account.username,
          subject: account.subject,
          profilePictureUrl: account.profilePictureUrl,
          socialId: account.subject || account.socialId
        })),
        mfaMethods: []
      };

      return user;
      
    } catch (error) {
      const errorContext: LogContext = {
        action: 'get-privy-user',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      logger.error('Failed to get user:', errorContext);
      throw error;
    }
  }

  /**
   * Get all users (admin function) - simplified for social auth context
   */
  async getUsers(): Promise<PrivyUser[]> {
    try {
      // Note: In production, you might want to implement pagination
      const result = await this.privy.getUsers();
      
      if (!Array.isArray(result)) {
        logger.warn('getUsers returned non-array result', { result });
        return [];
      }

      const users = result.map((privyUser: any) => ({
        id: privyUser.id,
        createdAt: privyUser.createdAt ? privyUser.createdAt.toISOString() : new Date().toISOString(),
        linkedAccounts: (privyUser.linkedAccounts || []).map((account: any) => ({
          type: account.type,
          address: account.address,
          email: account.email,
          phone: account.phone,
          name: account.name,
          username: account.username,
          subject: account.subject,
          profilePictureUrl: account.profilePictureUrl,
          socialId: account.subject || account.socialId
        })),
        mfaMethods: []
      }));
      
      return users;
      
    } catch (error) {
      const errorContext: LogContext = {
        action: 'get-privy-users',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      logger.error('Failed to get users:', errorContext);
      throw error;
    }
  }

  /**
   * Delete user từ Privy (admin function)
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      await this.privy.deleteUser(userId);
      logger.info(`User deleted from Privy: ${userId}`);
    } catch (error) {
      const errorContext: LogContext = {
        action: 'delete-privy-user',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      logger.error('Failed to delete user:', errorContext);
      throw error;
    }
  }

  /**
   * Get primary social profile từ user
   */
  getPrimarySocialProfile(user: PrivyUser): PrivyLinkedAccount | null {
    // Ưu tiên các social login phổ biến
    const socialPriority = ['google_oauth', 'twitter_oauth', 'farcaster', 'telegram', 'tiktok_oauth', 'discord_oauth'];
    
    for (const type of socialPriority) {
      const account = user.linkedAccounts.find(acc => acc.type === type);
      if (account) return account;
    }
    
    // Fallback to any social account
    return user.linkedAccounts.find(account => 
      account.type.includes('oauth') || 
      account.type === 'farcaster' || 
      account.type === 'telegram'
    ) || null;
  }

  /**
   * Get primary email từ user (từ email account hoặc social profile)
   */
  getPrimaryEmail(user: PrivyUser): string | null {
    // Ưu tiên email account trước
    const emailAccount = user.linkedAccounts.find(account => account.type === 'email');
    if (emailAccount?.email) return emailAccount.email;
    
    // Fallback to email từ social accounts
    const socialWithEmail = user.linkedAccounts.find(account => 
      account.email && (account.type.includes('oauth') || account.type === 'farcaster')
    );
    
    return socialWithEmail?.email || null;
  }

  /**
   * Get primary wallet address từ user
   */
  getPrimaryWallet(user: PrivyUser): string | null {
    const walletAccount = user.linkedAccounts.find(account => account.type === 'wallet');
    return walletAccount?.address || null;
  }

  /**
   * Check if user has specific social provider
   */
  hasSocialProvider(user: PrivyUser, provider: string): boolean {
    const providerType = provider === 'google' ? 'google_oauth' : 
                        provider === 'twitter' ? 'twitter_oauth' :
                        provider === 'x' ? 'twitter_oauth' :
                        provider === 'tiktok' ? 'tiktok_oauth' :
                        provider;
                        
    return user.linkedAccounts.some(account => account.type === providerType);
  }

  /**
   * Get all social providers for user
   */
  getSocialProviders(user: PrivyUser): string[] {
    return user.linkedAccounts
      .filter(account => account.type.includes('oauth') || account.type === 'farcaster' || account.type === 'telegram')
      .map(account => account.type.replace('_oauth', ''));
  }

  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Health check cho Privy service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple health check bằng cách thử verify một dummy token (sẽ fail nhưng connection OK)
      await this.privy.verifyAuthToken('dummy-token').catch(() => {
        // Expected to fail, but connection works
      });
      return true;
    } catch (error) {
      const errorContext: LogContext = {
        action: 'privy-health-check',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      logger.error('Privy health check failed:', errorContext);
      return false;
    }
  }
}