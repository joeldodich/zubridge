import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Store } from 'redux';
import type { AnyState, WebContentsWrapper } from '@zubridge/types';
import { WebContents } from 'electron';

import { createReduxBridge } from '../src/main.js';

// Mock Redux store
function createMockReduxStore(initialState: any = {}) {
  let currentState = { ...initialState };
  const listeners: Array<() => void> = [];

  const store = {
    getState: vi.fn(() => currentState),
    dispatch: vi.fn((action: any) => {
      if (action.type === 'SET_STATE') {
        currentState = { ...currentState, ...action.payload };
      } else if (action.type === 'INCREMENT') {
        currentState = { ...currentState, counter: (currentState.counter || 0) + 1 };
      } else if (action.type === 'DECREMENT') {
        currentState = { ...currentState, counter: (currentState.counter || 0) - 1 };
      }
      listeners.forEach((listener) => listener());
      return action;
    }),
    subscribe: vi.fn((listener: () => void) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      };
    }),
  };

  return store as unknown as Store<any>;
}

// Mock WebContentsWrapper
const createMockWrapper = () => {
  const mockWebContents = {
    id: 1,
    send: vi.fn(),
    isDestroyed: vi.fn(() => false),
    isLoading: vi.fn(() => false),
    once: vi.fn(),
    // Add required WebContents methods/properties
    on: vi.fn(),
    off: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  } as unknown as WebContents;

  return {
    webContents: {
      ...mockWebContents,
      // Explicitly type send as a mock function
      send: vi.fn().mockImplementation((channel: string, ...args: any[]) => {}) as ReturnType<typeof vi.fn>,
    } as unknown as WebContents,
    isDestroyed: vi.fn(() => false),
  } as WebContentsWrapper;
};

