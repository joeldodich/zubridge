import type { StoreApi } from 'zustand';
import type { WebContents } from 'electron';

export type Thunk<S> = (getState: StoreApi<S>['getState'], dispatch: Dispatch<S>) => void;

export type Action<T extends string = string> = {
  type: T;
  payload: unknown;
};

export type AnyState = Record<string, unknown>;
export type Reducer<S> = (state: S, args: Action) => S;
export type RootReducer<S extends AnyState> = (state: S, args: Action) => S;
export type Handler = (...arg: unknown[]) => void;
export type MainZustandBridgeOpts<S extends AnyState> = {
  handlers?: Record<string, Handler>;
  reducer?: RootReducer<S>;
};

export interface WebContentsWrapper {
  webContents: WebContents;
  isDestroyed(): boolean;
}

// Define MainZustandBridge type
export type MainZustandBridge = <State extends AnyState, Store extends StoreApi<State>>(
  store: Store,
  wrappers: WebContentsWrapper[],
  options?: MainZustandBridgeOpts<State>,
) => {
  unsubscribe: (wrappers?: WebContentsWrapper[]) => void;
  subscribe: (wrappers: WebContentsWrapper[]) => { unsubscribe: () => void };
  getSubscribedWindows: () => number[];
};

export type Dispatch<S> = {
  (action: string, payload?: unknown): void;
  (action: Action): void;
  (action: Thunk<S>): void;
};

interface BaseHandler<S> {
  dispatch: Dispatch<S>;
}

export interface Handlers<S extends AnyState> extends BaseHandler<S> {
  getState(): Promise<S>;
  subscribe(callback: (newState: S) => void): () => void;
}

export type ExtractState<S> = S extends {
  getState: () => infer T;
}
  ? T
  : never;

export type ReadonlyStoreApi<T> = Pick<StoreApi<T>, 'getState' | 'getInitialState' | 'subscribe'>;

export type DispatchFunc<S> = (action: Thunk<S> | Action | string, payload?: unknown) => unknown;
