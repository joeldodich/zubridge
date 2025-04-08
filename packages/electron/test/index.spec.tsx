import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AnyState, Handlers, Action, Thunk } from '@zubridge/types';

// Mock @zubridge/core
vi.mock('@zubridge/core', () => {
  return {
    createStore: vi.fn().mockImplementation(() => ({
      getState: vi.fn().mockReturnValue({ test: 'state' }),
      setState: vi.fn(),
      subscribe: vi.fn(),
      destroy: vi.fn(),
    })),
    createUseStore: vi.fn().mockImplementation(() =>
      Object.assign(vi.fn().mockReturnValue({}), {
        getState: vi.fn().mockReturnValue({ test: 'state' }),
        setState: vi.fn(),
        subscribe: vi.fn(),
        destroy: vi.fn(),
      }),
    ),
    useDispatch: vi.fn().mockImplementation(() => vi.fn()),
  };
});

// Import after mock to avoid hoisting issues
import { createUseStore, useDispatch, createHandlers } from '../src/index';
import * as core from '@zubridge/core';

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
    expect(core.createUseStore).toHaveBeenCalled();
  });

  it('should create a useStore hook with custom handlers when provided', () => {
    const customHandlers = {
      dispatch: vi.fn(),
      getState: vi.fn().mockResolvedValue({ custom: true }),
      subscribe: vi.fn(),
    } as unknown as Handlers<AnyState>;

    const useStore = createUseStore<AnyState>(customHandlers);
    expect(useStore).toBeDefined();
    // Verify the core createUseStore was called with custom handlers
    expect(core.createUseStore).toHaveBeenCalledWith(customHandlers);
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
    expect(core.useDispatch).toHaveBeenCalled();
  });

  it('should create a dispatch function with custom handlers when provided', () => {
    const customHandlers = {
      dispatch: vi.fn(),
      getState: vi.fn(),
      subscribe: vi.fn(),
    } as unknown as Handlers<AnyState>;

    const dispatch = useDispatch<AnyState>(customHandlers);
    expect(dispatch).toBeDefined();
    // Verify the core useDispatch was called with custom handlers
    expect(core.useDispatch).toHaveBeenCalledWith(customHandlers);
  });
});
