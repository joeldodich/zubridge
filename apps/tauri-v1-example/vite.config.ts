import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Import our custom UI watcher plugin
import { watchUIPackage } from '@zubridge/ui/vite-plugin';
// Check if we should watch UI package changes
const shouldWatchUI = process.env.WATCH_UI === 'true';
console.log(`[DEBUG] Watch UI: ${shouldWatchUI}`);

// Configure plugins based on whether we should watch UI
const getPlugins = () => {
  const plugins = [react()];

  // Only add the UI watcher plugin if WATCH_UI=true
  if (shouldWatchUI) {
    console.log('[DEBUG] Adding UI watcher plugin');
    plugins.push([watchUIPackage()]);
  }

  return plugins;
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: getPlugins(),

  // Prevent Vite from clearing the screen
  clearScreen: false,

  // Set the root directory for source files and index.html
  root: 'src/renderer',

  // Set the base path for assets during development and build
  base: './',

  // Configure the development server
  server: {
    // Use the port Tauri expects
    port: 5173,
    // Throw error if port is already in use
    strictPort: true,
    // Watch for changes in the Tauri configuration
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },

  // Configure the build process
  build: {
    // Set the output directory relative to the project root
    outDir: '../../dist',
    // Empty the output directory before building
    emptyOutDir: true,
  },
});
