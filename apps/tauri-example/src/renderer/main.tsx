import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { initializeBridge, cleanupZubridge } from '@zubridge/tauri';
import './styles/main-window.css';
import { MainApp } from './App.main';
import { RuntimeApp } from './App.runtime';

function AppWrapper() {
  const [isReady, setIsReady] = useState(false);
  const [windowLabel, setWindowLabel] = useState('main');
  const [isRuntime, setIsRuntime] = useState(false);
  const [bridgeInitialized, setBridgeInitialized] = useState(false);

  useEffect(() => {
    const setupApp = async () => {
      try {
        // Initialize Zubridge with Tauri v2 invoke and listen functions
        console.log('[main.tsx] Initializing Zubridge bridge with Tauri API...');
        await initializeBridge({
          invoke,
          listen,
        });
        console.log('[main.tsx] Zubridge bridge initialized successfully');
        setBridgeInitialized(true);

        // Fetch window info
        const currentWindow = WebviewWindow.getCurrent();
        const label = currentWindow.label;
        console.log(`[main.tsx] Current window label: ${label}`);
        setWindowLabel(label);

        // Only dynamically created runtime windows should use RuntimeApp
        // Both main and secondary windows should use MainApp
        if (label.startsWith('runtime_')) {
          setIsRuntime(true);
        }
      } catch (error) {
        console.error('[main.tsx] Error setting up app:', error);
        setWindowLabel('error-label');
      } finally {
        setIsReady(true);
      }
    };

    setupApp();

    return () => {
      console.log('[main.tsx] Cleaning up Zubridge...');
      cleanupZubridge();
    };
  }, []);

  if (!isReady || !bridgeInitialized) {
    return <div>Loading Window Info & Initializing Bridge...</div>;
  }

  return isRuntime ? <RuntimeApp windowLabel={windowLabel} /> : <MainApp windowLabel={windowLabel} />;
}

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>,
);
