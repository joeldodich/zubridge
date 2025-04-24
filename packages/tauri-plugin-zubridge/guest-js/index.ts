import { invoke } from '@tauri-apps/api/tauri';
import { listen, Event } from '@tauri-apps/api/event';

/**
 * Zubridge action with type and optional payload
 */
export interface ZubridgeAction {
  type: string;
  payload?: unknown;
}

/**
 * Get the initial state from the Tauri backend
 * @returns Promise that resolves to the serialized state
 */
export async function getInitialState<T>(): Promise<T> {
  return await invoke<T>('plugin:zubridge|get_initial_state');
}

/**
 * Dispatch an action to update the state
 * @param action Action to dispatch
 * @returns Promise that resolves to the serialized updated state
 */
export async function dispatchAction<T>(action: ZubridgeAction): Promise<T> {
  return await invoke<T>('plugin:zubridge|dispatch_action', { action });
}

/**
 * Subscribe to state updates
 * @param callback Function to call when state updates
 * @param event Custom event name
 * @returns Promise that resolves to an unlisten function
 */
export async function subscribeToState<T>(
  callback: (state: T) => void,
  event = 'zubridge://state-update',
): Promise<() => void> {
  return await listen<string>(event, (eventPayload: Event<string>) => {
    const state = JSON.parse(eventPayload.payload) as T;
    callback(state);
  });
}

/**
 * Zubridge API
 */
export const zubridge = {
  getInitialState,
  dispatchAction,
  subscribeToState,
};

export default zubridge;
