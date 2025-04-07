import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/main-window.css';
import { MainApp } from './App.main.js';
import { RuntimeApp } from './App.runtime.js';

// App wrapper component to handle async loading of debug info
function AppWrapper() {
  // Check if this is a runtime window
  const urlParams = new URLSearchParams(window.location.search);
  const isRuntimeWindow = urlParams.has('runtime');

  // Create state for our app
  const [isReady, setIsReady] = useState(false);
  const [windowId, setWindowId] = useState(0);
  const [modeName, setModeName] = useState('Unknown');

  // Fetch window info on mount
  useEffect(() => {
    const initApp = async () => {
      try {
        // Get window info
        if (window.electron) {
          // Basic properties we know exist
          const windowIdValue = await window.electron.getWindowId();

          // Try to get mode if available
          let modeNameValue = 'Unknown';

          try {
            const modeInfo = await window.electron.getMode();
            if (modeInfo) {
              modeNameValue = modeInfo.modeName;
            }
          } catch (e) {
            console.warn('Could not get mode info:', e);
          }

          // Set states
          setWindowId(windowIdValue);
          setModeName(modeNameValue);
        }
      } catch (error) {
        console.error('Error initializing app:', error);
      } finally {
        setIsReady(true);
      }
    };

    initApp();
  }, []);

  // Show loading screen while getting info
  if (!isReady) {
    return <div>Loading...</div>;
  }

  // Render the appropriate component based on window type
  return isRuntimeWindow ? <RuntimeApp windowId={windowId} modeName={modeName} /> : <MainApp />;
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
