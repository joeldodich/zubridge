import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { StoreApi } from 'zustand';
import type { AnyState, Handler, WebContentsWrapper, StateManager } from '@zubridge/types';
import { IpcChannel } from '../src/constants';

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

const { mainZustandBridge, createDispatch, createZustandBridge } = await import('../src/main.js');

// Test that mainZustandBridge is an alias for createZustandBridge
describe('mainZustandBridge', () => {
  it('should be an alias for createZustandBridge', () => {
    expect(mainZustandBridge).toBe(createZustandBridge);
  });
});

// Tests for createZustandBridge with options
describe('createZustandBridge', () => {
  let mockStore: Record<string, Mock>;
  let mockWrapper: WebContentsWrapper;

  beforeEach(() => {
    // Mock store that allows us to capture the subscriber function
    mockStore = {
      getState: vi.fn().mockReturnValue({ test: 'state', counter: 0 }),
      setState: vi.fn(),
      subscribe: vi.fn().mockImplementation(() => vi.fn()),
    };

    // Create a mock wrapper
    mockWrapper = {
      webContents: {
        send: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(false),
        once: vi.fn(),
        id: 123,
      } as unknown as Electron.WebContents,
      isDestroyed: vi.fn().mockReturnValue(false),
    };
  });

  it('should create a bridge with handlers option', () => {
    const mockHandler = vi.fn();
    const handlers = {
      customAction: mockHandler,
    };

    const bridge = createZustandBridge(mockStore as unknown as StoreApi<AnyState>, [mockWrapper], {
      handlers,
    });

    // Dispatch an action that should be handled by our custom handler
    bridge.dispatch('customAction', { value: 42 });

    // Verify our handler was called
    expect(mockHandler).toHaveBeenCalledWith({ value: 42 });
  });

  it('should create a bridge with reducer option', () => {
    const mockReducer = vi.fn().mockImplementation((state, action) => {
      if (action.type === 'INCREMENT') {
        return { ...state, counter: state.counter + 1 };
      }
      return state;
    });

    const bridge = createZustandBridge(mockStore as unknown as StoreApi<AnyState>, [mockWrapper], {
      reducer: mockReducer,
    });

    // Dispatch an action that should be handled by our reducer
    bridge.dispatch('INCREMENT');

    // Verify the reducer was called and setState was called with the result
    expect(mockReducer).toHaveBeenCalled();
    expect(mockStore.setState).toHaveBeenCalled();
  });

  it('should handle exposeState option', () => {
    createZustandBridge(mockStore as unknown as StoreApi<AnyState>, [mockWrapper], {
      exposeState: true,
    });

    // Initial state should have been sent
    expect(mockWrapper.webContents.send).toHaveBeenCalledWith(IpcChannel.SUBSCRIBE, { test: 'state', counter: 0 });
  });

  it('should prioritize handlers over reducer over built-in actions', () => {
    const mockHandler = vi.fn();
    const mockReducer = vi.fn();

    const bridge = createZustandBridge(mockStore as unknown as StoreApi<AnyState>, [mockWrapper], {
      handlers: {
        testAction: mockHandler,
      },
      reducer: mockReducer,
    });

    // When handler exists, it should be used
    bridge.dispatch('testAction', 'test');
    expect(mockHandler).toHaveBeenCalledWith('test');
    expect(mockReducer).not.toHaveBeenCalled();

    // Reset mocks
    mockHandler.mockReset();
    mockReducer.mockReset();

    // When handler doesn't exist but reducer does, reducer should be used
    bridge.dispatch('otherAction', 'test');
    expect(mockHandler).not.toHaveBeenCalled();
    expect(mockReducer).toHaveBeenCalled();
  });

  // Test adapter functionality through the bridge API
  it('should process setState actions', () => {
    const bridge = createZustandBridge(mockStore as unknown as StoreApi<AnyState>, [mockWrapper]);

    // Test setState action via the bridge's dispatch
    bridge.dispatch('setState', { newValue: 'test' });
    expect(mockStore.setState).toHaveBeenCalledWith({ newValue: 'test' });
  });

  it('should call store methods when action type matches a method name', () => {
    // Add a mock method to the state object
    const incrementMock = vi.fn();
    mockStore.getState.mockReturnValue({
      test: 'state',
      increment: incrementMock,
    });

    const bridge = createZustandBridge(mockStore as unknown as StoreApi<AnyState>, [mockWrapper]);

    // Test calling a method via the bridge's dispatch
    bridge.dispatch('increment', 5);
    expect(incrementMock).toHaveBeenCalledWith(5);
  });

  it('should handle custom handlers via bridge', () => {
    const customHandler = vi.fn();
    const bridge = createZustandBridge(mockStore as unknown as StoreApi<AnyState>, [mockWrapper], {
      handlers: {
        customAction: customHandler,
      },
    });

    // Test custom handler via the bridge's dispatch
    bridge.dispatch('customAction', 'test');
    expect(customHandler).toHaveBeenCalledWith('test');

    // Verify setState wasn't called
    expect(mockStore.setState).not.toHaveBeenCalled();
  });

  it('should handle errors in actions gracefully', () => {
    // Create an error spy
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Create a handler that throws
    const errorHandler = vi.fn().mockImplementation(() => {
      throw new Error('Handler error');
    });

    const bridge = createZustandBridge(mockStore as unknown as StoreApi<AnyState>, [mockWrapper], {
      handlers: {
        errorAction: errorHandler,
      },
    });

    // This should not throw
    expect(() => {
      bridge.dispatch('errorAction', 'test');
    }).not.toThrow();

    // Error should be logged
    expect(errorSpy).toHaveBeenCalled();

    // Restore the spy
    errorSpy.mockRestore();
  });
});

