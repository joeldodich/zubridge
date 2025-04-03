import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { backendZustandBridge, createDispatch, getState, updateState } from '../src/backend.js';
import type { StoreApi } from 'zustand';
import type { AnyState } from '@zubridge/types';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/api/event', () => {
  return {
    listen: vi.fn().mockImplementation((_event: string, callback: any) => {
      vi.stubGlobal('mockEventCallback', callback);
      return Promise.resolve(() => {});
    }),
    emit: vi.fn(),
  };
});

// Import mocked functions
import { invoke } from '@tauri-apps/api/core';

afterEach(() => {
  vi.clearAllMocks();
});

describe('createDispatch', () => {
  let store: Record<string, Mock>;

  beforeEach(() => {
    store = {
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
      store.getState.mockReturnValue(testState);
    });

    it('should call a handler with the expected payload - string action', () => {
      const dispatch = createDispatch(store as unknown as StoreApi<AnyState>);

      dispatch('testAction', { test: 'payload' });

      expect(testState.testAction).toHaveBeenCalledWith({ test: 'payload' });
    });

    it('should call a handler with the expected payload - object action', () => {
      const dispatch = createDispatch(store as unknown as StoreApi<AnyState>);

      dispatch({ type: 'testAction', payload: { test: 'payload' } });

      expect(testState.testAction).toHaveBeenCalledWith({ test: 'payload' });
    });
  });

  describe('when created with separate handlers', () => {
    let testHandlers: Record<string, Mock>;

    beforeEach(() => {
      testHandlers = { testAction: vi.fn() };
    });

    it('should call a handler with the expected payload - string action', () => {
      const dispatch = createDispatch(store as unknown as StoreApi<AnyState>, { handlers: testHandlers });

      dispatch('testAction', { test: 'payload' });

      expect(testHandlers.testAction).toHaveBeenCalledWith({ test: 'payload' });
    });

    it('should call a handler with the expected payload - object action', () => {
      const dispatch = createDispatch(store as unknown as StoreApi<AnyState>, { handlers: testHandlers });

      dispatch({ type: 'testAction', payload: { test: 'payload' } });

      expect(testHandlers.testAction).toHaveBeenCalledWith({ test: 'payload' });
    });
  });

  describe('when created with redux-style reducers', () => {
    it('should call the reducer and update the state', () => {
      const testState = { test: 'state' };
      const testReducer = vi.fn().mockImplementation((existingState, action) => {
        if (action.type === 'testAction' && action.payload === 'testPayload') {
          return {
            ...existingState,
            updated: 'state',
          };
        }
        return existingState;
      });

      const dispatch = createDispatch(store as unknown as StoreApi<AnyState>, { reducer: testReducer });

      dispatch({ type: 'testAction', payload: 'testPayload' });

      expect(store.setState).toHaveBeenCalledWith(expect.any(Function));

      const newTestState = store.setState.mock.calls[0][0](testState);

      expect(newTestState).toStrictEqual({ test: 'state', updated: 'state' });
    });
  });
});

describe('backendZustandBridge', () => {
  const options: { handlers?: Record<string, Mock> } = {};
  let mockStore: Record<string, Mock>;

  beforeEach(() => {
    mockStore = {
      getState: vi.fn(),
      setState: vi.fn(),
      subscribe: vi.fn(),
    };
  });

  it('should pass dispatch messages through to the store', async () => {
    options.handlers = { test: vi.fn() };

    await backendZustandBridge(mockStore as unknown as StoreApi<AnyState>, options);

    const mockEventCallback = (globalThis as any).mockEventCallback;
    await mockEventCallback({ payload: { type: 'test', payload: 'payload' } });

    expect(options.handlers.test).toHaveBeenCalledWith('payload');
  });

  it('should handle getState calls and return the sanitized state', async () => {
    mockStore.getState.mockReturnValue({ test: 'state', testHandler: vi.fn() });

    await backendZustandBridge(mockStore as unknown as StoreApi<AnyState>, options);

    const state = mockStore.getState();

    expect(mockStore.getState).toHaveBeenCalled();
    expect(state).toHaveProperty('test', 'state');
  });

  it('should handle subscribe calls and emit sanitized state', async () => {
    const { emit } = await import('@tauri-apps/api/event');

    await backendZustandBridge(mockStore as unknown as StoreApi<AnyState>, options);

    expect(mockStore.subscribe).toHaveBeenCalledWith(expect.any(Function));
    const subscription = mockStore.subscribe.mock.calls[0][0];

    await subscription({ test: 'state', testHandler: vi.fn() });

    expect(emit).toHaveBeenCalledWith('zubridge-tauri:state-update', { test: 'state' });
  });

  it('should return an unsubscribe function', async () => {
    mockStore.subscribe.mockImplementation(() => vi.fn());

    const bridge = await backendZustandBridge(mockStore as unknown as StoreApi<AnyState>, options);

    expect(bridge.unsubscribe).toStrictEqual(expect.any(Function));
    expect(mockStore.subscribe).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should properly cleanup subscriptions when unsubscribe is called', async () => {
    const mockUnsubscribe = vi.fn();
    mockStore.subscribe.mockReturnValue(mockUnsubscribe);

    const bridge = await backendZustandBridge(mockStore as unknown as StoreApi<AnyState>, options);

    expect(mockStore.subscribe).toHaveBeenCalled();
    expect(bridge.unsubscribe).toBeDefined();

    bridge.unsubscribe();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});

describe('getState', () => {
  it('should retrieve state', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockResolvedValueOnce({
      value: {
        counter: 42,
        nested: {
          value: 'test',
        },
      },
    });

    const state = await getState();

    expect(invoke).toHaveBeenCalledWith('get_state');
    expect(state).toEqual({
      counter: 42,
      nested: {
        value: 'test',
      },
    });
  });

  it('should handle null and undefined values', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockResolvedValueOnce({
      value: {
        nullValue: null,
        undefinedValue: undefined,
      },
    });

    const state = await getState();

    expect(invoke).toHaveBeenCalledWith('get_state');
    expect(state).toEqual({
      nullValue: null,
      undefinedValue: undefined,
    });
  });

  it('should handle errors in state retrieval', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Failed to get state'));

    await expect(getState()).rejects.toThrow('Failed to get state');
  });
});

describe('updateState', () => {
  it('should emit state updates', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const state = {
      counter: 42,
      nested: {
        value: 'test',
      },
    };

    await updateState(state);

    expect(invoke).toHaveBeenCalledWith('update_state', {
      state: {
        value: {
          counter: 42,
          nested: {
            value: 'test',
          },
        },
      },
    });
  });

  it('should handle empty state', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const state = {};

    await updateState(state);

    expect(invoke).toHaveBeenCalledWith('update_state', {
      state: {
        value: {},
      },
    });
  });

  it('should handle errors in state update', async () => {
    const testError = new Error('Failed to update state');
    vi.mocked(invoke).mockRejectedValueOnce(testError);

    const consoleErrorSpy = vi.spyOn(console, 'error');

    await expect(updateState({ test: 'value' })).rejects.toThrow('Failed to update state');

    expect(consoleErrorSpy).toHaveBeenCalledWith('Renderer: Failed to update state:', testError);
    expect(invoke).toHaveBeenCalledWith('update_state', { state: { value: { test: 'value' } } });

    consoleErrorSpy.mockRestore();
  });
});
