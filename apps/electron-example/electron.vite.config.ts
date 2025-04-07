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
    // Don't use any plugins for the preload script
    // This ensures that electron and other Node.js modules are properly bundled
    build: {
      minify: false,
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
        // Add an alias for @zubridge/electron to use a browser-safe version
        '@zubridge/electron': resolve(__dirname, '../../packages/electron/dist/index.js'),
        '@zubridge/core': resolve(__dirname, '../../packages/core/dist/index.js'),
        '@zubridge/types': resolve(__dirname, '../../packages/types/dist/index.js'),
      },
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
        },
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
