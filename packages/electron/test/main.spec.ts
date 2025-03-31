import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { StoreApi } from 'zustand';
import type { AnyState, Handler, WebContentsWrapper } from '@zubridge/types';

const mockIpcMain = {
  emit: vi.fn().mockImplementation((event: string, ...args: unknown[]) => {
    const calls = (mockIpcMain.on.mock.calls.filter((call) => call[0] === event) || []) as [string, Handler][];
    for (const call of calls) {
      const handler = call[1];
      handler(...args);
    }
  }),
  handle: vi.fn() as unknown as Mock,
  on: vi.fn() as unknown as Mock,
  removeHandler: vi.fn() as unknown as Mock,
  removeAllListeners: vi.fn() as unknown as Mock,
};

vi.mock('electron', () => ({
  ipcMain: mockIpcMain,
  default: {
    ipcMain: mockIpcMain,
  },
}));

const { mainZustandBridge, createDispatch } = await import('../src/main.js');

describe('createDispatch', () => {
  let mockStore: Record<string, Mock>;

  beforeEach(() => {
    mockStore = {
      getState: vi.fn(),
      setState: vi.fn(),
      subscribe: vi.fn(),
      getInitialState: vi.fn(),
    };
  });

  describe('when created with store-based handlers', () => {
    const testState: Record<string, Mock | string> = { test: 'state' };

    beforeEach(() => {
      testState.testAction = vi.fn();
      mockStore.getState.mockReturnValue(testState);
    });

    it('should call a handler with the expected payload - string action', () => {
      const dispatch = createDispatch(mockStore as unknown as StoreApi<AnyState>);

      dispatch('testAction', { test: 'payload' });
      expect(testState.testAction).toHaveBeenCalledWith({ test: 'payload' });
    });

    it('should call a handler with the expected payload - action object', () => {
      const dispatch = createDispatch(mockStore as unknown as StoreApi<AnyState>);

      dispatch({ type: 'testAction', payload: { test: 'payload' } });
      expect(testState.testAction).toHaveBeenCalledWith({ test: 'payload' });
    });
  });

  describe('when created with separate handlers', () => {
    const mockHandlers = {
      testAction: vi.fn(),
    };

    it('should call the handler with the expected payload', () => {
      const dispatch = createDispatch(mockStore as unknown as StoreApi<AnyState>, { handlers: mockHandlers });

      dispatch('testAction', { test: 'payload' });
      expect(mockHandlers.testAction).toHaveBeenCalledWith({ test: 'payload' });
    });
  });

  describe('when created with a reducer', () => {
    const mockReducer = vi.fn().mockImplementation((state, action) => ({
      ...state,
      test: action.payload,
    }));

    it('should call the reducer with the current state and action', () => {
      const initialState = { test: 'initial' };
      mockStore.getState.mockReturnValue(initialState);
      mockStore.setState.mockImplementation((fn) => {
        const newState = fn(initialState);
        expect(mockReducer).toHaveBeenCalledWith(initialState, { type: 'testAction', payload: { test: 'payload' } });
        return newState;
      });

      const dispatch = createDispatch(mockStore as unknown as StoreApi<AnyState>, { reducer: mockReducer });
      dispatch('testAction', { test: 'payload' });
    });
  });
});

describe('mainZustandBridge', () => {
  let mockStore: Record<string, Mock>;
  let mockWrapper: WebContentsWrapper;

  beforeEach(() => {
    mockStore = {
      getState: vi.fn().mockReturnValue({ test: 'state' }),
      setState: vi.fn(),
      subscribe: vi.fn().mockReturnValue(vi.fn()),
      getInitialState: vi.fn(),
    };

    const isDestroyedMock = vi.fn().mockReturnValue(false);
    mockWrapper = {
      webContents: {
        send: vi.fn(),
        isDestroyed: isDestroyedMock,
        isLoading: vi.fn().mockReturnValue(false),
        once: vi.fn(),
      } as unknown as Electron.WebContents,
      isDestroyed: isDestroyedMock,
    };
  });

  it('should pass dispatch messages through to the store', () => {
    const { unsubscribe } = mainZustandBridge(mockStore as unknown as StoreApi<AnyState>, [mockWrapper]);

    mockIpcMain.on.mock.calls[0][1](null, 'testAction', { test: 'payload' });
    expect(mockStore.getState).toHaveBeenCalled();

    unsubscribe();
  });

  it('should handle getState calls and return the sanitized state', async () => {
    const { unsubscribe } = mainZustandBridge(mockStore as unknown as StoreApi<AnyState>, [mockWrapper]);

    const result = await mockIpcMain.handle.mock.calls[0][1]();
    expect(result).toEqual({ test: 'state' });

    unsubscribe();
  });

  it('should handle subscribe calls and send sanitized state to the window', () => {
    const { unsubscribe } = mainZustandBridge(mockStore as unknown as StoreApi<AnyState>, [mockWrapper]);

    // Manually trigger the subscription callback
    const subscriber = mockStore.subscribe.mock.calls[0][0];
    subscriber({ test: 'new state' });

    expect(mockWrapper.webContents.send).toHaveBeenCalledWith('zubridge-subscribe', { test: 'new state' });

    unsubscribe();
  });

  it('should handle multiple windows', () => {
    const isDestroyedMock2 = vi.fn().mockReturnValue(false);
    const mockWrapper2: WebContentsWrapper = {
      webContents: {
        send: vi.fn(),
        isDestroyed: isDestroyedMock2,
        isLoading: vi.fn().mockReturnValue(false),
        once: vi.fn(),
      } as unknown as Electron.WebContents,
      isDestroyed: isDestroyedMock2,
    };

    const { unsubscribe } = mainZustandBridge(mockStore as unknown as StoreApi<AnyState>, [mockWrapper, mockWrapper2]);

    // Manually trigger the subscription callback
    const subscriber = mockStore.subscribe.mock.calls[0][0];
    subscriber({ test: 'new state' });

    expect(mockWrapper.webContents.send).toHaveBeenCalledWith('zubridge-subscribe', { test: 'new state' });
    expect(mockWrapper2.webContents.send).toHaveBeenCalledWith('zubridge-subscribe', { test: 'new state' });

    unsubscribe();
  });

  it('should handle destroyed windows', () => {
    (mockWrapper.isDestroyed as Mock).mockReturnValue(true);

    const { unsubscribe } = mainZustandBridge(mockStore as unknown as StoreApi<AnyState>, [mockWrapper]);

    mockStore.subscribe.mock.calls[0][0]({ test: 'new state' });
    expect(mockWrapper.webContents.send).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('should return an unsubscribe function', () => {
    const { unsubscribe } = mainZustandBridge(mockStore as unknown as StoreApi<AnyState>, [mockWrapper]);
    expect(typeof unsubscribe).toBe('function');
    expect(mockStore.subscribe).toHaveBeenCalled();
  });
});
