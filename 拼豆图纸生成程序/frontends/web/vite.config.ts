import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    target: 'es2020',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, '../../shared'),
    },
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 5173,
    headers: {
      // Required for SharedArrayBuffer (WASM threading)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    allowedHosts: true,
  },
  optimizeDeps: {
    exclude: ['perler_engine.js'],
  },
  assetsInclude: ['**/*.wasm'],
});
