// Re-export from core
import {
  createStore as createCoreStore,
  createUseStore as createCoreUseStore,
  useDispatch as useCoreDispatch,
} from '@zubridge/core';
import type { AnyState, Handlers } from '@zubridge/types';

// Export types
export type * from '@zubridge/types';

// Add type declaration for window.zubridge
declare global {
  interface Window {
    zubridge: any;
  }
}

// Create Electron-specific handlers
export const createHandlers = <S extends AnyState>(): Handlers<S> => {
  if (typeof window === 'undefined' || !window.zubridge) {
    throw new Error('Zubridge handlers not found in window. Make sure the preload script is properly set up.');
  }

  return window.zubridge as Handlers<S>;
};

// Create store with Electron-specific handlers
export const createStore = <S extends AnyState>(): ReturnType<typeof createCoreStore<S>> => {
  const handlers = createHandlers<S>();
  return createCoreStore<S>(handlers);
};

// Create useStore hook with Electron-specific handlers
export const createUseStore = <S extends AnyState>() => {
  const handlers = createHandlers<S>();
  return createCoreUseStore<S>(handlers);
};

// Create useDispatch hook with Electron-specific handlers
export const useDispatch = <S extends AnyState>() => {
  const handlers = createHandlers<S>();
  return useCoreDispatch<S>(handlers);
};
