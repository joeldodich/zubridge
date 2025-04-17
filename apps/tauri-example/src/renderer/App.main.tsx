// @ts-ignore: React is used for JSX transformation
import React from 'react';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import './styles/main-window.css';
import { useZubridgeStore, useZubridgeDispatch } from '@zubridge/tauri';
import type { AnyState } from '@zubridge/tauri';

interface MainAppProps {
  windowLabel: string;
}

interface AppState extends AnyState {
  counter?: number;
}

export function MainApp({ windowLabel }: MainAppProps) {
  console.log('[App.main] Renderer process loaded.');

  const dispatch = useZubridgeDispatch();
  const counter = useZubridgeStore<number>((state: AppState) => state.counter ?? 0);
  const bridgeStatus = useZubridgeStore((state) => state.__bridge_status);
  const isMainWindow = windowLabel === 'main';

  const handleIncrement = () => {
    const action = { type: 'INCREMENT_COUNTER' };
    console.log(`[App.main] Dispatching:`, action);
    dispatch(action);
  };

  const handleDecrement = () => {
    const action = { type: 'DECREMENT_COUNTER' };
    console.log(`[App.main] Dispatching:`, action);
    dispatch(action);
  };

  const handleDoubleCounter = () => {
    // Use a thunk to get the current state and dispatch a new action
    dispatch((getState, dispatch) => {
      const currentValue = (getState().counter as number) || 0;
      console.log(`[${windowLabel}] Thunk: Doubling counter from ${currentValue} to ${currentValue * 2}`);

      // Dispatch a special action to set the counter to double its current value
      dispatch({ type: 'SET_COUNTER', payload: currentValue * 2 });
    });
  };

  const handleDoubleWithObject = () => {
    // Use the counter from the store hook
    const currentValue = counter || 0;
    console.log(`[${windowLabel}] Action Object: Doubling counter from ${currentValue} to ${currentValue * 2}`);

    // Dispatch an action object directly (no thunk)
    dispatch({
      type: 'SET_COUNTER',
      payload: currentValue * 2,
    });
  };

  const handleCreateWindow = () => {
    const uniqueLabel = `runtime_${Date.now()}`;
    const webview = new WebviewWindow(uniqueLabel, {
      url: window.location.pathname,
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

  const handleQuitApp = async () => {
    try {
      await invoke('quit_app');
    } catch (error) {
      console.error('Error invoking quit_app:', error);
    }
  };

  const handleCloseWindow = async () => {
    try {
      console.log(`[App.main] Attempting to close window with label: ${windowLabel}`);
      try {
        // Await the promise returned by getByLabel
        const currentWindow = await WebviewWindow.getByLabel(windowLabel);
        if (currentWindow) {
          console.log(`[App.main] Found window, calling close()...`);
          await currentWindow.close();
        } else {
          console.warn(`[App.main] WebviewWindow.getByLabel returned null for label: ${windowLabel}`);
        }
      } catch (error) {
        console.error('[App.main] Error closing window:', error);
      }
    } catch (error) {
      console.error('Error invoking close_window:', error);
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
            <button onClick={handleDoubleCounter}>Double (Thunk)</button>
            <button onClick={handleDoubleWithObject}>Double (Action Object)</button>
          </div>
        </div>

        <div className="window-section">
          <div className="button-group window-button-group">
            <button onClick={handleCreateWindow}>Create Window</button>
            {/* Quit button only makes sense in the main window */}
            {isMainWindow ? (
              <button onClick={handleQuitApp} className="close-button">
                Quit App
              </button>
            ) : (
              <button onClick={handleCloseWindow} className="close-button">
                Close Window
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
