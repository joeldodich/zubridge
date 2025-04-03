import React, { useEffect, useState } from 'react';
import { useDispatch } from '@zubridge/tauri';
import { useStore } from './hooks/useStore.js';
import type { State } from '../features/index.js';

export const App: React.FC = () => {
  console.log('App component rendering');
  const [isMainWindow, setIsMainWindow] = useState<boolean>(true);

  useEffect(() => {
    const checkWindow = async () => {
      try {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const currentWindow = getCurrentWebviewWindow();
        setIsMainWindow(currentWindow.label === 'main');
      } catch (error) {
        console.error('Error checking window:', error);
      }
    };

    checkWindow();
  }, []);

  // With our modified useStore, selectors are automatically memoized
  const { counter } = useStore((x: State) => ({
    counter: x.counter,
    window: x.window,
  }));
  const dispatch = useDispatch();

  console.log('App component rendered', counter, typeof counter);

  // Show loading state when counter is undefined
  if (typeof counter === 'undefined') {
    return <main>Loading...</main>;
  }

  const handleCreateWindow = () => {
    dispatch('WINDOW:CREATE');
  };

  const handleCloseWindow = () => {
    dispatch('WINDOW:CLOSE');
  };

  return (
    <main>
      <div className="counter-controls">
        <button type="button" onClick={() => dispatch('COUNTER:DECREMENT')}>
          decrement
        </button>
        <pre>{counter}</pre>
        <button type="button" onClick={() => dispatch('COUNTER:INCREMENT')}>
          increment
        </button>
      </div>

      <div className="window-controls">
        {isMainWindow ? (
          <button type="button" onClick={handleCreateWindow}>
            Create Window
          </button>
        ) : (
          <button type="button" onClick={handleCloseWindow}>
            Close Window
          </button>
        )}
      </div>
    </main>
  );
};
