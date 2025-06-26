import { JwtService } from '../../src/services/jwtService';

// Mock fastify JWT
const mockJwt = {
  sign: jest.fn(),
  verify: jest.fn(),
  decode: jest.fn(),
};

// Mock config
const mockConfig = {
  get: jest.fn(),
};

describe('JwtService', () => {
  let jwtService: JwtService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup config defaults
    mockConfig.get.mockImplementation((key: string) => {
      const defaults: Record<string, any> = {
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
        JWT_ISSUER: 'moonx-farm',
        JWT_AUDIENCE: 'moonx-farm-users',
      };
      return defaults[key];
    });

    jwtService = new JwtService(mockJwt as any, mockConfig);
  });

  describe('createTokenPair', () => {
    it('should create access and refresh tokens', async () => {
      const mockAccessToken = 'mock.access.token';
      const mockRefreshToken = 'mock.refresh.token';
      
      mockJwt.sign
        .mockReturnValueOnce(mockAccessToken)
        .mockReturnValueOnce(mockRefreshToken);

      const payload = {
        userId: 'user-123',
        privyUserId: 'privy-456',
        walletAddress: '0x1234567890123456789012345678901234567890',
        email: 'test@example.com',
      };

      const result = await jwtService.createTokenPair(payload);

      expect(result).toHaveProperty('accessToken', mockAccessToken);
      expect(result).toHaveProperty('refreshToken', mockRefreshToken);
      expect(result).toHaveProperty('accessTokenId');
      expect(result).toHaveProperty('refreshTokenId');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('refreshExpiresAt');

      // Verify JWT sign calls
      expect(mockJwt.sign).toHaveBeenCalledTimes(2);
      
      // Check access token call
      expect(mockJwt.sign).toHaveBeenNthCalledWith(1, 
        expect.objectContaining({
          ...payload,
          type: 'access',
          jti: expect.any(String),
        }),
        { expiresIn: '15m' }
      );

      // Check refresh token call
      expect(mockJwt.sign).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          userId: payload.userId,
          privyUserId: payload.privyUserId,
          type: 'refresh',
          jti: expect.any(String),
        }),
        { expiresIn: '7d' }
      );
    });

    it('should handle token creation errors', async () => {
      mockJwt.sign.mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      const payload = {
        userId: 'user-123',
        privyUserId: 'privy-456',
        walletAddress: '0x1234567890123456789012345678901234567890',
      };

      await expect(jwtService.createTokenPair(payload))
        .rejects.toThrow('Token creation failed');
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', async () => {
      const mockDecoded = {
        userId: 'user-123',
        privyUserId: 'privy-456',
        walletAddress: '0x1234567890123456789012345678901234567890',
        type: 'access',
        jti: 'token-id-123',
        iat: 1234567890,
        exp: 1234567890,
      };

      mockJwt.verify.mockResolvedValue(mockDecoded);

      const result = await jwtService.verifyAccessToken('valid.token');

      expect(result).toEqual(mockDecoded);
      expect(mockJwt.verify).toHaveBeenCalledWith('valid.token');
    });

    it('should reject invalid token type', async () => {
      const mockDecoded = {
        userId: 'user-123',
        type: 'refresh', // Wrong type
        jti: 'token-id-123',
      };

      mockJwt.verify.mockResolvedValue(mockDecoded);

      await expect(jwtService.verifyAccessToken('invalid.token'))
        .rejects.toThrow('Invalid or expired access token');
    });

    it('should handle verification errors', async () => {
      mockJwt.verify.mockRejectedValue(new Error('Token expired'));

      await expect(jwtService.verifyAccessToken('expired.token'))
        .rejects.toThrow('Invalid or expired access token');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', async () => {
      const mockDecoded = {
        userId: 'user-123',
        privyUserId: 'privy-456',
        type: 'refresh',
        jti: 'refresh-token-id-123',
      };

      mockJwt.verify.mockResolvedValue(mockDecoded);

      const result = await jwtService.verifyRefreshToken('valid.refresh.token');

      expect(result).toEqual({
        userId: mockDecoded.userId,
        privyUserId: mockDecoded.privyUserId,
        jti: mockDecoded.jti,
      });
    });

    it('should reject invalid token type', async () => {
      const mockDecoded = {
        userId: 'user-123',
        type: 'access', // Wrong type
        jti: 'token-id-123',
      };

      mockJwt.verify.mockResolvedValue(mockDecoded);

      await expect(jwtService.verifyRefreshToken('invalid.token'))
        .rejects.toThrow('Invalid or expired refresh token');
    });
  });

  describe('getTokenId', () => {
    it('should extract token ID from token', () => {
      const mockDecoded = {
        jti: 'token-id-123',
        userId: 'user-123',
      };

      mockJwt.decode.mockReturnValue(mockDecoded);

      const result = jwtService.getTokenId('some.token');

      expect(result).toBe('token-id-123');
      expect(mockJwt.decode).toHaveBeenCalledWith('some.token');
    });

    it('should return null for invalid token', () => {
      mockJwt.decode.mockReturnValue(null);

      const result = jwtService.getTokenId('invalid.token');

      expect(result).toBeNull();
    });

    it('should return null for token without jti', () => {
      mockJwt.decode.mockReturnValue({ userId: 'user-123' });

      const result = jwtService.getTokenId('token.without.jti');

      expect(result).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid token', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      mockJwt.decode.mockReturnValue({ exp: futureExp });

      const result = jwtService.isTokenExpired('valid.token');

      expect(result).toBe(false);
    });

    it('should return true for expired token', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      mockJwt.decode.mockReturnValue({ exp: pastExp });

      const result = jwtService.isTokenExpired('expired.token');

      expect(result).toBe(true);
    });

    it('should return true for token without exp', () => {
      mockJwt.decode.mockReturnValue({ userId: 'user-123' });

      const result = jwtService.isTokenExpired('token.without.exp');

      expect(result).toBe(true);
    });

    it('should return true for invalid token', () => {
      mockJwt.decode.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = jwtService.isTokenExpired('invalid.token');

      expect(result).toBe(true);
    });
  });
});