import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1', // Avoid IPv6 (::1) bind issues on some environments
    port: 5176,  // Business frontend dedicated port
    strictPort: true,  // Fail if port is in use
  },
})
