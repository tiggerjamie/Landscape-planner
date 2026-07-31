import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// A relative base means the built bundle works from any path — the GitHub
// Pages project URL (/Landscape-planner/), a local preview, or a file open —
// without needing to know the deploy location at build time.
export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
