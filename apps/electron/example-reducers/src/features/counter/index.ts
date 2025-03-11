import type { Reducer } from '@zubridge/electron';

export type CounterAction = { type: 'COUNTER:INCREMENT' } | { type: 'COUNTER:DECREMENT' };

export const counterReducer: Reducer<number> = (state, action) => {
  switch (action.type) {
    case 'COUNTER:INCREMENT':
      return state + 1;
    case 'COUNTER:DECREMENT':
      return state - 1;
    default:
      return state;
  }
};
