import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base path matches the GitHub Pages repo name so the deployed bundle
// resolves its assets under https://<user>.github.io/Landscape-planner/
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES === 'true' ? '/Landscape-planner/' : '/',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
