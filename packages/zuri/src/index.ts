import { useStore, type StoreApi } from 'zustand';
import { createStore as createZustandStore } from 'zustand/vanilla';
import { invoke } from '@tauri-apps/api';
import { listen, Event, emit } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';

import type { AnyState, Handlers } from './types.js';
import type { Action, Thunk } from './types.js';

type ExtractState<S> = S extends {
  getState: () => infer T;
}
  ? T
  : never;

type ReadonlyStoreApi<T> = Pick<StoreApi<T>, 'getState' | 'getInitialState' | 'subscribe'>;

let store: StoreApi<AnyState>;

export const createStore = <S extends AnyState>(bridge: Handlers<S>): StoreApi<S> => {
  console.log('Renderer Store: Creating...');

  store = createZustandStore<Partial<S>>((setState: StoreApi<S>['setState']) => {
    console.log('Renderer Store: Setting up subscriptions');

    // subscribe to changes
    bridge.subscribe((state) => {
      console.log('Renderer Store: Received state update:', state);
      setState(state);
    });

    // get initial state
    console.log('Renderer Store: Requesting initial state');
    bridge
      .getState()
      .then((state) => {
        console.log('Renderer Store: Received initial state:', state);
        setState(state);
      })
      .catch((err) => {
        console.error('Renderer Store: Failed to get initial state:', err);
      });

    console.log('Renderer Store: Returning empty initial state');
    // no state keys - they will all come from main
    return {};
  });

  return store as StoreApi<S>;
};

type UseBoundStore<S extends ReadonlyStoreApi<unknown>> = {
  (): ExtractState<S>;
  <U>(selector: (state: ExtractState<S>) => U): U;
} & S;

export const createUseStore = <S extends AnyState>(bridge: Handlers<S>): UseBoundStore<StoreApi<S>> => {
  const vanillaStore = createStore<S>(bridge);
  const useBoundStore = (selector: (state: S) => unknown) => useStore(vanillaStore, selector);

  Object.assign(useBoundStore, vanillaStore);

  // return store hook
  return useBoundStore as UseBoundStore<StoreApi<S>>;
};

type DispatchFunc<S> = (action: Thunk<S> | Action | string, payload?: unknown) => unknown;

export const useDispatch =
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

export const rendererZustandBridge = <S extends AnyState>() => {
  console.log('Renderer: Creating bridge...');

  const getState = async () => {
    console.log('Renderer: Requesting initial state...');
    try {
      console.log('Renderer: Invoking get-state command');
      const state = await invoke<S>('get_state');
      console.log('Renderer: Got state from main:', state);
      return state;
    } catch (err) {
      console.error('Renderer: Failed to get state:', err);
      throw err;
    }
  };

  let dispatch: (action: string | Action | Thunk<S>, payload?: unknown) => Promise<void>;

  dispatch = async (action: string | Action | Thunk<S>, payload?: unknown) => {
    if (typeof action === 'function') {
      const state = await getState();
      return action(() => state, dispatch);
    }
    const eventPayload = typeof action === 'string' ? { type: action, payload } : action;
    await emit('zuri:action', eventPayload);
  };

  const handlers = {
    dispatch,
    getState,
    subscribe: (callback: (state: S) => void) => {
      console.log('Renderer: Setting up state subscription');
      let unlisten: UnlistenFn;

      // Set up the listener
      listen<S>('zuri:state-update', (event: Event<S>) => {
        console.log('Renderer: Received state update:', event.payload);
        callback(event.payload);
      }).then((unlistenerFn) => {
        unlisten = unlistenerFn;
        console.log('Renderer: State subscription ready');
      });

      return () => {
        console.log('Renderer: Cleaning up state subscription');
        unlisten?.();
      };
    },
  };

  console.log('Renderer: Bridge handlers created');
  return { handlers };
};

export { type Handlers, type Reducer } from './types.js';
export { mainZustandBridge } from './main.js';
