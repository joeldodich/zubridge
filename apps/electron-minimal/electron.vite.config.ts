import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        // Add an alias for @zubridge/electron to pull from workspace package, instead on NPM.
        '@zubridge/electron': resolve(__dirname, '../../packages/electron/dist/index.js'),
        '@zubridge/types': resolve(__dirname, '../../packages/types/dist/index.js')
      }
    },
    plugins: [react()],
    optimizeDeps: {
      include: ['zustand', '@zubridge/types']
    }
  }
})
