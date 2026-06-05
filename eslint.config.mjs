import baseConfig from '@repo/eslint-config/base'
import reactConfig from '@repo/eslint-config/react'

const config = [
  ...baseConfig,
  ...reactConfig,
  {
    ignores: [
      'apps/web/dist/**',
      'apps/web/.astro/**',
      '.turbo/**',
      '**/.turbo/**',
      '.vercel/**',
      'node_modules/**',
      'tsconfig.tsbuildinfo',
      'public/sw.js',
      'public/icons/**',
    ],
  },
  {
    files: ['apps/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['../../apps/*', '../*/app/*'],
        },
      ],
    },
  },
  {
    files: ['packages/data-client/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next',
              message: '@repo/data-client must stay framework-neutral (no Next.js).',
            },
            {
              name: 'next/*',
              message: '@repo/data-client must stay framework-neutral (no Next.js).',
            },
            {
              name: 'react',
              message: '@repo/data-client must stay framework-neutral (no React).',
            },
            {
              name: 'react-dom',
              message: '@repo/data-client must stay framework-neutral (no React).',
            },
          ],
        },
      ],
    },
  },
  {
    rules: {
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]

export default config
