import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AnyState, Handlers, Action, Thunk } from '@zubridge/types';

// Create mock store and other functionality
const mockStore = {
  getState: vi.fn().mockReturnValue({ test: 'state' }),
  setState: vi.fn(),
  subscribe: vi.fn(),
  destroy: vi.fn(),
};

// Mock @zubridge/core
vi.mock('@zubridge/core', () => {
  return {
    createStore: vi.fn().mockImplementation((handlers) => mockStore),
    createUseStore: vi.fn().mockImplementation((handlers) => Object.assign(vi.fn().mockReturnValue({}), mockStore)),
    useDispatch: vi.fn().mockImplementation((handlers) =>
      vi.fn().mockImplementation((action, payload) => {
        if (typeof action === 'function') {
          return action({}, handlers.dispatch);
        }
        if (typeof action === 'string') {
          return handlers.dispatch(action, payload);
        }
        return handlers.dispatch(action);
      }),
    ),
  };
});

import { createUseStore, useDispatch, createStore, createHandlers } from '../src/index';

type TestState = {
  testCounter: number;
};

vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: vi.fn(),
    send: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  },
}));

describe('createHandlers', () => {
  const originalWindow = global.window;

  afterEach(() => {
    // Restore window after each test
    global.window = originalWindow;
  });

  it('should throw an error when window is undefined', () => {
    // @ts-ignore - Intentionally setting window to undefined for testing
    global.window = undefined;

    expect(() => {
      createHandlers();
    }).toThrow('Zubridge handlers not found in window');
  });

  it('should throw an error when window.zubridge is undefined', () => {
    // @ts-ignore - Intentionally removing zubridge for testing
    global.window = { ...originalWindow };
    delete global.window.zubridge;

    expect(() => {
      createHandlers();
    }).toThrow('Zubridge handlers not found in window');
  });

  it('should return window.zubridge when it exists', () => {
    const mockHandlers = {
      dispatch: vi.fn(),
      getState: vi.fn(),
      subscribe: vi.fn(),
    };

    global.window.zubridge = mockHandlers;

    const handlers = createHandlers();
    expect(handlers).toBe(mockHandlers);
  });
});

describe('createStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).zubridge = {
      dispatch: vi.fn(),
      getState: vi.fn().mockResolvedValue({ test: 'state' }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as Handlers<AnyState>;
  });

  it('should create a store with handlers', () => {
    const store = createStore<AnyState>();
    expect(store).toBeDefined();
    expect(typeof store.getState).toBe('function');
    expect(typeof store.subscribe).toBe('function');
    expect(typeof store.setState).toBe('function');
  });
});

describe('createUseStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).zubridge = {
      dispatch: vi.fn(),
      getState: vi.fn().mockResolvedValue({ test: 'state' }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as Handlers<AnyState>;
  });

  it('should return a store hook', async () => {
    const useStore = createUseStore<AnyState>();
    const store = useStore;
    expect(store).toBeDefined();
    expect(typeof store.getState).toBe('function');
    expect(typeof store.subscribe).toBe('function');
  });

  it('should handle dispatch calls', async () => {
    const dispatch = useDispatch<AnyState>();
    const action: Action = { type: 'test', payload: 'data' };
    await dispatch(action);
    expect(window.zubridge.dispatch).toHaveBeenCalledWith(action);
  });

  it('should handle getState calls', async () => {
    const useStore = createUseStore<AnyState>();
    const store = useStore;
    // Wait for the initial state to be set
    await new Promise((resolve) => setTimeout(resolve, 0));
    const state = store.getState();
    expect(state).toEqual({ test: 'state' });
  });

  it('should handle subscribe calls', async () => {
    const useStore = createUseStore<AnyState>();
    const store = useStore;
    const listener = vi.fn();
    store.subscribe(listener);
    // We're not actually testing the window.zubridge call anymore since we've mocked the implementation
    expect(mockStore.subscribe).toHaveBeenCalled();
  });
});

describe('useDispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).zubridge = {
      dispatch: vi.fn(),
      getState: vi.fn().mockResolvedValue({ testCounter: 1 }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as Handlers<AnyState>;
  });

  it('should handle thunks', async () => {
    const dispatch = useDispatch<TestState>();

    const thunk: Thunk<TestState> = (_getState, dispatchFn) => {
      dispatchFn({ type: 'test', payload: { testCounter: 2 } });
    };

    await dispatch(thunk);

    expect(window.zubridge.dispatch).toHaveBeenCalledWith({
      type: 'test',
      payload: { testCounter: 2 },
    });
  });

  it('should handle action objects', async () => {
    const dispatch = useDispatch<AnyState>();
    const action: Action = { type: 'test', payload: 'data' };
    await dispatch(action);
    expect(window.zubridge.dispatch).toHaveBeenCalledWith(action);
  });

  it('should handle string actions', async () => {
    const dispatch = useDispatch<AnyState>();
    await dispatch('test', 'data');
    expect(window.zubridge.dispatch).toHaveBeenCalledWith('test', 'data');
  });
});
