import React from 'react';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { screen, render, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { EventCallback, UnlistenFn, Event } from '@tauri-apps/api/event';

// Import the actual module to test
import * as tauriModule from '../src/index.js';
// Correctly import exported types
import type { AnyState, ZubridgeAction, InternalState } from '../src/index.js';

// --- Mocks Setup ---\n\n// Centralized mock state and listener storage
let mockBackendState: AnyState = { counter: 0, initial: true };
let stateUpdateListener: EventCallback<AnyState> | null = null;
let unlistenMock = vi.fn();

// Mock references - Assign inside the vi.mock factory
let mockInvoke: ReturnType<typeof vi.fn>;
let mockListen: ReturnType<typeof vi.fn>;

// Mock Tauri Core API
vi.mock('@tauri-apps/api/core', () => {
  // Create the actual mock function *inside* the factory
  const invokeMock = vi.fn(async (cmd: string, args?: any): Promise<any> => {
    console.log(`[Mock] invoke called: ${cmd}`, args);
    switch (cmd) {
      case '__zubridge_get_initial_state':
        return Promise.resolve(mockBackendState);
      case '__zubridge_dispatch_action':
        // In a real test, you might modify mockBackendState based on action
        return Promise.resolve();
      case 'get_state':
        return Promise.resolve({ value: mockBackendState }); // Assuming wrapper structure
      case 'update_state':
        mockBackendState = args?.state?.value ?? mockBackendState;
        // Simulate the backend emitting an update after state is set
        // Need to wrap state updates triggering react updates in act
        await act(async () => {
          simulateStateUpdate(mockBackendState);
        });
        return Promise.resolve();
      default:
        console.error(`[Mock] Unknown invoke command: ${cmd}`);
        return Promise.reject(new Error(`Unknown command: ${cmd}`));
    }
  });
  // Assign to outer variable for test access
  mockInvoke = invokeMock;
  // Return the mock implementation
  return { invoke: invokeMock };
});

// Mock Tauri Event API
vi.mock('@tauri-apps/api/event', () => {
  // Create the actual mock function *inside* the factory
  const listenMock = vi.fn(async (event: string, callback: EventCallback<any>): Promise<UnlistenFn> => {
    console.log(`[Mock] listen called for event: ${event}`);
    if (event === '__zubridge_state_update') {
      stateUpdateListener = callback;
      return Promise.resolve(unlistenMock); // Return the mock unlisten function
    }
    // Return a dummy unlisten for other events
    return Promise.resolve(() => {});
  });
  // Assign to outer variable for test access
  mockListen = listenMock;
  // Return the mock implementation
  return {
    listen: listenMock,
    emit: vi.fn(() => Promise.resolve()), // Mock emit if needed
  };
});

// --- Helper Functions ---\n\n// Helper to simulate a state update event from the backend
function simulateStateUpdate(newState: AnyState) {
  if (stateUpdateListener) {
    console.log('[Mock] Simulating state update event with:', newState);
    // Use act to ensure React processes the state update triggered by the listener
    act(() => {
      // Corrected: Removed windowLabel, ensure type matches Event<AnyState>
      stateUpdateListener!({ payload: newState, event: '__zubridge_state_update', id: Math.random() });
    });
  } else {
    console.warn('[Mock] simulateStateUpdate called but no listener is registered.');
  }
}

// Helper to reset mocks and library state between tests
function resetMocksAndLibrary(initialState: AnyState = { counter: 10, initial: true }) {
  mockBackendState = { ...initialState };
  stateUpdateListener = null;
  vi.clearAllMocks(); // Clear mocks like invoke, listen
  unlistenMock.mockClear(); // Clear the specific unlisten mock
  // Reset internal library state via cleanup
  // Wrap in act because cleanupZubridge calls internalStore.setState
  act(() => {
    tauriModule.cleanupZubridge();
  });
}

// --- Test Suite ---\n\n// Define a simple test state structure
type TestState = {
  counter: number;
  initial: boolean;
  message?: string;
};

// Reset before each test
beforeEach(() => {
  resetMocksAndLibrary();
});

// Optional: Clean up after each test (redundant with beforeEach but good practice)
afterEach(() => {
  vi.restoreAllMocks();
});

describe('@zubridge/tauri', () => {
  describe('Initialization and useZubridgeStore', () => {
    it('should initialize, fetch initial state, and provide it via useZubridgeStore', async () => {
      const TestComponent = () => {
        // Corrected: Select specific fields, handle potential undefined
        const counter = tauriModule.useZubridgeStore((s: InternalState) => s.counter as number | undefined);
        const status = tauriModule.useZubridgeStore((s: InternalState) => s.__zubridge_status);

        if (status !== 'ready') {
          return <div>Status: {status}</div>;
        }
        return <div>Counter: {counter ?? 'N/A'}</div>; // Handle undefined counter
      };

      render(<TestComponent />);

      // Check status during initialization
      expect(screen.getByText('Status: initializing')).toBeInTheDocument();

      // Wait for initialization to complete (invoke and listen calls)
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('__zubridge_get_initial_state');
        expect(mockListen).toHaveBeenCalledWith('__zubridge_state_update', expect.any(Function));
      });

      // Wait for the component to re-render with the ready status and initial state
      await waitFor(() => {
        expect(screen.getByText('Counter: 10')).toBeInTheDocument(); // Initial state from resetMocksAndLibrary
      });
    });

    it('should update the store when a state update event is received', async () => {
      const TestComponent = () => {
        // Corrected: Select specific fields
        const counter = tauriModule.useZubridgeStore((s: InternalState) => s.counter as number | undefined);
        const message = tauriModule.useZubridgeStore((s: InternalState) => s.message as string | undefined);
        const status = tauriModule.useZubridgeStore((s: InternalState) => s.__zubridge_status);

        if (status !== 'ready') {
          return <div>Loading...</div>;
        }
        // Handle potentially undefined values in output
        return (
          <div>
            Counter: {counter ?? 'N/A'} Message: {message ?? 'N/A'}
          </div>
        );
      };

      render(<TestComponent />);

      // Wait for initial state
      await waitFor(() => {
        expect(screen.getByText('Counter: 10 Message: N/A')).toBeInTheDocument();
      });

      // Simulate an update from the backend
      const updatedState: Partial<TestState> = { counter: 15, initial: false, message: 'Updated' };
      simulateStateUpdate(updatedState);

      // Wait for the component to reflect the updated state
      await waitFor(() => {
        expect(screen.getByText('Counter: 15 Message: Updated')).toBeInTheDocument();
      });
    });
  });

  describe('useZubridgeDispatch', () => {
    it('should return a dispatch function that invokes the backend command', async () => {
      const TestComponent = () => {
        const dispatch = tauriModule.useZubridgeDispatch();
        const status = tauriModule.useZubridgeStore((s: InternalState) => s.__zubridge_status);

        const handleClick = () => {
          dispatch({ type: 'INCREMENT', payload: 1 });
        };

        if (status !== 'ready') return <div>Initializing...</div>;

        return <button onClick={handleClick}>Dispatch Increment</button>;
      };

      render(<TestComponent />);

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      // Click the button to dispatch
      act(() => {
        screen.getByRole('button').click();
      });

      // Verify invoke was called correctly
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('__zubridge_dispatch_action', {
          action: { type: 'INCREMENT', payload: 1 },
        });
      });
    });
  });

  describe('Direct State Interaction Functions', () => {
    it('getState should invoke get_state and return the state', async () => {
      mockBackendState = { counter: 99, initial: false };
      const state = await tauriModule.getState();
      expect(mockInvoke).toHaveBeenCalledWith('get_state');
      expect(state).toEqual({ counter: 99, initial: false });
    });

    it('updateState should invoke update_state with the correct payload', async () => {
      const newState = { counter: 101, initial: false, message: 'Direct Update' };
      await tauriModule.updateState(newState);
      expect(mockInvoke).toHaveBeenCalledWith('update_state', { state: { value: newState } });

      // Optional: Verify mock state was updated if mock simulates it
      expect(mockBackendState).toEqual(newState);
    });
  });

  describe('cleanupZubridge', () => {
    it('should call the unlisten function and reset status', async () => {
      // Initialize first
      const TestComponent = () => {
        // Trigger init by using the hook
        tauriModule.useZubridgeStore((s: InternalState) => s.counter);
        return null;
      };
      render(<TestComponent />);
      await waitFor(() => expect(mockListen).toHaveBeenCalled()); // Wait for listener setup

      expect(unlistenMock).not.toHaveBeenCalled();
      // Wrap cleanup in act as it causes state updates
      act(() => {
        tauriModule.cleanupZubridge();
      });

      expect(unlistenMock).toHaveBeenCalledTimes(1);

      // Corrected: Verify status is reset by checking the hook *after* cleanup
      let statusAfterCleanup: string | undefined;
      const StatusCheckComponent = () => {
        statusAfterCleanup = tauriModule.useZubridgeStore((s) => s.__zubridge_status);
        return <div>Status Check: {statusAfterCleanup}</div>;
      };
      // Need to render the component *after* cleanup to get the reset status
      render(<StatusCheckComponent />);
      // Use waitFor because the status update from cleanup might not be immediate
      await waitFor(() => {
        expect(statusAfterCleanup).toBe('uninitialized');
      });
    });
  });
});
