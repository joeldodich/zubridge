import React from 'react';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { act, waitFor, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { EventCallback, UnlistenFn } from '@tauri-apps/api/event';

// Import the actual module to test
import * as tauriModule from '../src/index.js';
// Import functions/state needed for testing
import {
  internalStore,
  initializeBridge,
  cleanupZubridge,
  getState,
  updateState,
  useZubridgeDispatch,
  useZubridgeStore,
} from '../src/index.js';
import type { AnyState, InternalState, ZubridgeAction } from '../src/index.js';

// --- Mocks Setup ---
let mockBackendState: AnyState = { counter: 0, initial: true };
let stateUpdateListener: EventCallback<AnyState> | null = null;
let unlistenMock = vi.fn();

// Define the mock invoke implementation variable, accessible within beforeEach and tests
let mockInvokeImplementation: ((cmd: string, args?: any) => Promise<any>) | null = null;
// Define the mock listen implementation variable
let mockListenImplementation: ((event: string, callback: EventCallback<any>) => Promise<UnlistenFn>) | null = null;

vi.mock('@tauri-apps/api/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tauri-apps/api/core')>();
  return {
    ...original,
    invoke: vi.fn((cmd: string, args?: any): Promise<any> => {
      // Delegate to the current implementation set in beforeEach or tests
      if (mockInvokeImplementation) {
        return mockInvokeImplementation(cmd, args);
      }
      return Promise.reject(new Error(`[Mock Core] No invoke implementation set for ${cmd}`));
    }),
  };
});

vi.mock('@tauri-apps/api/event', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tauri-apps/api/event')>();
  // Define the mock listen function using vi.fn()
  const listenMockFn = vi.fn(async (event: string, callback: EventCallback<any>): Promise<UnlistenFn> => {
    // Delegate to the current implementation set in beforeEach or tests
    if (mockListenImplementation) {
      return mockListenImplementation(event, callback);
    }
    return Promise.reject(new Error(`[Mock Event] No listen implementation set for ${event}`));
  });

  return {
    ...original,
    listen: listenMockFn, // Use the vi.fn() instance
    emit: vi.fn(() => Promise.resolve()),
  };
});

// --- Helper Functions ---
function simulateStateUpdate(newState: AnyState) {
  if (stateUpdateListener) {
    act(() => {
      stateUpdateListener!({ payload: newState, event: '__zubridge_state_update', id: Math.random() });
    });
  } else {
    console.warn('[TEST Mock] simulateStateUpdate called but no listener is registered.');
  }
}

// --- Test Suite ---
type TestState = { counter: number; initial: boolean; message?: string };

beforeEach(async () => {
  // Make beforeEach async to import mocks
  // Default implementation for invoke
  mockInvokeImplementation = async (cmd: string, args?: any): Promise<any> => {
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
        console.error(`[Default Mock] Unknown command: ${cmd}`);
        return Promise.reject(new Error(`[Default Mock] Unknown command: ${cmd}`));
    }
  };

  // Default implementation for listen
  mockListenImplementation = async (event: string, callback: EventCallback<any>): Promise<UnlistenFn> => {
    if (event === '__zubridge_state_update') {
      stateUpdateListener = callback;
      return Promise.resolve(unlistenMock);
    }
    return Promise.resolve(vi.fn()); // Return a generic mock unlisten for other events
  };

  // Reset backend state
  mockBackendState = { counter: 10, initial: true };
  stateUpdateListener = null;

  // Clear Vitest mocks (including call history)
  vi.clearAllMocks();
  unlistenMock.mockClear();

  // Reset the mocked functions themselves if needed (restores default implementation)
  // This is important if a test changes the implementation (e.g., to throw errors)
  const { invoke } = await import('@tauri-apps/api/core');
  const { listen } = await import('@tauri-apps/api/event');
  if (vi.isMockFunction(invoke)) invoke.mockClear();
  if (vi.isMockFunction(listen)) listen.mockClear();

  // Cleanup state SINCE last test, NO act wrapper
  cleanupZubridge();
});

// No afterEach

