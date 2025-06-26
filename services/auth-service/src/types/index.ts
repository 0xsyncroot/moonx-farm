// Types for Auth Service

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

export interface PrivyUser {
  id: string;
  created_at: string;
  linked_accounts: Array<{
    type: string;
    address?: string;
    email?: string;
    subject?: string;
  }>;
  mfa_methods: any[];
}

export interface TokenPayload {
  userId: string;
  privyUserId: string;
  walletAddress: string;
  email?: string;
  iat?: number;
  exp?: number;
  jti?: string;
  type?: 'access' | 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenId: string;
  refreshTokenId: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
}

export interface VerifyTokenResult {
  userId: string;
  user: PrivyUser;
  walletAddress?: string;
  email?: string;
}

export interface AuthenticatedUser {
  userId: string;
  privyUserId: string;
  walletAddress?: string;
  email?: string;
  tokenId: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
}

export interface ApiError {
  success: false;
  message: string;
  code: string;
  details?: any;
  timestamp: string;
  requestId?: string;
}

export interface LoginRequest {
  privyAccessToken: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface UpdateProfileRequest {
  email?: string;
}

export interface ChangeWalletRequest {
  newWalletAddress: string;
  privyAccessToken: string;
}

export interface SessionListQuery {
  limit?: number;
  offset?: number;
}

export interface AuthResponse {
  user: User;
  tokens: TokenPair;
}

export interface SessionInfo {
  id: string;
  sessionToken: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
}

export interface UserStats {
  totalSessions: number;
  activeSessions: number;
  accountAge: number;
  lastLogin?: Date;
  isActive: boolean;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
}

export interface RateLimitResult {
  count: number;
  ttl: number;
  exceeded: boolean;
}

export interface PrivyUserData {
  id: string;
  privyUserId: string;
  walletAddress?: string;
  email?: string;
  linkedAccounts: any[];
  mfaMethods: any[];
  createdAt: Date;
  isActive: boolean;
}

export interface CreateUserData {
  privyUserId: string;
  walletAddress: string;
  email?: string;
}

export interface UpdateUserData {
  email?: string;
  wallet_address?: string;
  is_active?: boolean;
  last_login_at?: Date;
}

export interface CreateSessionData {
  userId: string;
  sessionToken: string;
  refreshToken: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface TokenValidationResult {
  isValid: boolean;
  user?: AuthenticatedUser;
  error?: string;
}

// Note: Fastify type extensions are handled in server setup
// to avoid conflicts with existing type declarations

// Environment variables
export interface AuthServiceConfig {
  // Server
  AUTH_SERVICE_HOST: string;
  AUTH_SERVICE_PORT: number;
  NODE_ENV: string;
  LOG_LEVEL: string;

  // Database
  DATABASE_URL: string;
  DATABASE_MAX_CONNECTIONS: number;
  DATABASE_IDLE_TIMEOUT_MS: number;
  DATABASE_CONNECTION_TIMEOUT_MS: number;
  DATABASE_SSL: boolean;

  // Redis
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  REDIS_DB: number;
  REDIS_KEY_PREFIX: string;
  REDIS_LAZY_CONNECT: boolean;
  REDIS_MAX_RETRIES_PER_REQUEST: number;
  REDIS_CONNECT_TIMEOUT: number;
  REDIS_COMMAND_TIMEOUT: number;

  // JWT
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;

  // Privy
  PRIVY_APP_ID: string;
  PRIVY_APP_SECRET: string;
  PRIVY_VERIFICATION_KEY: string;

  // Frontend
  FRONTEND_URL?: string;
}