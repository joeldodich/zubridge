import { describe, it, expect, vi, beforeEach } from 'vitest';
import { preloadZustandBridge } from '../src/preload';
import type { AnyState, Thunk } from '@zubridge/types';

vi.mock('electron', () => ({
  ipcRenderer: {
    on: vi.fn(),
    removeListener: vi.fn(),
    invoke: vi.fn(),
    send: vi.fn(),
  },
}));

import { ipcRenderer } from 'electron';

describe('preloadZustandBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Silence console.error for the thunk test
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should create handlers with default channel names', () => {
    const { handlers } = preloadZustandBridge();
    expect(handlers).toBeDefined();
    expect(typeof handlers.subscribe).toBe('function');
    expect(typeof handlers.getState).toBe('function');
    expect(typeof handlers.dispatch).toBe('function');
  });

  it('should create handlers with custom channel names', () => {
    const { handlers } = preloadZustandBridge('custom-update', 'custom-getState', 'custom-dispatch');
    expect(handlers).toBeDefined();
    expect(typeof handlers.subscribe).toBe('function');
    expect(typeof handlers.getState).toBe('function');
    expect(typeof handlers.dispatch).toBe('function');
  });

  it('should set up a subscription with ipcRenderer', () => {
    const { handlers } = preloadZustandBridge();
    const callback = vi.fn();
    const unsubscribe = handlers.subscribe(callback);

    expect(ipcRenderer.on).toHaveBeenCalledWith('zubridge-subscribe', expect.any(Function));

    // Test the listener
    const listener = (ipcRenderer.on as ReturnType<typeof vi.fn>).mock.calls[0][1];
    listener(null, { test: 'state' });
    expect(callback).toHaveBeenCalledWith({ test: 'state' });

    // Test unsubscribe
    unsubscribe();
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith('zubridge-subscribe', listener);
  });

  it('should get state from ipcRenderer', async () => {
    const { handlers } = preloadZustandBridge();
    (ipcRenderer.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({ test: 'state' });

    const state = await handlers.getState();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('zubridge-getState');
    expect(state).toEqual({ test: 'state' });
  });

  it('should throw an error when trying to dispatch a thunk', () => {
    const { handlers } = preloadZustandBridge();
    const thunk: Thunk<AnyState> = () => {};

    expect(() => {
      handlers.dispatch(thunk);
    }).toThrow('Thunks cannot be dispatched from the renderer process');
    expect(console.error).toHaveBeenCalledWith('Thunks cannot be dispatched from the renderer process');
  });

  it('should dispatch a string action with payload', () => {
    const { handlers } = preloadZustandBridge();
    handlers.dispatch('TEST_ACTION', 'test-payload');

    expect(ipcRenderer.send).toHaveBeenCalledWith('zubridge-dispatch', {
      type: 'TEST_ACTION',
      payload: 'test-payload',
    });
  });

  it('should dispatch an action object', () => {
    const { handlers } = preloadZustandBridge();
    const action = { type: 'TEST_ACTION', payload: 'test-payload' };
    handlers.dispatch(action);

    expect(ipcRenderer.send).toHaveBeenCalledWith('zubridge-dispatch', action);
  });
});
