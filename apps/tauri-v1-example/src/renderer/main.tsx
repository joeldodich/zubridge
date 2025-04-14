import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
// Import v1 APIs
import { getCurrent } from '@tauri-apps/api/window';
import './styles/main-window.css';
import { MainApp } from './App.main';
import { RuntimeApp } from './App.runtime';

// App wrapper component to handle async loading
function AppWrapper() {
  const [isReady, setIsReady] = useState(false);
  const [windowLabel, setWindowLabel] = useState('main'); // Default to 'main'
  const [isRuntime, setIsRuntime] = useState(false); // Track window type

  // Effect for setting up bridge and window info
  useEffect(() => {
    const setupApp = async () => {
      try {
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
  }, []); // Run setup once on mount

  // Show loading screen while getting info
  if (!isReady) {
    return <div>Loading Window Info...</div>;
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
