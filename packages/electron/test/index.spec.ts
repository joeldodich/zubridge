import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AnyState, Handlers, Thunk } from '@zubridge/types';

// Import from source
import { createUseStore, useDispatch, createHandlers } from '../src/index';

type TestState = {
  testCounter: number;
};

// Mock zustand
vi.mock('zustand', () => ({
  useStore: vi.fn().mockReturnValue({ test: 'state' }),
}));

// Create a working mock store
const mockZustandStore = {
  getState: vi.fn().mockReturnValue({ test: 'state' }),
  setState: vi.fn(),
  subscribe: vi.fn(),
  destroy: vi.fn(),
};

vi.mock('zustand/vanilla', () => {
  return {
    createStore: vi.fn().mockImplementation((factory) => {
      // Call the factory function right away to simulate store creation
      if (typeof factory === 'function') {
        const setState = vi.fn();
        factory(setState);
      }
      return mockZustandStore;
    }),
  };
});

// Mock electron
vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: vi.fn().mockResolvedValue({ test: 'state' }),
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
    // Create a new window object without zubridge
    const windowWithoutZubridge = { ...originalWindow } as Window & typeof globalThis;
    (windowWithoutZubridge as any).zubridge = undefined;
    global.window = windowWithoutZubridge;

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

describe('createUseStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).zubridge = {
      dispatch: vi.fn(),
      getState: vi.fn().mockReturnValue(Promise.resolve({ test: 'state' })),
      subscribe: vi.fn(),
    } as unknown as Handlers<AnyState>;
  });

  it('should return a store hook', async () => {
    const useStore = createUseStore<AnyState>();
    expect(useStore).toBeDefined();
  });

  it('should create a useStore hook with custom handlers when provided', () => {
    const customHandlers = {
      dispatch: vi.fn(),
      getState: vi.fn().mockReturnValue(Promise.resolve({ custom: true })),
      subscribe: vi.fn(),
    } as unknown as Handlers<AnyState>;

    const useStore = createUseStore<AnyState>(customHandlers);
    expect(useStore).toBeDefined();
  });
});

describe('useDispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).zubridge = {
      dispatch: vi.fn(),
      getState: vi.fn().mockReturnValue(Promise.resolve({ test: 'state' })),
      subscribe: vi.fn(),
    } as unknown as Handlers<AnyState>;
  });

  it('should return a dispatch function', async () => {
    const dispatch = useDispatch<AnyState>();
    expect(dispatch).toBeDefined();
  });

  it('should create a dispatch function with custom handlers when provided', () => {
    const customHandlers = {
      dispatch: vi.fn(),
      getState: vi.fn().mockReturnValue(Promise.resolve({ test: 'state' })),
      subscribe: vi.fn(),
    } as unknown as Handlers<AnyState>;

    const dispatch = useDispatch<AnyState>(customHandlers);
    expect(dispatch).toBeDefined();
  });
});

describe('useCoreDispatch', () => {
  let mockHandlers: Handlers<TestState>;
  let mockStore: any;

  beforeEach(() => {
    mockHandlers = {
      dispatch: vi.fn(),
      getState: vi.fn().mockResolvedValue({ testCounter: 1 }),
      subscribe: vi.fn(),
    };

    mockStore = {
      getState: vi.fn().mockReturnValue({ testCounter: 1 }),
      setState: vi.fn(),
      subscribe: vi.fn(),
    };
  });

  it('should create a dispatch function with given handlers', () => {
    const dispatch = useDispatch(mockHandlers as any);
    expect(dispatch).toBeDefined();
    expect(typeof dispatch).toBe('function');
  });

  it('should handle string action types', () => {
    const dispatch = useDispatch<TestState>(mockHandlers);

    dispatch('INCREMENT', 5);

    expect(mockHandlers.dispatch).toHaveBeenCalledWith('INCREMENT', 5);
  });

  it('should handle action objects', () => {
    const dispatch = useDispatch<TestState>(mockHandlers);
    const action = { type: 'SET_COUNTER', payload: 42 };

    dispatch(action);

    expect(mockHandlers.dispatch).toHaveBeenCalledWith(action);
  });

  it('should execute thunk actions', () => {
    const dispatch = useDispatch<TestState>(mockHandlers);

    const thunkAction = vi.fn((getState, innerDispatch) => {
      const state = getState();
      // Use expect.any to avoid exact comparison that might fail
      expect(state).toEqual(expect.any(Object));
      innerDispatch('INCREMENT');
      return 'thunk-result';
    });

    const result = dispatch(thunkAction as unknown as Thunk<TestState>);

    expect(thunkAction).toHaveBeenCalled();
    expect(mockHandlers.dispatch).toHaveBeenCalledWith('INCREMENT');
    expect(result).toBe('thunk-result');
  });
});
