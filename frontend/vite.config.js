import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

const parentDir = path.resolve(process.cwd(), '..');

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    https: {
      key: fs.readFileSync(path.resolve(parentDir, 'key.pem')),
      cert: fs.readFileSync(path.resolve(parentDir, 'cert.pem')),
    },
    proxy: {
      '/api': {
        target: 'https://localhost:8002',
        changeOrigin: true,
        secure: false,
      },
      '/synthesize': {
        target: 'https://localhost:8002',
        changeOrigin: true,
        secure: false,
      },
      '/generate': {
        target: 'https://localhost:8002',
        changeOrigin: true,
        secure: false,
      },
      '/questions': {
        target: 'https://localhost:8002',
        changeOrigin: true,
        secure: false,
      },
      '/interview': {
        target: 'https://localhost:8002',
        changeOrigin: true,
        secure: false,
      },
      '/transcribe': {
        target: 'https://localhost:8002',
        changeOrigin: true,
        secure: false,
      },
      '/diagnose': {
        target: 'https://localhost:8002',
        changeOrigin: true,
        secure: false,
      },
      '/models': {
        target: 'https://localhost:8002',
        changeOrigin: true,
        secure: false,
      },
      '/switch_model': {
        target: 'https://localhost:8002',
        changeOrigin: true,
        secure: false,
      },
      '/stt_health': {
        target: 'https://localhost:8002',
        changeOrigin: true,
        secure: false,
      },
      '/benchmark': {
        target: 'https://localhost:8002',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: 'https://localhost:8002',
        changeOrigin: true,
        secure: false,
      }
    }
  }
});
