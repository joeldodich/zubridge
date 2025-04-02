/**
 * Constants used for IPC communication between main and renderer processes.
 * These are internal to the Zubridge electron implementation.
 */
export enum IpcChannel {
  /** Channel for subscribing to state updates */
  SUBSCRIBE = 'zubridge-subscribe',
  /** Channel for getting the current state */
  GET_STATE = 'zubridge-getState',
  /** Channel for dispatching actions */
  DISPATCH = 'zubridge-dispatch',
}
