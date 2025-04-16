import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AnyState, Handlers, Action, Thunk } from '@zubridge/types';

// Import from source
import { createUseStore, useDispatch, createHandlers, createCoreUseStore, useCoreDispatch } from '../src/index';

type TestState = {
  testCounter: number;
};

// Mock zustand
vi.mock('zustand', () => ({
  useStore: vi.fn().mockReturnValue({ test: 'state' }),
}));

vi.mock('zustand/vanilla', () => ({
  createStore: vi.fn().mockImplementation(() => ({
    getState: vi.fn().mockReturnValue({ test: 'state' }),
    setState: vi.fn(),
    subscribe: vi.fn(),
    destroy: vi.fn(),
  })),
}));

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
      getState: vi.fn(),
      subscribe: vi.fn(),
    } as unknown as Handlers<AnyState>;
  });

  it('should return a store hook', async () => {
    const useStore = createUseStore<AnyState>();
    expect(useStore).toBeDefined();
    // We're now calling our local implementation instead of core
    // expect(core.createUseStore).toHaveBeenCalled();
  });

  it('should create a useStore hook with custom handlers when provided', () => {
    const customHandlers = {
      dispatch: vi.fn(),
      getState: vi.fn().mockResolvedValue({ custom: true }),
      subscribe: vi.fn(),
    } as unknown as Handlers<AnyState>;

    const useStore = createUseStore<AnyState>(customHandlers);
    expect(useStore).toBeDefined();
    // We're now calling our local implementation with custom handlers
    // expect(core.createUseStore).toHaveBeenCalledWith(customHandlers);
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
    // We're now calling our local implementation instead of core
    // expect(core.useDispatch).toHaveBeenCalled();
  });

  it('should create a dispatch function with custom handlers when provided', () => {
    const customHandlers = {
      dispatch: vi.fn(),
      getState: vi.fn(),
      subscribe: vi.fn(),
    } as unknown as Handlers<AnyState>;

    const dispatch = useDispatch<AnyState>(customHandlers);
    expect(dispatch).toBeDefined();
    // We're now calling our local implementation with custom handlers
    // expect(core.useDispatch).toHaveBeenCalledWith(customHandlers);
  });
});

describe('createCoreUseStore', () => {
  it('should create a useStore hook with given handlers', () => {
    const mockHandlers = {
      dispatch: vi.fn(),
      getState: vi.fn().mockResolvedValue({ test: 'state' }),
      subscribe: vi.fn(),
    };

    const useStore = createCoreUseStore(mockHandlers as any);
    expect(useStore).toBeDefined();
  });
});

describe('useCoreDispatch', () => {
  it('should create a dispatch function with given handlers', () => {
    const mockHandlers = {
      dispatch: vi.fn(),
      getState: vi.fn().mockResolvedValue({ test: 'state' }),
      subscribe: vi.fn(),
    };

    const dispatch = useCoreDispatch(mockHandlers as any);
    expect(dispatch).toBeDefined();
  });
});
