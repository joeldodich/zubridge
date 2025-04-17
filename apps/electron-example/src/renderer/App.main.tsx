// @ts-ignore: React is used for JSX transformation
import React from 'react';
import { useStore } from './hooks/useStore';
import { useDispatch } from '@zubridge/electron';
import './styles/main-window.css';

// Define props expected from AppWrapper
interface MainAppProps {
  windowId: number;
  modeName: string;
  windowType?: 'main' | 'secondary'; // Add window type parameter
}

export function MainApp({ windowId, modeName, windowType = 'main' }: MainAppProps) {
  const dispatch = useDispatch();
  const counter = useStore((state) => state.counter);

  const handleIncrement = () => {
    dispatch('COUNTER:INCREMENT');
  };

  const handleDecrement = () => {
    dispatch('COUNTER:DECREMENT');
  };

  const handleDoubleCounter = () => {
    // Use a thunk to get the current state and dispatch a new action
    dispatch((getState, dispatch) => {
      const currentValue = (getState().counter as number) || 0;
      console.log(`[${windowType} ${windowId}] Thunk: Doubling counter from ${currentValue} to ${currentValue * 2}`);

      // Dispatch a special action to set the counter to double its current value
      dispatch('COUNTER:SET', currentValue * 2);
    });
  };

  const handleDoubleWithObject = () => {
    // Use the useStore to get the current counter value
    const currentValue = (counter as number) || 0;
    console.log(
      `[${windowType} ${windowId}] Action Object: Doubling counter from ${currentValue} to ${currentValue * 2}`,
    );

    // Dispatch an action object with type and payload
    dispatch({
      type: 'COUNTER:SET',
      payload: currentValue * 2,
    });
  };

  const handleCreateWindow = async () => {
    try {
      console.log(`[${windowType} ${windowId}] Requesting new runtime window...`);
      // Use the RENAMED API
      const result = await window.electronAPI?.createRuntimeWindow();
      if (result?.success) {
        console.log(`[${windowType} ${windowId}] Runtime window created successfully (ID: ${result.windowId}).`);
      } else {
        console.error(`[${windowType} ${windowId}] Failed to create runtime window.`);
      }
    } catch (error) {
      console.error(`[${windowType} ${windowId}] Error requesting runtime window:`, error);
    }
  };

  const handleQuitApp = () => {
    try {
      // Use the RENAMED API
      window.electronAPI?.quitApp();
    } catch (error) {
      console.error('Error quitting app:', error);
    }
  };

  // Determine window title based on type
  const windowTitle = windowType === 'secondary' ? 'Secondary' : 'Main';

  return (
    <div className="app-container">
      {/* Fixed header to display window ID and type */}
      <div className="fixed-header">
        {windowTitle} Window - {modeName} (ID: <span className="window-id">{windowId}</span>)
      </div>

      <div className="content">
        {/* Counter Section */}
        <div className="counter-section">
          <h2>Counter: {counter}</h2>
          <div className="button-group">
            <button onClick={handleDecrement}>-</button>
            <button onClick={handleIncrement}>+</button>
            <button onClick={handleDoubleCounter}>Double (Thunk)</button>
            <button onClick={handleDoubleWithObject}>Double (Action Object)</button>
          </div>
        </div>

        {/* Window Section */}
        <div className="window-section">
          <div className="button-group window-button-group">
            <button onClick={handleCreateWindow}>Create Window</button>
            {/* Only show quit button on main window */}
            {windowType === 'main' && (
              <button onClick={handleQuitApp} className="close-button">
                Quit App
              </button>
            )}
            {/* Show close button on secondary window */}
            {windowType === 'secondary' && (
              <button onClick={() => window.electronAPI?.closeCurrentWindow()} className="close-button">
                Close Window
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
