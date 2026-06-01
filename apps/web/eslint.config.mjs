import baseConfig from '@repo/eslint-config/base'
import reactConfig from '@repo/eslint-config/react'
import eslintPluginAstro from 'eslint-plugin-astro'

const config = [
  ...baseConfig,
  ...eslintPluginAstro.configs.recommended,
  ...reactConfig.map((block) => ({
    ...block,
    files: block.files ?? ['**/*.{ts,tsx,js,jsx}'],
  })),
  {
    ignores: ['dist/**', '.astro/**', 'node_modules/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx,astro}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['../../apps/*', '../*/app/*'],
        },
      ],
    },
  },
]

export default config
