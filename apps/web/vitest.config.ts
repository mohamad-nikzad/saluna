import { getViteConfig } from 'astro/config'

export default getViteConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
