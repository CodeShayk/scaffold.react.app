import { injectable, inject } from 'inversify';
import { IAuthService, ITokenManager, IHttpClient, AuthUser, AuthTokens, OAuthConfig, TYPES } from './../types';

@injectable()
export class AuthService implements IAuthService {
  constructor(
    @inject(TYPES.TokenManager) private tokenManager: ITokenManager,
    @inject(TYPES.HttpClient) private httpClient: IHttpClient,
    @inject(TYPES.OAuthConfig) private oauthConfig: OAuthConfig
  ) {}

  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.oauthConfig.clientId,
      redirect_uri: this.oauthConfig.redirectUri,
      scope: this.oauthConfig.scope,
      response_type: 'code',
      state: this.generateState()
    });

    return `${this.oauthConfig.authUrl}?${params.toString()}`;
  }

  async login(code: string): Promise<AuthUser> {
    try {
      // Exchange code for tokens
      const tokenResponse = await this.exchangeCodeForTokens(code);
      const tokens = tokenResponse.data;

      // Store tokens
      this.tokenManager.setTokens(tokens);

      // Get user info
      const user = await this.getCurrentUser();

      return user;
    } catch (error) {
      throw new Error(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async logout(): Promise<void> {
    this.tokenManager.clearTokens();
    // Optional: Make request to revoke tokens on server
  }

  async refreshToken(): Promise<AuthTokens> {
    return this.tokenManager.refreshAccessToken();
  }

  async getCurrentUser(): Promise<AuthUser> {
    try {
      const response = await this.httpClient.get<AuthUser>(this.oauthConfig.userInfoUrl);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get user info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async exchangeCodeForTokens(code: string): Promise<{ data: AuthTokens }> {
    const response = await this.httpClient.post<AuthTokens>(this.oauthConfig.tokenUrl, {
      client_id: this.oauthConfig.clientId,
      code,
      redirect_uri: this.oauthConfig.redirectUri,
      grant_type: 'authorization_code'
    }, {
      headers: {
        'Accept': 'application/json'
      }
    });

    return response;
  }

  private generateState(): string {
    const state = Math.random().toString(36).substring(2, 15) +
                  Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('oauth_state', state);
    return state;
  }

  validateState(state: string): boolean {
    const storedState = sessionStorage.getItem('oauth_state');
    sessionStorage.removeItem('oauth_state');
    return storedState === state;
  }

  isAuthenticated(): boolean {
    const token = this.tokenManager.getAccessToken();
    return token !== null && !this.tokenManager.isTokenExpired();
  }
}