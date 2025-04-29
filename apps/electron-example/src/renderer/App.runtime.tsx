// @ts-ignore: React is used for JSX
import React from 'react';
import { useEffect } from 'react';
import { useDispatch } from '@zubridge/electron';
import { useStore } from './hooks/useStore';
import { Counter, ThemeToggle, WindowDisplay, WindowActions } from '@zubridge/ui';
import './styles/index.css';

interface RuntimeAppProps {
  modeName: string;
  windowId: number;
}

interface CounterObject {
  value: number;
}

export function RuntimeApp({ modeName, windowId }: RuntimeAppProps) {
  const dispatch = useDispatch();

  // Get counter value from store
  const counter = useStore((state) => {
    // Handle both number and object formats
    const counterValue = state.counter as number | CounterObject | undefined;

    if (counterValue && typeof counterValue === 'object' && 'value' in counterValue) {
      console.log(`[Runtime ${windowId}] Counter is an object with value property:`, counterValue);
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

  const incrementCounter = () => {
    try {
      console.log(`[Runtime ${windowId}] Dispatching COUNTER:INCREMENT action`);
      dispatch('COUNTER:INCREMENT');
    } catch (error) {
      console.error('Error dispatching increment action:', error);
    }
  };

  const decrementCounter = () => {
    try {
      console.log(`[Runtime ${windowId}] Dispatching COUNTER:DECREMENT action`);
      dispatch('COUNTER:DECREMENT');
    } catch (error) {
      console.error('Error dispatching decrement action:', error);
    }
  };

  const resetCounter = () => {
    try {
      console.log(`[Runtime ${windowId}] Dispatching COUNTER:RESET action`);
      dispatch('COUNTER:RESET');
    } catch (error) {
      console.error('Error dispatching reset action:', error);
    }
  };

  const doubleCounterThunk = () => {
    try {
      console.log(`[Runtime ${windowId}] Dispatching double counter thunk`);
      dispatch((getState, dispatch) => {
        const currentState = getState();
        console.log(`[Runtime ${windowId}] Thunk getState result:`, currentState);

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

        console.log(`[Runtime ${windowId}] Thunk: Doubling counter from ${currentValue} to ${currentValue * 2}`);
        dispatch('COUNTER:SET', currentValue * 2);
      });
    } catch (error) {
      console.error('Error dispatching double counter thunk:', error);
    }
  };

  const doubleCounterAction = () => {
    try {
      // Handle both number and object formats
      let currentValue = 0;

      if (counter !== undefined) {
        if (typeof counter === 'object' && counter !== null && 'value' in counter) {
          const counterObj = counter as CounterObject;
          currentValue = counterObj.value;
        } else if (typeof counter === 'number') {
          currentValue = counter;
        }
      }

      console.log(`[Runtime ${windowId}] Action Object: Doubling counter from ${currentValue} to ${currentValue * 2}`);
      dispatch({ type: 'COUNTER:SET', payload: currentValue * 2 });
    } catch (error) {
      console.error('Error dispatching double counter action:', error);
    }
  };

  const toggleTheme = () => {
    try {
      console.log(`[Runtime ${windowId}] Dispatching THEME:TOGGLE action`);
      dispatch('THEME:TOGGLE');
    } catch (error) {
      console.error('Error dispatching theme toggle action:', error);
    }
  };

  const createWindow = async () => {
    try {
      console.log(`[Runtime ${windowId}] Requesting new runtime window...`);
      const result = await window.electronAPI?.createRuntimeWindow();
      if (result?.success) {
        console.log(`[Runtime ${windowId}] Runtime window created successfully (ID: ${result.windowId}).`);
      } else {
        console.error(`[Runtime ${windowId}] Failed to create runtime window.`);
      }
    } catch (error) {
      console.error(`[Runtime ${windowId}] Error requesting runtime window:`, error);
    }
  };

  const closeWindow = () => {
    try {
      window.electronAPI?.closeCurrentWindow();
    } catch (error) {
      console.error('Error closing window:', error);
    }
  };

  // Apply theme based on state
  useEffect(() => {
    // Remove both theme classes first
    document.body.classList.remove('dark-theme', 'light-theme');

    // Add the appropriate theme class
    if (isDarkMode) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.add('light-theme');
    }

    console.log(`[Runtime ${windowId}] Theme set to ${isDarkMode ? 'dark' : 'light'} mode`);
  }, [isDarkMode, windowId]);

  // Format counter for display
  const displayCounter =
    typeof counter === 'object' && counter !== null && 'value' in counter ? (counter as CounterObject).value : counter;

  return (
    <WindowDisplay
      windowId={windowId}
      windowTitle="Runtime Window"
      mode={modeName}
      bridgeStatus={bridgeStatus as 'ready' | 'error' | 'initializing'}
      isRuntimeWindow={true}
    >
      <Counter
        value={displayCounter as number}
        onIncrement={incrementCounter}
        onDecrement={decrementCounter}
        onDouble={(method) => (method === 'thunk' ? doubleCounterThunk() : doubleCounterAction())}
        onReset={resetCounter}
        isLoading={bridgeStatus === 'initializing'}
      />

      <div className="theme-section">
        <ThemeToggle theme={isDarkMode ? 'dark' : 'light'} onToggle={toggleTheme} />

        <WindowActions onCreateWindow={createWindow} onCloseWindow={closeWindow} isMainWindow={false} />
      </div>
    </WindowDisplay>
  );
}
