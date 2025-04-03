import { emit, listen } from '@tauri-apps/api/event';
import type { StoreApi } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

import type { Action, AnyState, Handler, MainZustandBridgeOpts, Thunk } from '@zubridge/types';

export type MainZustandBridge = <State extends AnyState, Store extends StoreApi<State>>(
  store: Store,
  options?: MainZustandBridgeOpts<State>,
) => Promise<{
  unsubscribe: () => void;
  commands: Record<string, (...args: any[]) => Promise<unknown>>;
}>;

function sanitizeState(state: AnyState) {
  const safeState: Record<string, unknown> = {};

  for (const statePropName in state) {
    const stateProp = state[statePropName];
    if (typeof stateProp !== 'function') {
      safeState[statePropName] = stateProp;
    }
  }

  return safeState;
}

export const createDispatch =
  <State extends AnyState, Store extends StoreApi<State>>(store: Store, options?: MainZustandBridgeOpts<State>) =>
  (action: string | Action | Thunk<State>, payload?: unknown) => {
    const actionType = (action as Action).type || (action as string);
    const actionPayload = (action as Action).payload || payload;

    if (options?.handlers) {
      const handler = options.handlers[actionType];
      if (typeof handler === 'function') {
        handler(actionPayload);
      }
    } else if (typeof options?.reducer === 'function') {
      const reducer = options.reducer;
      const reducerAction = { type: actionType, payload: actionPayload };
      store.setState((state) => reducer(state, reducerAction));
    } else {
      const state = store.getState();
      const handler = state[actionType as keyof State] as Handler;
      if (typeof handler === 'function') {
        handler(actionPayload);
      }
    }
  };

// Helper to get all webview windows from the app
const getWebviewWindows = async (): Promise<{ [key: string]: any }> => {
  try {
    // Import API dynamically to avoid issues at initialization time
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    return WebviewWindow.getAll();
  } catch (error) {
    console.error('Bridge: Error getting webview windows:', error);
    return {};
  }
};

// Helper to broadcast state to all windows
const broadcastStateToAllWindows = async (state: Record<string, unknown>) => {
  try {
    const windows = await getWebviewWindows();
    const windowCount = Object.keys(windows).length;

    // Add a timestamp and unique ID to the state update
    const enhancedState = {
      ...state,
      __meta: {
        updateId: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        timestamp: Date.now(),
        sourceWindow: 'bridge',
      },
    };

    // First update the backend state
    console.log(
      `Bridge: Broadcasting state update #${enhancedState.__meta.updateId} to ${windowCount} windows:`,
      state,
    );

    await invoke('set_state', { state: enhancedState }).catch((error) => {
      console.error('Bridge: Error updating backend state:', error);
    });

    // Then broadcast to all windows directly
    if (windowCount > 0) {
      // Use direct emit to each window
      await emit('zubridge-tauri:state-update', enhancedState).catch((error) => {
        console.error('Bridge: Error broadcasting state update:', error);
      });
      console.log(
        `Bridge: State update #${enhancedState.__meta.updateId} broadcasted successfully to ${windowCount} windows`,
      );
    } else {
      console.log('Bridge: No windows to broadcast to');
    }
  } catch (error) {
    console.error('Bridge: Error broadcasting state:', error);
  }
};

export const mainZustandBridge = async <State extends AnyState, Store extends StoreApi<State>>(
  store: Store,
  options?: MainZustandBridgeOpts<State>,
) => {
  console.log('Bridge: Initializing...');
  const dispatch = createDispatch(store, options);

  // Track windows that have subscribed to state updates
  const subscribedWindowLabels = new Set<string>();

  // Set up event listeners for actions from any window
  console.log('Bridge: Setting up event listeners...');
  const unlisten = await listen<Action>('zubridge-tauri:action', (event) => {
    console.log('Bridge: Received action:', event.payload);
    try {
      // Dispatch the action to update the store
      dispatch(event.payload);
    } catch (error) {
      console.error('Bridge: Error dispatching action:', error);
    }
  });

  // Listen for new window creation events
  const unlistenWindowCreated = await listen('tauri://window-created', async (event) => {
    try {
      if (event && event.payload) {
        const label = (event.payload as { label: string }).label;
        console.log(`Bridge: New window created with label: ${label}`);

        // Add to tracked windows
        subscribedWindowLabels.add(label);

        // Send current state to the new window
        const safeState = sanitizeState(store.getState());

        // Wait a moment for the window to initialize
        setTimeout(async () => {
          try {
            // Add metadata to the state
            const enhancedState = {
              ...safeState,
              __meta: {
                updateId: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
                timestamp: Date.now(),
                sourceWindow: 'bridge',
                reason: 'window-created',
              },
            };

            await emit('zubridge-tauri:state-update', enhancedState);
            console.log(`Bridge: Sent state #${enhancedState.__meta.updateId} to new window: ${label}`);
          } catch (error) {
            console.error(`Bridge: Error sending state to new window ${label}:`, error);
          }
        }, 100);
      }
    } catch (error) {
      console.error('Bridge: Error handling window creation:', error);
    }
  });

  // Listen for window destruction events
  const unlistenWindowDestroyed = await listen('tauri://window-destroyed', (event) => {
    try {
      if (event && event.payload) {
        const label = (event.payload as { label: string }).label;
        console.log(`Bridge: Window destroyed with label: ${label}`);

        // Remove from tracked windows
        subscribedWindowLabels.delete(label);
      }
    } catch (error) {
      console.error('Bridge: Error handling window destruction:', error);
    }
  });

  // Subscribe to store changes
  console.log('Bridge: Setting up store subscription...');
  const unsubscribeStore = store.subscribe((state) => {
    try {
      const safeState = sanitizeState(state);
      broadcastStateToAllWindows(safeState).catch((error) => {
        console.error('Bridge: Error in broadcast:', error);
      });
    } catch (error) {
      console.error('Bridge: Error in store subscription handler:', error);
    }
  });

  // Initialize the main window with state
  console.log('Bridge: Setting initial state...');
  try {
    const initialState = sanitizeState(store.getState());

    // Broadcast initial state to any existing windows
    await broadcastStateToAllWindows({
      ...initialState,
      __meta: {
        reason: 'initial-state',
      },
    }).catch((error) => {
      console.error('Bridge: Error broadcasting initial state:', error);
    });

    // Track all existing windows
    const windows = await getWebviewWindows();
    for (const label in windows) {
      subscribedWindowLabels.add(label);
    }
    console.log(
      `Bridge: Tracking ${subscribedWindowLabels.size} windows: ${Array.from(subscribedWindowLabels).join(', ')}`,
    );
  } catch (error) {
    console.error('Bridge: Error initializing state:', error);
  }

  console.log('Bridge: Setup complete');

  return {
    unsubscribe: () => {
      try {
        // Clean up all event listeners
        unlisten();
        unlistenWindowCreated();
        unlistenWindowDestroyed();
        unsubscribeStore();

        console.log('Bridge: Unsubscribed successfully');
      } catch (error) {
        console.error('Bridge: Error during unsubscribe:', error);
      }
    },
  };
};

export async function getState(): Promise<AnyState> {
  try {
    const response = await invoke<{ value: AnyState }>('get_state');
    return response.value;
  } catch (error) {
    console.error('Renderer: Failed to get state:', error);
    throw error;
  }
}

export async function updateState(state: AnyState): Promise<void> {
  try {
    await invoke('update_state', { state: { value: state } });
  } catch (error) {
    console.error('Renderer: Failed to update state:', error);
    throw error;
  }
}
