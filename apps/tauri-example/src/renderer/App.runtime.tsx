// @ts-ignore: React is used for JSX
import React from 'react';
// Correct import paths for Tauri window APIs
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'; // Import WebviewWindow from correct path
// Import Zubridge hooks
import { useZubridgeStore, useZubridgeDispatch } from '@zubridge/tauri'; // Removed initializeBridge import
import type { AnyState } from '@zubridge/tauri'; // Import state type if needed for selectors
import './styles/runtime-window.css';

interface RuntimeAppProps {
  windowLabel: string;
}

interface ThemeState {
  is_dark: boolean;
}

// Use AnyState or define a more specific State type expected from the backend
interface AppState extends AnyState {
  // Assuming backend sends { counter: number }
  counter?: number; // Make optional as it might not be present during init
  theme?: ThemeState;
}

export function RuntimeApp({ windowLabel }: RuntimeAppProps) {
  // Get dispatch function from Zubridge hook
  const dispatch = useZubridgeDispatch();

  // Get counter from Zubridge store
  const counter = useZubridgeStore<number>((state: AppState) => state.counter ?? 0);

  // Get theme state
  const isDarkMode = useZubridgeStore<boolean>((state: AppState) => state.theme?.is_dark ?? false);

  // Get the bridge status (optional, for loading indicators etc.)
  const bridgeStatus = useZubridgeStore((state) => state.__bridge_status);

  // Apply theme based on state
  React.useEffect(() => {
    // Remove both theme classes first
    document.body.classList.remove('dark-theme', 'light-theme');

    // Add the appropriate theme class
    if (isDarkMode) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.add('light-theme');
    }

    console.log(`[App.runtime] Theme set to ${isDarkMode ? 'dark' : 'light'} mode`);
  }, [isDarkMode]);

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

  const doubleCounter = () => {
    // Use a thunk to get the current state and dispatch a new action
    dispatch((getState, dispatch) => {
      const currentValue = (getState().counter as number) || 0;
      console.log(`[${windowLabel}] Thunk: Doubling counter from ${currentValue} to ${currentValue * 2}`);

      // Dispatch a special action to set the counter to double its current value
      dispatch({ type: 'SET_COUNTER', payload: currentValue * 2 });
    });
  };

  const doubleWithObject = () => {
    // Use the counter from the store hook
    const currentValue = counter || 0;
    console.log(`[${windowLabel}] Action Object: Doubling counter from ${currentValue} to ${currentValue * 2}`);

    // Dispatch an action object directly (no thunk)
    dispatch({
      type: 'SET_COUNTER',
      payload: currentValue * 2,
    });
  };

  const toggleTheme = () => {
    console.log(`[App.runtime] Dispatching THEME:TOGGLE action`);
    dispatch({ type: 'THEME:TOGGLE' });
  };

  // Use Tauri API for window creation
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

  // Use WebviewWindow.getByLabel to get the current window instance
  const closeWindow = async () => {
    console.log(`[App.runtime] Attempting to close window with label: ${windowLabel}`);
    try {
      // Await the promise returned by getByLabel
      const currentWindow = await WebviewWindow.getByLabel(windowLabel);
      if (currentWindow) {
        console.log(`[App.runtime] Found window, calling close()...`);
        await currentWindow.close();
      } else {
        console.warn(`[App.runtime] WebviewWindow.getByLabel returned null for label: ${windowLabel}`);
      }
    } catch (error) {
      console.error('[App.runtime] Error closing window:', error);
    }
  };

  return (
    <div className="app-container runtime-window">
      <div className="fixed-header">
        <div className="header-main">
          <span className="window-title">Runtime Window</span> (ID: <span className="window-id">{windowLabel}</span>)
        </div>
        <div className={`header-bridge-status ${bridgeStatus === 'ready' ? 'status-ready' : 'status-error'}`}>
          Bridge: {bridgeStatus}
        </div>
      </div>
      <div className="content">
        <div className="counter-section">
          {/* Show loading indicator while initializing */}
          <h2>Counter: {bridgeStatus === 'initializing' ? '...' : counter}</h2>
          <div className="button-group">
            <button onClick={decrementCounter}>-</button>
            <button onClick={incrementCounter}>+</button>
            <button onClick={doubleCounter}>Double (Thunk)</button>
            <button onClick={doubleWithObject}>Double (Object)</button>
          </div>
        </div>
        <div className="theme-section">
          <div className="button-group theme-button-group">
            <button onClick={toggleTheme}>Toggle Theme</button>
            <button onClick={createWindow} className="create-window-button">
              Create Window
            </button>
            <button onClick={closeWindow} className="close-button">
              Close Window
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
