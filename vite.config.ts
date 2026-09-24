import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Set VITE_BASE_PATH=/repository-name/ for GitHub Pages project sites.
export default defineConfig({ base: process.env.VITE_BASE_PATH || '/', plugins: [react()] })
