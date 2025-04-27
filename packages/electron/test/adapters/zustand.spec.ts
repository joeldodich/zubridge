import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoreApi } from 'zustand/vanilla';
import type { AnyState, Action, RootReducer } from '@zubridge/types';

import { createZustandAdapter } from '../../src/adapters/zustand.js';

// Create a mock Zustand store
function createMockZustandStore<S extends AnyState>(initialState: S = {} as S) {
  let currentState = { ...initialState };
  const listeners: Array<(state: S, prevState: S) => void> = [];

  const store = {
    getState: vi.fn(() => currentState),
    setState: vi.fn((updater: any, replace?: boolean) => {
      const prevState = { ...currentState };
      if (typeof updater === 'function') {
        currentState = replace ? { ...updater(currentState) } : { ...currentState, ...updater(currentState) };
      } else {
        currentState = replace ? { ...updater } : { ...currentState, ...updater };
      }
      listeners.forEach((listener) => listener(currentState, prevState));
      return currentState;
    }),
    subscribe: vi.fn((listener: (state: S, prevState: S) => void) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      };
    }),
    destroy: vi.fn(() => {
      listeners.length = 0;
    }),
  };

  return store as unknown as StoreApi<S>;
}

describe('Zustand Adapter', () => {
  let store: StoreApi<AnyState>;
  let adapter: ReturnType<typeof createZustandAdapter>;

  beforeEach(() => {
    store = createMockZustandStore({ count: 0, setCount: vi.fn() });
    adapter = createZustandAdapter(store);
  });

  describe('getState', () => {
    it('should return the current store state', () => {
      const state = adapter.getState();
      expect(state).toEqual({ count: 0, setCount: expect.any(Function) });
      expect(store.getState).toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('should pass the listener to the store subscribe method', () => {
      const listener = vi.fn();
      adapter.subscribe(listener);
      expect(store.subscribe).toHaveBeenCalled();
    });
  });

  describe('processAction with handlers', () => {
    it('should call custom handlers when provided', () => {
      const customHandler = vi.fn();
      const adapterWithHandlers = createZustandAdapter(store, {
        handlers: {
          CUSTOM_ACTION: customHandler,
        },
      });

      const action: Action = { type: 'CUSTOM_ACTION', payload: 'test-data' };
      adapterWithHandlers.processAction(action);

      expect(customHandler).toHaveBeenCalledWith('test-data');
      expect(store.setState).not.toHaveBeenCalled();
    });

    it('should call custom handlers with case-insensitive matching', () => {
      const incrementHandler = vi.fn();
      const decrementHandler = vi.fn();
      const adapterWithHandlers = createZustandAdapter(store, {
        handlers: {
          increment: incrementHandler,
          DECREMENT: decrementHandler,
        },
      });

      // Test uppercase action with lowercase handler
      adapterWithHandlers.processAction({ type: 'INCREMENT', payload: 5 });
      expect(incrementHandler).toHaveBeenCalledWith(5);

      // Test lowercase action with uppercase handler
      adapterWithHandlers.processAction({ type: 'decrement', payload: 3 });
      expect(decrementHandler).toHaveBeenCalledWith(3);
    });
  });

  describe('processAction with reducer', () => {
    it('should use the reducer when provided', () => {
      const reducer: RootReducer<AnyState> = vi.fn((state, action) => {
        if (action.type === 'INCREMENT') {
          return { ...state, count: state.count + 1 };
        }
        return state;
      });

      const adapterWithReducer = createZustandAdapter(store, { reducer });
      const action: Action = { type: 'INCREMENT' };
      adapterWithReducer.processAction(action);

      expect(reducer).toHaveBeenCalledWith({ count: 0, setCount: expect.any(Function) }, action);
      expect(store.setState).toHaveBeenCalled();
    });
  });

  describe('processAction with built-in actions', () => {
    it('should handle setState action', () => {
      const action: Action = { type: 'setState', payload: { count: 42 } };
      adapter.processAction(action);

      expect(store.setState).toHaveBeenCalledWith({ count: 42 });
    });

    it('should call store methods that match action type', () => {
      const setCountMock = vi.fn();
      const testStore = createMockZustandStore({
        count: 0,
        setCount: setCountMock,
      });

      const testAdapter = createZustandAdapter(testStore);
      const action: Action = { type: 'setCount', payload: 99 };

      testAdapter.processAction(action);

      expect(setCountMock).toHaveBeenCalledWith(99);
    });

    it('should call store methods with case-insensitive matching', () => {
      const incrementMock = vi.fn();
      const decrementMock = vi.fn();
      const resetMock = vi.fn();

      const testStore = createMockZustandStore({
        count: 0,
        increment: incrementMock,
        decrement: decrementMock,
        resetCounter: resetMock,
      });

      const testAdapter = createZustandAdapter(testStore);

      // Test uppercase action with lowercase method
      testAdapter.processAction({ type: 'INCREMENT', payload: 5 });
      expect(incrementMock).toHaveBeenCalledWith(5);

      // Test mixed case action with lowercase method
      testAdapter.processAction({ type: 'DeCreMeNt', payload: 3 });
      expect(decrementMock).toHaveBeenCalledWith(3);

      // Test lowercase action with camelCase method
      testAdapter.processAction({ type: 'resetcounter' });
      expect(resetMock).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should catch and log errors during action processing', () => {
      const errorReducer: RootReducer<AnyState> = vi.fn(() => {
        throw new Error('Test reducer error');
      });

      const adapterWithReducer = createZustandAdapter(store, { reducer: errorReducer });

      // Mock console.error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const action: Action = { type: 'ERROR_ACTION' };
      adapterWithReducer.processAction(action);

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error processing action:', expect.any(Error));

      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
  });
});
