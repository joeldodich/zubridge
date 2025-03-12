import React from 'react';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { screen, render, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { createStore, createUseStore, rendererZustandBridge, type Handlers, useDispatch } from '../src/index.js';
import { Thunk } from '../src/types.js';

// Mock Tauri API functions
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(() => Promise.resolve()),
}));

// Import mocked functions
const { invoke } = await import('@tauri-apps/api/core');
const { listen, emit } = await import('@tauri-apps/api/event');

// Configure longer timeout for async tests
vi.setConfig({ testTimeout: 10000 });

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.mocked(invoke).mockReset();
  vi.mocked(listen).mockReset();
  vi.mocked(emit).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('createUseStore', () => {
  it('should return a store hook', async () => {
    const handlers = {
      dispatch: vi.fn(),
      getState: vi.fn().mockResolvedValue({ testCounter: 0 }),
      subscribe: vi.fn((fn) => fn({ testCounter: 0 })),
    };
    const useStore = createUseStore(handlers);
    const TestApp = () => {
      const testCounter = useStore((x) => x.testCounter);

      return (
        <main>
          counter: <span data-testid="counter">{testCounter}</span>
        </main>
      );
    };

    render(<TestApp useStore={useStore} />);

    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByTestId('counter')).toHaveTextContent('0');
  });

  it('should handle initial state loading', async () => {
    const handlers = {
      dispatch: vi.fn(),
      getState: vi.fn().mockResolvedValue({ loading: true }),
      subscribe: vi.fn().mockImplementation((fn) => fn({ loading: true })),
    };
    const useStore = createUseStore(handlers);

    const TestApp = () => {
      const loading = useStore((state) => state.loading);
      return <div data-testid="loading">{loading ? 'Loading' : 'Done'}</div>;
    };

    render(<TestApp />);
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Loading');
    });
  });
});

describe('createDispatch', () => {
  type TestState = { testCounter: number; setCounter: (counter: TestState['testCounter']) => void };

  const state = { testCounter: 0 };
  let handlers: Record<string, Mock>;

  beforeEach(() => {
    state.testCounter = 0;
    handlers = {
      dispatch: vi.fn().mockImplementation((action, payload) => {
        store.setState((state) => {
          state.testCounter = action.payload || payload?.testCounter || payload;
          return state;
        });
      }),
      getState: vi.fn().mockResolvedValue(state),
      subscribe: vi.fn().mockImplementation((fn) => fn(state)),
    };
    const store = createStore<TestState>(handlers as unknown as Handlers<TestState>);
  });

  it('should create a dispatch hook which can handle thunks', async () => {
    const TestApp = () => {
      const dispatch = useDispatch<TestState>(handlers as unknown as Handlers<TestState>);
      return (
        <main>
          <button
            type="button"
            onClick={() =>
              dispatch((getState, dispatch) => {
                const { testCounter } = getState();
                dispatch('TEST:COUNTER:THUNK', testCounter + 2);
              })
            }
          >
            Dispatch Thunk
          </button>
        </main>
      );
    };

    render(<TestApp />);
    await waitFor(() => setTimeout(() => {}, 0));

    fireEvent.click(screen.getByText('Dispatch Thunk'));
    expect(handlers.dispatch).toHaveBeenCalledWith('TEST:COUNTER:THUNK', 2);
    fireEvent.click(screen.getByText('Dispatch Thunk'));
    expect(handlers.dispatch).toHaveBeenCalledWith('TEST:COUNTER:THUNK', 4);
    fireEvent.click(screen.getByText('Dispatch Thunk'));
    expect(handlers.dispatch).toHaveBeenCalledWith('TEST:COUNTER:THUNK', 6);
  });

  it('should create a dispatch hook which can handle action objects', async () => {
    const TestApp = () => {
      const dispatch = useDispatch<TestState>(handlers as unknown as Handlers<TestState>);
      return (
        <main>
          <button type="button" onClick={() => dispatch({ type: 'TEST:COUNTER:ACTION', payload: 2 })}>
            Dispatch Action
          </button>
        </main>
      );
    };

    render(<TestApp />);
    await waitFor(() => setTimeout(() => {}, 0));

    fireEvent.click(screen.getByText('Dispatch Action'));
    expect(handlers.dispatch).toHaveBeenCalledWith({ type: 'TEST:COUNTER:ACTION', payload: 2 });
  });

  it('should create a dispatch hook which can handle inline actions', async () => {
    const TestApp = () => {
      const dispatch = useDispatch<TestState>(handlers as unknown as Handlers<TestState>);
      return (
        <main>
          <button type="button" onClick={() => dispatch('TEST:COUNTER:INLINE', 1)}>
            Dispatch Inline Action
          </button>
        </main>
      );
    };

    render(<TestApp />);
    await waitFor(() => setTimeout(() => {}, 0));

    fireEvent.click(screen.getByText('Dispatch Inline Action'));
    expect(handlers.dispatch).toHaveBeenCalledWith('TEST:COUNTER:INLINE', 1);
  });
});