describe('createDispatch', () => {
  let mockStore: Record<string, Mock>;
  let mockStateManager: StateManager<any>;

  beforeEach(() => {
    mockStore = {
      getState: vi.fn(),
      setState: vi.fn(),
      subscribe: vi.fn(),
      getInitialState: vi.fn(),
    };

    // Create a StateManager for testing
    mockStateManager = {
      getState: mockStore.getState,
      subscribe: mockStore.subscribe,
      processAction: vi.fn(),
    };
  });

  describe('when created with store-based handlers', () => {
    const testState: Record<string, Mock | string> = { test: 'state' };

    beforeEach(() => {
      testState.testAction = vi.fn();
      mockStore.getState.mockReturnValue(testState);
    });

    it('should call a handler with the expected payload - string action', () => {
      const dispatch = createDispatch(mockStateManager);

      dispatch('testAction', { test: 'payload' });
      expect(mockStateManager.processAction).toHaveBeenCalledWith({
        type: 'testAction',
        payload: { test: 'payload' },
      });
    });

    it('should call a handler with the expected payload - action object', () => {
      const dispatch = createDispatch(mockStateManager);

      dispatch({ type: 'testAction', payload: { test: 'payload' } });
      expect(mockStateManager.processAction).toHaveBeenCalledWith({
        type: 'testAction',
        payload: { test: 'payload' },
      });
    });

    it('should handle missing handlers gracefully', () => {
      const dispatch = createDispatch(mockStateManager);

      // Should not throw when handler doesn't exist
      expect(() => dispatch('nonExistentAction')).not.toThrow();
    });

    it('should handle handler errors gracefully', () => {
      (mockStateManager.processAction as Mock).mockImplementation(() => {
        throw new Error('Test error');
      });

      const dispatch = createDispatch(mockStateManager);

      // Should not throw when handler throws
      expect(() => dispatch('errorAction')).not.toThrow();
      expect(mockStateManager.processAction).toHaveBeenCalled();
    });
  });

  describe('when handling thunks', () => {
    it('should call the thunk with getState and dispatch', () => {
      const thunk = vi.fn();
      const dispatch = createDispatch(mockStateManager);

      dispatch(thunk);

      expect(thunk).toHaveBeenCalledWith(
        expect.any(Function), // getState
        expect.any(Function), // dispatch
      );
    });

    it('should handle thunk errors gracefully', () => {
      const errorThunk = vi.fn().mockImplementation(() => {
        throw new Error('Thunk error');
      });

      const dispatch = createDispatch(mockStateManager);

      // Should not throw when thunk throws
      expect(() => dispatch(errorThunk)).not.toThrow();
    });
  });
});

