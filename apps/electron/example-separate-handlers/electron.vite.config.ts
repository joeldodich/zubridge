import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@zubridge/electron'] })],
    build: {
      rollupOptions: {
        output: {
          format: 'es',
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['@zubridge/electron'] })],
    build: {
      rollupOptions: {
        external: ['electron'],
        output: {
          format: 'cjs',
        },
      },
    },
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer'),
        // Add aliases for @zubridge packages
        '@zubridge/electron': resolve(__dirname, '../../../packages/electron/dist/index.js'),
        '@zubridge/core': resolve(__dirname, '../../../packages/core/dist/index.js'),
        '@zubridge/types': resolve(__dirname, '../../../packages/types/dist/index.js'),
      },
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          format: 'es',
        },
      },
    },
    // Define globals for the renderer process
    define: {
      // This prevents errors with __dirname in the renderer
      '__dirname': JSON.stringify(''),
      '__filename': JSON.stringify(''),
      // This prevents errors with process.env in the renderer
      'process.env': '{}',
    },
    // Optimize dependencies
    optimizeDeps: {
      include: ['zustand', '@zubridge/core', '@zubridge/types'],
    },
  },
});
