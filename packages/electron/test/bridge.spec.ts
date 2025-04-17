import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, WebContents } from 'electron';
import type { AnyState, StateManager, WebContentsWrapper } from '@zubridge/types';
import type { StoreApi } from 'zustand/vanilla';
import type { Store } from 'redux';
import { createCoreBridge, createBridgeFromStore } from '../src/bridge';
import * as registryModule from '../src/utils/stateManagerRegistry';

// Mock the stateManagerRegistry module
vi.mock('../src/utils/stateManagerRegistry', () => {
  return {
    getStateManager: vi.fn(),
  };
});

// Helper mock functions
function createMockWebContents(id = 1): WebContentsWrapper {
  return {
    id,
    send: vi.fn(),
    isDestroyed: vi.fn(() => false),
    ipc: {
      handle: vi.fn(),
      removeHandler: vi.fn(),
    },
  } as unknown as WebContentsWrapper;
}

function createMockBrowserWindow(id = 1): BrowserWindow {
  const webContents = createMockWebContents(id);
  return {
    webContents,
  } as unknown as BrowserWindow;
}

function createMockStateManager(): StateManager<AnyState> {
  return {
    getState: vi.fn(() => ({ counter: 0 })),
    subscribe: vi.fn(() => () => {}),
    processAction: vi.fn(),
  } as unknown as StateManager<AnyState>;
}

function createMockZustandStore(): StoreApi<AnyState> {
  return {
    getState: vi.fn(() => ({ counter: 0 })),
    setState: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  } as unknown as StoreApi<AnyState>;
}

function createMockReduxStore(): Store<AnyState> {
  return {
    getState: vi.fn(() => ({ counter: 0 })),
    dispatch: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    replaceReducer: vi.fn(),
    [Symbol.observable]: vi.fn(),
  } as unknown as Store<AnyState>;
}