describe('createStore', () => {
  it('should create a store with handlers', async () => {
    const handlers = {
      dispatch: vi.fn(),
      getState: vi.fn().mockResolvedValue({ count: 0 }),
      subscribe: vi.fn(),
    };
    const store = createStore(handlers);

    expect(store.getState).toBeDefined();
    expect(store.setState).toBeDefined();
    expect(store.subscribe).toBeDefined();
  });

  it('should handle errors in getState', async () => {
    const error = new Error('Failed to get state');
    const handlers = {
      dispatch: vi.fn(),
      getState: vi.fn().mockRejectedValue(error),
      subscribe: vi.fn(),
    };
    const store = createStore(handlers);

    try {
      await store.getState();
    } catch (e) {
      expect(e).toBe(error);
    }
  });

  it('should handle subscription updates', async () => {
    const mockSubscriber = vi.fn();
    const handlers = {
      dispatch: vi.fn(),
      getState: vi.fn().mockResolvedValue({ count: 0 }),
      subscribe: vi.fn((callback) => {
        // Call immediately with initial state
        callback({ count: 0 });
        // Schedule update with count: 1
        queueMicrotask(() => callback({ count: 1 }));
        return () => {};
      }),
    };

    const store = createStore(handlers);
    store.subscribe(mockSubscriber);

    // Ensure all microtasks are processed
    await new Promise((resolve) => setTimeout(resolve, 0));
    await vi.advanceTimersByTimeAsync(10);

    // Verify that mockSubscriber was called at least once
    expect(mockSubscriber).toHaveBeenCalled();

    // Check if any call contains the expected value
    const hasExpectedCall = mockSubscriber.mock.calls.some(
      (call) => call.length > 0 && call[0] && typeof call[0] === 'object' && call[0].count === 1,
    );

    expect(hasExpectedCall).toBe(true);
  });

  it('should handle subscription cleanup', () => {
    const handlers = {
      dispatch: vi.fn(),
      getState: vi.fn().mockResolvedValue({ count: 0 }),
      subscribe: vi.fn(),
    };
    const store = createStore(handlers);
    const unsubscribe = store.subscribe(() => {});

    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
    expect(handlers.subscribe).toHaveBeenCalled();
  });

  it('should handle selector updates', async () => {
    const handlers = {
      dispatch: vi.fn(),
      getState: vi.fn().mockResolvedValue({ count: 0, name: 'test' }),
      subscribe: vi.fn((fn) => fn({ count: 0, name: 'test' })),
    };
    const useStore = createUseStore(handlers);

    const TestApp = () => {
      const count = useStore((s) => s.count);
      const name = useStore((s) => s.name);
      return (
        <div>
          <span data-testid="count">{count}</span>
          <span data-testid="name">{name}</span>
        </div>
      );
    };

    render(<TestApp />);
    await vi.advanceTimersByTimeAsync(0);

    expect(screen.getByTestId('count')).toHaveTextContent('0');
    expect(screen.getByTestId('name')).toHaveTextContent('test');
  });

  it('should handle equality function', async () => {
    const handlers = {
      dispatch: vi.fn(),
      getState: vi.fn().mockResolvedValue({ user: { id: 1, name: 'test' } }),
      subscribe: vi.fn(),
    };
    const renderCount = vi.fn();
    type TestState = { user: { id: number; name: string } };

    const useStore = createUseStore<TestState>(handlers);

    const TestApp = () => {
      const user = useStore((s) => s.user);
      renderCount();
      return <div data-testid="user">{user?.name || ''}</div>;
    };

    render(<TestApp />);
    await vi.advanceTimersByTimeAsync(0);
  });

  it('should handle dispatch errors', async () => {
    const error = new Error('Dispatch error');
    const handlers = {
      dispatch: vi.fn().mockRejectedValue(error),
      getState: vi.fn().mockResolvedValue({}),
      subscribe: vi.fn(),
    };

    const TestApp = () => {
      const dispatch = useDispatch(handlers);
      return (
        <button
          onClick={async () => {
            try {
              await dispatch('TEST:ACTION');
            } catch (e) {
              console.error(e);
            }
          }}
        >
          Test Action
        </button>
      );
    };

    render(<TestApp />);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    fireEvent.click(screen.getByText('Test Action'));
    await vi.advanceTimersByTimeAsync(0);

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('should handle state updates with function updater', async () => {
    const handlers = {
      dispatch: vi.fn().mockImplementation(() => Promise.resolve()),
      getState: vi.fn().mockResolvedValue({ count: 0 }),
      subscribe: vi.fn(),
    };
    type TestState = { count: number };

    const store = createStore<TestState>(handlers);

    handlers.dispatch.mockImplementationOnce((action) => {
      expect(action).toEqual({
        type: 'setState',
        payload: { count: 1 },
      });
      return Promise.resolve();
    });

    await store.setState((state) => ({ count: state.count + 1 }));
  });

  it('should handle multiple subscriptions', async () => {
    const subscriber1 = vi.fn();
    const subscriber2 = vi.fn();
    const state = { count: 0 };
    const handlers = {
      dispatch: vi.fn(),
      getState: vi.fn().mockResolvedValue(state),
      subscribe: vi.fn((callback) => {
        Promise.resolve().then(() => {
          callback(state);
        });
        return () => {};
      }),
    };

    const store = createStore(handlers);
    store.subscribe(subscriber1);
    store.subscribe(subscriber2);

    await Promise.resolve();

    expect(subscriber1.mock.calls[0][0]).toEqual(state);
    expect(subscriber2.mock.calls[0][0]).toEqual(state);
  });
});

describe('useDispatch', () => {
  it('should handle thunk errors', async () => {
    const handlers = {
      dispatch: vi.fn(),
      getState: vi.fn().mockResolvedValue({}),
      subscribe: vi.fn(),
    };

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const TestApp = () => {
      const dispatch = useDispatch(handlers);
      return (
        <button
          onClick={async () => {
            try {
              await dispatch(async () => {
                throw new Error('Thunk error');
              });
            } catch (e) {
              console.error(e);
            }
          }}
        >
          Error
        </button>
      );
    };

    render(<TestApp />);

    fireEvent.click(screen.getByText('Error'));

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalled();
    });

    consoleError.mockRestore();
  });

  it('should handle non-function state updates', async () => {
    const newState = { count: 1 };
    const handlers = {
      dispatch: vi.fn().mockImplementation(() => Promise.resolve()),
      getState: vi.fn().mockResolvedValue({ count: 0 }),
      subscribe: vi.fn(),
    };

    const store = createStore(handlers);

    handlers.dispatch.mockImplementationOnce((action) => {
      expect(action).toEqual({
        type: 'setState',
        payload: newState,
      });
      return Promise.resolve();
    });

    await store.setState(newState);
  });

  it('should handle async thunks with state updates', async () => {
    const handlers = {
      dispatch: vi.fn().mockImplementation(() => Promise.resolve()),
      getState: vi.fn().mockResolvedValue({ count: 0 }),
      subscribe: vi.fn(),
    };

    type TestState = { count: number };

    const TestApp = () => {
      const dispatch = useDispatch(handlers);
      return (
        <button
          onClick={() =>
            dispatch(async (getState, dispatch) => {
              const state = (await getState()) as TestState;
              await dispatch('INCREMENT', state.count + 1);
              return state.count;
            })
          }
        >
          Async Thunk
        </button>
      );
    };

    render(<TestApp />);
    fireEvent.click(screen.getByText('Async Thunk'));

    await vi.advanceTimersByTimeAsync(0);
    expect(handlers.dispatch).toHaveBeenCalledWith('INCREMENT', 1);
  });
});

