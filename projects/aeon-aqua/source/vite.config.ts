import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ command }) => ({
  base: './',
  assetsInclude: ['**/*.glb'],
  server: { host: '127.0.0.1', port: 5173 },
  plugins: command === 'build' ? [viteSingleFile()] : [],
  build: {
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 2000
  }
}));
