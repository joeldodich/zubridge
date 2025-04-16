import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { StateManager, WebContentsWrapper } from '@zubridge/types';
import { IpcChannel } from '../src/constants';

// Import the module being tested
import * as GenericBridgeModule from '../src/generic-bridge';

// Set up mocks first, before spying on module functions
vi.mock('electron', async () => {
  return {
    ipcMain: {
      on: vi.fn(),
      handle: vi.fn(),
      removeHandler: vi.fn(),
      removeAllListeners: vi.fn(),
    },
  };
});

// Import after mocking dependencies
import { ipcMain } from 'electron';

describe('createGenericBridge', () => {
  let mockStateManager: StateManager<any>;
  let mockWrapper: WebContentsWrapper;
  let stateSubscriberCallback: (state: any) => void;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset mock functions
    vi.clearAllMocks();

    // Spy on console.error
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Initialize mock state manager
    stateSubscriberCallback = vi.fn();
    mockStateManager = {
      getState: vi.fn().mockReturnValue({ test: 'state' }),
      subscribe: vi.fn().mockImplementation((callback) => {
        stateSubscriberCallback = callback;
        return vi.fn(); // Unsubscribe function
      }),
      processAction: vi.fn(),
    };

    // Initialize mock wrapper
    mockWrapper = {
      webContents: {
        id: 1,
        send: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(false),
        once: vi.fn(),
      } as any,
      isDestroyed: vi.fn().mockReturnValue(false),
    };
  });

  afterEach(() => {
    // Restore console.error
    consoleErrorSpy.mockRestore();
  });

  it('should handle actions from renderers', () => {
    GenericBridgeModule.createGenericBridge(mockStateManager, [mockWrapper]);

    // Get the handler function registered for DISPATCH
    const dispatchHandler = (ipcMain.on as any).mock.calls.find((call: any) => call[0] === IpcChannel.DISPATCH)?.[1];

    expect(dispatchHandler).toBeDefined();

    // Simulate an action dispatch
    const action = { type: 'TEST_ACTION', payload: 'test' };
    dispatchHandler({}, action);

    // Check if the state manager processed the action
    expect(mockStateManager.processAction).toHaveBeenCalledWith(action);
  });

  it('should handle errors in action dispatch without crashing', () => {
    // Make processAction throw an error
    (mockStateManager.processAction as any).mockImplementation(() => {
      throw new Error('Test error');
    });

    GenericBridgeModule.createGenericBridge(mockStateManager, [mockWrapper]);

    // Get the handler function registered for DISPATCH
    const dispatchHandler = (ipcMain.on as any).mock.calls.find((call: any) => call[0] === IpcChannel.DISPATCH)?.[1];

    // Simulate an action dispatch that will cause an error
    const action = { type: 'ERROR_ACTION', payload: 'test' };
    dispatchHandler({}, action);

    // Check if error was logged
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should handle getState requests from renderers', () => {
    GenericBridgeModule.createGenericBridge(mockStateManager, [mockWrapper]);

    // Get the handler function registered for GET_STATE
    const getStateHandler = (ipcMain.handle as any).mock.calls.find(
      (call: any) => call[0] === IpcChannel.GET_STATE,
    )?.[1];

    expect(getStateHandler).toBeDefined();

    // Simulate a getState request
    const state = getStateHandler();

    // Check if the state manager's getState was called
    expect(mockStateManager.getState).toHaveBeenCalled();
    expect(state).toEqual({ test: 'state' });
  });

  it('should handle getState errors gracefully in the handler function', () => {
    // Get the handler function directly without initializing the bridge
    GenericBridgeModule.createGenericBridge(mockStateManager, [mockWrapper]);

    // Mock getState to throw
    mockStateManager.getState = vi.fn().mockImplementation(() => {
      throw new Error('Get state error');
    });

    // Get the actual handler from the mock calls
    const getStateHandler = (ipcMain.handle as any).mock.calls.find(
      (call: any) => call[0] === IpcChannel.GET_STATE,
    )?.[1];

    // Invoke the handler directly
    const result = getStateHandler();

    // Check the result and error logging
    expect(result).toEqual({});
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error handling getState'), expect.any(Error));
  });

  it('should handle subscription errors gracefully', () => {
    // Create a fresh error spy for this test only
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Create a bridge that won't throw on initialization
    const bridge = GenericBridgeModule.createGenericBridge(mockStateManager, [mockWrapper]);

    // Make an error happen only during the state update
    mockWrapper.webContents.send = vi.fn().mockImplementation(() => {
      throw new Error('Send error during state update');
    });

    // This should not throw an error even though send throws
    expect(() => {
      stateSubscriberCallback({ updated: 'state' });
    }).not.toThrow();

    // Clean up
    errorSpy.mockRestore();
  });

  it('should handle loading windows', () => {
    // Set up a window that's still loading
    const loadingWrapper: WebContentsWrapper = {
      webContents: {
        id: 2,
        send: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(true), // Window is loading
        once: vi.fn().mockImplementation((event, callback) => {
          // Store the callback to call it later
          if (event === 'did-finish-load') {
            setTimeout(() => callback(), 0);
          }
        }),
      } as any,
      isDestroyed: vi.fn().mockReturnValue(false),
    };

    GenericBridgeModule.createGenericBridge(mockStateManager, [loadingWrapper]);

    // The once handler should be registered for 'did-finish-load'
    expect(loadingWrapper.webContents.once).toHaveBeenCalledWith('did-finish-load', expect.any(Function));

    // Return a promise to wait for the setTimeout to execute
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // The window should have received the state
        expect(loadingWrapper.webContents.send).toHaveBeenCalledWith(IpcChannel.SUBSCRIBE, { test: 'state' });
        resolve();
      }, 10);
    });
  });

  it('should handle loading window that gets destroyed before loading finishes', () => {
    // Set up a window that's loading
    const loadingWrapper: WebContentsWrapper = {
      webContents: {
        id: 3,
        send: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(true), // Window is loading
        once: vi.fn().mockImplementation((event, callback) => {
          // Store the callback to call it later, after the window is destroyed
          if (event === 'did-finish-load') {
            setTimeout(() => {
              // Set destroyed to true before callback
              (loadingWrapper.webContents.isDestroyed as any).mockReturnValue(true);
              callback();
            }, 0);
          }
        }),
      } as any,
      isDestroyed: vi.fn().mockReturnValue(false),
    };

    GenericBridgeModule.createGenericBridge(mockStateManager, [loadingWrapper]);

    // Get the callback function
    expect(loadingWrapper.webContents.once).toHaveBeenCalledWith('did-finish-load', expect.any(Function));

    // Return a promise to wait for the setTimeout to execute
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // The window should not have received any state because it's destroyed
        expect(loadingWrapper.webContents.send).not.toHaveBeenCalled();
        resolve();
      }, 10);
    });
  });

  it('should handle destroying the bridge', () => {
    const bridge = GenericBridgeModule.createGenericBridge(mockStateManager, [mockWrapper]);

    // The destroy function should cleanup resources
    bridge.destroy();

    // Should remove the GET_STATE handler
    expect(ipcMain.removeHandler).toHaveBeenCalledWith(IpcChannel.GET_STATE);

    // Should call the state manager unsubscribe function
    expect(mockStateManager.subscribe).toHaveBeenCalled();
    const unsubscribe = (mockStateManager.subscribe as any).mock.results[0].value;
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('should handle invalid wrappers', () => {
    // Create an invalid wrapper without webContents
    const invalidWrapper = { isDestroyed: vi.fn().mockReturnValue(false) } as any;

    // This should not throw
    const bridge = GenericBridgeModule.createGenericBridge(mockStateManager, [invalidWrapper]);

    // Should still create bridge
    expect(bridge).toBeDefined();

    // Trigger a state update, which should still work
    stateSubscriberCallback({ updated: 'state' });

    // Since no valid wrappers exist, no send calls should happen
    expect(mockWrapper.webContents.send).not.toHaveBeenCalled();
  });
});
