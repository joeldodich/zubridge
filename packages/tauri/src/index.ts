import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Event as TauriEvent, UnlistenFn } from '@tauri-apps/api/event';
import { createStore } from 'zustand/vanilla';
// React hook for subscribing to external stores - ensure @types/react is installed
import { useSyncExternalStore } from 'react';
// Import base types
import type { AnyState } from '@zubridge/types';

// --- Types ---\n\n/**\n * Defines the structure for actions dispatched to the backend.\n */
export type ZubridgeAction = {
  type: string;
  payload?: any; // Corresponds to Rust's serde_json::Value
};

/**
 * Represents the possible status of the bridge connection.
 */
type ZubridgeStatus = 'initializing' | 'ready' | 'error' | 'uninitialized';

/**
 * Extends the user's state with internal Zubridge status properties.
 * Exported for testing purposes.
 */
export type InternalState = AnyState & {
  // <-- Added export
  __zubridge_status: ZubridgeStatus;
  __zubridge_error?: any;
};

// --- Internal Store and Synchronization Logic ---\n\n// Internal vanilla store holding the state replica
// Exported only for testing (e.g., checking status after cleanup)
export const internalStore = createStore<InternalState>(() => ({
  // <-- Added export
  __zubridge_status: 'initializing',
}));

let initializePromise: Promise<void> | null = null;
let unlistenStateUpdate: UnlistenFn | null = null;

/**
 * Initializes the connection to the Tauri backend.
 * Fetches the initial state and sets up a listener for state updates.
 * This function is idempotent and safe to call multiple times.
 */
async function initializeBridge(): Promise<void> {
  if (initializePromise) {
    return initializePromise; // Already initializing or initialized
  }
  console.log('Zubridge Tauri: Initializing connection...');

  initializePromise = (async () => {
    try {
      // 1. Fetch initial state
      internalStore.setState((s) => ({ ...s, __zubridge_status: 'initializing' }));
      console.log('Zubridge Tauri: Fetching initial state...');
      // Note: The backend command needs to return the *entire* state object
      const initialState = await invoke<AnyState>('__zubridge_get_initial_state');
      // Set the fetched state, keeping the status
      internalStore.setState(
        (prevState) => ({
          ...initialState,
          __zubridge_status: prevState.__zubridge_status, // Keep status from before fetch potentially
        }),
        true, // Replace state
      );
      console.log('Zubridge Tauri: Initial state received.', internalStore.getState());

      // 2. Listen for state updates
      console.log('Zubridge Tauri: Setting up state update listener...');
      unlistenStateUpdate = await listen<AnyState>('__zubridge_state_update', (event: TauriEvent<AnyState>) => {
        console.log('Zubridge Tauri: Received state update event.', event.payload);
        // Replace the entire state with the payload from the backend event
        // Assume the backend sends the full state on each update
        internalStore.setState(
          (prevState) => ({
            ...event.payload,
            __zubridge_status: prevState.__zubridge_status, // Keep current status
          }),
          true, // Replace state
        );
      });
      console.log('Zubridge Tauri: State update listener active.');

      // 3. Update status to ready
      internalStore.setState((s) => ({ ...s, __zubridge_status: 'ready' }));
      console.log('Zubridge Tauri: Initialization successful.');
    } catch (error) {
      console.error('Zubridge Tauri: Initialization failed!', error);
      internalStore.setState(
        (s) => ({
          ...s,
          __zubridge_status: 'error',
          __zubridge_error: error,
        }),
        true, // Replace state
      );
      // Clean up listener if partially set up
      if (unlistenStateUpdate) {
        unlistenStateUpdate();
        unlistenStateUpdate = null;
      }
      // Reset promise so init can be retried
      initializePromise = null;
      // Rethrow or handle as appropriate for your lib's error strategy
      throw error;
    }
  })();

  return initializePromise;
}

/**
 * Cleans up the Tauri event listener and resets the internal state.
 * Useful for testing or specific teardown scenarios.
 */
export function cleanupZubridge(): void {
  if (unlistenStateUpdate) {
    console.log('Zubridge Tauri: Cleaning up state listener.');
    unlistenStateUpdate();
    unlistenStateUpdate = null;
  }
  initializePromise = null;
  // Reset to a clean initial state
  internalStore.setState({ __zubridge_status: 'uninitialized' }, true);
  console.log('Zubridge Tauri: Cleanup complete.');
}

