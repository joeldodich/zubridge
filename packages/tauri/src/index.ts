// import { invoke } from '@tauri-apps/api/tauri';
// import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
// Import InvokeArgs for type definition
// import type { InvokeArgs } from '@tauri-apps/api/tauri';
// import type { EventName, EventCallback } from '@tauri-apps/api/event';
import { createStore } from 'zustand/vanilla';
// React hook for subscribing to external stores - ensure @types/react is installed
import { useSyncExternalStore } from 'react';
// Import base types
import type { AnyState } from '@zubridge/types';

// Add type declaration reference if vite-env.d.ts is used
/// <reference types="./vite-env" />

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

// Add options interface with more generic function types
export interface ZubridgeTauriOptions {
  invoke: (cmd: string, args?: any) => Promise<any>; // Use any for args
  listen: (event: string, handler: (event: any) => void) => Promise<UnlistenFn>; // Use any for event, string for name
}

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

// Module-level variables to hold the provided functions
let providedInvoke: ZubridgeTauriOptions['invoke'] | null = null;
let providedListen: ZubridgeTauriOptions['listen'] | null = null;

/**
 * Initializes the connection to the Tauri backend.
 * Fetches the initial state and sets up a listener for state updates.
 * This function is idempotent and safe to call multiple times.
 */
// Modify initializeBridge to accept options
export async function initializeBridge(options?: ZubridgeTauriOptions): Promise<void> {
  // Validate options - Ensure both invoke and listen are required again
  if (!options?.invoke || !options?.listen) {
    initializePromise = null;
    isInitializing = false;
    throw new Error("Zubridge Tauri: 'invoke' AND 'listen' functions must be provided in options.");
  }
  // Store functions if not initializing
  if (!isInitializing) {
    if (!providedInvoke) providedInvoke = options.invoke;
    if (!providedListen) providedListen = options.listen;
  }

  if (initializePromise || isInitializing) {
    return initializePromise ?? Promise.resolve();
  }

  // Ensure we have functions before proceeding
  if (!providedInvoke || !providedListen) {
    isInitializing = false;
    throw new Error("Zubridge Tauri: Stored 'invoke' or 'listen' function is missing unexpectedly.");
  }

  isInitializing = true;
  const currentInvoke = providedInvoke;
  const currentListen = providedListen; // Capture listen again

  const promise = (async () => {
    internalStore.setState((s) => ({ ...s, __zubridge_status: 'initializing' }));
    try {
      // Use the provided invoke function
      const initialState = await currentInvoke('__zubridge_get_initial_state');
      internalStore.setState(
        (prevState) => ({
          ...initialState,
          __zubridge_status: 'initializing',
        }),
        true, // Replace state
      );

      // --- UNCOMMENT and use currentListen ---
      console.log('Zubridge Tauri: Setting up state update listener...'); // Add log
      unlistenStateUpdate = await currentListen('__zubridge_state_update', (event) => {
        console.log('Zubridge Tauri: Received state update event.', event.payload); // Add log
        internalStore.setState(
          (prevState) => ({
            ...event.payload,
            __zubridge_status: prevState.__zubridge_status, // Keep status
          }),
          true, // Replace state
        );
      });
      console.log('Zubridge Tauri: State update listener active.'); // Add log
      // --- End uncomment ---

      // Set status to ready NOW THAT LISTENER IS ACTIVE
      internalStore.setState((s) => ({ ...s, __zubridge_status: 'ready' }));
      console.log('Zubridge Tauri: Initialization successful.'); // Update log
    } catch (error) {
      console.error('Zubridge Tauri: Initialization failed!', error);
      // Clean up listener if partially set up
      if (unlistenStateUpdate) {
        unlistenStateUpdate();
        unlistenStateUpdate = null;
      }
      initializePromise = null;
      internalStore.setState(
        (s) => ({
          ...s,
          __zubridge_status: 'error',
          __zubridge_error: error,
        }),
        true, // Replace state
      );
      throw error;
    } finally {
      isInitializing = false;
    }
  })();

  initializePromise = promise;
  return initializePromise;
}

/**
 * Cleans up the Tauri event listener and resets the internal state.
 * Useful for testing or specific teardown scenarios.
 */
export function cleanupZubridge(): void {
  if (unlistenStateUpdate) {
    // console.log('Zubridge Tauri: Cleaning up state listener.');
    unlistenStateUpdate();
    unlistenStateUpdate = null;
  }
  initializePromise = null;
  isInitializing = false; // <-- Ensure flag is cleared on cleanup
  // Reset to a clean initial state
  internalStore.setState({ __zubridge_status: 'uninitialized' }, true);
  providedInvoke = null;
  providedListen = null; // Clear listen
  // console.log('Zubridge Tauri: Cleanup complete.');
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
  const dispatch = async (action: ZubridgeAction): Promise<void> => {
    // Ensure invoke was provided during initialization
    if (!providedInvoke) {
      console.error('Zubridge Tauri: Dispatch failed. Bridge not initialized with invoke function.');
      throw new Error('Zubridge is not initialized (missing invoke function).');
    }
    const currentInvoke = providedInvoke; // Capture for async use

    let status = internalStore.getState().__zubridge_status;

    // If not ready, wait for initialization to complete (if it's in progress)
    if (status !== 'ready') {
      if (initializePromise) {
        console.log(`Zubridge Tauri: Dispatch waiting for initialization (${status})...`);
        try {
          await initializePromise;
          status = internalStore.getState().__zubridge_status; // Re-check status after waiting
          if (status !== 'ready') {
            // Initialization finished but resulted in an error or unexpected state
            const error = internalStore.getState().__zubridge_error;
            console.error(
              `Zubridge Tauri: Initialization finished with status '${status}'. Cannot dispatch. Error:`,
              error,
            );
            throw new Error(`Zubridge initialization failed with status: ${status}`);
          }
          console.log(`Zubridge Tauri: Initialization complete, proceeding with dispatch.`);
        } catch (initError) {
          console.error(
            `Zubridge Tauri: Initialization failed while waiting in dispatch. Cannot dispatch. Error:`,
            initError,
          );
          throw initError; // Re-throw the initialization error
        }
      } else {
        // Not ready and no initialization promise exists (shouldn't happen if initializeBridge was called)
        console.error(
          `Zubridge Tauri: Dispatch called while status is '${status}' and initialization promise is missing. Cannot dispatch. Action:`,
          action,
        );
        throw new Error(`Zubridge is not initialized and initialization is not in progress.`);
      }
    }

    // Original dispatch logic
    try {
      // Use the provided invoke function
      await currentInvoke('__zubridge_dispatch_action', { action });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `[useZubridgeDispatch] Error invoking __zubridge_dispatch_action for ${action.type}:`,
        errorMessage,
        error,
      );
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
  if (!providedInvoke) throw new Error('Zubridge not initialized.');
  try {
    const response = await providedInvoke('get_state');
    return (response as { value: AnyState }).value;
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
  if (!providedInvoke) throw new Error('Zubridge not initialized.');
  try {
    await providedInvoke('update_state', { state: { value: state } });
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
