import { Configuration } from 'electron-builder';

// Get the current mode from environment variables
const mode = process.env.ZUBRIDGE_MODE || 'basic'; // Default to basic if not specified

const config: Configuration = {
  appId: 'com.electron.zubridge-example',
  asar: true,
  copyright: 'goosewobbler',
  productName: `zubridge-electron-example-${mode}`,
  directories: {
    buildResources: '../resources/build',
    output: `dist-${mode}`,
  },
  files: [`out-${mode}/**/*`],
  extraResources: [
    {
      from: '../../resources/trayIcon.png',
      to: 'trayIcon.png',
    },
  ],
  linux: {
    executableName: `zubridge-electron-example-${mode}`,
    category: 'Utility',
    target: ['AppImage', 'deb', 'rpm', 'tar.gz'],
  },
  mac: {
    entitlementsInherit: 'build/entitlements.mac.plist',
    notarize: false,
    target: ['dmg', 'zip'],
    category: 'public.app-category.developer-tools',
  },
  win: {
    target: ['nsis', 'portable'],
  },
};

export default config;