describe('rendererZustandBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create bridge handlers', () => {
      const { handlers } = rendererZustandBridge<{ counter: number }>();
      expect(handlers).toBeDefined();
      expect(handlers.dispatch).toBeDefined();
      expect(handlers.getState).toBeDefined();
      expect(handlers.subscribe).toBeDefined();
    });
  });

  describe('getState handler', () => {
    it('should retrieve state successfully', async () => {
      const { handlers } = rendererZustandBridge<{ counter: number }>();
      const testState = { counter: 42 };

      vi.mocked(invoke).mockResolvedValueOnce(testState);
      const state = await handlers.getState();

      expect(invoke).toHaveBeenCalledWith('get_state');
      expect(state).toEqual(testState);
    });

    it('should handle errors in state retrieval', async () => {
      const { handlers } = rendererZustandBridge<{ counter: number }>();
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Failed to get state'));

      await expect(handlers.getState()).rejects.toThrow('Failed to get state');
    });
  });

  describe('subscribe handler', () => {
    it('should handle state subscription successfully', async () => {
      const { handlers } = rendererZustandBridge<{ counter: number }>();
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

      await handlers.subscribe(mockCallback);

      expect(listen).toHaveBeenCalledWith('zubridge-tauri:state-update', expect.any(Function));
      expect(mockCallback).toHaveBeenCalledWith(testState);
    });

    it('should handle subscription cleanup', async () => {
      const { handlers } = rendererZustandBridge<{ counter: number }>();
      const unsubscribe = vi.fn();

      vi.mocked(listen).mockResolvedValueOnce(unsubscribe);

      const cleanup = await handlers.subscribe(() => {});
      cleanup();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('dispatch handler', () => {
    it('should dispatch actions successfully', async () => {
      const { handlers } = rendererZustandBridge<{ counter: number }>();
      vi.mocked(emit).mockResolvedValueOnce(undefined);

      await handlers.dispatch('INCREMENT', { counter: 1 });

      expect(emit).toHaveBeenCalledWith('zubridge-tauri:action', {
        type: 'INCREMENT',
        payload: { counter: 1 },
      });
    });

    it('should handle action objects', async () => {
      const { handlers } = rendererZustandBridge<{ counter: number }>();
      vi.mocked(emit).mockResolvedValueOnce(undefined);

      await handlers.dispatch({
        type: 'INCREMENT',
        payload: { counter: 1 },
      });

      expect(emit).toHaveBeenCalledWith('zubridge-tauri:action', {
        type: 'INCREMENT',
        payload: { counter: 1 },
      });
    });

    it('should handle thunk dispatch', async () => {
      const { handlers } = rendererZustandBridge<{ counter: number }>();
      const testState = { counter: 42 };

      vi.mocked(invoke).mockResolvedValueOnce(testState);
      vi.mocked(emit).mockResolvedValueOnce(undefined);

      const thunk: Thunk<{ counter: number }> = async (getState, dispatch) => {
        const state = await getState();
        await dispatch('INCREMENT', { counter: state.counter + 1 });
      };

      await handlers.dispatch(thunk);

      expect(invoke).toHaveBeenCalledWith('get_state');
      expect(emit).toHaveBeenCalledWith('zubridge-tauri:action', {
        type: 'INCREMENT',
        payload: { counter: 43 },
      });
    });
  });
});
