// @ts-ignore: React is used for JSX
import React from 'react';
// Correct import paths for Tauri v1 window APIs
import { WebviewWindow, getCurrent } from '@tauri-apps/api/window';
// Import Zubridge hooks
import { useZubridgeStore, useZubridgeDispatch } from '@zubridge/tauri';
import type { AnyState } from '@zubridge/tauri';
import './styles/runtime-window.css';

interface RuntimeAppProps {
  windowLabel: string;
}

interface AppState extends AnyState {
  counter?: number;
}

export function RuntimeApp({ windowLabel }: RuntimeAppProps) {
  const dispatch = useZubridgeDispatch();
  const counter = useZubridgeStore<number>((state: AppState) => state.counter ?? 0);
  const bridgeStatus = useZubridgeStore((state) => state.__bridge_status);

  const incrementCounter = () => {
    const action = { type: 'COUNTER:INCREMENT' };
    console.log(`[App.runtime] Dispatching:`, action);
    dispatch(action);
  };

  const decrementCounter = () => {
    const action = { type: 'COUNTER:DECREMENT' };
    console.log(`[App.runtime] Dispatching:`, action);
    dispatch(action);
  };

  const createWindow = () => {
    const uniqueLabel = `runtime_${Date.now()}`;
    const webview = new WebviewWindow(uniqueLabel, {
      url: window.location.pathname,
      title: `Runtime Window (${uniqueLabel})`,
      width: 600,
      height: 400,
    });
    webview.once('tauri://created', () => console.log(`Window ${uniqueLabel} created`));
    webview.once('tauri://error', (e) => console.error(`Failed to create window ${uniqueLabel}:`, e));
  };

  const closeWindow = async () => {
    console.log(`[App.runtime] Attempting to close window with label: ${windowLabel}`);
    try {
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
