// @ts-ignore: React is used for JSX
import React from 'react';
import { useState, useEffect } from 'react';
import './styles/runtime-window.css'; // Reuse runtime styles for now
import type { State } from '../types/state.js'; // Import State type
import type { AnyState } from '@zubridge/types'; // <-- Import AnyState

// Define props expected from AppWrapper
interface SecondaryAppProps {
  modeName: string;
  windowId: number;
}

export function SecondaryApp({ modeName, windowId }: SecondaryAppProps) {
  const [count, setCount] = useState(0);

  // Dispatch functions (similar to RuntimeApp)
  const incrementCounter = () => {
    try {
      window.zubridge.dispatch('COUNTER:INCREMENT');
    } catch (error) {
      console.error('Error dispatching increment action:', error);
    }
  };

  const decrementCounter = () => {
    try {
      window.zubridge.dispatch('COUNTER:DECREMENT');
    } catch (error) {
      console.error('Error dispatching decrement action:', error);
    }
  };

  const createWindow = async () => {
    try {
      console.log(`[SecondaryApp ${windowId}] Requesting new runtime window...`);
      // Use the RENAMED API
      const result = await window.electronAPI?.createRuntimeWindow();
      if (result?.success) {
        console.log(`[SecondaryApp ${windowId}] Runtime window created successfully (ID: ${result.windowId}).`);
      } else {
        console.error(`[SecondaryApp ${windowId}] Failed to create runtime window.`);
      }
    } catch (error) {
      console.error(`[SecondaryApp ${windowId}] Error requesting runtime window:`, error);
    }
  };

  const closeWindow = () => {
    try {
      // Use the RENAMED API
      window.electronAPI?.closeCurrentWindow();
    } catch (error) {
      console.error('Error closing window:', error);
    }
  };

  // Subscribe to state changes (similar to RuntimeApp)
  useEffect(() => {
    const fetchInitialState = async () => {
      try {
        const initialState = await window.zubridge.getState();
        if (typeof initialState.counter === 'number') {
          setCount(initialState.counter);
        }
      } catch (error) {
        console.error('Error fetching initial state:', error);
      }
    };

    fetchInitialState();

    const unsubscribe = window.zubridge.subscribe((state: AnyState) => {
      if (typeof (state as State)?.counter === 'number') {
        setCount((state as State).counter);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="app-container runtime-window">
      {' '}
      {/* Reuse styles */}
      <div className="fixed-header">
        Secondary Window - {modeName} (ID: <span className="window-id">{windowId}</span>)
      </div>
      <div className="content">
        <div className="counter-section">
          <h2>Counter: {count}</h2>
          <div className="button-group">
            <button onClick={decrementCounter}>-</button>
            <button onClick={incrementCounter}>+</button>
          </div>
        </div>

        <div className="window-section">
          <div className="button-group window-button-group">
            <button onClick={createWindow}>Create Window</button>
            <button onClick={closeWindow} className="close-button">
              Close Window
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
