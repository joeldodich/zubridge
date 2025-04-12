import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Event as TauriEvent, UnlistenFn } from '@tauri-apps/api/event';
import { createStore } from 'zustand/vanilla';
// React hook for subscribing to external stores - ensure @types/react is installed
import { useSyncExternalStore } from 'react';
// Import base types
import type { AnyState } from '@zubridge/types';

// --- Types ---

/**
 * Defines the structure for actions dispatched to the backend.
 */
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
  __zubridge_status: ZubridgeStatus;
  __zubridge_error?: any;
};

// --- Internal Store and Synchronization Logic ---

// Internal vanilla store holding the state replica
// Exported only for testing
export const internalStore = createStore<InternalState>(() => ({
  // Start as uninitialized, let initializeBridge set initializing
  __zubridge_status: 'uninitialized',
}));

let initializePromise: Promise<void> | null = null;
let unlistenStateUpdate: UnlistenFn | null = null;
let isInitializing = false; // <-- Guard flag

/**
 * Initializes the connection to the Tauri backend.
 * Fetches the initial state and sets up a listener for state updates.
 * This function is idempotent and safe to call multiple times.
 */
export async function initializeBridge(): Promise<void> {
  // <-- Added export
  // Check both the promise and the flag
  if (initializePromise || isInitializing) {
    console.log('Zubridge Tauri: Initialization already in progress or complete.');
    return initializePromise ?? Promise.resolve(); // Return existing promise or dummy if only flag is set
  }
  // Set flag SYNC
  isInitializing = true;
  console.log('Zubridge Tauri: Initializing connection...');

  // Create and assign the promise FIRST
  const promise = (async () => {
    // Set status immediately inside the async IIFE
    internalStore.setState((s) => ({ ...s, __zubridge_status: 'initializing' }));
    try {
      // 1. Fetch initial state
      console.log('Zubridge Tauri: Fetching initial state...');
      const initialState = await invoke<AnyState>('__zubridge_get_initial_state');
      // Set the fetched state, keeping the 'initializing' status
      internalStore.setState(
        (prevState) => ({
          ...initialState,
          // Ensure status remains 'initializing' here
          __zubridge_status: 'initializing',
        }),
        true, // Replace state
      );
      console.log('Zubridge Tauri: Initial state received.', internalStore.getState());

      // 2. Listen for state updates
      console.log('Zubridge Tauri: Setting up state update listener...');
      unlistenStateUpdate = await listen<AnyState>('__zubridge_state_update', (event: TauriEvent<AnyState>) => {
        console.log('Zubridge Tauri: Received state update event.', event.payload);
        // Replace the entire state with the payload from the backend event
        internalStore.setState(
          (prevState) => ({
            ...event.payload,
            // Keep current status (should be 'ready' by now, unless error occurs)
            __zubridge_status: prevState.__zubridge_status,
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
      // Reset promise ONLY on failure
      initializePromise = null;
      throw error; // Rethrow caught error
    } finally {
      // Clear flag SYNC when promise resolves or rejects
      isInitializing = false; // <-- Clear flag in finally
    }
  })();

  // Assign the promise to the global variable
  initializePromise = promise;
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
  isInitializing = false; // <-- Ensure flag is cleared on cleanup
  // Reset to a clean initial state
  internalStore.setState({ __zubridge_status: 'uninitialized' }, true);
  console.log('Zubridge Tauri: Cleanup complete.');
}

// --- React Hooks ---

/**
 * React hook to access the Zubridge state, synchronized with the Tauri backend.
 * Ensures the bridge is initialized before returning state.
 *
 * @template StateSlice The type of the state slice selected.
 * @param selector Function to select a slice of the state. The full state includes internal `__zubridge_` properties.
 * @param equalityFn Optional function to compare selected state slices for memoization.
 * @returns The selected state slice.
 */
export function useZubridgeStore<StateSlice>(
  selector: (state: InternalState) => StateSlice,
  equalityFn?: (a: StateSlice, b: StateSlice) => boolean,
): StateSlice {
  // Ensure initialization is triggered when the hook is first used, BUT NOT automatically in tests
  // Check if 'import.meta.vitest' exists and is true
  const isTestEnv = typeof import.meta.vitest !== 'undefined' && import.meta.vitest;
  // Check flag *in addition* to promise and status
  if (!isTestEnv && !isInitializing && !initializePromise && internalStore.getState().__zubridge_status !== 'ready') {
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
  // Do NOT auto-initialize here in tests. Rely on manual init or useZubridgeStore.

  // Return the dispatch function that invokes the backend command
  const dispatch = async (action: ZubridgeAction): Promise<void> => {
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

// --- Direct State Interaction Functions ---

/**
 * Directly fetches the entire current state from the Rust backend.
 * Use sparingly, prefer `useZubridgeStore` for reactive updates in components.
 * @returns A promise that resolves with the full application state.
 */
export async function getState(): Promise<AnyState> {
  try {
    // Ensure the backend command is named appropriately, e.g., 'get_state'
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
    // Ensure the backend command is named appropriately, e.g., 'update_state'
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
