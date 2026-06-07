export { ApiError, NetworkError } from './errors'
export {
  createApiClient,
  createAuthApi,
  endpoints,
} from './legacy'
export type {
  ApiClient,
  ApiClientOptions,
  RequestOptions,
  TokenProvider,
  AuthApi,
  LoginInput,
  LoginResponse,
  SignupInput,
  SignupResponse,
  MeResponse,
} from './legacy'