describe('mainZustandBridge functions', () => {
  let mockStore: Record<string, Mock>;
  let storeSubscriber: (state: unknown) => void;
  let mockWrapper: WebContentsWrapper;
  let windowId1: number, windowId2: number;

  beforeEach(() => {
    // Setup window IDs
    windowId1 = 123;
    windowId2 = 456;

    // Reset mockIpcMain functions
    (mockIpcMain.on as Mock).mockClear();
    (mockIpcMain.handle as Mock).mockClear();
    (mockIpcMain.removeHandler as Mock).mockClear();
    (mockIpcMain.removeAllListeners as Mock).mockClear();

    // Store subscriber callback function we'll call to trigger updates
    storeSubscriber = vi.fn();

    // Mock store that allows us to capture the subscriber function
    mockStore = {
      getState: vi.fn().mockReturnValue({ test: 'state' }),
      setState: vi.fn(),
      subscribe: vi.fn().mockImplementation((callback) => {
        storeSubscriber = callback;
        return vi.fn();
      }),
      getInitialState: vi.fn(),
    };

    // Create a mock wrapper with realistic behavior
    const isDestroyedMock = vi.fn().mockReturnValue(false);
    const sendMock = vi.fn();
    const onceMock = vi.fn().mockImplementation((event, callback) => {
      if (event === 'destroyed') {
        // Store the callback but don't call it
      } else if (event === 'did-finish-load') {
        // Immediately call the finish load callback
        callback();
      }
    });

    mockWrapper = {
      webContents: {
        send: sendMock,
        isDestroyed: isDestroyedMock,
        isLoading: vi.fn().mockReturnValue(false),
        once: onceMock,
        id: windowId1,
      } as unknown as Electron.WebContents,
      isDestroyed: isDestroyedMock,
    };
  });

  it('should pass dispatch messages through to the store', () => {
    const bridge = mainZustandBridge(mockStore as unknown as StoreApi<AnyState>, [mockWrapper]);

    mockIpcMain.on.mock.calls[0][1](null, 'testAction', { test: 'payload' });
    expect(mockStore.getState).toHaveBeenCalled();

    bridge.unsubscribe();
  });

  it('should handle getState calls and return the sanitized state', async () => {
    const bridge = mainZustandBridge(mockStore as unknown as StoreApi<AnyState>, [mockWrapper]);

    const result = await mockIpcMain.handle.mock.calls[0][1]();
    expect(result).toEqual({ test: 'state' });

    bridge.unsubscribe();
  });

  it('should handle thunk actions', () => {
    const thunkAction = (dispatch: any, getState: any) => {
      const state = getState();
      dispatch('nestedAction', state);
    };

    mockStore.getState.mockReturnValue({ test: 'thunk state' });

    // Create a proper state manager
    const stateManager = {
      getState: mockStore.getState,
      subscribe: mockStore.subscribe,
      processAction: vi.fn(),
    };

    const dispatch = createDispatch(stateManager);

    // We need to manually implement the thunk behavior for testing
    const thunkDispatch = (action: any) => {
      if (typeof action === 'function') {
        return action(thunkDispatch, mockStore.getState);
      }
      return dispatch(action);
    };

    // Call with a thunk
    thunkDispatch(thunkAction);

    // Verify getState was called (by the thunk)
    expect(mockStore.getState).toHaveBeenCalled();
  });

  it('should support subscriptions with explicit options', () => {
    // Create a mock store and wrapper
    const specialStore = {
      getState: vi.fn().mockReturnValue({ otherState: 'value' }),
      setState: vi.fn(),
      subscribe: vi.fn().mockReturnValue(vi.fn()),
      getInitialState: vi.fn(),
    };

    // Create test window
    const testWindow: WebContentsWrapper = {
      webContents: {
        send: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(false),
        once: vi.fn(),
        id: 201,
      } as unknown as Electron.WebContents,
      isDestroyed: vi.fn().mockReturnValue(false),
    };

    // Create a custom handler
    const customHandler = vi.fn();

    // Create a bridge with handlers option
    const bridge = mainZustandBridge(specialStore as unknown as StoreApi<AnyState>, [testWindow], {
      handlers: {
        customAction: customHandler,
      },
    });

    // Verify the bridge was created with the store
    expect(specialStore.getState).toHaveBeenCalled();
    expect(specialStore.subscribe).toHaveBeenCalled();

    // Initial state should be sent
    expect(testWindow.webContents.send).toHaveBeenCalledWith('__zubridge_state_update', { otherState: 'value' });

    // Bridge should have typical methods
    expect(bridge.unsubscribe).toBeDefined();
    expect(bridge.subscribe).toBeDefined();
    expect(bridge.getSubscribedWindows).toBeDefined();

    // Dispatch a custom action and verify our handler was called
    bridge.dispatch('customAction', 'test-payload');
    expect(customHandler).toHaveBeenCalledWith('test-payload');
  });
});

