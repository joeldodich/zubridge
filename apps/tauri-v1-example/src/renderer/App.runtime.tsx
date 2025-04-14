// @ts-ignore: React is used for JSX
import React, { useEffect } from 'react';
// Correct import paths for Tauri v1 window APIs
import { WebviewWindow, getCurrent } from '@tauri-apps/api/window'; // Import both WebviewWindow and getCurrent for v1
// Import v1 specific APIs
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
// Import Zubridge hooks
import { useZubridgeStore, useZubridgeDispatch, initializeBridge } from '@zubridge/tauri';
import type { AnyState } from '@zubridge/tauri'; // Import state type if needed for selectors
import './styles/runtime-window.css';

interface RuntimeAppProps {
  // windowId: number; // Remove windowId
  windowLabel: string;
}

// Use AnyState or define a more specific State type expected from the backend
interface AppState extends AnyState {
  // Assuming backend sends { counter: number }
  counter?: number; // Make optional as it might not be present during init
}

export function RuntimeApp({ windowLabel }: RuntimeAppProps) {
  // Initialize Zubridge
  useEffect(() => {
    console.log(`[App.runtime ${windowLabel}] Initializing bridge...`);
    initializeBridge({ invoke, listen });
  }, [windowLabel]);

  // Get dispatch function from Zubridge hook
  const dispatch = useZubridgeDispatch();

  // Get counter from Zubridge store
  const counter = useZubridgeStore<number>((state: AppState) => state.counter ?? 0);

  // Get the bridge status (optional, for loading indicators etc.)
  const bridgeStatus = useZubridgeStore((state) => state.__zubridge_status);

  const incrementCounter = () => {
    // Dispatch Zubridge action - Use command name as type
    const action = { type: 'INCREMENT_COUNTER' };
    console.log(`[App.runtime] Dispatching:`, action);
    dispatch(action);
  };

  const decrementCounter = () => {
    // Dispatch Zubridge action - Use command name as type
    const action = { type: 'DECREMENT_COUNTER' };
    console.log(`[App.runtime] Dispatching:`, action);
    dispatch(action);
  };

  // Use Tauri v1 API for window creation
  const createWindow = () => {
    const uniqueLabel = `runtime_${Date.now()}`;
    const webview = new WebviewWindow(uniqueLabel, {
      url: window.location.pathname, // Use current path
      title: `Runtime Window (${uniqueLabel})`,
      width: 600,
      height: 400,
    });
    webview.once('tauri://created', () => console.log(`Window ${uniqueLabel} created`));
    webview.once('tauri://error', (e) => console.error(`Failed to create window ${uniqueLabel}:`, e));
  };

  // Use v1 getCurrent() to get the current window instance
  const closeWindow = async () => {
    console.log(`[App.runtime] Attempting to close window with label: ${windowLabel}`);
    try {
      // Get current window with v1 API and close it
      const currentWindow = getCurrent();
      if (currentWindow) {
        console.log(`[App.runtime] Found window, calling close()...`);
        await currentWindow.close();
      } else {
        console.warn(`[App.runtime] Failed to get current window`);
      }
    } catch (error) {
      console.error('[App.runtime] Error closing window:', error);
    }
  };

  return (
    <div className="app-container runtime-window">
      <div className="fixed-header">
        Window: <span className="window-id">{windowLabel}</span>
        {/* Display bridge status (optional) */}
        <span style={{ marginLeft: '10px', fontSize: '0.8em', color: 'grey' }}>(Bridge: {bridgeStatus})</span>
      </div>
      <div className="content">
        <div className="counter-section">
          {/* Show loading indicator while initializing */}
          <h2>Counter: {bridgeStatus === 'initializing' ? '...' : counter}</h2>
          <div className="button-group">
            <button onClick={decrementCounter}>-</button>
            <button onClick={incrementCounter}>+</button>
          </div>
        </div>
        {/* Add back window controls section */}
        <div className="window-section">
          <div className="button-group window-button-group">
            <button onClick={createWindow}>Create Window</button>
            <button onClick={closeWindow} className="close-button">
              Close Window
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