describe('@zubridge/tauri', () => {
  describe('Manual Initialization', () => {
    it('should set status to initializing then ready', async () => {
      expect(internalStore.getState().__zubridge_status).toBe('uninitialized');
      const initPromise = initializeBridge();
      await waitFor(() => expect(internalStore.getState().__zubridge_status).toBe('initializing'));
      await act(async () => {
        await initPromise;
      });
      expect(internalStore.getState().__zubridge_status).toBe('ready');
    });

    it('should fetch initial state', async () => {
      // Import invoke INSIDE the test
      const { invoke } = await import('@tauri-apps/api/core');
      mockBackendState = { counter: 55, initial: false };
      await act(async () => {
        await initializeBridge();
      });
      expect(invoke).toHaveBeenCalledWith('__zubridge_get_initial_state'); // Assert on imported mock
      const state = internalStore.getState();
      expect(state.counter).toBe(55);
      expect(state.initial).toBe(false);
      expect(state.__zubridge_status).toBe('ready');
    });

    it('should set up listener', async () => {
      // Import listen INSIDE the test
      const { listen } = await import('@tauri-apps/api/event');
      await act(async () => {
        await initializeBridge();
      });
      expect(listen).toHaveBeenCalledWith('__zubridge_state_update', expect.any(Function)); // Assert on imported mock
      expect(stateUpdateListener).toBeInstanceOf(Function);
    });

    it('should handle concurrent initialization calls gracefully', async () => {
      const p1 = initializeBridge();
      const p2 = initializeBridge();
      const p3 = initializeBridge();
      await act(async () => {
        await Promise.all([p1, p2, p3]);
      });
      expect(internalStore.getState().__zubridge_status).toBe('ready');

      // Import mocks INSIDE the test for assertion
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');
      expect(invoke).toHaveBeenCalledTimes(1);
      expect(listen).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization failure (invoke)', async () => {
      const initError = new Error('Invoke failed');
      mockInvokeImplementation = async (cmd: string) => {
        // Override implementation
        if (cmd === '__zubridge_get_initial_state') throw initError;
        return Promise.resolve();
      };

      await expect(
        act(async () => {
          await initializeBridge();
        }),
      ).rejects.toThrow(initError);

      const state = internalStore.getState();
      expect(state.__zubridge_status).toBe('error');
      expect(state.__zubridge_error).toBe(initError);

      // Import listen INSIDE the test
      const { listen } = await import('@tauri-apps/api/event');
      expect(listen).not.toHaveBeenCalled(); // Listener setup shouldn't happen
      // expect(unlistenMock).not.toHaveBeenCalled(); // REMOVED - This check is unreliable due to beforeEach cleanup
    });

    it('should handle initialization failure (listen)', async () => {
      const listenError = new Error('Listen failed');
      mockListenImplementation = async () => {
        throw listenError;
      }; // Override implementation

      await expect(
        act(async () => {
          await initializeBridge();
        }),
      ).rejects.toThrow(listenError);

      // Use waitFor to ensure state update from catch block occurs
      await waitFor(() => {
        const state = internalStore.getState();
        expect(state.__zubridge_status).toBe('error');
        expect(state.__zubridge_error).toBe(listenError);
      });

      expect(unlistenMock).not.toHaveBeenCalled();
    });
  });

  describe('State Updates', () => {
    it('should update store when state update event is received', async () => {
      await act(async () => {
        await initializeBridge();
      });
      await waitFor(() => expect(internalStore.getState().__zubridge_status).toBe('ready'));
      await waitFor(() => expect(stateUpdateListener).toBeInstanceOf(Function));

      const updatedState: Partial<TestState> = { counter: 150, message: 'Event Update' };
      simulateStateUpdate(updatedState);

      await waitFor(() => {
        const state = internalStore.getState();
        expect(state.counter).toBe(150);
        expect(state.message).toBe('Event Update');
      });
      expect(internalStore.getState().__zubridge_status).toBe('ready');
    });
  });

  describe('useZubridgeDispatch Hook', () => {
    it('should invoke backend command via useZubridgeDispatch', async () => {
      // Import invoke INSIDE the test
      const { invoke } = await import('@tauri-apps/api/core');
      await act(async () => {
        await initializeBridge();
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

      expect(invoke).toHaveBeenCalledWith('__zubridge_dispatch_action', { action: testAction }); // Assert on imported mock
    });

    it('should warn if dispatching before ready', async () => {
      const warnSpy = vi.spyOn(console, 'warn');
      let dispatchFn: ((action: ZubridgeAction) => Promise<void>) | null = null;
      const TestComponent = () => {
        dispatchFn = useZubridgeDispatch();
        return null;
      };
      render(<TestComponent />);

      expect(dispatchFn).toBeInstanceOf(Function);
      const initialStatus = internalStore.getState().__zubridge_status;
      expect(initialStatus).toBe('uninitialized'); // Check specific initial status

      const testAction = { type: 'EARLY_ACTION' };
      await act(async () => {
        await dispatchFn!(testAction);
      });

      expect(warnSpy).toHaveBeenCalledWith(
        `Zubridge Tauri: Dispatch called while status is '${initialStatus}'. Action may fail if backend is not ready. Action:`,
        testAction,
      );
      // Import invoke INSIDE the test
      const { invoke } = await import('@tauri-apps/api/core');
      expect(invoke).toHaveBeenCalledWith('__zubridge_dispatch_action', { action: testAction }); // Assert on imported mock
      warnSpy.mockRestore();
    });

    it('should handle dispatch failure', async () => {
      const dispatchError = new Error('Dispatch failed');
      mockInvokeImplementation = async (cmd: string) => {
        // Override implementation
        if (cmd === '__zubridge_dispatch_action') throw dispatchError;
        if (cmd === '__zubridge_get_initial_state') return Promise.resolve(mockBackendState);
        return Promise.resolve();
      };

      await act(async () => {
        await initializeBridge();
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
    it('getState should invoke get_state', async () => {
      // Import invoke INSIDE the test
      const { invoke } = await import('@tauri-apps/api/core');
      mockBackendState = { counter: 99, initial: false };
      await getState();
      expect(invoke).toHaveBeenCalledWith('get_state'); // Assert on imported mock
    });

    it('should handle getState failure', async () => {
      const getError = new Error('getState failed');
      mockInvokeImplementation = async (cmd: string) => {
        // Override implementation
        if (cmd === 'get_state') throw getError;
        return Promise.resolve();
      };
      await expect(getState()).rejects.toThrow(getError);
    });

    it('updateState should invoke update_state', async () => {
      // Import invoke INSIDE the test
      const { invoke } = await import('@tauri-apps/api/core');
      const newState = { counter: 101, initial: false, message: 'Direct Update' };
      await updateState(newState);
      expect(invoke).toHaveBeenCalledWith('update_state', { state: { value: newState } }); // Assert on imported mock
    });

    it('should handle updateState failure', async () => {
      const updateError = new Error('updateState failed');
      mockInvokeImplementation = async (cmd: string) => {
        // Override implementation
        if (cmd === 'update_state') throw updateError;
        return Promise.resolve();
      };
      await expect(updateState({ failed: true })).rejects.toThrow(updateError);
    });
  });

  describe('cleanupZubridge Functionality', () => {
    it('should call unlisten and set status to uninitialized', async () => {
      await act(async () => {
        await initializeBridge();
      });
      await waitFor(() => expect(internalStore.getState().__zubridge_status).toBe('ready'));

      const callsBeforeCleanup = unlistenMock.mock.calls.length;
      cleanupZubridge(); // NO act wrapper

      expect(unlistenMock.mock.calls.length).toBeGreaterThan(callsBeforeCleanup);
      expect(internalStore.getState().__zubridge_status).toBe('uninitialized');

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(internalStore.getState().__zubridge_status).toBe('uninitialized');
    });
  });

  describe('useZubridgeStore Hook', () => {
    it('should return selected state slice after initialization', async () => {
      mockBackendState = { counter: 88, initial: true, message: 'Hook Test' };
      await act(async () => {
        await initializeBridge();
      });
      await waitFor(() => expect(internalStore.getState().__zubridge_status).toBe('ready'));

      let messageFromHook: string | undefined = undefined;
      let statusFromHook: string | undefined = undefined;
      const TestComponent = () => {
        messageFromHook = useZubridgeStore((s) => s.message as string | undefined);
        statusFromHook = useZubridgeStore((s) => s.__zubridge_status);
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
}); // Closing brace for the main describe block
