// @ts-ignore: React is used for JSX transformation
import React from 'react';
import { useEffect, useState } from 'react';
import { useStore } from './hooks/useStore';
import { useDispatch } from '@zubridge/electron';
import './styles/main-window.css';
import './types';

export function MainApp() {
  const dispatch = useDispatch();
  const counter = useStore((state) => state.counter);
  const [windowId, setWindowId] = useState<number | null>(null);
  const [isMainWindow, setIsMainWindow] = useState(false);
  const [modeName, setModeName] = useState<string>('');

  useEffect(() => {
    // Get window ID and check if this is the main window
    const initializeWindow = async () => {
      if (window.electron) {
        try {
          const [id, isMain, mode] = await Promise.all([
            window.electron.getWindowId(),
            window.electron.isMainWindow(),
            window.electron.getMode(),
          ]);

          setWindowId(id);
          setIsMainWindow(isMain);
          setModeName(mode.modeName);
        } catch (error) {
          console.error('Error initializing window:', error);
        }
      }
    };

    initializeWindow();
  }, []);

  const handleIncrement = () => {
    dispatch('COUNTER:INCREMENT');
  };

  const handleDecrement = () => {
    dispatch('COUNTER:DECREMENT');
  };

  const handleCreateWindow = () => {
    dispatch('WINDOW:CREATE');
  };

  const handleQuitApp = () => {
    try {
      if (window.electron?.quitApp) {
        window.electron.quitApp();
      }
    } catch (error) {
      console.error('Error quitting app:', error);
    }
  };

  return (
    <div className="app-container">
      {/* Fixed header to display window ID */}
      <div className="fixed-header">
        {isMainWindow ? 'Main Window' : 'Runtime Window'} - {modeName} {windowId !== null && `(ID: `}
        <span className="window-id">{windowId}</span>
        {windowId !== null && `)`}
      </div>

      <div className="content">
        <div className="counter-section">
          <h2>Counter: {counter}</h2>
          <div className="button-group">
            <button onClick={handleDecrement}>-</button>
            <button onClick={handleIncrement}>+</button>
          </div>
        </div>

        <div className="window-section">
          <div className="button-group window-button-group">
            <button onClick={handleCreateWindow}>Create New Window</button>
            <button onClick={handleQuitApp} className="close-button">
              Quit App
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
