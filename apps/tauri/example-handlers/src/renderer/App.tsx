import React, { useState, useEffect, useRef } from 'react';
import { useDispatch } from '@zubridge/tauri';
import { useStore } from './hooks/useStore.js';
import type { State } from '../features/index.js';

// Metadata type for state updates
interface UpdateMetadata {
  updateId?: string;
  timestamp?: number;
  sourceWindow?: string;
  reason?: string;
}

export const App: React.FC = () => {
  // The useStore hook now handles memoization and sync with other windows
  const counter = useStore((state: State) => state.counter);
  const updateMeta = useStore((state: any) => state.__meta as UpdateMetadata);
  const dispatch = useDispatch<State>();
  const [isMainWindow, setIsMainWindow] = useState<boolean | null>(null);
  const [windowLabel, setWindowLabel] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const counterRef = useRef<number | null>(null);

  // Add a log entry
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(logEntry);
    setLogs((prev) => [logEntry, ...prev].slice(0, 10)); // Keep last 10 logs
  };

  // Check if this is the main window when component mounts
  useEffect(() => {
    const checkMainWindow = async () => {
      try {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const currentWindow = getCurrentWebviewWindow();

        // Store the current window label for logging
        setWindowLabel(currentWindow.label);

        // Check if the current window is the main window
        setIsMainWindow(currentWindow.label === 'main');

        addLog(`Window initialized: ${currentWindow.label}`);
      } catch (error) {
        console.error('Error checking window label:', error);
        setIsMainWindow(false);
      }
    };

    checkMainWindow();
  }, []);

  // Log when counter changes for debugging
  useEffect(() => {
    if (windowLabel && typeof counter !== 'undefined') {
      if (counterRef.current !== counter) {
        const timestamp = new Date().toLocaleTimeString();
        setLastUpdate(timestamp);

        // Check if we have metadata about this update
        let logMessage = `Counter updated to: ${counter}`;
        if (updateMeta) {
          logMessage += ` (Update #${updateMeta.updateId || 'unknown'} from ${updateMeta.sourceWindow || 'unknown'})`;
          if (updateMeta.reason) {
            logMessage += ` - Reason: ${updateMeta.reason}`;
          }
        }

        addLog(logMessage);
        counterRef.current = counter;
      }
    }
  }, [counter, windowLabel, updateMeta]);

  // Show loading state when counter is undefined
  if (typeof counter === 'undefined') {
    return <main>Loading...</main>;
  }

  // Function to close the current window - always use direct method
  const closeThisWindow = async () => {
    try {
      addLog('Closing current window');
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const currentWindow = getCurrentWebviewWindow();
      await currentWindow.close();
    } catch (error) {
      console.error('Error closing window:', error);
      addLog(`Error closing window: ${error}`);
    }
  };

  // Function to create a new window through action dispatch
  const createNewWindow = () => {
    addLog('Dispatching WINDOW:CREATE action');
    dispatch('WINDOW:CREATE');
  };

  // Increment counter using dispatch
  const incrementCounter = () => {
    addLog('Dispatching COUNTER:INCREMENT action');
    dispatch('COUNTER:INCREMENT');
  };

  // Decrement counter using dispatch
  const decrementCounter = () => {
    addLog('Dispatching COUNTER:DECREMENT action');
    dispatch('COUNTER:DECREMENT');
  };

  // Format update metadata
  const formattedUpdateInfo = () => {
    if (!updateMeta) return 'No update info';

    const time = updateMeta.timestamp ? new Date(updateMeta.timestamp).toLocaleTimeString() : 'unknown';

    return `Update #${updateMeta.updateId || 'unknown'} at ${time} from ${updateMeta.sourceWindow || 'unknown'}`;
  };

  // Determine if the close button should be shown based only on window type
  const showCloseButton = !isMainWindow;

  return (
    <main>
      <div className="window-info">
        {isMainWindow ? (
          <div className="main-window-label">Main Window</div>
        ) : (
          <div className="child-window-label">Window: {windowLabel}</div>
        )}
      </div>

      <div style={{ height: '30px' }}></div>

      <div className="counter-display">
        <button type="button" onClick={decrementCounter}>
          decrement
        </button>
        <div className="counter-value">
          <pre>{counter}</pre>
          <div className="timestamp">Last update: {lastUpdate}</div>
          {updateMeta && <div className="update-metadata">{formattedUpdateInfo()}</div>}
        </div>
        <button type="button" onClick={incrementCounter}>
          increment
        </button>
      </div>

      <div className="flex-spacer" style={{ flex: 1 }}></div>

      <div className="button-container">
        <button type="button" onClick={createNewWindow}>
          create window
        </button>

        {showCloseButton && (
          <button type="button" onClick={closeThisWindow}>
            close window
          </button>
        )}
      </div>

      <div className="logs-container">
        <h4>Recent Events:</h4>
        <div className="logs">
          {logs.map((log, index) => (
            <div key={index} className="log-entry">
              {log}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
};