// Add more thorough tests for the createDispatch function
describe('createDispatch - advanced', () => {
  let mockStateManager: StateManager<any>;

  beforeEach(() => {
    mockStateManager = {
      getState: vi.fn().mockReturnValue({ counter: 0 }),
      subscribe: vi.fn(),
      processAction: vi.fn(),
    };
  });

  it('should dispatch thunks that can access state and dispatch other actions', () => {
    const dispatch = createDispatch(mockStateManager);

    // Create a thunk that reads state and dispatches another action
    const thunk = vi.fn().mockImplementation((getState, innerDispatch) => {
      const state = getState();
      if (state.counter < 10) {
        innerDispatch('INCREMENT');
      }
    });

    // Dispatch the thunk
    dispatch(thunk);

    // Verify the thunk was called with getState and dispatch functions
    expect(thunk).toHaveBeenCalledWith(expect.any(Function), expect.any(Function));

    // Now call the getState function passed to the thunk
    const getStateFn = thunk.mock.calls[0][0];
    expect(getStateFn()).toEqual({ counter: 0 });

    // Call the dispatch function passed to the thunk with a string action
    const innerDispatch = thunk.mock.calls[0][1];
    innerDispatch('INCREMENT');

    // Verify processAction was called with proper action
    expect(mockStateManager.processAction).toHaveBeenCalledWith({
      type: 'INCREMENT',
      payload: undefined,
    });
  });

  it('should support thunk actions with async/await', async () => {
    const dispatch = createDispatch(mockStateManager);

    // Create an async thunk
    const asyncThunk = vi.fn().mockImplementation(async (getState, innerDispatch) => {
      // Simulate an API call
      await new Promise((resolve) => setTimeout(resolve, 10));
      innerDispatch('ASYNC_ACTION', 'result');
      return 'thunk-result';
    });

    // Dispatch the async thunk
    const result = dispatch(asyncThunk);

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Verify the thunk was called
    expect(asyncThunk).toHaveBeenCalled();

    // Check that processAction was called with the expected action
    expect(mockStateManager.processAction).toHaveBeenCalledWith({
      type: 'ASYNC_ACTION',
      payload: 'result',
    });
  });

  it('should handle complex action objects', () => {
    const dispatch = createDispatch(mockStateManager);

    // Dispatch an action with nested payload
    dispatch({
      type: 'COMPLEX_ACTION',
      payload: {
        nested: {
          value: 42,
        },
        array: [1, 2, 3],
      },
    });

    // Verify the action was processed correctly
    expect(mockStateManager.processAction).toHaveBeenCalledWith({
      type: 'COMPLEX_ACTION',
      payload: {
        nested: {
          value: 42,
        },
        array: [1, 2, 3],
      },
    });
  });

  it('should handle chained dispatches in thunks', () => {
    const dispatch = createDispatch(mockStateManager);

    // Create a thunk that calls another thunk
    const innerThunk = vi.fn().mockImplementation((getState, innerDispatch) => {
      innerDispatch('INNER_ACTION');
    });

    const outerThunk = vi.fn().mockImplementation((getState, innerDispatch) => {
      innerDispatch(innerThunk);
      innerDispatch('OUTER_ACTION');
    });

    // Dispatch the outer thunk
    dispatch(outerThunk);

    // Verify both thunks were called
    expect(outerThunk).toHaveBeenCalled();
    expect(innerThunk).toHaveBeenCalled();

    // Verify both actions were dispatched
    expect(mockStateManager.processAction).toHaveBeenCalledWith({
      type: 'INNER_ACTION',
      payload: undefined,
    });
    expect(mockStateManager.processAction).toHaveBeenCalledWith({
      type: 'OUTER_ACTION',
      payload: undefined,
    });
  });

  it('should handle errors in thunks without crashing', () => {
    // Spy on console.error
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const dispatch = createDispatch(mockStateManager);

    // Create a thunk that throws an error
    const errorThunk = vi.fn().mockImplementation(() => {
      throw new Error('Thunk error');
    });

    // This should not throw
    expect(() => {
      dispatch(errorThunk);
    }).not.toThrow();

    // Error should be logged
    expect(errorSpy).toHaveBeenCalled();

    // Restore the spy
    errorSpy.mockRestore();
  });
});