// --- React Hooks ---\n\n/**\n * React hook to access the Zubridge state, synchronized with the Tauri backend.\n * Ensures the bridge is initialized before returning state.\n *\n * @template StateSlice The type of the state slice selected.\n * @param selector Function to select a slice of the state. The full state includes internal `__zubridge_` properties.\n * @param equalityFn Optional function to compare selected state slices for memoization.\n * @returns The selected state slice.\n */
export function useZubridgeStore<StateSlice>(
  selector: (state: InternalState) => StateSlice,
  equalityFn?: (a: StateSlice, b: StateSlice) => boolean,
): StateSlice {
  // Ensure initialization is triggered when the hook is first used
  // We don't await here, the hook will re-render once state changes
  if (!initializePromise && internalStore.getState().__zubridge_status !== 'ready') {
    initializeBridge().catch((err) => {
      // Errors are logged within initializeBridge and status is set
      console.error('Zubridge initialization error during hook usage:', err);
    });
  }

  // Use useSyncExternalStore for safe subscription to the vanilla store
  const slice = useSyncExternalStore(
    internalStore.subscribe,
    () => selector(internalStore.getState()),
    () => selector(internalStore.getState()), // SSR/initial snapshot
  );

  // Note: React's default shallow equality check works well with useSyncExternalStore
  // If a custom equalityFn is provided, React uses it. No extra implementation needed here.
  if (equalityFn) {
    // Just acknowledging it's used by useSyncExternalStore
  }

  return slice;
}

/**
 * React hook to get the dispatch function for sending actions to the Tauri backend.
 *
 * @returns Dispatch function `(action: ZubridgeAction) => Promise<void>`
 */
export function useZubridgeDispatch(): (action: ZubridgeAction) => Promise<void> {
  // Ensure initialization is triggered (dispatch might be called before store access)
  if (!initializePromise && internalStore.getState().__zubridge_status !== 'ready') {
    initializeBridge().catch((err) => {
      console.error('Zubridge initialization error during dispatch usage:', err);
    });
  }

  // Return the dispatch function that invokes the backend command
  const dispatch = async (action: ZubridgeAction): Promise<void> => {
    // Optional: Wait for initialization before dispatching? Or let it potentially fail?
    // await initializeBridge(); // Could add this, but might delay dispatch unnecessarily if already ready.

    const status = internalStore.getState().__zubridge_status;
    if (status !== 'ready') {
      console.warn(
        `Zubridge Tauri: Dispatch called while status is '${status}'. Action may fail if backend is not ready. Action:`,
        action,
      );
      // Optionally throw an error or wait for 'ready' status here
    }

    try {
      console.log('Zubridge Tauri: Dispatching action ->', action);
      // The backend command expects the action object directly under the 'action' key
      await invoke('__zubridge_dispatch_action', { action });
      console.log('Zubridge Tauri: Dispatch action invoked successfully.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Zubridge Tauri: Error dispatching action ${action.type}:`, errorMessage, error);
      // Rethrow or handle error as needed by the application
      throw error;
    }
  };

  return dispatch;
}

// --- Direct State Interaction Functions ---\n\n/**\n * Directly fetches the entire current state from the Rust backend.\n * Use sparingly, prefer `useZubridgeStore` for reactive updates in components.\n * @returns A promise that resolves with the full application state.\n */
export async function getState(): Promise<AnyState> {
  try {
    // Ensure the backend command is named appropriately, e.g., \'get_state\'
    // and returns the state object, potentially nested e.g. { value: ... }
    const response = await invoke<{ value: AnyState }>('get_state');
    return response.value;
  } catch (error) {
    console.error('Zubridge Tauri: Failed to get state directly:', error);
    throw error;
  }
}

/**
 * Directly updates the entire state in the Rust backend.
 * Use with caution, as this bypasses the action dispatch flow and might
 * overwrite state unexpectedly if not coordinated properly.
 * @param state The complete state object to set in the backend.
 * @returns A promise that resolves when the update command completes.
 */
export async function updateState(state: AnyState): Promise<void> {
  try {
    // Ensure the backend command is named appropriately, e.g., \'update_state\'
    // and accepts the state object, potentially nested e.g. { state: { value: ... } }
    await invoke('update_state', { state: { value: state } });
  } catch (error) {
    console.error('Zubridge Tauri: Failed to update state directly:', error);
    throw error;
  }
}

// Optional: Re-export base types if needed by consumers
export type { AnyState };

// Initialize automatically when the module loads?
// Generally better to let the first hook usage trigger it.
// initializeBridge();
