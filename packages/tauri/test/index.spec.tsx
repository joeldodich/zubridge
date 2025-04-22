import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, waitFor, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { UnlistenFn } from '@tauri-apps/api/event';

import {
  internalStore,
  initializeBridge,
  cleanupZubridge,
  getState,
  updateState,
  useZubridgeDispatch,
  useZubridgeStore,
  type BackendOptions,
} from '../src/index.js';
import type { AnyState, Action, DispatchFunc } from '@zubridge/types';

// --- Mocks Setup ---
let mockBackendState: AnyState = { counter: 0, initial: true };
let stateUpdateListener: ((event: { payload: any }) => void) | null = null;
let unlistenMock = vi.fn();

// Create mock functions for invoke and listen that will be passed to initializeBridge
const mockInvoke = vi.fn(async (cmd: string, args?: any): Promise<any> => {
  switch (cmd) {
    case '__zubridge_get_initial_state':
      return Promise.resolve(mockBackendState);
    case '__zubridge_dispatch_action':
      return Promise.resolve();
    case 'get_state':
      return Promise.resolve({ value: mockBackendState });
    case 'update_state':
      mockBackendState = args?.state?.value ?? mockBackendState;
      return Promise.resolve();
    default:
      console.error(`[Mock Invoke] Unknown command: ${cmd}`);
      return Promise.reject(new Error(`[Mock Invoke] Unknown command: ${cmd}`));
  }
});

// Raw mock implementation with payload structure
const mockListenRaw = vi.fn(async (event: string, callback: (event: { payload: any }) => void): Promise<UnlistenFn> => {
  if (event === '__zubridge_state_update') {
    stateUpdateListener = callback;
    return Promise.resolve(unlistenMock);
  }
  return Promise.resolve(vi.fn()); // Return a generic mock unlisten for other events
});

// Type-compatible wrapper for the BackendOptions interface
const mockListen = async <E = unknown,>(event: string, handler: (event: E) => void): Promise<UnlistenFn> => {
  // Adapt the handler to expect an event with payload
  return mockListenRaw(event, (e: { payload: any }) => {
    // Call the original handler with the payload as the event
    handler(e as unknown as E);
  });
};

// Mock options object to pass to initializeBridge
const mockTauriOptions: BackendOptions = {
  invoke: mockInvoke,
  listen: mockListen,
};

// --- Helper Functions ---
function simulateStateUpdate(newState: AnyState) {
  if (stateUpdateListener) {
    act(() => {
      stateUpdateListener!({ payload: newState });
    });
  } else {
    console.warn('[TEST Mock] simulateStateUpdate called but no listener is registered.');
  }
}

// --- Test Suite ---
type TestState = { counter: number; initial: boolean; message?: string };

beforeEach(async () => {
  // Reset backend state
  mockBackendState = { counter: 10, initial: true };
  stateUpdateListener = null;

  // Clear Vitest mocks (including call history)
  vi.clearAllMocks();
  unlistenMock.mockReset();
  mockInvoke.mockClear();
  mockListenRaw.mockClear();

  // Cleanup state since last test
  cleanupZubridge();
});

