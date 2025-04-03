// Re-export from core
import { createUseStore as createCoreUseStore, useDispatch as useCoreDispatch } from '@zubridge/core';
import type { AnyState, Handlers } from '@zubridge/types';

// Export types
export type * from '@zubridge/types';

// Add type declaration for window.zubridge
declare global {
  interface Window {
    zubridge: Handlers<AnyState>;
  }
}

// Create Electron-specific handlers
export const createHandlers = <S extends AnyState>(): Handlers<S> => {
  if (typeof window === 'undefined' || !window.zubridge) {
    throw new Error('Zubridge handlers not found in window. Make sure the preload script is properly set up.');
  }

  return window.zubridge as Handlers<S>;
};

// Create useStore hook with optional handlers parameter
export const createUseStore = <S extends AnyState>(customHandlers?: Handlers<S>) => {
  const handlers = customHandlers || createHandlers<S>();
  return createCoreUseStore<S>(handlers);
};

// Create useDispatch hook with optional handlers parameter
export const useDispatch = <S extends AnyState>(customHandlers?: Handlers<S>) => {
  const handlers = customHandlers || createHandlers<S>();
  return useCoreDispatch<S>(handlers);
};

// Export environment utilities
export * from './utils/environment';
