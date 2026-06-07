// Auth endpoint paths for the legacy hand-written client.
// All paths point at Hono (`/api/v1/*`). The client's `baseUrl` is the
// origin (e.g. `https://api.saluna.ir`), and these paths are appended.
export const endpoints = {
  auth: {
    signIn: '/api/v1/auth/sign-in/username',
    signup: '/api/v1/auth/signup',
    signOut: '/api/v1/auth/sign-out',
    me: '/api/v1/auth/me',
  },
} as const
