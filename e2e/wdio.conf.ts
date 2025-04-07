import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

import type { NormalizedPackageJson } from 'read-package-up';

import { getAppBuildInfo, getBinaryPath, getElectronVersion } from '@wdio/electron-utils';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const appDir = process.env.APP_DIR as string;
const mode = process.env.MODE || 'basic'; // Default to basic mode if not specified
const packageJsonPath = path.join(__dirname, '..', 'apps', appDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, { encoding: 'utf-8' })) as NormalizedPackageJson;
const pkg = { packageJson, path: packageJsonPath };
const electronVersion = await getElectronVersion(pkg);

// Define the binary path that will be set once the promise resolves
let binaryPath: string;

// Get the config that will be exported
const config = {
  services: ['electron'],
  capabilities: [
    {
      'browserName': 'electron',
      'wdio:electronServiceOptions': {
        // This will be defined below, before the config is used
        appBinaryPath: '',
        appArgs: ['--no-sandbox'],
        appEnv: { ZUBRIDGE_MODE: mode },
        restoreMocks: true,
      },
    },
  ],
  waitforTimeout: 5000,
  connectionRetryCount: 10,
  connectionRetryTimeout: 30000,
  logLevel: 'debug',
  runner: 'local',
  outputDir: `wdio-logs-${appDir}-${mode}`,
  specs: ['./test/*.spec.ts'],
  tsConfigPath: path.join(__dirname, 'tsconfig.json'),
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 30000,
  },
};

// This is an async IIFE to set up our environment before export
(async () => {
  try {
    const appBuildInfo = await getAppBuildInfo(pkg);
    const binPath = await getBinaryPath(packageJsonPath, appBuildInfo, electronVersion);

    if (!binPath) {
      throw new Error(`Could not find binary path for ${appDir}`);
    }

    // Update the config with the resolved binary path
    binaryPath = binPath;
    config.capabilities[0]['wdio:electronServiceOptions'].appBinaryPath = binPath;

    globalThis.packageJson = packageJson;
    process.env.TEST = 'true';
  } catch (error) {
    console.error('Error setting up WDIO config:', error);
    process.exit(1);
  }
})();

export { config };
