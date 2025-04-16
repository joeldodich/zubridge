import type { AnyState, Handlers } from '@zubridge/types';
import { useStore, type StoreApi } from 'zustand';
import { createStore as createZustandStore } from 'zustand/vanilla';
import type { Action, Thunk, ExtractState, ReadonlyStoreApi, DispatchFunc } from '@zubridge/types';

// Export types
export type * from '@zubridge/types';

// Add type declaration for window.zubridge
declare global {
  interface Window {
    zubridge: Handlers<AnyState>;
  }
}

// Core store functionality (moved from core package)
let store: StoreApi<AnyState>;

export const createStore = <S extends AnyState>(bridge: Handlers<S>): StoreApi<S> => {
  store = createZustandStore<Partial<S>>((setState: StoreApi<S>['setState']) => {
    // subscribe to changes
    bridge.subscribe((state: S) => setState(state));

    // get initial state
    bridge.getState().then((state: S) => setState(state));

    // no state keys - they will all come from main
    return {};
  });

  return store as StoreApi<S>;
};

type UseBoundStore<S extends ReadonlyStoreApi<unknown>> = {
  (): ExtractState<S>;
  <U>(selector: (state: ExtractState<S>) => U): U;
} & S;

export const createCoreUseStore = <S extends AnyState>(bridge: Handlers<S>): UseBoundStore<StoreApi<S>> => {
  const vanillaStore = createStore<S>(bridge);
  const useBoundStore = (selector: (state: S) => unknown) => useStore(vanillaStore, selector);

  Object.assign(useBoundStore, vanillaStore);

  // return store hook
  return useBoundStore as UseBoundStore<StoreApi<S>>;
};

export const useCoreDispatch =
  <S extends AnyState>(bridge: Handlers<S>): DispatchFunc<S> =>
  (action: Thunk<S> | Action | string, payload?: unknown): unknown => {
    if (typeof action === 'function') {
      // passed a function / thunk - so we execute the action, pass dispatch & store getState into it
      const typedStore = store as StoreApi<S>;
      return action(typedStore.getState, bridge.dispatch);
    }

    // passed action type and payload separately
    if (typeof action === 'string') {
      return bridge.dispatch(action, payload);
    }

    // passed an action
    return bridge.dispatch(action);
  };

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
