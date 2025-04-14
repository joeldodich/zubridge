// @ts-ignore: React is used for JSX transformation
import React, { useEffect } from 'react';
// Use v1 API paths
import { WebviewWindow } from '@tauri-apps/api/window'; // WebviewWindow is in window module in v1
// Import invoke and listen specific to v1
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import './styles/main-window.css';
// Import Zubridge hooks
import { useZubridgeStore, useZubridgeDispatch, initializeBridge } from '@zubridge/tauri';
import type { AnyState } from '@zubridge/tauri'; // Import state type if needed for selectors

interface MainAppProps {
  windowLabel: string;
}

// Use AnyState or define a more specific State type expected from the backend
interface AppState extends AnyState {
  counter?: number; // Make optional as it might not be present during init
}

export function MainApp({ windowLabel }: MainAppProps) {
  console.log('[App.main] Renderer process loaded.');

  // Get dispatch function from Zubridge hook
  const dispatch = useZubridgeDispatch();

  // Get counter from Zubridge store
  const counter = useZubridgeStore<number>((state: AppState) => state.counter ?? 0);

  // Get the bridge status (optional, for loading indicators etc.)
  const bridgeStatus = useZubridgeStore((state) => state.__zubridge_status);

  // Initialize Zubridge connection on mount
  useEffect(() => {
    console.log('[App.main] Initializing Zubridge...');
    initializeBridge({ invoke, listen }).catch((err) => {
      console.error('[App.main] Zubridge initialization failed:', err);
    });

    // Test invoke call to verify Tauri API behavior
    invoke('__test_command_does_not_exist')
      .then(() => console.log('[App.main] Test invoke succeeded (unexpectedly)'))
      .catch((err) => {
        if (err.message?.includes('__TAURI_INTERNALS__')) {
          console.error('[App.main] Test invoke FAILED: Tauri internals not found.', err);
        } else {
          console.log('[App.main] Test invoke seems OK (got expected command-not-found error).');
        }
      });
  }, []); // Empty dependency array ensures this runs only once on mount

  // Determine if main window based on label (no local state needed)
  const isMainWindow = windowLabel === 'main';

  const handleIncrement = () => {
    // Dispatch Zubridge action - Use command name as type
    const action = { type: 'INCREMENT_COUNTER' };
    console.log(`[App.main] Dispatching:`, action);
    dispatch(action);
  };

  const handleDecrement = () => {
    // Dispatch Zubridge action - Use command name as type
    const action = { type: 'DECREMENT_COUNTER' };
    console.log(`[App.main] Dispatching:`, action);
    dispatch(action);
  };

  const handleCreateWindow = () => {
    // Using v1 WebviewWindow API
    const uniqueLabel = `runtime_${Date.now()}`;
    const webview = new WebviewWindow(uniqueLabel, {
      url: window.location.pathname, // Use current path for the new window
      title: `Runtime Window (${uniqueLabel})`,
      width: 600,
      height: 400,
    });

    webview.once('tauri://created', function () {
      console.log(`Window ${uniqueLabel} created`);
    });
    webview.once('tauri://error', function (e) {
      console.error(`Failed to create window ${uniqueLabel}:`, e);
    });
  };

  // Use v1 invoke for custom command
  const handleQuitApp = async () => {
    try {
      await invoke('quit_app');
    } catch (error) {
      console.error('Error invoking quit_app:', error);
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
