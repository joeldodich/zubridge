import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
// Import UI package styles before local styles
import '@zubridge/ui/dist/styles.css';
import './styles/index.css';
import { MainApp } from './App.main.js';
import { RuntimeApp } from './App.runtime.js';

// Define possible window types
type WindowType = 'main' | 'secondary' | 'runtime';

// App wrapper component to handle async loading of debug info
function AppWrapper() {
  // Create state for our app
  const [windowType, setWindowType] = useState<WindowType | null>(null);
  const [windowId, setWindowId] = useState<number | null>(null);
  const [modeName, setModeName] = useState('Unknown');

  // Fetch window info on mount
  useEffect(() => {
    const initApp = async () => {
      try {
        // Get window info using the renamed API
        if (window.electronAPI) {
          const info = await window.electronAPI.getWindowInfo();
          const modeInfo = await window.electronAPI.getMode();

          if (info) {
            setWindowType(info.type);
            setWindowId(info.id);
          }
          if (modeInfo) {
            setModeName(modeInfo.modeName);
          }
        }
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    };

    initApp();
  }, []);

  // Show loading screen while getting info
  if (!windowType || windowId === null) {
    return <div>Loading Window Info...</div>;
  }

  // Render the appropriate component based on window type
  if (windowType === 'runtime') {
    return <RuntimeApp windowId={windowId} modeName={modeName} />;
  } else {
    return <MainApp windowId={windowId} modeName={modeName} windowType={windowType} />;
  }
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
