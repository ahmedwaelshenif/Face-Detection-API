import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8100',
        changeOrigin: true,
      },
      '/face-api': {
        target: 'http://127.0.0.1:8100',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/face-api/, ''),
      },
      '/registrationRequest': {
        target: process.env.VITE_MONITORING_API || 'https://localhost:7062',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
