// @ts-ignore: React is used for JSX transformation
import React from 'react';
import { useStore } from './hooks/useStore';
import { useDispatch } from '@zubridge/electron';
import { Counter, ThemeToggle, WindowDisplay, WindowActions } from '@zubridge/ui';
import './styles/index.css';

// Define props expected from AppWrapper
interface MainAppProps {
  windowId: number;
  modeName: string;
  windowType?: 'main' | 'directWebContents' | 'browserView' | 'webContentsView' | 'runtime'; // Add window type parameter
}

interface CounterObject {
  value: number;
}

export function MainApp({ windowId, modeName, windowType = 'main' }: MainAppProps) {
  const dispatch = useDispatch();

  // Get counter value from store
  const counter = useStore((state) => {
    console.log('[App.main] Reading counter from state:', state);

    // Handle both number and object formats
    const counterValue = state.counter as number | CounterObject | undefined;

    if (counterValue && typeof counterValue === 'object' && 'value' in counterValue) {
      console.log('[App.main] Counter is an object with value property:', counterValue);
      return counterValue.value;
    }

    return counterValue;
  });

  // Get theme value from store
  const isDarkMode = useStore((state) => {
    return state.theme?.isDark ?? false;
  });

  // Get bridge status
  const bridgeStatus = useStore((state) => state.__bridge_status || 'ready');

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

  // Log counter value when it changes
  React.useEffect(() => {
    console.log('[App.main] Counter value in component:', counter);
  }, [counter]);

  const handleIncrement = () => {
    console.log('[App.main] Handling increment');
    dispatch('COUNTER:INCREMENT');
  };

  const handleDecrement = () => {
    console.log('[App.main] Handling decrement');
    dispatch('COUNTER:DECREMENT');
  };

  const handleDoubleCounter = () => {
    console.log('[App.main] Handling double via thunk');
    // Use a thunk to get the current state and dispatch a new action
    dispatch((getState, dispatch) => {
      const currentState = getState();
      console.log('[App.main] Thunk getState result:', currentState);

      // Handle both number and object formats in the thunk
      let currentValue = 0;
      const counterValue = currentState.counter as number | CounterObject | undefined;

      if (counterValue) {
        if (typeof counterValue === 'object' && 'value' in counterValue) {
          currentValue = counterValue.value;
        } else if (typeof counterValue === 'number') {
          currentValue = counterValue;
        }
      }

      console.log(`[${windowType} ${windowId}] Thunk: Doubling counter from ${currentValue} to ${currentValue * 2}`);

      // Dispatch a special action to set the counter to double its current value
      dispatch('COUNTER:SET', currentValue * 2);
    });
  };

  const handleDoubleWithObject = () => {
    console.log('[App.main] Handling double via object');
    // Handle both number and object formats for double with object
    let currentValue = 0;

    if (counter !== undefined) {
      if (typeof counter === 'object' && counter !== null && 'value' in counter) {
        const counterObj = counter as CounterObject;
        currentValue = counterObj.value;
      } else if (typeof counter === 'number') {
        currentValue = counter;
      }
    }

    console.log(
      `[${windowType} ${windowId}] Action Object: Doubling counter from ${currentValue} to ${currentValue * 2}`,
    );

    // Dispatch an action object with type and payload
    dispatch({
      type: 'COUNTER:SET',
      payload: currentValue * 2,
    });
  };

  const handleResetCounter = () => {
    console.log('[App.main] Resetting counter');
    dispatch('COUNTER:RESET');
  };

  const handleToggleTheme = () => {
    console.log('[App.main] Toggling theme');
    dispatch('THEME:TOGGLE');
  };

  // Handle window creation
  const handleCreateWindow = async () => {
    try {
      console.log(`[${windowType} ${windowId}] Requesting new runtime window...`);
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

  // Handle quit app
  const handleQuitApp = () => {
    try {
      window.electronAPI?.quitApp();
    } catch (error) {
      console.error('Error quitting app:', error);
    }
  };

  // Handle close window
  const handleCloseWindow = () => {
    try {
      window.electronAPI?.closeCurrentWindow();
    } catch (error) {
      console.error('Error closing window:', error);
    }
  };

  // Format counter for display
  const displayCounter =
    typeof counter === 'object' && counter !== null && 'value' in counter ? (counter as CounterObject).value : counter;

  const isMainWindow = windowType === 'main';
  const windowTypeDisplay = windowType.charAt(0).toUpperCase() + windowType.slice(1);

  return (
    <WindowDisplay
      windowId={windowId}
      windowTitle={`${windowTypeDisplay} Window`}
      mode={modeName}
      bridgeStatus={bridgeStatus as 'ready' | 'error' | 'initializing'}
    >
      <Counter
        value={displayCounter as number}
        onIncrement={handleIncrement}
        onDecrement={handleDecrement}
        onDouble={(method) => (method === 'thunk' ? handleDoubleCounter() : handleDoubleWithObject())}
        onReset={handleResetCounter}
        isLoading={bridgeStatus === 'initializing'}
      />

      <div className="theme-section">
        <ThemeToggle theme={isDarkMode ? 'dark' : 'light'} onToggle={handleToggleTheme} />

        <WindowActions
          onCreateWindow={handleCreateWindow}
          onCloseWindow={handleCloseWindow}
          onQuitApp={handleQuitApp}
          isMainWindow={isMainWindow}
        />
      </div>
    </WindowDisplay>
  );
}
