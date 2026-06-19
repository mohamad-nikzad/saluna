import baseConfig from '@repo/eslint-config/base'
import reactConfig from '@repo/eslint-config/react'

const config = [
  ...baseConfig,
  ...reactConfig,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'react-hooks/incompatible-library': 'off',
      'no-restricted-imports': [
        'error',
        {
          patterns: ['@repo/ui', '@repo/ui/*', '../../apps/*', '../*/app/*'],
        },
      ],
    },
  },
]

export default config
