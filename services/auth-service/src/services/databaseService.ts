import { DatabaseManager } from '@moonx-farm/infrastructure';
import { createLogger, LogContext } from '@moonx-farm/common';

const logger = createLogger('auth-database-service');

export interface User {
  id: string;
  privy_user_id: string;
  wallet_address: string;
  email?: string;
  created_at: Date;
  updated_at: Date;
  last_login_at?: Date;
  is_active: boolean;
}

export interface UserSession {
  id: string;
  user_id: string;
  session_token: string;
  refresh_token: string;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Authentication-specific Database service
 * Contains domain logic for user/session management
 * Delegates generic database operations to infrastructure DatabaseManager
 */
export class DatabaseService {
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  // === USER MANAGEMENT OPERATIONS ===
  
  /**
   * Create a new user account using query builder
   */
  async createUser(userData: {
    privyUserId: string;
    walletAddress: string;
    email?: string;
  }): Promise<User> {
    const logContext: LogContext = { 
      privyUserId: userData.privyUserId,
      hasEmail: !!userData.email,
      walletAddress: userData.walletAddress.substring(0, 8) + '...'
    };
    
    try {
      const insertData = {
        privy_user_id: userData.privyUserId,
        wallet_address: userData.walletAddress,
        email: userData.email,
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true
      };

      const result = await this.db
        .insert('users', insertData)
        .returning(['*'])
        .execute();

      logger.info('User created successfully', { ...logContext, userId: result.rows[0].id });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create user', { 
        ...logContext,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Find user by Privy ID (primary lookup for auth) using query builder
   */
  async getUserByPrivyId(privyUserId: string): Promise<User | null> {
    try {
      const result = await this.db
        .select('users')
        .where({ privy_user_id: privyUserId, is_active: true })
        .execute();
      
      const user = result.rows[0] || null;
      logger.debug('User lookup by Privy ID', { 
        privyUserId, 
        found: !!user,
        userId: user?.id 
      });
      
      return user;
    } catch (error) {
      const logContext: LogContext = { 
        privyUserId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Failed to get user by Privy ID', logContext);
      return null;
    }
  }

  /**
   * Find user by wallet address (for wallet-based auth) using query builder
   */
  async getUserByWalletAddress(walletAddress: string): Promise<User | null> {
    try {
      const result = await this.db
        .select('users')
        .where({ wallet_address: walletAddress, is_active: true })
        .execute();
      
      const user = result.rows[0] || null;
      logger.debug('User lookup by wallet address', { 
        walletAddress: walletAddress.substring(0, 8) + '...', 
        found: !!user,
        userId: user?.id 
      });
      
      return user;
    } catch (error) {
      const logContext: LogContext = { 
        walletAddress: walletAddress.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Failed to get user by wallet address', logContext);
      return null;
    }
  }

  /**
   * Find user by internal ID using query builder
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      const result = await this.db
        .select('users')
        .where({ id: userId, is_active: true })
        .execute();
      
      const user = result.rows[0] || null;
      logger.debug('User lookup by ID', { userId, found: !!user });
      
      return user;
    } catch (error) {
      const logContext: LogContext = { 
        userId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Failed to get user by ID', logContext);
      return null;
    }
  }

  /**
   * Update user's last login timestamp using query builder
   */
  async updateUserLastLogin(userId: string): Promise<void> {
    try {
      await this.db
        .update('users', { 
          last_login_at: new Date(), 
          updated_at: new Date() 
        })
        .where({ id: userId })
        .execute();
      
      logger.debug('User last login updated', { userId });
    } catch (error) {
      const logContext: LogContext = { 
        userId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Failed to update user last login', logContext);
      throw error;
    }
  }

  /**
   * Update user profile information using query builder
   */
  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    try {
      const updateData = {
        ...updates,
        updated_at: new Date()
      };
      
      const result = await this.db
        .update('users', updateData)
        .where({ id: userId })
        .returning(['*'])
        .execute();
      
      logger.info('User updated successfully', { 
        userId, 
        updatedFields: Object.keys(updates)
      });
      
      return result.rows[0];
    } catch (error) {
      const logContext: LogContext = { 
        userId,
        updatedFields: Object.keys(updates),
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Failed to update user', logContext);
      throw error;
    }
  }

  // === SESSION MANAGEMENT OPERATIONS ===
  
  /**
   * Create a new user session using query builder
   */
  async createSession(sessionData: {
    userId: string;
    sessionToken: string;
    refreshToken: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<UserSession> {
    const logContext: LogContext = { 
      userId: sessionData.userId,
      hasIpAddress: !!sessionData.ipAddress,
      hasUserAgent: !!sessionData.userAgent,
      expiresAt: sessionData.expiresAt.toISOString()
    };
    
    try {
      const insertData = {
        user_id: sessionData.userId,
        session_token: sessionData.sessionToken,
        refresh_token: sessionData.refreshToken,
        expires_at: sessionData.expiresAt,
        created_at: new Date(),
        updated_at: new Date(),
        ip_address: sessionData.ipAddress,
        user_agent: sessionData.userAgent,
      };

      const result = await this.db
        .insert('user_sessions', insertData)
        .returning(['*'])
        .execute();

      logger.info('Session created successfully', { 
        ...logContext, 
        sessionId: result.rows[0].id 
      });
      
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create session', { 
        ...logContext,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Find session by access token using query builder with time comparison
   */
  async getSessionByToken(sessionToken: string): Promise<UserSession | null> {
    try {
      // For time comparison, use raw query as it's more complex than simple equality
      const result = await this.db.query(
        'SELECT * FROM user_sessions WHERE session_token = $1 AND expires_at > NOW()',
        [sessionToken],
        { queryName: 'getSessionByToken' }
      );
      
      const session = result.rows[0] || null;
      logger.debug('Session lookup by token', { 
        tokenId: sessionToken.substring(0, 8) + '...',
        found: !!session,
        sessionId: session?.id
      });
      
      return session;
    } catch (error) {
      const logContext: LogContext = { 
        tokenId: sessionToken.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Failed to get session by token', logContext);
      return null;
    }
  }

  /**
   * Find session by refresh token using optimized query with metrics
   */
  async getSessionByRefreshToken(refreshToken: string): Promise<UserSession | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM user_sessions WHERE refresh_token = $1 AND expires_at > NOW()',
        [refreshToken],
        { queryName: 'getSessionByRefreshToken' }
      );
      
      const session = result.rows[0] || null;
      logger.debug('Session lookup by refresh token', { 
        refreshTokenId: refreshToken.substring(0, 8) + '...',
        found: !!session,
        sessionId: session?.id
      });
      
      return session;
    } catch (error) {
      const logContext: LogContext = { 
        refreshTokenId: refreshToken.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Failed to get session by refresh token', logContext);
      return null;
    }
  }

  /**
   * Update session with new access token using query builder
   */
  async updateSessionToken(sessionId: string, newSessionToken: string, expiresAt: Date): Promise<void> {
    try {
      await this.db
        .update('user_sessions', {
          session_token: newSessionToken,
          expires_at: expiresAt,
          updated_at: new Date()
        })
        .where({ id: sessionId })
        .execute();
      
      logger.debug('Session token updated', { 
        sessionId,
        newTokenId: newSessionToken.substring(0, 8) + '...',
        expiresAt: expiresAt.toISOString()
      });
    } catch (error) {
      const logContext: LogContext = { 
        sessionId,
        newTokenId: newSessionToken.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Failed to update session token', logContext);
      throw error;
    }
  }

  /**
   * Delete a specific session using query builder
   */
  async deleteSession(sessionToken: string): Promise<void> {
    try {
      await this.db
        .delete('user_sessions')
        .where({ session_token: sessionToken })
        .execute();
      
      logger.debug('Session deleted', { 
        tokenId: sessionToken.substring(0, 8) + '...'
      });
    } catch (error) {
      const logContext: LogContext = { 
        tokenId: sessionToken.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Failed to delete session', logContext);
      throw error;
    }
  }

  /**
   * Delete all sessions for a user (logout all devices) using query builder
   */
  async deleteAllUserSessions(userId: string): Promise<void> {
    try {
      const result = await this.db
        .delete('user_sessions')
        .where({ user_id: userId })
        .execute();
      
      logger.info('All user sessions deleted', { 
        userId, 
        deletedCount: result.rowCount 
      });
    } catch (error) {
      const logContext: LogContext = { 
        userId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Failed to delete all user sessions', logContext);
      throw error;
    }
  }

  /**
   * Clean up expired sessions (maintenance operation) using raw query
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      // Use raw query for time comparison with proper query naming
      const result = await this.db.query(
        'DELETE FROM user_sessions WHERE expires_at <= NOW()',
        [],
        { queryName: 'cleanupExpiredSessions' }
      );
      
      logger.info('Expired sessions cleaned up', { 
        cleanedCount: result.rowCount 
      });
    } catch (error) {
      const logContext: LogContext = { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Failed to cleanup expired sessions', logContext);
      throw error;
    }
  }

  // === BATCH OPERATIONS FOR PERFORMANCE ===
  
  /**
   * Create multiple users in a single transaction (for bulk operations)
   */
  async createUsersBatch(usersData: Array<{
    privyUserId: string;
    walletAddress: string;
    email?: string;
  }>): Promise<User[]> {
    return this.db.transaction(async (tx) => {
      const users: User[] = [];
      
      for (const userData of usersData) {
        const insertData = {
          privy_user_id: userData.privyUserId,
          wallet_address: userData.walletAddress,
          email: userData.email,
          created_at: new Date(),
          updated_at: new Date(),
          is_active: true
        };

        const result = await tx.query(
          'INSERT INTO users (privy_user_id, wallet_address, email, created_at, updated_at, is_active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
          [insertData.privy_user_id, insertData.wallet_address, insertData.email, insertData.created_at, insertData.updated_at, insertData.is_active]
        );
        
        users.push(result.rows[0]);
      }
      
      logger.info('Batch user creation completed', { count: users.length });
      return users;
    });
  }

  /**
   * Get user sessions with pagination and filtering
   */
  async getUserSessions(userId: string, options: {
    limit?: number;
    offset?: number;
    activeOnly?: boolean;
  } = {}): Promise<{ sessions: UserSession[]; total: number }> {
    const { limit = 10, offset = 0, activeOnly = false } = options;
    
    try {
      // Build base query
      let whereClause = 'user_id = $1';
      const params: any[] = [userId];
      
      if (activeOnly) {
        whereClause += ' AND expires_at > NOW()';
      }
      
      // Get total count
      const countResult = await this.db.query(
        `SELECT COUNT(*) FROM user_sessions WHERE ${whereClause}`,
        params,
        { queryName: 'getUserSessionsCount' }
      );
      
      // Get paginated results
      const sessionsResult = await this.db.query(
        `SELECT * FROM user_sessions WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
        { queryName: 'getUserSessionsPaginated' }
      );
      
      logger.debug('User sessions retrieved with pagination', {
        userId,
        total: parseInt(countResult.rows[0].count),
        returned: sessionsResult.rows.length,
        limit,
        offset
      });
      
      return {
        sessions: sessionsResult.rows,
        total: parseInt(countResult.rows[0].count)
      };
    } catch (error) {
      const logContext: LogContext = {
        userId,
        limit,
        offset,
        activeOnly,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      logger.error('Failed to get user sessions with pagination', logContext);
      throw error;
    }
  }

  // === GENERIC OPERATIONS (Delegates to infrastructure) ===
  
  /**
   * Execute raw query - delegates to infrastructure DatabaseManager
   * Use only when domain-specific methods above don't fit your needs
   */
  async query(text: string, params?: any[], options?: { queryName?: string }): Promise<any> {
    return this.db.query(text, params, options);
  }

  /**
   * Transaction support - delegates to infrastructure layer
   */
  async transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    return this.db.transaction(callback);
  }

  /**
   * Batch operations - delegates to infrastructure layer
   */
  async batch(queries: Array<{ text: string; params?: any[] }>): Promise<any[]> {
    return this.db.batch(queries);
  }

  /**
   * Health check - delegates to infrastructure layer
   */
  isHealthy(): boolean {
    return this.db.isHealthy();
  }

  /**
   * Connection management - delegates to infrastructure layer
   */
  async connect(): Promise<void> {
    await this.db.connect();
    logger.info('✅ Auth database service connected');
  }

  async disconnect(): Promise<void> {
    await this.db.disconnect();
    logger.info('Auth database service disconnected');
  }

  /**
   * Get pool statistics - delegates to infrastructure layer
   */
  getPoolStats() {
    return this.db.getPoolStats();
  }
}