describe('Redux Bridge', () => {
  let mockStore: Store<AnyState>;
  let mockWrapper: WebContentsWrapper;

  beforeEach(() => {
    // Reset mocks and create fresh store for each test
    vi.clearAllMocks();
    mockStore = createMockReduxStore({ counter: 0 });
    mockWrapper = createMockWrapper();

    // Mock IPC handlers
    vi.mock('electron', async () => {
      const actual = await vi.importActual('electron');
      return {
        ...(actual as any),
        ipcMain: {
          on: vi.fn(),
          handle: vi.fn(),
          removeHandler: vi.fn(),
        },
      };
    });
  });

  describe('Redux Store Subscription', () => {
    it('should properly add and remove listeners via subscribe', () => {
      // Access the internal listeners array for testing purposes
      // @ts-ignore - Accessing private member for testing
      const listenersArray = (mockStore as any).__proto__.listeners || [];

      // Create spy functions for listeners so we can identify them
      const listener1 = vi.fn().mockName('listener1');
      const listener2 = vi.fn().mockName('listener2');

      // Add listeners
      const unsubscribe1 = mockStore.subscribe(listener1);
      const unsubscribe2 = mockStore.subscribe(listener2);

      // Verify subscribe was called
      expect(mockStore.subscribe).toHaveBeenCalledTimes(2);

      // Dispatch to trigger listeners
      mockStore.dispatch({ type: 'INCREMENT' });

      // Both listeners should have been called
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);

      // Remove first listener
      unsubscribe1();

      // Dispatch again
      mockStore.dispatch({ type: 'INCREMENT' });

      // Only the second listener should have been called again
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(2);

      // Remove second listener
      unsubscribe2();

      // Dispatch one more time
      mockStore.dispatch({ type: 'INCREMENT' });

      // No additional calls should occur
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(2);
    });

    // Additional focused test to ensure full coverage of the unsubscribe logic
    it('should directly test the unsubscribe mechanism for complete coverage', () => {
      // Test proper Store typing is returned from createMockReduxStore
      const store = createMockReduxStore({ value: 42 });
      expect(store.getState).toBeDefined();
      expect(store.dispatch).toBeDefined();
      expect(store.subscribe).toBeDefined();

      // Create identifiable listeners
      const listenerA = vi.fn().mockName('listenerA');
      const listenerB = vi.fn().mockName('listenerB');
      const listenerC = vi.fn().mockName('listenerC');

      // Get the actual store implementation
      const reduxStore = store as any;

      // Access the private listeners array through a Redux action
      // We'll use our mock implementation details to verify
      let internalListeners: Function[] = [];

      // Subscribe listeners
      const unsubA = store.subscribe(listenerA);
      store.subscribe(listenerB);
      store.subscribe(listenerC);

      // Capture listeners through a custom action
      store.dispatch({
        type: 'INSPECT_LISTENERS',
        payload: {
          callback: (listeners: Function[]) => {
            internalListeners = [...listeners]; // Copy the array
          },
        },
      });

      // Verify all 3 listeners were added
      expect(internalListeners.length).toBe(3);

      // Call unsubscribe for listener A
      unsubA();

      // Dispatch again to capture updated listeners
      store.dispatch({
        type: 'INSPECT_LISTENERS',
        payload: {
          callback: (listeners: Function[]) => {
            internalListeners = [...listeners]; // Copy the array
          },
        },
      });

      // Verify listener was removed (now 2 listeners)
      expect(internalListeners.length).toBe(2);

      // Verify the correct listeners remain by triggering them
      store.dispatch({ type: 'TEST' });
      expect(listenerA).not.toHaveBeenCalled();
      expect(listenerB).toHaveBeenCalled();
      expect(listenerC).toHaveBeenCalled();
    });
  });

  describe('createReduxBridge', () => {
    it('should create a bridge with the correct interface', () => {
      const bridge = createReduxBridge(mockStore, [mockWrapper]);

      expect(bridge).toHaveProperty('subscribe');
      expect(bridge).toHaveProperty('unsubscribe');
      expect(bridge).toHaveProperty('getSubscribedWindows');
      expect(bridge).toHaveProperty('dispatch');
      expect(bridge).toHaveProperty('destroy');
    });

    it('should provide a dispatch function that works with the Redux store', () => {
      const bridge = createReduxBridge(mockStore, [mockWrapper]);

      bridge.dispatch('INCREMENT');
      expect(mockStore.getState()).toEqual({ counter: 1 });

      bridge.dispatch({ type: 'DECREMENT' });
      expect(mockStore.getState()).toEqual({ counter: 0 });
    });

    it('should support dispatch with action and payload parameters', () => {
      const bridge = createReduxBridge(mockStore, [mockWrapper]);

      bridge.dispatch('SET_STATE', { counter: 42 });
      expect(mockStore.getState()).toEqual({ counter: 42 });
    });

    it('should handle thunks in the dispatch function', () => {
      const bridge = createReduxBridge(mockStore, [mockWrapper]);

      bridge.dispatch((getState, dispatch) => {
        const state = getState();
        expect(state).toEqual({ counter: 0 });
        dispatch('INCREMENT');
      });

      expect(mockStore.getState()).toEqual({ counter: 1 });
    });

    it('should notify subscribed windows when store state changes', () => {
      const bridge = createReduxBridge(mockStore, [mockWrapper]);

      // Dispatch an action to change state
      bridge.dispatch('INCREMENT');

      // Verify that the window was notified of the state change
      const send = mockWrapper.webContents.send as ReturnType<typeof vi.fn>;
      expect(send).toHaveBeenCalled();

      // Get the last call arguments
      const lastCallIndex = send.mock.calls.length - 1;
      const lastCallArgs = send.mock.calls[lastCallIndex];

      // Verify the message contains the updated state
      expect(lastCallArgs[1]).toEqual({ counter: 1 });
    });

    it('should unsubscribe windows when requested', () => {
      const bridge = createReduxBridge(mockStore, [mockWrapper]);

      // Initial subscription happens in bridge creation
      expect(mockStore.subscribe).toHaveBeenCalled();

      // Unsubscribe the window
      bridge.unsubscribe([mockWrapper]);

      // Reset the send mock
      const send = mockWrapper.webContents.send as ReturnType<typeof vi.fn>;
      send.mockClear();

      // Dispatch an action
      bridge.dispatch('INCREMENT');

      // The window should not have been notified
      expect(send).not.toHaveBeenCalled();
    });

    it('should allow subscribing additional windows after creation', () => {
      const bridge = createReduxBridge(mockStore, []);

      // Create a second mock window
      const secondWrapper = createMockWrapper();

      // Subscribe the new window
      bridge.subscribe([secondWrapper]);

      // Dispatch an action
      bridge.dispatch('INCREMENT');

      // The second window should have been notified
      const send = secondWrapper.webContents.send as ReturnType<typeof vi.fn>;
      expect(send).toHaveBeenCalled();
    });

    it('should return currently subscribed window IDs', () => {
      const bridge = createReduxBridge(mockStore, [mockWrapper]);

      // Get the subscribed window IDs
      const windowIds = bridge.getSubscribedWindows();

      // Verify the correct ID is in the list
      expect(windowIds).toContain(mockWrapper.webContents.id);
    });
  });
});
