// @ts-ignore: React is used for JSX
import React from 'react';
import { useState, useEffect } from 'react';
import './styles/runtime-window.css';
import type { State } from '../types/index.js';
import type { AnyState } from '@zubridge/types';

interface RuntimeAppProps {
  modeName: string;
  windowId: number;
}

export function RuntimeApp({ modeName, windowId }: RuntimeAppProps) {
  const [count, setCount] = useState(0);

  const incrementCounter = () => {
    try {
      console.log(`[Runtime ${windowId}] Dispatching COUNTER:INCREMENT action`);
      window.zubridge.dispatch('COUNTER:INCREMENT');
    } catch (error) {
      console.error('Error dispatching increment action:', error);
    }
  };

  const decrementCounter = () => {
    try {
      console.log(`[Runtime ${windowId}] Dispatching COUNTER:DECREMENT action`);
      window.zubridge.dispatch('COUNTER:DECREMENT');
    } catch (error) {
      console.error('Error dispatching decrement action:', error);
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

  // Subscribe to state changes with proper cleanup
  useEffect(() => {
    // Immediately fetch current state on mount
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

    // Set up the subscription
    const unsubscribe = window.zubridge.subscribe((state: AnyState) => {
      if (typeof (state as State)?.counter === 'number') {
        setCount((state as State).counter);
      }
    });

    // Clean up the subscription when the component unmounts
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="app-container runtime-window">
      <div className="fixed-header">
        Runtime Window - {modeName} (ID: <span className="window-id">{windowId}</span>)
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
