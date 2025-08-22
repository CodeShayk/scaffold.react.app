import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Container } from 'inversify';
import { TokenManager } from '@/services/TokenManager';
import { TYPES, AuthTokens } from '@/types';

describe('TokenManager', () => {
  let container: Container;
  let tokenManager: TokenManager;
  let mockHttpClient: any;

  const mockTokens: AuthTokens = {
    accessToken: 'access_token_123',
    refreshToken: 'refresh_token_123',
    expiresIn: 3600,
    tokenType: 'Bearer'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    
    container = new Container();
    
    mockHttpClient = {
      post: vi.fn()
    };

    container.bind(TYPES.HttpClient).toConstantValue(mockHttpClient);
    container.bind(TYPES.TokenManager).to(TokenManager);

    tokenManager = container.get<TokenManager>(TYPES.TokenManager);
  });

  describe('setTokens and getTokens', () => {
    it('should store and retrieve access token', () => {
      tokenManager.setTokens(mockTokens);
      
      expect(tokenManager.getAccessToken()).toBe(mockTokens.accessToken);
      expect(tokenManager.getRefreshToken()).toBe(mockTokens.refreshToken);
      expect(tokenManager.getTokenType()).toBe(mockTokens.tokenType);
    });

    it('should return null when no tokens are stored', () => {
      expect(tokenManager.getAccessToken()).toBeNull();
      expect(tokenManager.getRefreshToken()).toBeNull();
    });
  });

  describe('clearTokens', () => {
    it('should remove all stored tokens', () => {
      tokenManager.setTokens(mockTokens);
      tokenManager.clearTokens();
      
      expect(tokenManager.getAccessToken()).toBeNull();
      expect(tokenManager.getRefreshToken()).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid token', () => {
      tokenManager.setTokens(mockTokens);
      
      expect(tokenManager.isTokenExpired()).toBe(false);
    });

    it('should return true when no expiration time is stored', () => {
      expect(tokenManager.isTokenExpired()).toBe(true);
    });

    it('should return true for expired token', () => {
      const expiredTokens = { ...mockTokens, expiresIn: -3600 }; // Expired 1 hour ago
      tokenManager.setTokens(expiredTokens);
      
      expect(tokenManager.isTokenExpired()).toBe(true);
    });
  });

  describe('refreshAccessToken', () => {
    it('should successfully refresh tokens', async () => {
      const newTokens = {
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
        expiresIn: 3600,
        tokenType: 'Bearer'
      };

      tokenManager.setTokens(mockTokens);
      mockHttpClient.post.mockResolvedValueOnce({ data: newTokens });

      const result = await tokenManager.refreshAccessToken();

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          grant_type: 'refresh_token',
          refresh_token: mockTokens.refreshToken
        })
      );

      expect(result).toEqual(newTokens);
      expect(tokenManager.getAccessToken()).toBe(newTokens.accessToken);
    });

    it('should throw error when no refresh token is available', async () => {
      await expect(tokenManager.refreshAccessToken()).rejects.toThrow('No refresh token available');
    });

    it('should clear tokens when refresh fails', async () => {
      tokenManager.setTokens(mockTokens);
      mockHttpClient.post.mockRejectedValueOnce(new Error('Refresh failed'));

      await expect(tokenManager.refreshAccessToken()).rejects.toThrow('Failed to refresh token');
      expect(tokenManager.getAccessToken()).toBeNull();
    });
  });
});