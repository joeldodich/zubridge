import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

// Get the current mode from environment variables
const mode = process.env.ZUBRIDGE_MODE || 'basic'; // Default to basic if not specified
const outDir = `out-${mode}`; // Create mode-specific output directory

// Function to update package.json during build
const updatePackageJsonPlugin = () => {
  return {
    name: 'update-package-json',
    closeBundle: () => {
      try {
        // Read the original package.json
        const packageJsonPath = resolve(__dirname, 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

        // Create a modified package.json for the build
        const modifiedPackageJson = {
          ...packageJson,
          main: `./${outDir}/main/index.js`,
        };

        // Write the modified package.json to the output directory
        const outputPath = resolve(__dirname, outDir, 'package.json');
        fs.writeFileSync(outputPath, JSON.stringify(modifiedPackageJson, null, 2));

        console.log(`Updated package.json with main field pointing to ${outDir}/main/index.js`);
      } catch (error) {
        console.error('Error updating package.json:', error);
      }
    },
  };
};

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@zubridge/electron'] }), updatePackageJsonPlugin()],
    build: {
      outDir,
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
      outDir,
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
      outDir,
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
      // Let the renderer know which mode it's running in
      'import.meta.env.VITE_ZUBRIDGE_MODE': JSON.stringify(mode),
    },
    // Optimize dependencies
    optimizeDeps: {
      include: ['zustand', '@zubridge/core', '@zubridge/types'],
    },
  },
});
