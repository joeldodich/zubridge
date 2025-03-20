import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Thunk } from '@zubridge/types';

// Define test state type
type TestState = { count: number; testCounter: number };

// Mock the core module
vi.mock('@zubridge/core', () => {
  const mockStore = {
    getState: vi.fn(() => ({ count: 0, testCounter: 0 })),
    setState: vi.fn(),
    subscribe: vi.fn(),
  };

  return {
    createStore: vi.fn(() => mockStore),
    createUseStore: vi.fn(() => {
      const useStoreMock = vi.fn((selector) => {
        // Return a default state that matches what the tests expect
        const state: TestState = { testCounter: 0, count: 0 };
        return selector ? selector(state) : state;
      });
      Object.assign(useStoreMock, mockStore);
      return useStoreMock;
    }),
    useDispatch: vi.fn((handlers) => {
      return (action, payload) => {
        if (typeof action === 'function') {
          // For thunks, execute the function with mock getState and dispatch
          return action(
            () => ({ count: 0, testCounter: 0 }) as TestState, // Mock getState
            handlers.dispatch, // Pass through the dispatch function
          );
        }
        return handlers.dispatch(action, payload);
      };
    }),
  };
});

// Mock the Tauri API functions
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(() => Promise.resolve()),
}));

// Import mocked functions
import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';

// Import the actual module
import * as tauriModule from '../src/index.js';
import * as coreModule from '@zubridge/core';

// Spy on console.error
const consoleErrorSpy = vi.spyOn(console, 'error');

beforeEach(() => {
  vi.clearAllMocks();
  consoleErrorSpy.mockClear();
});

describe('createStore', () => {
  it('should create a store with handlers', () => {
    const store = tauriModule.createStore();

    expect(store).toBeDefined();
    expect(coreModule.createStore).toHaveBeenCalled();
  });
});

describe('createUseStore', () => {
  it('should return a store hook', () => {
    const useStore = tauriModule.createUseStore();

    const TestApp = () => {
      const testCounter = useStore((x) => x.testCounter);
      return (
        <main>
          counter: <span data-testid="counter">{testCounter}</span>
        </main>
      );
    };

    render(<TestApp />);

    expect(screen.getByTestId('counter')).toHaveTextContent('0');
    expect(coreModule.createUseStore).toHaveBeenCalled();
  });
});

describe('useDispatch', () => {
  it('should create a dispatch function', () => {
    const dispatch = tauriModule.useDispatch();

    // Create a mock handler to test with
    const mockDispatch = vi.fn();

    // Call the dispatch function
    dispatch('INCREMENT');

    // Verify that the core useDispatch was called
    expect(coreModule.useDispatch).toHaveBeenCalled();
  });

  it('should handle thunks', () => {
    const dispatch = tauriModule.useDispatch<TestState>();

    // Call the dispatch function with a thunk
    dispatch((getState, dispatch) => {
      const state = getState();
      dispatch('INCREMENT', state.count + 1);
    });

    // Verify that the core useDispatch was called
    expect(coreModule.useDispatch).toHaveBeenCalled();
  });
});

describe('rendererZustandBridge', () => {
  describe('initialization', () => {
    it('should create bridge handlers', () => {
      const { handlers } = tauriModule.rendererZustandBridge<{ counter: number }>();
      expect(handlers).toBeDefined();
      expect(handlers.dispatch).toBeDefined();
      expect(handlers.getState).toBeDefined();
      expect(handlers.subscribe).toBeDefined();
    });
  });

  describe('getState handler', () => {
    it('should retrieve state successfully', async () => {
      const { handlers } = tauriModule.rendererZustandBridge<{ counter: number }>();
      const testState = { counter: 42 };

      vi.mocked(invoke).mockResolvedValueOnce(testState);
      const state = await handlers.getState();

      expect(invoke).toHaveBeenCalledWith('get_state');
      expect(state).toEqual(testState);
    });

    it('should handle errors in state retrieval', async () => {
      const { handlers } = tauriModule.rendererZustandBridge<{ counter: number }>();
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Failed to get state'));

      await expect(handlers.getState()).rejects.toThrow('Failed to get state');
    });
  });

  describe('subscribe handler', () => {
    it('should handle state subscription successfully', async () => {
      const { handlers } = tauriModule.rendererZustandBridge<{ counter: number }>();
      const mockCallback = vi.fn();
      const testState = { counter: 42 };

      vi.mocked(listen).mockImplementationOnce((event, callback) => {
        if (event === 'zubridge-tauri:state-update') {
          callback({
            event: 'zubridge-tauri:state-update',
            id: 1,
            payload: testState,
          });
        }
        return Promise.resolve(() => {});
      });

      const unsubscribe = handlers.subscribe(mockCallback);

      // Wait for the promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(listen).toHaveBeenCalledWith('zubridge-tauri:state-update', expect.any(Function));
      expect(mockCallback).toHaveBeenCalledWith(testState);

      // Test unsubscribe
      unsubscribe();
    });

    it('should handle errors in subscription setup', async () => {
      const { handlers } = tauriModule.rendererZustandBridge<{ counter: number }>();
      const mockCallback = vi.fn();
      const testError = new Error('Subscription error');

      // Mock listen to reject with an error
      vi.mocked(listen).mockRejectedValueOnce(testError);

      const unsubscribe = handlers.subscribe(mockCallback);

      // Wait for the promise to reject
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify that console.error was called with the error
      expect(consoleErrorSpy).toHaveBeenCalledWith('Renderer: Error setting up state subscription:', testError);

      // Test unsubscribe (should not throw even though setup failed)
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe('dispatch handler', () => {
    it('should dispatch string actions successfully', () => {
      const { handlers } = tauriModule.rendererZustandBridge<{ counter: number }>();

      handlers.dispatch('INCREMENT', { counter: 1 });

      expect(emit).toHaveBeenCalledWith('zubridge-tauri:action', {
        type: 'INCREMENT',
        payload: { counter: 1 },
      });
    });

    it('should handle action objects', () => {
      const { handlers } = tauriModule.rendererZustandBridge<{ counter: number }>();

      handlers.dispatch({
        type: 'INCREMENT',
        payload: { counter: 1 },
      });

      expect(emit).toHaveBeenCalledWith('zubridge-tauri:action', {
        type: 'INCREMENT',
        payload: { counter: 1 },
      });
    });

    it('should reject thunk dispatch', () => {
      const { handlers } = tauriModule.rendererZustandBridge<{ counter: number }>();

      const thunk: Thunk<{ counter: number }> = async (getState, dispatch) => {
        const state = await getState();
        await dispatch('INCREMENT', { counter: state.counter + 1 });
      };

      expect(() => handlers.dispatch(thunk)).toThrow('Thunks must be dispatched in the main process');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Renderer: Cannot dispatch thunk directly to main process');
    });
  });
});
