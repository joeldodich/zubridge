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
} from '../src/index.js';
import type { AnyState, ZubridgeAction, ZubridgeTauriOptions } from '../src/index.js';

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

const mockListen = vi.fn(async (event: string, callback: (event: { payload: any }) => void): Promise<UnlistenFn> => {
  if (event === '__zubridge_state_update') {
    stateUpdateListener = callback;
    return Promise.resolve(unlistenMock);
  }
  return Promise.resolve(vi.fn()); // Return a generic mock unlisten for other events
});

// Mock options object to pass to initializeBridge
const mockTauriOptions: ZubridgeTauriOptions = {
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
  mockListen.mockClear();

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
      expect(mockListen).toHaveBeenCalledWith('__zubridge_state_update', expect.any(Function));
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
      expect(mockListen).toHaveBeenCalledTimes(1);
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
        return mockListen(event, callback);
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
        return mockListen(event, callback);
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
      expect(mockListen).not.toHaveBeenCalled();
    });

    it('should handle initialization failure (listen)', async () => {
      const listenError = new Error('Listen failed');
      const failingMockListen = vi.fn().mockRejectedValue(listenError);

      await expect(
        act(async () => {
          await initializeBridge({
            invoke: mockInvoke,
            listen: failingMockListen,
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
  });

  describe('useZubridgeDispatch Hook', () => {
    it('should invoke backend command via useZubridgeDispatch', async () => {
      await act(async () => {
        await initializeBridge(mockTauriOptions);
      });

      let dispatchFn: ((action: ZubridgeAction) => Promise<void>) | null = null;
      const TestComponent = () => {
        dispatchFn = useZubridgeDispatch();
        return null;
      };
      render(<TestComponent />);

      expect(dispatchFn).toBeInstanceOf(Function);

      const testAction = { type: 'TEST_ACTION', payload: { value: 1 } };
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

      let dispatchFn: ((action: ZubridgeAction) => Promise<void>) | null = null;
      const TestComponent = () => {
        dispatchFn = useZubridgeDispatch();
        return null;
      };
      render(<TestComponent />);
      expect(dispatchFn).toBeInstanceOf(Function);

      const testAction = { type: 'FAILING_ACTION' };
      await expect(
        act(async () => {
          await dispatchFn!(testAction);
        }),
      ).rejects.toThrow(dispatchError);
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
});
