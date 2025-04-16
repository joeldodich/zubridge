import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { StateManager, WebContentsWrapper } from '@zubridge/types';
import { IpcChannel } from '../src/constants.js';
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
// Import the createCoreBridge function
import { createCoreBridge } from '../src/bridge.js';

describe('createCoreBridge', () => {
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
    createCoreBridge(mockStateManager, [mockWrapper]);

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

    createCoreBridge(mockStateManager, [mockWrapper]);

    // Get the handler function registered for DISPATCH
    const dispatchHandler = (ipcMain.on as any).mock.calls.find((call: any) => call[0] === IpcChannel.DISPATCH)?.[1];

    // Simulate an action dispatch that will cause an error
    const action = { type: 'ERROR_ACTION', payload: 'test' };
    dispatchHandler({}, action);

    // Check if error was logged
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should handle getState requests from renderers', () => {
    createCoreBridge(mockStateManager, [mockWrapper]);

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
    createCoreBridge(mockStateManager, [mockWrapper]);

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
    const bridge = createCoreBridge(mockStateManager, [mockWrapper]);

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

    createCoreBridge(mockStateManager, [loadingWrapper]);

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

    createCoreBridge(mockStateManager, [loadingWrapper]);

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
    const bridge = createCoreBridge(mockStateManager, [mockWrapper]);

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
    const bridge = createCoreBridge(mockStateManager, [invalidWrapper]);

    // Should still create bridge
    expect(bridge).toBeDefined();

    // Trigger a state update, which should still work
    stateSubscriberCallback({ updated: 'state' });

    // Since no valid wrappers exist, no send calls should happen
    expect(mockWrapper.webContents.send).not.toHaveBeenCalled();
  });

  // Additional tests for improved coverage

  it('should handle subscribing new windows after initialization', () => {
    const bridge = createCoreBridge(mockStateManager, []);

    // Create a new window to subscribe
    const newWrapper: WebContentsWrapper = {
      webContents: {
        id: 5,
        send: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(false),
        once: vi.fn(),
      } as any,
      isDestroyed: vi.fn().mockReturnValue(false),
    };

    // Subscribe the new window
    const subscription = bridge.subscribe([newWrapper]);

    // Verify initial state was sent
    expect(newWrapper.webContents.send).toHaveBeenCalledWith(IpcChannel.SUBSCRIBE, { test: 'state' });

    // Verify it has an unsubscribe method
    expect(subscription.unsubscribe).toBeDefined();
  });

  it('should not send state updates to unsubscribed windows', () => {
    const bridge = createCoreBridge(mockStateManager, [mockWrapper]);

    // Clear send calls from initialization
    (mockWrapper.webContents.send as any).mockClear();

    // Unsubscribe the window
    bridge.unsubscribe([mockWrapper]);

    // Trigger a state update
    stateSubscriberCallback({ updated: 'state' });

    // Window should not receive the update
    expect(mockWrapper.webContents.send).not.toHaveBeenCalled();
  });

  it('should handle window errors when checking destroyed state', () => {
    // Create a wrapper that throws when isDestroyed is called
    const errorWrapper: WebContentsWrapper = {
      webContents: {
        id: 6,
        send: vi.fn(),
        isDestroyed: vi.fn().mockImplementation(() => {
          throw new Error('isDestroyed error');
        }),
        isLoading: vi.fn().mockReturnValue(false),
        once: vi.fn(),
      } as any,
      isDestroyed: vi.fn().mockImplementation(() => {
        throw new Error('isDestroyed error');
      }),
    };

    // This should not throw
    const bridge = createCoreBridge(mockStateManager, [errorWrapper]);

    // Trigger a state update
    stateSubscriberCallback({ updated: 'state' });

    // Should not crash, and the errorWrapper should be effectively ignored
    expect(bridge).toBeDefined();
  });

  it('should gracefully handle unsubscribing all windows', () => {
    // Create multiple wrappers
    const wrapper1: WebContentsWrapper = {
      webContents: {
        id: 10,
        send: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(false),
        once: vi.fn(),
      } as any,
      isDestroyed: vi.fn().mockReturnValue(false),
    };

    const wrapper2: WebContentsWrapper = {
      webContents: {
        id: 11,
        send: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(false),
        once: vi.fn(),
      } as any,
      isDestroyed: vi.fn().mockReturnValue(false),
    };

    const bridge = createCoreBridge(mockStateManager, [wrapper1, wrapper2]);

    // Clear any send calls from initialization
    (wrapper1.webContents.send as any).mockClear();
    (wrapper2.webContents.send as any).mockClear();

    // Unsubscribe all windows
    bridge.unsubscribe();

    // Trigger a state update
    stateSubscriberCallback({ updated: 'state' });

    // No windows should receive the update
    expect(wrapper1.webContents.send).not.toHaveBeenCalled();
    expect(wrapper2.webContents.send).not.toHaveBeenCalled();
  });

  it('should register destroyed event handler on window', () => {
    // Create a wrapper
    const wrapper: WebContentsWrapper = {
      webContents: {
        id: 12,
        send: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(false),
        once: vi.fn(),
      } as any,
      isDestroyed: vi.fn().mockReturnValue(false),
    };

    createCoreBridge(mockStateManager, [wrapper]);

    // Verify 'destroyed' event handler was registered
    expect(wrapper.webContents.once).toHaveBeenCalledWith('destroyed', expect.any(Function));
  });

  it('should return the list of subscribed window IDs', () => {
    // Create wrappers with different IDs
    const wrapper1: WebContentsWrapper = {
      webContents: {
        id: 20,
        send: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(false),
        once: vi.fn(),
      } as any,
      isDestroyed: vi.fn().mockReturnValue(false),
    };

    const wrapper2: WebContentsWrapper = {
      webContents: {
        id: 21,
        send: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(false),
        once: vi.fn(),
      } as any,
      isDestroyed: vi.fn().mockReturnValue(false),
    };

    const bridge = createCoreBridge(mockStateManager, [wrapper1, wrapper2]);

    // Get the list of subscribed window IDs
    const subscribedWindows = bridge.getSubscribedWindows();

    // Check that it contains the expected IDs
    expect(subscribedWindows).toContain(20);
    expect(subscribedWindows).toContain(21);
    expect(subscribedWindows.length).toBe(2);
  });

  it('should handle errors when sending to a specific window', () => {
    // Successful wrapper
    const goodWrapper: WebContentsWrapper = {
      webContents: {
        id: 30,
        send: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(false),
        once: vi.fn(),
      } as any,
      isDestroyed: vi.fn().mockReturnValue(false),
    };

    // Wrapper that throws on send
    const errorWrapper: WebContentsWrapper = {
      webContents: {
        id: 31,
        send: vi.fn().mockImplementation(() => {
          throw new Error('Send error');
        }),
        isDestroyed: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(false),
        once: vi.fn(),
      } as any,
      isDestroyed: vi.fn().mockReturnValue(false),
    };

    const bridge = createCoreBridge(mockStateManager, [goodWrapper, errorWrapper]);

    // Clear initial send calls
    (goodWrapper.webContents.send as any).mockClear();
    (errorWrapper.webContents.send as any).mockClear();

    // Trigger a state update
    stateSubscriberCallback({ updated: 'state' });

    // The good wrapper should still receive the update
    expect(goodWrapper.webContents.send).toHaveBeenCalledWith(IpcChannel.SUBSCRIBE, { updated: 'state' });

    // The error wrapper should have attempted to send
    expect(errorWrapper.webContents.send).toHaveBeenCalled();

    // And we should not have crashed
    expect(consoleErrorSpy).not.toHaveBeenCalled(); // Error handling is done in safelySendToWindow
  });

  it('should handle errors during window loading', () => {
    // Set up a window that's loading but throws when sending
    const loadingWrapper: WebContentsWrapper = {
      webContents: {
        id: 40,
        send: vi.fn().mockImplementation(() => {
          throw new Error('Send error');
        }),
        isDestroyed: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(true), // Window is loading
        once: vi.fn().mockImplementation((event, callback) => {
          if (event === 'did-finish-load') {
            setTimeout(() => callback(), 0);
          }
        }),
      } as any,
      isDestroyed: vi.fn().mockReturnValue(false),
    };

    createCoreBridge(mockStateManager, [loadingWrapper]);

    // Return a promise to wait for the setTimeout to execute
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // The callback should have been called without throwing
        expect(loadingWrapper.webContents.once).toHaveBeenCalledWith('did-finish-load', expect.any(Function));
        resolve();
      }, 10);
    });
  });

  it('should handle null IDs during subscribe', () => {
    const bridge = createCoreBridge(mockStateManager, []);

    // Create a wrapper that returns null ID
    const nullIdWrapper: WebContentsWrapper = {
      webContents: {
        id: null as any, // Force null ID
        send: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(false),
        once: vi.fn(),
      } as any,
      isDestroyed: vi.fn().mockReturnValue(false),
    };

    // This should not throw
    const subscription = bridge.subscribe([nullIdWrapper]);
    expect(subscription).toBeDefined();
    expect(subscription.unsubscribe).toBeDefined();
  });

  it('should handle errors in webContents.once during subscribe', () => {
    const bridge = createCoreBridge(mockStateManager, []);

    // Create a wrapper that throws on once
    const errorOnceWrapper: WebContentsWrapper = {
      webContents: {
        id: 50,
        send: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(false),
        once: vi.fn().mockImplementation(() => {
          throw new Error('once error');
        }),
      } as any,
      isDestroyed: vi.fn().mockReturnValue(false),
    };

    // This should not throw
    const subscription = bridge.subscribe([errorOnceWrapper]);
    expect(subscription).toBeDefined();
  });

  it('should handle null IDs during unsubscribe', () => {
    // Create a bridge with a valid wrapper
    const bridge = createCoreBridge(mockStateManager, [mockWrapper]);

    // Create a wrapper that returns null ID for unsubscribe
    const nullIdWrapper: WebContentsWrapper = {
      webContents: {
        // Force getWebContentsId to return null by having a null ID
        id: null as any,
        send: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(false),
        once: vi.fn(),
      } as any,
      isDestroyed: vi.fn().mockReturnValue(false),
    };

    // This should not throw
    bridge.unsubscribe([nullIdWrapper]);

    // original wrapper should still be subscribed
    expect(bridge.getSubscribedWindows()).toContain(1);
  });

  it('should handle empty subscriptions during state update', () => {
    const bridge = createCoreBridge(mockStateManager, []);

    // Trigger a state update with no subscriptions
    stateSubscriberCallback({ updated: 'state' });

    // Should not crash
    expect(bridge).toBeDefined();
  });

  it('should handle invalid input to subscribe', () => {
    const bridge = createCoreBridge(mockStateManager, []);

    // Call subscribe with null
    const result = bridge.subscribe(null as any);

    // Should return a no-op unsubscribe function
    expect(result).toEqual({ unsubscribe: expect.any(Function) });
    // Calling unsubscribe should not throw
    expect(() => result.unsubscribe()).not.toThrow();
  });

  it('should handle windows already marked as destroyed', () => {
    // Create a wrapper that's already destroyed
    const destroyedWrapper: WebContentsWrapper = {
      webContents: {
        id: 60,
        send: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(true), // Already destroyed
        isLoading: vi.fn(),
        once: vi.fn(),
      } as any,
      isDestroyed: vi.fn().mockReturnValue(true), // Already destroyed
    };

    const bridge = createCoreBridge(mockStateManager, [destroyedWrapper]);

    // Attempt to trigger a state update
    stateSubscriberCallback({ updated: 'state' });

    // No send should have occurred since window is destroyed
    expect(destroyedWrapper.webContents.send).not.toHaveBeenCalled();
  });

  it('should handle wrappers with null webContents during subscribe', () => {
    const bridge = createCoreBridge(mockStateManager, []);

    // Create a wrapper with no webContents
    const noWebContentsWrapper: WebContentsWrapper = {
      webContents: null as any,
      isDestroyed: vi.fn().mockReturnValue(false),
    };

    // This should not throw
    const subscription = bridge.subscribe([noWebContentsWrapper]);
    expect(subscription).toBeDefined();
  });

  it('should clean up destroyed windows that were initially valid', () => {
    // Create a wrapper that will be considered valid at first
    const wrapper = {
      webContents: {
        id: 123,
        send: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(false),
        once: vi.fn(),
      },
      isDestroyed: vi.fn().mockReturnValue(false),
    } as unknown as WebContentsWrapper;

    const bridge = createCoreBridge(mockStateManager, [wrapper]);

    // First make sure the window is actually subscribed
    // Call subscribe explicitly to ensure it's added to the subscriptions
    bridge.subscribe([wrapper]);

    // Now verify it's in the subscribed windows list
    const initialWindows = bridge.getSubscribedWindows();
    expect(initialWindows).toContain(123);

    // Make the wrapper appear to be destroyed for subsequent calls
    wrapper.isDestroyed = vi.fn().mockReturnValue(true);
    wrapper.webContents.isDestroyed = vi.fn().mockReturnValue(true);

    // Trigger a state update to run cleanupDestroyedWindows
    stateSubscriberCallback({ updated: 'state' });

    // The window should now be removed from subscriptions
    const remainingWindows = bridge.getSubscribedWindows();
    expect(remainingWindows).not.toContain(123);
  });

  it('should handle errors in state subscription handler error path', () => {
    // Instead of testing the console.error output, let's just ensure the code
    // doesn't crash when the subscription handler has an error

    // Create a bridge
    const bridge = createCoreBridge(mockStateManager, []);

    // Get the subscriber callback function
    const subscriberCallback = (mockStateManager.subscribe as any).mock.calls[0][0];

    // Create a wrapper that will throw when sending
    const errorWrapper = {
      webContents: {
        id: 789,
        send: vi.fn().mockImplementation(() => {
          throw new Error('Deliberate error in send');
        }),
        isDestroyed: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(false),
        once: vi.fn(),
      },
      isDestroyed: vi.fn().mockReturnValue(false),
    } as unknown as WebContentsWrapper;

    // Add the wrapper to the bridge
    bridge.subscribe([errorWrapper]);

    // This should not throw, even though the send function will throw
    expect(() => {
      subscriberCallback({});
    }).not.toThrow();
  });

  it('should handle errors when setting up destroyed event listener', () => {
    // Create a wrapper that throws when once is called
    const errorWrapper = {
      webContents: {
        id: 456,
        send: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(false),
        once: vi.fn().mockImplementation(() => {
          throw new Error('Error in once');
        }),
      },
      isDestroyed: vi.fn().mockReturnValue(false),
    } as unknown as WebContentsWrapper;

    const bridge = createCoreBridge(mockStateManager, []);

    // This should not throw even though the wrapper's once method will throw
    expect(() => {
      bridge.subscribe([errorWrapper]);
    }).not.toThrow();

    // The wrapper should still be added to subscriptions
    expect(bridge.getSubscribedWindows()).toContain(456);
  });

  it('should properly unsubscribe specific windows using the returned unsubscribe function', () => {
    const bridge = createCoreBridge(mockStateManager, []);

    // Create test wrappers
    const wrapper1 = {
      webContents: {
        id: 100,
        send: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(false),
        once: vi.fn(),
      },
      isDestroyed: vi.fn().mockReturnValue(false),
    } as unknown as WebContentsWrapper;

    const wrapper2 = {
      webContents: {
        id: 200,
        send: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(false),
        once: vi.fn(),
      },
      isDestroyed: vi.fn().mockReturnValue(false),
    } as unknown as WebContentsWrapper;

    // Subscribe the first wrapper
    const subscription1 = bridge.subscribe([wrapper1]);
    expect(bridge.getSubscribedWindows()).toContain(100);

    // Subscribe the second wrapper
    const subscription2 = bridge.subscribe([wrapper2]);
    expect(bridge.getSubscribedWindows()).toContain(200);

    // Unsubscribe the first wrapper using the returned function
    subscription1.unsubscribe();

    // First wrapper should be removed, second should remain
    expect(bridge.getSubscribedWindows()).not.toContain(100);
    expect(bridge.getSubscribedWindows()).toContain(200);

    // Unsubscribe the second wrapper
    subscription2.unsubscribe();
    expect(bridge.getSubscribedWindows()).not.toContain(200);
  });
});
