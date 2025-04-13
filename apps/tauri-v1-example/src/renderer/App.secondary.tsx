// @ts-ignore: React is used for JSX
import React from 'react';
// Import v1 API paths
import { WebviewWindow } from '@tauri-apps/api/window';
// Import Zubridge hooks
import { useZubridgeStore, useZubridgeDispatch } from '@zubridge/tauri';
import type { AnyState } from '@zubridge/tauri';
import './styles/runtime-window.css'; // Reuse styles

interface SecondaryAppProps {
  windowLabel: string;
}

interface AppState extends AnyState {
  counter?: number;
}

export function SecondaryApp({ windowLabel }: SecondaryAppProps) {
  const dispatch = useZubridgeDispatch();
  const counter = useZubridgeStore<number>((state: AppState) => state.counter ?? 0);
  const bridgeStatus = useZubridgeStore((state) => state.__zubridge_status);

  const incrementCounter = () => {
    dispatch({ type: 'INCREMENT_COUNTER' });
  };

  const decrementCounter = () => {
    dispatch({ type: 'DECREMENT_COUNTER' });
  };

  // Create new runtime window
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

  // Close this secondary window
  const closeWindow = async () => {
    try {
      const currentWindow = WebviewWindow.getByLabel(windowLabel);
      if (currentWindow) {
        await currentWindow.close();
      } else {
        console.warn(`[App.secondary] Window not found for label: ${windowLabel}`);
      }
    } catch (error) {
      console.error('[App.secondary] Error closing window:', error);
    }
  };

  return (
    <div className="app-container runtime-window">
      <div className="fixed-header">
        Window: <span className="window-id">Secondary ({windowLabel})</span> {/* Identify as Secondary */}
        <span style={{ marginLeft: '10px', fontSize: '0.8em', color: 'grey' }}>(Bridge: {bridgeStatus})</span>
      </div>
      <div className="content">
        <div className="counter-section">
          <h2>Counter: {bridgeStatus === 'initializing' ? '...' : counter}</h2>
          <div className="button-group">
            <button onClick={decrementCounter}>-</button>
            <button onClick={incrementCounter}>+</button>
          </div>
        </div>
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
