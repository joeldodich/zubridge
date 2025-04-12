// @ts-ignore: React is used for JSX transformation
import React from 'react';
import { useStore } from './hooks/useStore';
import { useDispatch } from '@zubridge/electron';
import './styles/main-window.css';

// Define props expected from AppWrapper
interface MainAppProps {
  windowId: number;
  modeName: string;
}

export function MainApp({ windowId, modeName }: MainAppProps) {
  const dispatch = useDispatch();
  const counter = useStore((state) => state.counter);

  const handleIncrement = () => {
    dispatch('COUNTER:INCREMENT');
  };

  const handleDecrement = () => {
    dispatch('COUNTER:DECREMENT');
  };

  const handleCreateWindow = async () => {
    try {
      console.log(`[MainApp ${windowId}] Requesting new runtime window...`);
      // Use the RENAMED API
      const result = await window.electronAPI?.createRuntimeWindow();
      if (result?.success) {
        console.log(`[MainApp ${windowId}] Runtime window created successfully (ID: ${result.windowId}).`);
      } else {
        console.error(`[MainApp ${windowId}] Failed to create runtime window.`);
      }
    } catch (error) {
      console.error(`[MainApp ${windowId}] Error requesting runtime window:`, error);
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

  return (
    <div className="app-container">
      {/* Fixed header to display window ID and type */}
      <div className="fixed-header">
        Main Window - {modeName} (ID: <span className="window-id">{windowId}</span>)
      </div>

      <div className="content">
        {/* Counter Section */}
        <div className="counter-section">
          <h2>Counter: {counter}</h2>
          <div className="button-group">
            <button onClick={handleDecrement}>-</button>
            <button onClick={handleIncrement}>+</button>
          </div>
        </div>

        {/* Window Section */}
        <div className="window-section">
          <div className="button-group window-button-group">
            <button onClick={handleCreateWindow}>Create Window</button>
            {/* Quit button only makes sense in the main window */}
            <button onClick={handleQuitApp} className="close-button">
              Quit App
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
