import type { BaseState } from '../../../types/index.js';
import type { Handler } from '@zubridge/types';

/**
 * Types for the handlers mode state
 */
export interface WindowState {
  isOpen: boolean;
}

export interface State extends BaseState {}

/**
 * Action handlers for the handlers mode
 * In this mode, we define handlers for each action type
 * rather than using reducers
 */
export interface CounterHandlers {
  'COUNTER:INCREMENT': () => void;
  'COUNTER:DECREMENT': () => void;
}

export interface WindowHandlers {
  'WINDOW:CREATE': () => void;
  'WINDOW:CLOSE': (payload?: { windowId?: number }) => void;
}

// Define ActionHandlers as a Record<string, Handler> to be compatible with createDispatch
export type ActionHandlers = Record<string, Handler> & CounterHandlers & WindowHandlers;
