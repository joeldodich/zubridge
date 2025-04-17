import { createCoreBridge, createDispatch } from '@zubridge/electron/main';
import type { BrowserWindow } from 'electron';
import type { StateManager, Action, AnyState } from '@zubridge/types';
import type { ZustandBridge } from '@zubridge/electron/main';

/**
 * Custom state manager implementation
 * This is a minimal implementation that follows the StateManager interface
 */
class CustomStateManager implements StateManager<AnyState> {
  // The current state
  private state: AnyState = {
    counter: 0,
  };

  // Set of listeners to be notified on state changes
  private listeners = new Set<(state: AnyState) => void>();

  /**
   * Get the current state
   */
  getState = (): AnyState => {
    console.log('[Custom Mode] Getting state:', this.state);
    return { ...this.state };
  };

  /**
   * Subscribe to state changes
   * @param listener Function to call when state changes
   * @returns Unsubscribe function
   */
  subscribe = (listener: (state: AnyState) => void): (() => void) => {
    console.log('[Custom Mode] Adding listener');
    this.listeners.add(listener);
    return () => {
      console.log('[Custom Mode] Removing listener');
      this.listeners.delete(listener);
    };
  };

  /**
   * Process an action and update state
   * @param action The action to process
   */
  processAction = (action: Action): void => {
    console.log('[Custom Mode] Processing action:', action);

    // Handle different action types
    switch (action.type) {
      case 'COUNTER:INCREMENT':
        this.updateState({
          counter: (this.state.counter as number) + 1,
        });
        break;

      case 'COUNTER:DECREMENT':
        this.updateState({
          counter: (this.state.counter as number) - 1,
        });
        break;

      case 'COUNTER:SET':
        this.updateState({
          counter: action.payload as number,
        });
        break;

      default:
        console.log('[Custom Mode] Unhandled action type:', action.type);
        break;
    }
  };

  /**
   * Update the state and notify listeners
   * @param newState Partial state to merge with current state
   */
  private updateState(newState: Partial<AnyState>): void {
    this.state = { ...this.state, ...newState };
    console.log('[Custom Mode] State updated:', this.state);

    // Notify all listeners
    this.listeners.forEach((listener) => {
      listener(this.state);
    });
  }
}

// Create a singleton instance of our state manager
export const stateManager = new CustomStateManager();

/**
 * Creates a bridge using the custom state manager approach
 * This demonstrates how to use createCoreBridge with a custom state manager
 */
export const createCustomBridge = (windows: BrowserWindow[] = []): ZustandBridge => {
  console.log('[Custom Mode] Creating bridge with custom state manager');

  // Create the core bridge with our state manager
  const coreBridge = createCoreBridge(stateManager, windows);

  // Create a dispatch function that works with our state manager
  const dispatchFn = createDispatch(stateManager);

  // Log initial state for debugging
  console.log('[Custom Mode] Initial state:', stateManager.getState());

  // Return the bridge interface that matches other bridge implementations
  return {
    subscribe: coreBridge.subscribe,
    unsubscribe: coreBridge.unsubscribe,
    getSubscribedWindows: coreBridge.getSubscribedWindows,
    destroy: coreBridge.destroy,
    dispatch: dispatchFn,
  };
};
