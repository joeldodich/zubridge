import { useDispatch } from '@zubridge/electron';
import { useState, useEffect } from 'react';

import { useStore } from './hooks/useStore.js';
import type { State } from '../features/index.js';

// Declare the electron interface
declare global {
  interface Window {
    electron: {
      closeCurrentWindow: () => void;
      isMainWindow: () => Promise<boolean>;
    };
  }
}

export const App = () => {
  const counter = useStore((state) => state.counter);
  const dispatch = useDispatch<State>();
  const [isMainWindow, setIsMainWindow] = useState<boolean | null>(null);

  // Check if this is the main window when component mounts
  useEffect(() => {
    const checkMainWindow = async () => {
      if (window.electron?.isMainWindow) {
        try {
          const isMain = await window.electron.isMainWindow();
          setIsMainWindow(isMain);
        } catch (error) {
          console.error('Error checking if main window:', error);
        }
      }
    };

    checkMainWindow();
  }, []);

  // Show loading state when counter is undefined
  if (counter === undefined) {
    return <main>Loading...</main>;
  }

  // Use the direct window closing method for simplicity
  const closeThisWindow = () => {
    if (window.electron) {
      window.electron.closeCurrentWindow();
    }
  };

  // Determine if the close button should be shown based only on window type
  const showCloseButton = !isMainWindow;

  return (
    <main>
      <div style={{ height: '30px' }}></div>

      <div className="counter-display">
        <button type="button" onClick={() => dispatch('COUNTER:DECREMENT')}>
          decrement
        </button>
        <pre>{counter}</pre>
        <button type="button" onClick={() => dispatch('COUNTER:INCREMENT')}>
          increment
        </button>
      </div>

      <div className="flex-spacer" style={{ flex: 1 }}></div>

      <div className="button-container">
        <button type="button" onClick={() => dispatch('WINDOW:CREATE')}>
          create window
        </button>

        {showCloseButton && (
          <button type="button" onClick={closeThisWindow}>
            close window
          </button>
        )}
      </div>

      <div style={{ height: '30px' }}></div>
    </main>
  );
};
