import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
// Import v1 APIs
import { getCurrent } from '@tauri-apps/api/window';
import { initializeBridge, cleanupZubridge } from '@zubridge/tauri';
import './styles/main-window.css';
import { MainApp } from './App.main';
import { RuntimeApp } from './App.runtime';

// App wrapper component to handle async loading
function AppWrapper() {
  const [isReady, setIsReady] = useState(false);
  const [windowLabel, setWindowLabel] = useState('main'); // Default to 'main'
  const [isRuntime, setIsRuntime] = useState(false); // Track window type
  const [bridgeInitialized, setBridgeInitialized] = useState(false);

  // Effect for setting up bridge and window info
  useEffect(() => {
    // Helper to wait for Tauri v1 globals
    const waitForTauri = async () => {
      // Use type assertion for checking specific properties
      while (
        !(window as any).__TAURI__ ||
        typeof (window as any).__TAURI__.invoke !== 'function' ||
        typeof (window as any).__TAURI__.event?.listen !== 'function'
      ) {
        console.log('[main.tsx v1] Waiting for window.__TAURI__ globals...');
        await new Promise((resolve) => setTimeout(resolve, 50)); // Wait 50ms
      }
      console.log('[main.tsx v1] window.__TAURI__ globals found.');
    };

    const setupApp = async () => {
      try {
        await waitForTauri(); // Wait for Tauri v1 globals

        // Initialize Zubridge using explicit v1 globals
        console.log('[main.tsx v1] Initializing Zubridge bridge with window.__TAURI__...');
        await initializeBridge({
          // Assert types directly here
          invoke: (window as any).__TAURI__.invoke,
          listen: (window as any).__TAURI__.event.listen,
        });
        console.log('[main.tsx v1] Zubridge bridge initialized.');
        setBridgeInitialized(true);

        // Fetch window info using v1 API
        const currentWindow = getCurrent();
        const label = currentWindow.label;
        setWindowLabel(label);

        // Identify runtime windows
        if (label !== 'main') {
          setIsRuntime(true);
        }
      } catch (error) {
        console.error('Error setting up app:', error);
        setWindowLabel('error-label');
      } finally {
        setIsReady(true);
      }
    };

    setupApp();

    // Add cleanup
    return () => {
      console.log('[main.tsx v1] Cleaning up Zubridge...');
      cleanupZubridge();
    };
  }, []); // Run setup once on mount

  // Show loading screen while getting info & initializing bridge
  if (!isReady || !bridgeInitialized) {
    return <div>Loading Window Info & Initializing Bridge...</div>;
  }

  return isRuntime ? <RuntimeApp windowLabel={windowLabel} /> : <MainApp windowLabel={windowLabel} />;
}

// Get the DOM container element
const container = document.getElementById('root');

// Create React root and render the app
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>,
);
