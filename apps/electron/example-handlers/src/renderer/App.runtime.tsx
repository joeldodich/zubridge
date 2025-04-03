import { createUseStore, useDispatch } from '@zubridge/electron';
import type { State } from '../features';

// Create a shared store hook for the runtime window
const useStore = createUseStore<State>();

export const RuntimeApp = () => {
  // Create the dispatch function
  const dispatch = useDispatch<State>();

  // Access the counter from the store
  const counter = useStore((state) => state.counter);

  // Handle window closing
  const closeWindow = () => {
    if (window.electron) {
      window.electron.closeCurrentWindow();
    }
  };

  return (
    <main className="runtime-window">
      <h2>Runtime Window</h2>

      <div className="counter-display">
        <button type="button" onClick={() => dispatch('COUNTER:DECREMENT')}>
          decrement
        </button>
        <pre>{counter}</pre>
        <button type="button" onClick={() => dispatch('COUNTER:INCREMENT')}>
          increment
        </button>
      </div>

      <div className="button-container">
        <button type="button" onClick={closeWindow}>
          close window
        </button>
      </div>
    </main>
  );
};