// Test that createZustandBridge correctly forwards window and message events
describe('createZustandBridge - IPC handler integration', () => {
  let mockStore: Record<string, Mock>;
  let mockWrapper: WebContentsWrapper;

  beforeEach(() => {
    // Mock store
    mockStore = {
      getState: vi.fn().mockReturnValue({ test: 'state' }),
      setState: vi.fn(),
      subscribe: vi.fn().mockReturnValue(vi.fn()),
    };

    // Mock wrapper
    mockWrapper = {
      webContents: {
        id: 100,
        send: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(false),
        once: vi.fn(),
      } as any,
      isDestroyed: vi.fn().mockReturnValue(false),
    };

    // Reset IPC mocks
    (mockIpcMain.on as Mock).mockClear();
    (mockIpcMain.handle as Mock).mockClear();
  });

  it('should register expected IPC handlers during bridge creation', () => {
    // Create the bridge
    const bridge = createZustandBridge(mockStore as unknown as StoreApi<AnyState>, [mockWrapper]);

    // Check that all expected IPC handlers are set up
    expect(mockIpcMain.handle).toHaveBeenCalledWith(IpcChannel.GET_STATE, expect.any(Function));
    expect(mockIpcMain.on).toHaveBeenCalledWith(IpcChannel.DISPATCH, expect.any(Function));

    // Verify the bridge has expected methods
    expect(bridge.subscribe).toBeDefined();
    expect(bridge.unsubscribe).toBeDefined();
    expect(bridge.dispatch).toBeDefined();
    expect(bridge.getSubscribedWindows).toBeDefined();
    expect(bridge.destroy).toBeDefined();
  });

  it('should correctly route IPC messages to handlers and reducers', () => {
    // Create a handler and a reducer for testing
    const customHandler = vi.fn();
    const customReducer = vi.fn().mockReturnValue({ updated: true });

    // Create the bridge with options
    const bridge = createZustandBridge(mockStore as unknown as StoreApi<AnyState>, [mockWrapper], {
      handlers: {
        customAction: customHandler,
      },
      reducer: customReducer,
    });

    // Extract IPC handlers registered with Electron
    const dispatchHandler = (mockIpcMain.on as any).mock.calls.find(
      (call: any) => call[0] === IpcChannel.DISPATCH,
    )?.[1];
    const getStateHandler = (mockIpcMain.handle as any).mock.calls.find(
      (call: any) => call[0] === IpcChannel.GET_STATE,
    )?.[1];

    // Test 1: Custom action handler from renderer
    dispatchHandler({}, { type: 'customAction', payload: 'test' });
    expect(customHandler).toHaveBeenCalledWith('test');

    // Test 2: Reducer action from renderer
    dispatchHandler({}, { type: 'reducerAction', payload: 'test' });
    expect(customReducer).toHaveBeenCalled();

    // Test 3: GET_STATE handler should return current state
    const state = getStateHandler();
    expect(state).toEqual({ test: 'state' });
  });
});
