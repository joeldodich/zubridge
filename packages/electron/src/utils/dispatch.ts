import type { Action, Dispatch, StateManager, Thunk } from '@zubridge/types';

/**
 * Creates a dispatch function for a bridge that handles both direct actions and thunks
 */
export function createDispatch<S>(stateManager: StateManager<S>): Dispatch<S> {
  return function dispatch(action: Thunk<S> | Action | string, payload?: unknown) {
    if (typeof action === 'function') {
      try {
        // Handle thunks by passing getState and dispatch
        (action as Thunk<S>)(() => stateManager.getState(), dispatch);
      } catch (error) {
        console.error('Error dispatching thunk:', error);
      }
    } else if (typeof action === 'string') {
      try {
        // Handle string actions with separate payload
        stateManager.processAction({ type: action, payload });
      } catch (error) {
        console.error('Error dispatching action:', error);
      }
    } else {
      try {
        // Handle action objects
        stateManager.processAction(action as Action);
      } catch (error) {
        console.error('Error dispatching action:', error);
      }
    }
  };
}
