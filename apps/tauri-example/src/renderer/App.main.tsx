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

interface ThemeState {
  is_dark: boolean;
}

interface AppState extends AnyState {
  counter?: number;
  theme?: ThemeState;
}

export function MainApp({ windowLabel }: MainAppProps) {
  console.log('[App.main] Renderer process loaded.');

  const dispatch = useZubridgeDispatch();
  const counter = useZubridgeStore<number>((state: AppState) => state.counter ?? 0);
  const isDarkMode = useZubridgeStore<boolean>((state: AppState) => state.theme?.is_dark ?? false);
  const bridgeStatus = useZubridgeStore((state) => state.__bridge_status);
  const isMainWindow = windowLabel === 'main';

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

    console.log(`[App.main] Theme set to ${isDarkMode ? 'dark' : 'light'} mode`);
  }, [isDarkMode]);

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

    // Dispatch an action object directly
    dispatch({
      type: 'SET_COUNTER',
      payload: currentValue * 2,
    });
  };

  const handleToggleTheme = () => {
    console.log('[App.main] Toggling theme');
    dispatch({ type: 'THEME:TOGGLE' });
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
        <div className="header-main">
          <span className="window-title">{isMainWindow ? 'Main' : 'Secondary'} Window</span> (ID:{' '}
          <span className="window-id">{windowLabel}</span>)
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
            <button onClick={handleDecrement}>-</button>
            <button onClick={handleIncrement}>+</button>
            <button onClick={handleDoubleCounter}>Double (Thunk)</button>
            <button onClick={handleDoubleWithObject}>Double (Object)</button>
          </div>
        </div>

        <div className="theme-section">
          <div className="button-group theme-button-group">
            <button onClick={handleToggleTheme}>Toggle Theme</button>
            <button onClick={handleCreateWindow} className="create-window-button">
              Create Window
            </button>
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
