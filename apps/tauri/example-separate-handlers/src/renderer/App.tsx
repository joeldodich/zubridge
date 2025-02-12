import React from 'react';
import { useDispatch } from 'zubridge-tauri';
import { useStore, handlers } from './hooks/useStore.js';
import type { State } from '../features/index.js';

export const App: React.FC = () => {
  console.log('App component rendering');
  const counter = useStore((x: State) => {
    console.log('App component useStore state:', x);
    console.log('App component useStore counter:', x.counter);
    return x.counter;
  });
  const dispatch = useDispatch(handlers);

  console.log('App component rendered', counter, typeof counter);

  // Show loading state when counter is undefined
  if (typeof counter === 'undefined') {
    return <main>Loading...</main>;
  }

  return (
    <main>
      <button type="button" onClick={() => dispatch('COUNTER:DECREMENT')}>
        decrement
      </button>
      <pre>{counter}</pre>
      <button type="button" onClick={() => dispatch('COUNTER:INCREMENT')}>
        increment
      </button>
    </main>
  );
};
