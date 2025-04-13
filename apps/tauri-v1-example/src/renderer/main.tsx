import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
// Import getCurrent separately for v1
import { WebviewWindow, getCurrent } from '@tauri-apps/api/window';
import './styles/main-window.css';
import { MainApp } from './App.main';
import { RuntimeApp } from './App.runtime';
import { SecondaryApp } from './App.secondary';
// import { SecondaryApp } from './App.secondary'; // Comment out until created

// Define possible window types
type WindowType = 'main' | 'secondary' | 'runtime';

// App wrapper component to handle async loading of debug info
function AppWrapper() {
  // Create state for our app
  const [windowType, setWindowType] = useState<WindowType | null>(null);
  // REMOVED: windowId state (not easily available in v1)
  const [windowLabel, setWindowLabel] = useState<string | null>(null);
  // REMOVED: modeName state

  // Fetch window info on mount
  useEffect(() => {
    const initApp = async () => {
      try {
        // Use v1 getCurrent() function
        const currentWindow = getCurrent();
        const label = currentWindow.label; // Access label directly
        setWindowLabel(label);
        setWindowType(label as WindowType); // Still assume label matches type
      } catch (error) {
        console.error('Error initializing app:', error);
        setWindowLabel('main'); // Fallback
        setWindowType('main');
      }
    };

    initApp();
  }, []);

  // Show loading screen while getting info
  if (!windowType || !windowLabel) {
    return <div>Loading Window Info...</div>;
  }

  // Render the appropriate component based on window type
  switch (windowType) {
    case 'main':
      return <MainApp windowLabel={windowLabel} />;
    case 'secondary':
      // Render SecondaryApp
      return <SecondaryApp windowLabel={windowLabel} />;
    case 'runtime':
    default:
      return <RuntimeApp windowLabel={windowLabel} />;
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
