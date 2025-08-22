import 'reflect-metadata';
import { Container } from 'inversify';
import {
  TYPES,
  IApiClient,
  IAuthService,
  ITokenManager,
  IHttpClient,
  OAuthConfig
} from './../types';
import { ApiClient } from './../services/ApiClient';
import { AuthService } from './../services/AuthService';
import { TokenManager } from './../services/TokenManager';
import { HttpClient } from './../services/HttpClient';
import { oauthConfig } from './../config/oauth';

const container = new Container();

// Bind configuration
container.bind<OAuthConfig>(TYPES.OAuthConfig).toConstantValue(oauthConfig);

// Bind services
container.bind<ITokenManager>(TYPES.TokenManager).to(TokenManager).inSingletonScope();
container.bind<IHttpClient>(TYPES.HttpClient).to(HttpClient).inSingletonScope();
container.bind<IApiClient>(TYPES.ApiClient).to(ApiClient).inSingletonScope();
container.bind<IAuthService>(TYPES.AuthService).to(AuthService).inSingletonScope();

export { container };