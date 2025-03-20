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
    createStore: vi.fn().mockImplementation(() => mockStore),
    createUseStore: vi.fn().mockImplementation(() => Object.assign(vi.fn().mockReturnValue({}), mockStore)),
    useDispatch: vi.fn().mockImplementation(() => vi.fn()),
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
      getState: vi.fn(),
      subscribe: vi.fn(),
    } as unknown as Handlers<AnyState>;
  });

  it('should create a store with handlers', () => {
    const store = createStore<AnyState>();
    expect(store).toBeDefined();
  });
});

describe('createUseStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).zubridge = {
      dispatch: vi.fn(),
      getState: vi.fn(),
      subscribe: vi.fn(),
    } as unknown as Handlers<AnyState>;
  });

  it('should return a store hook', async () => {
    const useStore = createUseStore<AnyState>();
    expect(useStore).toBeDefined();
  });
});

describe('useDispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).zubridge = {
      dispatch: vi.fn(),
      getState: vi.fn(),
      subscribe: vi.fn(),
    } as unknown as Handlers<AnyState>;
  });

  it('should return a dispatch function', async () => {
    const dispatch = useDispatch<AnyState>();
    expect(dispatch).toBeDefined();
  });
});
