/**
 * PM2 process file for the public marketing + booking site (port 3001).
 *
 *   cd apps/web
 *   pnpm build
 *   pm2 start ecosystem.config.cjs
 *
 * Env: copy repo-root .env.local / .env.production into the environment or use
 * pm2 ecosystem `env` / `env_production` blocks below.
 */
module.exports = {
  apps: [
    {
      name: 'saloon-web',
      cwd: __dirname,
      script: 'server.mjs',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: '3001',
      },
    },
  ],
}
