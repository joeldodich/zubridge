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

let store: StoreApi<AnyState>;

/**
 * Creates a Zustand store that connects to the backend
 * @deprecated Use createStore directly from zustand/vanilla instead
 */
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

// Create Electron-specific handlers
export const createHandlers = <S extends AnyState>(): Handlers<S> => {
  if (typeof window === 'undefined' || !window.zubridge) {
    throw new Error('Zubridge handlers not found in window. Make sure the preload script is properly set up.');
  }

  return window.zubridge as Handlers<S>;
};

/**
 * Creates a hook for accessing the store state in React components
 */
export const createUseStore = <S extends AnyState>(customHandlers?: Handlers<S>): UseBoundStore<StoreApi<S>> => {
  const handlers = customHandlers || createHandlers<S>();

  // Create the Zustand store directly
  const vanillaStore = createZustandStore<S>((setState: StoreApi<S>['setState']) => {
    // subscribe to changes
    handlers.subscribe((state: S) => setState(state as S));

    // get initial state
    handlers.getState().then((state: S) => setState(state as S));

    // no state keys - they will all come from main
    return {} as S;
  });

  // Store reference for dispatcher functions
  store = vanillaStore as unknown as StoreApi<AnyState>;

  // Create the hook function with the correct typing
  const useBoundStore: any = <U>(selector?: (state: S) => U) => useStore(vanillaStore, selector as any);

  // Assign store properties to the hook
  Object.assign(useBoundStore, vanillaStore);

  // return store hook
  return useBoundStore as UseBoundStore<StoreApi<S>>;
};

/**
 * Creates a dispatch function for sending actions to the main process
 */
export const useDispatch = <S extends AnyState>(customHandlers?: Handlers<S>): DispatchFunc<S> => {
  const handlers = customHandlers || createHandlers<S>();

  return (action: Thunk<S> | Action | string, payload?: unknown): unknown => {
    if (typeof action === 'function') {
      // passed a function / thunk - so we execute the action, pass dispatch & store getState into it
      const typedStore = store as StoreApi<S>;
      return action(typedStore.getState, handlers.dispatch);
    }

    // passed action type and payload separately
    if (typeof action === 'string') {
      return handlers.dispatch(action, payload);
    }

    // passed an action
    return handlers.dispatch(action);
  };
};

// Export environment utilities
export * from './utils/environment';