describe('@zubridge/tauri', () => {
  describe('Manual Initialization', () => {
    it('should set status to initializing then ready', async () => {
      expect(internalStore.getState().__bridge_status).toBe('uninitialized');
      const initPromise = initializeBridge(mockTauriOptions);
      await waitFor(() => expect(internalStore.getState().__bridge_status).toBe('initializing'));
      await act(async () => {
        await initPromise;
      });
      expect(internalStore.getState().__bridge_status).toBe('ready');
    });

    it('should fetch initial state', async () => {
      mockBackendState = { counter: 55, initial: false };
      await act(async () => {
        await initializeBridge(mockTauriOptions);
      });
      expect(mockInvoke).toHaveBeenCalledWith('__zubridge_get_initial_state');
      const state = internalStore.getState();
      expect(state.counter).toBe(55);
      expect(state.initial).toBe(false);
      expect(state.__bridge_status).toBe('ready');
    });

    it('should set up listener', async () => {
      await act(async () => {
        await initializeBridge(mockTauriOptions);
      });
      expect(mockListenRaw).toHaveBeenCalledWith('__zubridge_state_update', expect.any(Function));
      expect(stateUpdateListener).toBeInstanceOf(Function);
    });

    it('should handle concurrent initialization calls gracefully', async () => {
      const p1 = initializeBridge(mockTauriOptions);
      const p2 = initializeBridge(mockTauriOptions);
      const p3 = initializeBridge(mockTauriOptions);
      await act(async () => {
        await Promise.all([p1, p2, p3]);
      });
      expect(internalStore.getState().__bridge_status).toBe('ready');
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockListenRaw).toHaveBeenCalledTimes(1);
    });

    it('should handle re-initialization with new functions after cleanup', async () => {
      // First initialization
      await act(async () => {
        await initializeBridge(mockTauriOptions);
      });

      expect(internalStore.getState().__bridge_status).toBe('ready');
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockListenRaw).toHaveBeenCalledTimes(1);

      // Capture current call counts
      const invokeCallCount = mockInvoke.mock.calls.length;

      // Clean up
      cleanupZubridge();
      expect(internalStore.getState().__bridge_status).toBe('uninitialized');

      // Create new mock functions
      const newMockInvoke = vi.fn(async (cmd: string, args?: any): Promise<any> => {
        if (cmd === '__zubridge_get_initial_state') {
          return Promise.resolve({ counter: 100, initial: false, source: 'new' });
        }
        return mockInvoke(cmd, args);
      });

      const newMockListen = async <E = unknown,>(event: string, handler: (event: E) => void): Promise<UnlistenFn> => {
        return mockListenRaw(event, (e: { payload: any }) => {
          handler(e as unknown as E);
        });
      };

      // Re-initialize with new functions
      await act(async () => {
        await initializeBridge({
          invoke: newMockInvoke,
          listen: newMockListen,
        });
      });

      // Verify re-initialization happened with new functions
      expect(internalStore.getState().__bridge_status).toBe('ready');
      expect(internalStore.getState().source).toBe('new');
      expect(internalStore.getState().counter).toBe(100);

      // Original mock wasn't called again
      expect(mockInvoke.mock.calls.length).toBe(invokeCallCount);

      // New mock was called
      expect(newMockInvoke).toHaveBeenCalledWith('__zubridge_get_initial_state');

      // Test dispatch with new function
      let dispatchFn: DispatchFunc<AnyState> | null = null;
      const TestComponent = () => {
        dispatchFn = useZubridgeDispatch();
        return null;
      };
      render(<TestComponent />);

      await act(async () => {
        await dispatchFn!({ type: 'TEST_ACTION' });
      });

      // Should use new function for dispatch
      expect(newMockInvoke).toHaveBeenCalledWith('__zubridge_dispatch_action', expect.any(Object));
    });

    it('should throw error when options are missing', async () => {
      await expect(
        act(async () => {
          // @ts-ignore - Testing invalid parameters
          await initializeBridge();
        }),
      ).rejects.toThrow("Zubridge Tauri: 'invoke' AND 'listen' functions must be provided in options.");
    });

    it('should throw error when invoke function is missing', async () => {
      await expect(
        act(async () => {
          // @ts-ignore - Testing invalid parameters
          await initializeBridge({ listen: mockListen });
        }),
      ).rejects.toThrow("Zubridge Tauri: 'invoke' AND 'listen' functions must be provided in options.");
    });

    it('should throw error when listen function is missing', async () => {
      await expect(
        act(async () => {
          // @ts-ignore - Testing invalid parameters
          await initializeBridge({ invoke: mockInvoke });
        }),
      ).rejects.toThrow("Zubridge Tauri: 'invoke' AND 'listen' functions must be provided in options.");
    });

    it('should handle initialization with v1 Tauri APIs', async () => {
      const v1Invoke = vi.fn(async (cmd: string, args?: any) => {
        return mockInvoke(cmd, args);
      });
      const v1Listen = vi.fn(async (event: string, callback: any) => {
        return mockListenRaw(event, callback);
      });

      await act(async () => {
        await initializeBridge({
          invoke: v1Invoke,
          listen: v1Listen,
        });
      });

      expect(v1Invoke).toHaveBeenCalledWith('__zubridge_get_initial_state');
      expect(v1Listen).toHaveBeenCalledWith('__zubridge_state_update', expect.any(Function));
      expect(internalStore.getState().__bridge_status).toBe('ready');
    });

    it('should handle initialization with v2 Tauri APIs', async () => {
      const v2Invoke = vi.fn(async (cmd: string, args?: any) => {
        return mockInvoke(cmd, args);
      });
      const v2Listen = vi.fn(async (event: string, callback: any) => {
        return mockListenRaw(event, callback);
      });

      await act(async () => {
        await initializeBridge({
          invoke: v2Invoke,
          listen: v2Listen,
        });
      });

      expect(v2Invoke).toHaveBeenCalledWith('__zubridge_get_initial_state');
      expect(v2Listen).toHaveBeenCalledWith('__zubridge_state_update', expect.any(Function));
      expect(internalStore.getState().__bridge_status).toBe('ready');
    });

    it('should handle initialization failure (invoke)', async () => {
      const initError = new Error('Invoke failed');
      const failingMockInvoke = vi.fn().mockRejectedValue(initError);

      await expect(
        act(async () => {
          await initializeBridge({
            invoke: failingMockInvoke,
            listen: mockListen,
          });
        }),
      ).rejects.toThrow(initError);

      const state = internalStore.getState();
      expect(state.__bridge_status).toBe('error');
      expect(state.__bridge_error).toBe(initError);
      expect(mockListenRaw).not.toHaveBeenCalled();
    });

    it('should handle initialization failure (listen)', async () => {
      const listenError = new Error('Listen failed');
      const failingMockListen = vi.fn().mockRejectedValue(listenError);

      await expect(
        act(async () => {
          await initializeBridge({
            invoke: mockInvoke,
            listen: failingMockListen as any,
          });
        }),
      ).rejects.toThrow(listenError);

      // Use waitFor to ensure state update from catch block occurs
      await waitFor(() => {
        const state = internalStore.getState();
        expect(state.__bridge_status).toBe('error');
        expect(state.__bridge_error).toBe(listenError);
      });

      expect(unlistenMock).not.toHaveBeenCalled();
    });
  });

  describe('State Updates', () => {
    it('should update store when state update event is received', async () => {
      await act(async () => {
        await initializeBridge(mockTauriOptions);
      });
      await waitFor(() => expect(internalStore.getState().__bridge_status).toBe('ready'));
      await waitFor(() => expect(stateUpdateListener).toBeInstanceOf(Function));

      const updatedState: Partial<TestState> = { counter: 150, message: 'Event Update' };
      simulateStateUpdate(updatedState);

      await waitFor(() => {
        const state = internalStore.getState();
        expect(state.counter).toBe(150);
        expect(state.message).toBe('Event Update');
      });
      expect(internalStore.getState().__bridge_status).toBe('ready');
    });

    it('should handle multiple successive state updates correctly', async () => {
      await act(async () => {
        await initializeBridge(mockTauriOptions);
      });
      await waitFor(() => expect(internalStore.getState().__bridge_status).toBe('ready'));

      // Initial state check
      expect(internalStore.getState().counter).toBe(10); // Default from beforeEach

      // Set up a component that tracks values from the store
      const updates: number[] = [];
      const TestComponent = () => {
        const counter = useZubridgeStore((s) => s.counter as number);
        React.useEffect(() => {
          updates.push(counter);
        }, [counter]);
        return <div>Counter: {counter}</div>;
      };

      render(<TestComponent />);

      // Perform multiple rapid state updates with different payloads
      await act(async () => {
        simulateStateUpdate({ counter: 20, initial: false });
        await new Promise((resolve) => setTimeout(resolve, 10));

        simulateStateUpdate({ counter: 30, initial: false });
        await new Promise((resolve) => setTimeout(resolve, 10));

        simulateStateUpdate({ counter: 40, initial: false });
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Verify the final state
      await waitFor(() => {
        expect(internalStore.getState().counter).toBe(40);
        expect(internalStore.getState().initial).toBe(false);
      });

      // The component should have seen all the updates
      expect(updates).toContain(10); // Initial
      expect(updates).toContain(20); // First update
      expect(updates).toContain(30); // Second update
      expect(updates).toContain(40); // Third update

      // Component should show the final value
      expect(await screen.findByText('Counter: 40')).toBeInTheDocument();

      // Bridge status should remain ready throughout
      expect(internalStore.getState().__bridge_status).toBe('ready');
    });
  });

  describe('useZubridgeDispatch Hook', () => {
    it('should invoke backend command via useZubridgeDispatch', async () => {
      await act(async () => {
        await initializeBridge(mockTauriOptions);
      });

      let dispatchFn: DispatchFunc<AnyState> | null = null;
      const TestComponent = () => {
        dispatchFn = useZubridgeDispatch();
        return null;
      };
      render(<TestComponent />);

      expect(dispatchFn).toBeInstanceOf(Function);

      const testAction: Action = { type: 'TEST_ACTION', payload: { value: 1 } };
      await act(async () => {
        await dispatchFn!(testAction);
      });

      expect(mockInvoke).toHaveBeenCalledWith('__zubridge_dispatch_action', { action: testAction });
    });

    it('should handle dispatch failure', async () => {
      await act(async () => {
        await initializeBridge(mockTauriOptions);
      });

      // Override mockInvoke for specific command
      const dispatchError = new Error('Dispatch failed');
      mockInvoke.mockImplementation(async (cmd: string, args?: any) => {
        if (cmd === '__zubridge_dispatch_action') {
          throw dispatchError;
        }
        // Default behavior for other commands
        return mockBackendState;
      });

      let dispatchFn: DispatchFunc<AnyState> | null = null;
      const TestComponent = () => {
        dispatchFn = useZubridgeDispatch();
        return null;
      };
      render(<TestComponent />);
      expect(dispatchFn).toBeInstanceOf(Function);

      const testAction: Action = { type: 'FAILING_ACTION' };
      await expect(
        act(async () => {
          await dispatchFn!(testAction);
        }),
      ).rejects.toThrow(dispatchError);
    });

    it('should execute thunks locally with state and dispatch', async () => {
      await act(async () => {
        await initializeBridge(mockTauriOptions);
      });

      // Initialize state for testing
      mockBackendState = { counter: 42, initial: false };
      internalStore.setState({
        ...mockBackendState,
        __bridge_status: 'ready',
      });

      // Create a component to get the dispatch function
      let dispatchFn: DispatchFunc<AnyState> | null = null;
      const TestComponent = () => {
        dispatchFn = useZubridgeDispatch();
        return null;
      };
      render(<TestComponent />);
      expect(dispatchFn).toBeInstanceOf(Function);

      // Reset the mockInvoke implementation to ensure it doesn't throw errors
      // This prevents unhandled rejections in this test
      mockInvoke.mockImplementation(async (cmd: string, args?: any): Promise<any> => {
        if (cmd === '__zubridge_dispatch_action') {
          return Promise.resolve();
        }
        // Default behavior for other commands
        return mockBackendState;
      });

      // Create a thunk that accesses state and calls dispatch
      const thunkMock = vi.fn((getState, dispatch) => {
        const state = getState();
        expect(state.counter).toBe(42);

        // Dispatch an action from within the thunk
        dispatch({ type: 'THUNK_NESTED_ACTION', payload: state.counter * 2 });
        return Promise.resolve('thunk result');
      });

      // Execute the thunk
      let result;
      await act(async () => {
        result = await dispatchFn!(thunkMock);
      });

      // Verify thunk was executed and dispatch was called
      expect(thunkMock).toHaveBeenCalled();
      expect(mockInvoke).toHaveBeenCalledWith('__zubridge_dispatch_action', {
        action: { type: 'THUNK_NESTED_ACTION', payload: 84 },
      });
      expect(result).toBe('thunk result');
    });

    it('should handle thunk errors', async () => {
      await act(async () => {
        await initializeBridge(mockTauriOptions);
      });

      // Get dispatch function
      let dispatchFn: DispatchFunc<AnyState> | null = null;
      render(
        <TestComponent
          setDispatch={(fn) => {
            dispatchFn = fn;
          }}
        />,
      );

      // Create a thunk that throws an error
      const errorThunk = () => {
        throw new Error('Thunk execution failed');
      };

      // Execute the thunk and expect it to throw
      await expect(
        act(async () => {
          await dispatchFn!(errorThunk);
        }),
      ).rejects.toThrow('Thunk execution failed');
    });
  });

  describe('Direct State Interaction Functions', () => {
    beforeEach(async () => {
      // Initialize bridge before each test in this suite
      await act(async () => {
        await initializeBridge(mockTauriOptions);
      });
      // Ensure the bridge is ready
      await waitFor(() => expect(internalStore.getState().__bridge_status).toBe('ready'));
    });

    it('getState should invoke get_state', async () => {
      mockBackendState = { counter: 99, initial: false };
      await getState();
      expect(mockInvoke).toHaveBeenCalledWith('get_state');
    });

    it('should handle getState failure', async () => {
      const getError = new Error('getState failed');
      mockInvoke.mockImplementationOnce(() => Promise.reject(getError));
      await expect(getState()).rejects.toThrow(getError);
    });

    it('updateState should invoke update_state', async () => {
      const newState = { counter: 101, initial: false, message: 'Direct Update' };
      await updateState(newState);
      expect(mockInvoke).toHaveBeenCalledWith('update_state', { state: { value: newState } });
    });

    it('should handle updateState failure', async () => {
      const updateError = new Error('updateState failed');
      mockInvoke.mockImplementationOnce(() => Promise.reject(updateError));
      await expect(updateState({ failed: true })).rejects.toThrow(updateError);
    });
  });

  describe('cleanupZubridge Functionality', () => {
    it('should call unlisten and set status to uninitialized', async () => {
      await act(async () => {
        await initializeBridge(mockTauriOptions);
      });
      await waitFor(() => expect(internalStore.getState().__bridge_status).toBe('ready'));

      const callsBeforeCleanup = unlistenMock.mock.calls.length;
      cleanupZubridge();

      expect(unlistenMock.mock.calls.length).toBeGreaterThan(callsBeforeCleanup);
      expect(internalStore.getState().__bridge_status).toBe('uninitialized');

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(internalStore.getState().__bridge_status).toBe('uninitialized');
    });
  });

  describe('useZubridgeStore Hook', () => {
    it('should return selected state slice after initialization', async () => {
      mockBackendState = { counter: 88, initial: true, message: 'Hook Test' };
      await act(async () => {
        await initializeBridge(mockTauriOptions);
      });
      await waitFor(() => expect(internalStore.getState().__bridge_status).toBe('ready'));

      let messageFromHook: string | undefined = undefined;
      let statusFromHook: string | undefined = undefined;
      const TestComponent = () => {
        messageFromHook = useZubridgeStore((s) => s.message as string | undefined);
        statusFromHook = useZubridgeStore((s) => s.__bridge_status as string | undefined);
        return <div>Message: {messageFromHook ?? 'N/A'}</div>;
      };

      render(<TestComponent />);

      await waitFor(() => {
        expect(statusFromHook).toBe('ready');
        expect(messageFromHook).toBe('Hook Test');
      });
      expect(await screen.findByText('Message: Hook Test')).toBeInTheDocument();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle direct functions without initialization', async () => {
      // This tests lines 67-69
      cleanupZubridge();

      // Try to use functions without initialization
      await expect(getState()).rejects.toThrow('Zubridge not initialized');
      await expect(updateState({ test: true })).rejects.toThrow('Zubridge not initialized');
    });

    it('should handle dispatch when bridge is initializing', async () => {
      // Tests lines 209-211 and 195-202
      cleanupZubridge();

      // Set bridge to initializing but don't wait for it to complete
      const initPromise = initializeBridge(mockTauriOptions);

      // Render component to get dispatch function wrapped in act()
      let dispatchFn: DispatchFunc<AnyState> | null = null;
      await act(async () => {
        render(
          <React.StrictMode>
            <TestComponent
              setDispatch={(fn) => {
                dispatchFn = fn;
              }}
            />
          </React.StrictMode>,
        );
      });

      expect(dispatchFn).toBeInstanceOf(Function);

      // Mock a successful response for the dispatch
      mockInvoke.mockImplementation(async (cmd: string, args?: any) => {
        if (cmd === '__zubridge_dispatch_action') {
          return Promise.resolve();
        }
        return mockBackendState;
      });

      // Dispatch while bridge is initializing (should wait for initialization)
      const actionPromise = dispatchFn!({ type: 'TEST_WAIT' });

      // Complete initialization
      await act(async () => {
        await initPromise;
      });

      // Action should complete after initialization
      await actionPromise;

      expect(mockInvoke).toHaveBeenCalledWith('__zubridge_dispatch_action', expect.any(Object));
    });

    it('should handle dispatch without initialization', async () => {
      // Tests lines 218-248
      cleanupZubridge();

      // Render component to get dispatch function
      let dispatchFn: DispatchFunc<AnyState> | null = null;
      await act(async () => {
        render(
          <React.StrictMode>
            <TestComponent
              setDispatch={(fn) => {
                dispatchFn = fn;
              }}
            />
          </React.StrictMode>,
        );
      });

      // This should fail since bridge is not initialized
      await expect(dispatchFn!({ type: 'UNINITIALIZED' })).rejects.toThrow('not initialized');
    });

    it('should handle dispatch when the bridge is not ready and no initialization is in progress', async () => {
      // Tests lines 218-248 more thoroughly
      cleanupZubridge();

      // Set the bridge status to something other than 'ready' but without an initialization promise
      internalStore.setState({ __bridge_status: 'uninitialized' });

      // Render component to get dispatch function
      let dispatchFn: DispatchFunc<AnyState> | null = null;
      await act(async () => {
        render(
          <React.StrictMode>
            <TestComponent
              setDispatch={(fn) => {
                dispatchFn = fn;
              }}
            />
          </React.StrictMode>,
        );
      });

      // This should fail specifically with the updated error message that matches the implementation
      await expect(dispatchFn!({ type: 'NO_INIT_PROMISE' })).rejects.toThrow(
        'Zubridge is not initialized (missing invoke function)',
      );
    });

    it('should handle initialization errors when trying to dispatch', async () => {
      // Tests lines 195-202 more thoroughly
      cleanupZubridge();

      // Create a failing initialization
      const initError = new Error('Test init error');
      const failingInit = vi.fn().mockRejectedValue(initError);

      // Start initialization but expect it to fail
      let initPromise;
      try {
        initPromise = initializeBridge({
          invoke: failingInit,
          listen: mockListen,
        });
        await initPromise;
      } catch (e) {
        // Expected error
      }

      // Now the bridge should be in error state
      expect(internalStore.getState().__bridge_status).toBe('error');

      // Render component to get dispatch function
      let dispatchFn: DispatchFunc<AnyState> | null = null;
      await act(async () => {
        render(
          <React.StrictMode>
            <TestComponent
              setDispatch={(fn) => {
                dispatchFn = fn;
              }}
            />
          </React.StrictMode>,
        );
      });

      // Don't try to access initializePromise directly
      // Instead, we verify the error behavior from dispatch directly

      // This should fail with an error related to initialization
      await expect(
        act(async () => {
          // We expect this to fail because the bridge is in error state
          await dispatchFn!({ type: 'INIT_ERROR' });
        }),
      ).rejects.toThrow();

      // Verify the error state remains
      expect(internalStore.getState().__bridge_status).toBe('error');
      expect(internalStore.getState().__bridge_error).toBe(initError);

      // Cleanup properly
      cleanupZubridge();
    });
  });
});

// Helper component to fix React act() warnings
interface TestProps {
  setDispatch: (dispatch: DispatchFunc<AnyState>) => void;
}

function TestComponent({ setDispatch }: TestProps) {
  const dispatch = useZubridgeDispatch();
  React.useEffect(() => {
    setDispatch(dispatch);
  }, [dispatch, setDispatch]);
  return null;
}