describe('bridge.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getWebContentsId (internal function)', () => {
    // We can test this indirectly through createCoreBridge
    it('should extract WebContents ID from BrowserWindow', () => {
      const stateManager = createMockStateManager();
      const browserWindow = createMockBrowserWindow();
      const bridge = createCoreBridge(stateManager, [browserWindow]);

      expect(bridge.getSubscribedWindows()).toEqual([1]);
    });

    it('should extract WebContents ID from WebContents object', () => {
      const stateManager = createMockStateManager();
      const webContents = createMockWebContents();
      const bridge = createCoreBridge(stateManager, [webContents]);

      expect(bridge.getSubscribedWindows()).toEqual([1]);
    });
  });

  describe('createCoreBridge', () => {
    it('should create a bridge with the provided state manager', () => {
      const stateManager = createMockStateManager();
      const bridge = createCoreBridge(stateManager);

      expect(bridge).toHaveProperty('subscribe');
      expect(bridge).toHaveProperty('unsubscribe');
      expect(bridge).toHaveProperty('getSubscribedWindows');
      expect(bridge).toHaveProperty('destroy');
    });

    it('should not subscribe any windows when none are provided', () => {
      const stateManager = createMockStateManager();
      const bridge = createCoreBridge(stateManager);

      expect(bridge.getSubscribedWindows()).toEqual([]);
    });

    it('should subscribe provided windows', () => {
      const stateManager = createMockStateManager();
      const browserWindow = createMockBrowserWindow();
      const bridge = createCoreBridge(stateManager, [browserWindow]);

      expect(bridge.getSubscribedWindows()).toEqual([1]);
      expect(browserWindow.webContents.send).toHaveBeenCalledWith('__zubridge_state_update', { counter: 0 });
      expect(browserWindow.webContents.ipc.handle).toHaveBeenCalledWith('__zubridge_get_state', expect.any(Function));
      expect(browserWindow.webContents.ipc.handle).toHaveBeenCalledWith(
        '__zubridge_dispatch_action',
        expect.any(Function),
      );
    });

    it('should handle multiple windows', () => {
      const stateManager = createMockStateManager();
      const browserWindow1 = createMockBrowserWindow(1);
      const browserWindow2 = createMockBrowserWindow(2);

      const bridge = createCoreBridge(stateManager, [browserWindow1, browserWindow2]);

      expect(bridge.getSubscribedWindows()).toEqual([1, 2]);
      expect(browserWindow1.webContents.send).toHaveBeenCalledWith('__zubridge_state_update', { counter: 0 });
      expect(browserWindow2.webContents.send).toHaveBeenCalledWith('__zubridge_state_update', { counter: 0 });
    });

    it('should skip destroyed web contents', () => {
      const stateManager = createMockStateManager();
      const browserWindow = createMockBrowserWindow();

      // Mock the window as destroyed
      vi.mocked(browserWindow.webContents.isDestroyed).mockReturnValue(true);

      const bridge = createCoreBridge(stateManager, [browserWindow]);

      // Window should be in the subscribedWindows set, but no operations should be performed on it
      expect(bridge.getSubscribedWindows()).toEqual([1]);
      expect(browserWindow.webContents.send).not.toHaveBeenCalled();
      expect(browserWindow.webContents.ipc.handle).not.toHaveBeenCalled();
    });

    it('should subscribe to state changes', () => {
      const stateManager = createMockStateManager();
      const browserWindow = createMockBrowserWindow();
      const unsubscribeMock = vi.fn();

      // Mock the subscribe function to capture the callback and return unsubscribe
      vi.mocked(stateManager.subscribe).mockImplementation((callback) => {
        // Simulate a state update
        callback({ counter: 5 });
        return unsubscribeMock;
      });

      const bridge = createCoreBridge(stateManager, [browserWindow]);

      expect(stateManager.subscribe).toHaveBeenCalled();
      expect(browserWindow.webContents.send).toHaveBeenCalledWith('__zubridge_state_update', { counter: 5 });
    });

    it('should handle new windows subscription', () => {
      const stateManager = createMockStateManager();
      const bridge = createCoreBridge(stateManager);

      // Initially no windows
      expect(bridge.getSubscribedWindows()).toEqual([]);

      // Subscribe a new window
      const browserWindow = createMockBrowserWindow();
      bridge.subscribe([browserWindow]);

      expect(bridge.getSubscribedWindows()).toEqual([1]);
      expect(browserWindow.webContents.send).toHaveBeenCalledWith('__zubridge_state_update', { counter: 0 });
    });

    it('should handle window unsubscription', () => {
      const stateManager = createMockStateManager();
      const browserWindow1 = createMockBrowserWindow(1);
      const browserWindow2 = createMockBrowserWindow(2);

      const unsubscribeMock1 = vi.fn();
      const unsubscribeMock2 = vi.fn();

      // Set up different unsubscribe functions for each window
      vi.mocked(stateManager.subscribe).mockImplementationOnce(() => unsubscribeMock1);
      vi.mocked(stateManager.subscribe).mockImplementationOnce(() => unsubscribeMock2);

      const bridge = createCoreBridge(stateManager, [browserWindow1, browserWindow2]);

      expect(bridge.getSubscribedWindows()).toEqual([1, 2]);

      // Unsubscribe one window
      bridge.unsubscribe([browserWindow1]);

      expect(bridge.getSubscribedWindows()).toEqual([2]);
      expect(unsubscribeMock1).toHaveBeenCalled();
      expect(unsubscribeMock2).not.toHaveBeenCalled();
    });

    it('should unsubscribe all windows when called without arguments', () => {
      const stateManager = createMockStateManager();
      const browserWindow1 = createMockBrowserWindow(1);
      const browserWindow2 = createMockBrowserWindow(2);

      const unsubscribeMock1 = vi.fn();
      const unsubscribeMock2 = vi.fn();

      // Set up different unsubscribe functions for each window
      vi.mocked(stateManager.subscribe).mockImplementationOnce(() => unsubscribeMock1);
      vi.mocked(stateManager.subscribe).mockImplementationOnce(() => unsubscribeMock2);

      const bridge = createCoreBridge(stateManager, [browserWindow1, browserWindow2]);

      expect(bridge.getSubscribedWindows()).toEqual([1, 2]);

      // Unsubscribe all windows
      bridge.unsubscribe();

      expect(bridge.getSubscribedWindows()).toEqual([]);
      expect(unsubscribeMock1).toHaveBeenCalled();
      expect(unsubscribeMock2).toHaveBeenCalled();
    });

    it('should clean up all resources when destroy is called', () => {
      const stateManager = createMockStateManager();
      const browserWindow = createMockBrowserWindow();
      const unsubscribeMock = vi.fn();

      vi.mocked(stateManager.subscribe).mockImplementation(() => unsubscribeMock);

      const bridge = createCoreBridge(stateManager, [browserWindow]);

      expect(bridge.getSubscribedWindows()).toEqual([1]);

      bridge.destroy();

      expect(bridge.getSubscribedWindows()).toEqual([]);
      expect(unsubscribeMock).toHaveBeenCalled();
    });

    it('should correctly handle IPC dispatch messages', () => {
      const stateManager = createMockStateManager();
      const browserWindow = createMockBrowserWindow();

      createCoreBridge(stateManager, [browserWindow]);

      // Get the dispatch handler
      const dispatchHandler = vi
        .mocked(browserWindow.webContents.ipc.handle)
        .mock.calls.find((call) => call[0] === '__zubridge_dispatch_action')?.[1];

      expect(dispatchHandler).toBeDefined();

      if (dispatchHandler) {
        // Simulate an IPC message
        const action = { type: 'TEST_ACTION', payload: 42 };
        const result = dispatchHandler({} as any, { action });

        expect(stateManager.processAction).toHaveBeenCalledWith(action);
        expect(result).toEqual({ success: true });
      }
    });

    it('should correctly handle IPC get state messages', () => {
      const stateManager = createMockStateManager();
      const browserWindow = createMockBrowserWindow();

      createCoreBridge(stateManager, [browserWindow]);

      // Get the get state handler
      const getStateHandler = vi
        .mocked(browserWindow.webContents.ipc.handle)
        .mock.calls.find((call) => call[0] === '__zubridge_get_state')?.[1];

      expect(getStateHandler).toBeDefined();

      if (getStateHandler) {
        // Simulate an IPC message
        const result = getStateHandler({} as any);

        expect(stateManager.getState).toHaveBeenCalled();
        expect(result).toEqual({ counter: 0 });
      }
    });

    it('should handle errors in processAction', () => {
      const stateManager = createMockStateManager();
      const browserWindow = createMockBrowserWindow();

      // Mock processAction to throw an error
      vi.mocked(stateManager.processAction).mockImplementation(() => {
        throw new Error('Test error');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      createCoreBridge(stateManager, [browserWindow]);

      // Get the dispatch handler
      const dispatchHandler = vi
        .mocked(browserWindow.webContents.ipc.handle)
        .mock.calls.find((call) => call[0] === '__zubridge_dispatch_action')?.[1];

      if (dispatchHandler) {
        // Simulate an IPC message
        const action = { type: 'TEST_ACTION' };
        const result = dispatchHandler({} as any, { action });

        expect(stateManager.processAction).toHaveBeenCalledWith(action);
        expect(consoleSpy).toHaveBeenCalledWith('[Bridge] Error processing action:', expect.any(Error));
        expect(result).toEqual({ success: false, error: 'Error: Test error' });
      }

      consoleSpy.mockRestore();
    });
  });

  describe('createBridgeFromStore', () => {
    it('should get the state manager for a Zustand store', () => {
      const store = createMockZustandStore();
      const stateManager = createMockStateManager();
      const options = { testOption: true };

      vi.mocked(registryModule.getStateManager).mockReturnValue(stateManager);

      createBridgeFromStore(store, [], options as any);

      expect(registryModule.getStateManager).toHaveBeenCalledWith(store, options);
    });

    it('should get the state manager for a Redux store', () => {
      const store = createMockReduxStore();
      const stateManager = createMockStateManager();
      const options = { testOption: true };

      vi.mocked(registryModule.getStateManager).mockReturnValue(stateManager);

      createBridgeFromStore(store, [], options as any);

      expect(registryModule.getStateManager).toHaveBeenCalledWith(store, options);
    });

    it('should create a core bridge with the state manager', () => {
      const store = createMockZustandStore();
      const stateManager = createMockStateManager();
      const browserWindow = createMockBrowserWindow();

      vi.mocked(registryModule.getStateManager).mockReturnValue(stateManager);

      const bridge = createBridgeFromStore(store, [browserWindow]);

      expect(bridge.getSubscribedWindows()).toEqual([1]);
      expect(browserWindow.webContents.send).toHaveBeenCalledWith('__zubridge_state_update', { counter: 0 });
    });
  });
});
