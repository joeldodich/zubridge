// @ts-ignore: React is used for JSX transformation
import React from 'react';
// Use v1 API paths
import { WebviewWindow } from '@tauri-apps/api/window'; // WebviewWindow import path is different in v1
import { invoke } from '@tauri-apps/api/tauri'; // invoke is under /tauri in v1
import { exit } from '@tauri-apps/api/process'; // exit is under /process in v1
// Assuming zustand store setup remains similar, import the hook
// import { useStore } from './hooks/useStore';
import './styles/main-window.css';
// Removed import for ./types if it was Electron specific
// Removed import for @zubridge/electron hook
// Import the event listener API
// import { listen } from '@tauri-apps/api/event';
// Import the Zustand store hook
// import { useStore } from './store';
// import type { AppAction } from './bridge'; // Import action type
// Import Zubridge hooks
import { useZubridgeStore, useZubridgeDispatch } from '@zubridge/tauri';
import type { AnyState } from '@zubridge/tauri'; // Import state type if needed for selectors

interface MainAppProps {
  windowLabel: string;
  // dispatch: (action: AppAction) => void; // Add dispatch prop
}

// Use AnyState or define a more specific State type expected from the backend
interface AppState extends AnyState {
  // Assuming backend sends { counter: number }
  counter?: number; // Make optional as it might not be present during init
}

export function MainApp({ windowLabel }: MainAppProps) {
  // Get dispatch function from Zubridge hook
  const dispatch = useZubridgeDispatch();

  // Get counter from Zubridge store
  // Use a default value (e.g., 0) until the state is loaded
  const counter = useZubridgeStore<number>((state: AppState) => state.counter ?? 0);

  // Get the bridge status (optional, for loading indicators etc.)
  const bridgeStatus = useZubridgeStore((state) => state.__zubridge_status);

  // Determine if main window based on label (no local state needed)
  const isMainWindow = windowLabel === 'main';

  const handleIncrement = () => {
    // Dispatch Zubridge action - Use command name as type
    dispatch({ type: 'INCREMENT_COUNTER' });
  };

  const handleDecrement = () => {
    // Dispatch Zubridge action - Use command name as type
    dispatch({ type: 'DECREMENT_COUNTER' });
  };

  const handleCreateWindow = () => {
    // WebviewWindow creation logic might be slightly different in v1
    // but the core concept remains the same.
    const uniqueLabel = `runtime_${Date.now()}`;
    const webview = new WebviewWindow(uniqueLabel, {
      url: window.location.pathname, // Or specific path to index.html if needed
      title: `Runtime Window (${uniqueLabel})`,
      width: 600,
      height: 400,
    });

    // Event names might be slightly different in v1, check docs if issues arise
    webview.once('tauri://created', function () {
      console.log(`Window ${uniqueLabel} created`);
    });
    webview.once('tauri://error', function (e) {
      console.error(`Failed to create window ${uniqueLabel}:`, e);
    });
  };

  // Use the v1 exit API
  const handleQuitApp = async () => {
    try {
      await exit(0);
    } catch (error) {
      console.error('Error invoking exit:', error);
    }
  };

  return (
    <div className="app-container">
      <div className="fixed-header">
        {/* Display window label and mode */}
        Window: <span className="window-id">{windowLabel}</span>
        {/* Display bridge status (optional) */}
        <span style={{ marginLeft: '10px', fontSize: '0.8em', color: 'grey' }}>(Bridge: {bridgeStatus})</span>
      </div>

      <div className="content">
        <div className="counter-section">
          {/* Show loading indicator while initializing */}
          <h2>Counter: {bridgeStatus === 'initializing' ? '...' : counter}</h2>
          <div className="button-group">
            <button onClick={handleDecrement}>-</button>
            <button onClick={handleIncrement}>+</button>
          </div>
        </div>

        <div className="window-section">
          <div className="button-group window-button-group">
            <button onClick={handleCreateWindow}>Create Window</button>
            {/* Quit button only makes sense in the main window */}
            {isMainWindow && (
              <button onClick={handleQuitApp} className="close-button">
                Quit App
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
