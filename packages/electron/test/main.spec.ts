import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mainZustandBridge, createDispatch } from '../src/main';
import type { BrowserWindow } from 'electron';
import type { StoreApi } from 'zustand';
import type { AnyState } from '../src/index';

vi.mock('electron', () => ({
  ipcMain: {
    on: vi.fn(),
    handle: vi.fn(),
    emit: vi.fn(),
  },
}));

import { ipcMain } from 'electron';

describe('createDispatch', () => {
  const mockStore = {
    dispatch: vi.fn(),
    getState: vi.fn().mockReturnValue({ test: 'state' }),
    setState: vi.fn(),
    subscribe: vi.fn(),
  } as unknown as StoreApi<AnyState> & {
    dispatch: ReturnType<typeof vi.fn>;
    getState: ReturnType<typeof vi.fn>;
    setState: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle separate handlers case', () => {
    const mockHandler = vi.fn();
    const options = {
      handlers: {
        TEST_ACTION: mockHandler,
      },
    };

    const dispatch = createDispatch(mockStore, options);
    dispatch('TEST_ACTION', 'test-payload');

    expect(mockHandler).toHaveBeenCalledWith('test-payload');
  });

  it('should handle reducer case', () => {
    const mockReducer = vi.fn();
    const options = {
      reducer: mockReducer,
    };

    const dispatch = createDispatch(mockStore, options);
    dispatch('TEST_ACTION', 'test-payload');

    expect(mockStore.setState).toHaveBeenCalled();
    const setStateCallback = mockStore.setState.mock.calls[0][0];
    setStateCallback({});
    expect(mockReducer).toHaveBeenCalledWith({}, { type: 'TEST_ACTION', payload: 'test-payload' });
  });

  it('should handle store-based handlers case', () => {
    const mockHandler = vi.fn();
    mockStore.getState.mockReturnValue({
      TEST_ACTION: mockHandler,
    });

    const dispatch = createDispatch(mockStore);
    dispatch('TEST_ACTION', 'test-payload');

    expect(mockHandler).toHaveBeenCalledWith('test-payload');
  });
});

describe('mainZustandBridge', () => {
  const mockStore = {
    dispatch: vi.fn(),
    getState: vi.fn().mockReturnValue({ test: 'state' }),
    subscribe: vi.fn(),
  } as unknown as StoreApi<AnyState> & {
    dispatch: ReturnType<typeof vi.fn>;
    getState: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  };

  const mockWindow = {
    webContents: {
      send: vi.fn(),
    },
    isDestroyed: vi.fn().mockReturnValue(false),
  } as unknown as BrowserWindow & {
    webContents: {
      send: ReturnType<typeof vi.fn>;
    };
    isDestroyed: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass dispatch messages through to the store', () => {
    mainZustandBridge(ipcMain, mockStore, [mockWindow]);
    expect(ipcMain.on).toHaveBeenCalledWith('zustand-dispatch', expect.any(Function));
    const dispatchHandler = (ipcMain.on as ReturnType<typeof vi.fn>).mock.calls[0][1];
    dispatchHandler({}, { type: 'test', payload: 'data' });
    expect(mockStore.getState).toHaveBeenCalled();
  });

  it('should handle getState calls and return the sanitized state', () => {
    mainZustandBridge(ipcMain, mockStore, [mockWindow]);
    expect(ipcMain.handle).toHaveBeenCalledWith('zustand-getState', expect.any(Function));
    const getStateHandler = (ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls[0][1];
    const result = getStateHandler();
    expect(result).toEqual({ test: 'state' });
  });

  it('should handle subscribe calls and send sanitized state to the window', () => {
    mainZustandBridge(ipcMain, mockStore, [mockWindow]);
    expect(mockStore.subscribe).toHaveBeenCalledWith(expect.any(Function));
    const subscription = mockStore.subscribe.mock.calls[0][0];
    subscription({ test: 'state', handler: () => {} });
    expect(mockWindow.webContents.send).toHaveBeenCalledWith('zustand-update', { test: 'state' });
  });

  it('should handle multiple windows', () => {
    const mockWindow2 = {
      webContents: {
        send: vi.fn(),
      },
      isDestroyed: vi.fn().mockReturnValue(false),
    } as unknown as BrowserWindow & {
      webContents: {
        send: ReturnType<typeof vi.fn>;
      };
      isDestroyed: ReturnType<typeof vi.fn>;
    };
    mainZustandBridge(ipcMain, mockStore, [mockWindow, mockWindow2]);
    const subscription = mockStore.subscribe.mock.calls[0][0];
    subscription({ test: 'state', handler: () => {} });
    expect(mockWindow.webContents.send).toHaveBeenCalledWith('zustand-update', { test: 'state' });
    expect(mockWindow2.webContents.send).toHaveBeenCalledWith('zustand-update', { test: 'state' });
  });

  it('should handle destroyed windows', () => {
    mockWindow.isDestroyed.mockReturnValue(true);
    mainZustandBridge(ipcMain, mockStore, [mockWindow]);
    const subscription = mockStore.subscribe.mock.calls[0][0];
    subscription({ test: 'state', handler: () => {} });
    expect(mockWindow.webContents.send).not.toHaveBeenCalled();
  });

  it('should return an unsubscribe function', () => {
    const mockUnsubscribe = vi.fn();
    mockStore.subscribe.mockReturnValue(mockUnsubscribe);
    const { unsubscribe } = mainZustandBridge(ipcMain, mockStore, [mockWindow]);
    expect(mockStore.subscribe).toHaveBeenCalled();
    unsubscribe();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
