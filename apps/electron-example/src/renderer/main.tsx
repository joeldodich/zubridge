import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/main-window.css';
import { MainApp } from './App.main.js';
import { RuntimeApp } from './App.runtime.js';
import { SecondaryApp } from './App.secondary.js'; // Import type declarations

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
  switch (windowType) {
    case 'main':
      return <MainApp windowId={windowId} modeName={modeName} />;
    case 'secondary':
      return <SecondaryApp windowId={windowId} modeName={modeName} />;
    case 'runtime':
    default:
      // Runtime windows need ID and mode name
      return <RuntimeApp windowId={windowId} modeName={modeName} />;
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
