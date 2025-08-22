import { injectable, inject } from 'inversify';
import { AuthTokens, ITokenManager, IHttpClient, TYPES } from './../types';
import { oauthConfig } from './../config/oauth';

@injectable()
export class TokenManager implements ITokenManager {
  private readonly STORAGE_PREFIX = 'oauth_';

  constructor(
    @inject(TYPES.HttpClient) private httpClient: IHttpClient
  ) {}

  getAccessToken(): string | null {
    return localStorage.getItem(`${this.STORAGE_PREFIX}access_token`);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(`${this.STORAGE_PREFIX}refresh_token`);
  }

  setTokens(tokens: AuthTokens): void {
    const expiresAt = Date.now() + (tokens.expiresIn * 1000);

    localStorage.setItem(`${this.STORAGE_PREFIX}access_token`, tokens.accessToken);
    localStorage.setItem(`${this.STORAGE_PREFIX}refresh_token`, tokens.refreshToken);
    localStorage.setItem(`${this.STORAGE_PREFIX}expires_at`, expiresAt.toString());
    localStorage.setItem(`${this.STORAGE_PREFIX}token_type`, tokens.tokenType);
  }

  clearTokens(): void {
    localStorage.removeItem(`${this.STORAGE_PREFIX}access_token`);
    localStorage.removeItem(`${this.STORAGE_PREFIX}refresh_token`);
    localStorage.removeItem(`${this.STORAGE_PREFIX}expires_at`);
    localStorage.removeItem(`${this.STORAGE_PREFIX}token_type`);
  }

  isTokenExpired(): boolean {
    const expiresAt = localStorage.getItem(`${this.STORAGE_PREFIX}expires_at`);
    if (!expiresAt) return true;

    const expiration = parseInt(expiresAt, 10);
    const now = Date.now();

    // Consider token expired 5 minutes before actual expiration
    return now >= (expiration - 300000);
  }

  async refreshAccessToken(): Promise<AuthTokens> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await this.httpClient.post<AuthTokens>(oauthConfig.tokenUrl, {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: oauthConfig.clientId
      });

      const tokens = response.data;
      this.setTokens(tokens);

      return tokens;
    } catch (error) {
      this.clearTokens();
      throw new Error('Failed to refresh token');
    }
  }

  private getTokenExpirationTime(): number | null {
    const expiresAt = localStorage.getItem(`${this.STORAGE_PREFIX}expires_at`);
    return expiresAt ? parseInt(expiresAt, 10) : null;
  }

  getTokenType(): string {
    return localStorage.getItem(`${this.STORAGE_PREFIX}token_type`) || 'Bearer';
  }
}