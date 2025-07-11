import { EventEmitter } from 'events';
import { JsonRpcMessageHelper } from '@moonx-farm/shared';
import { JsonRpcMethods } from '../types';

export class AuthManager extends EventEmitter {
  private jwtToken: string;
  private userId: string | null;
  private isAuthenticated = false;
  private authenticationPromise: Promise<void> | null = null;
  private authTimeout: NodeJS.Timeout | null = null;

  constructor(jwtToken: string, userId?: string | null) {
    super();
    this.jwtToken = jwtToken;
    this.userId = userId || null;
  }

  // Send authentication message
  public async authenticate(): Promise<void> {
    if (this.authenticationPromise) {
      // If authentication is already in progress, return the existing promise
      return this.authenticationPromise;
    }

    this.authenticationPromise = new Promise((resolve, reject) => {
      // Set timeout for authentication
      this.authTimeout = setTimeout(() => {
        this.authenticationPromise = null;
        reject(new Error('Authentication timeout'));
      }, 10000); // 10 second timeout

      // Send authentication message
      const authMessage = JsonRpcMessageHelper.createRequest(
        JsonRpcMethods.AUTHENTICATE,
        { token: this.jwtToken },
        this.generateMessageId()
      );

      console.log('🔐 Sending authentication message...');
      this.emit('send-auth-message', authMessage);

      // Set up one-time listeners for auth response
      const onAuthSuccess = (result: any) => {
        this.handleAuthSuccess(result);
        this.cleanup();
        resolve();
      };

      const onAuthFailed = (error: string) => {
        this.handleAuthFailed(error);
        this.cleanup();
        reject(new Error(error));
      };

      const cleanup = () => {
        this.clearAuthTimeout();
        this.removeListener('auth-success', onAuthSuccess);
        this.removeListener('auth-failed', onAuthFailed);
      };

      this.cleanup = cleanup;
      this.once('auth-success', onAuthSuccess);
      this.once('auth-failed', onAuthFailed);
    });

    return this.authenticationPromise;
  }

  // Handle authentication success
  private handleAuthSuccess(result: any): void {
    console.log('✅ Authentication successful:', result);
    this.isAuthenticated = true;
    this.authenticationPromise = null;
    this.emit('authenticated', result);
  }

  // Handle authentication failure
  private handleAuthFailed(error: string): void {
    console.error('❌ Authentication failed:', error);
    this.isAuthenticated = false;
    this.authenticationPromise = null;
    this.emit('authentication-failed', error);
  }

  // Handle auth required message from server
  public handleAuthRequired(): void {
    console.log('🔐 Authentication required by server');
    this.authenticate().catch(error => {
      console.error('❌ Auto-authentication failed:', error);
    });
  }

  // Clear authentication timeout
  private clearAuthTimeout(): void {
    if (this.authTimeout) {
      clearTimeout(this.authTimeout);
      this.authTimeout = null;
    }
  }

  // Generate unique message ID
  private generateMessageId(): string {
    return `auth-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Update JWT token
  public updateToken(newToken: string): void {
    this.jwtToken = newToken;
    this.isAuthenticated = false; // Reset authentication status
    console.log('🔐 JWT token updated, re-authentication required');
  }

  // Update user ID
  public updateUserId(newUserId: string | null): void {
    this.userId = newUserId;
    console.log('👤 User ID updated:', this.userId);
  }

  // Get authentication status
  public isAuth(): boolean {
    return this.isAuthenticated;
  }

  // Get JWT token
  public getToken(): string {
    return this.jwtToken;
  }

  // Get user ID
  public getUserId(): string | null {
    return this.userId;
  }

  // Check if authentication is in progress
  public isAuthenticating(): boolean {
    return this.authenticationPromise !== null;
  }

  // Reset authentication state
  public reset(): void {
    this.isAuthenticated = false;
    this.authenticationPromise = null;
    this.clearAuthTimeout();
    console.log('🔄 Authentication state reset');
  }

  // Wait for authentication
  public async waitForAuth(timeout: number = 30000): Promise<void> {
    if (this.isAuthenticated) {
      return Promise.resolve();
    }

    if (this.authenticationPromise) {
      return this.authenticationPromise;
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener('authenticated', onAuthenticated);
        reject(new Error('Authentication wait timeout'));
      }, timeout);

      const onAuthenticated = () => {
        clearTimeout(timer);
        resolve();
      };

      this.once('authenticated', onAuthenticated);
    });
  }

  // Cleanup
  public cleanup(): void {
    console.log('🧹 Cleaning up authentication manager...');
    
    this.clearAuthTimeout();
    this.reset();
    this.removeAllListeners();
  }
} 