import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Container } from 'inversify';
import { AuthService } from '@/services/AuthService';
import { TokenManager } from '@/services/TokenManager';
import { HttpClient } from '@/services/HttpClient';
import { TYPES, OAuthConfig } from '@/types';

describe('AuthService', () => {
  let container: Container;
  let authService: AuthService;
  let mockTokenManager: jest.Mocked<TokenManager>;
  let mockHttpClient: jest.Mocked<HttpClient>;

  const mockOAuthConfig: OAuthConfig = {
    clientId: 'test-client-id',
    redirectUri: 'http://localhost:3000/auth/callback',
    scope: 'read:user',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user'
  };

  beforeEach(() => {
    container = new Container();
    
    mockTokenManager = {
      getAccessToken: vi.fn(),
      getRefreshToken: vi.fn(),
      setTokens: vi.fn(),
      clearTokens: vi.fn(),
      isTokenExpired: vi.fn(),
      refreshAccessToken: vi.fn(),
      getTokenType: vi.fn()
    } as any;

    mockHttpClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      setBaseUrl: vi.fn(),
      getBaseUrl: vi.fn()
    } as any;

    container.bind(TYPES.TokenManager).toConstantValue(mockTokenManager);
    container.bind(TYPES.HttpClient).toConstantValue(mockHttpClient);
    container.bind(TYPES.OAuthConfig).toConstantValue(mockOAuthConfig);
    container.bind(TYPES.AuthService).to(AuthService);

    authService = container.get<AuthService>(TYPES.AuthService);
  });

  describe('getAuthUrl', () => {
    it('should generate correct authorization URL', () => {
      const authUrl = authService.getAuthUrl();
      
      expect(authUrl).toContain(mockOAuthConfig.authUrl);
      expect(authUrl).toContain(`client_id=${mockOAuthConfig.clientId}`);
      expect(authUrl).toContain(`redirect_uri=${encodeURIComponent(mockOAuthConfig.redirectUri)}`);
      expect(authUrl).toContain(`scope=${mockOAuthConfig.scope}`);
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain('state=');
    });
  });

  describe('login', () => {
    it('should successfully login with authorization code', async () => {
      const mockTokens = {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresIn: 3600,
        tokenType: 'Bearer'
      };

      const mockUser = {
        id: '123',
        name: 'Test User',
        email: 'test@example.com'
      };

      mockHttpClient.post.mockResolvedValueOnce({ data: mockTokens, status: 200 });
      mockHttpClient.get.mockResolvedValueOnce({ data: mockUser, status: 200 });

      const result = await authService.login('test_code');

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        mockOAuthConfig.tokenUrl,
        expect.objectContaining({
          client_id: mockOAuthConfig.clientId,
          code: 'test_code',
          redirect_uri: mockOAuthConfig.redirectUri,
          grant_type: 'authorization_code'
        }),
        expect.objectContaining({
          headers: { Accept: 'application/json' }
        })
      );

      expect(mockTokenManager.setTokens).toHaveBeenCalledWith(mockTokens);
      expect(mockHttpClient.get).toHaveBeenCalledWith(mockOAuthConfig.userInfoUrl);
      expect(result).toEqual(mockUser);
    });

    it('should throw error when login fails', async () => {
      mockHttpClient.post.mockRejectedValueOnce(new Error('Token exchange failed'));

      await expect(authService.login('invalid_code')).rejects.toThrow('Login failed');
    });
  });

  describe('logout', () => {
    it('should clear tokens on logout', async () => {
      await authService.logout();
      expect(mockTokenManager.clearTokens).toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('should fetch current user info', async () => {
      const mockUser = {
        id: '123',
        name: 'Test User',
        email: 'test@example.com'
      };

      mockHttpClient.get.mockResolvedValueOnce({ data: mockUser, status: 200 });

      const result = await authService.getCurrentUser();

      expect(mockHttpClient.get).toHaveBeenCalledWith(mockOAuthConfig.userInfoUrl);
      expect(result).toEqual(mockUser);
    });

    it('should throw error when user info fetch fails', async () => {
      mockHttpClient.get.mockRejectedValueOnce(new Error('Unauthorized'));

      await expect(authService.getCurrentUser()).rejects.toThrow('Failed to get user info');
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when user has valid token', () => {
      mockTokenManager.getAccessToken.mockReturnValue('valid_token');
      mockTokenManager.isTokenExpired.mockReturnValue(false);

      const result = authService.isAuthenticated();

      expect(result).toBe(true);
    });

    it('should return false when user has no token', () => {
      mockTokenManager.getAccessToken.mockReturnValue(null);

      const result = authService.isAuthenticated();

      expect(result).toBe(false);
    });

    it('should return false when token is expired', () => {
      mockTokenManager.getAccessToken.mockReturnValue('expired_token');
      mockTokenManager.isTokenExpired.mockReturnValue(true);

      const result = authService.isAuthenticated();

      expect(result).toBe(false);
    });
  });
});