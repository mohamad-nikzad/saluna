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
      'apps/api/.wrangler/**',
      'packages/api-client/src/generated/**',
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
    rules: {
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
]

export default config
