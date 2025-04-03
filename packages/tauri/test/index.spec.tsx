import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

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
