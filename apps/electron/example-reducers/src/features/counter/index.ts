import type { Reducer } from '@zubridge/electron';

export type CounterAction = { type: 'COUNTER:INCREMENT' } | { type: 'COUNTER:DECREMENT' };

export const reducer: Reducer<number> = (counter = 0, action: { type: string }) => {
  switch (action.type) {
    case 'COUNTER:INCREMENT':
      return counter + 1;
    case 'COUNTER:DECREMENT':
      return counter - 1;
    default:
      return counter;
  }
};
