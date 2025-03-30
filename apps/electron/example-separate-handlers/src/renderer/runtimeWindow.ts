import { createUseStore, useDispatch } from '@zubridge/electron';
import type { State } from '../features';

const useStore = createUseStore<State>();

const counter = document.getElementById('counter');
const decrementButton = document.getElementById('decrement');
const incrementButton = document.getElementById('increment');

if (!counter || !decrementButton || !incrementButton) {
  throw new Error('Required elements not found');
}

const dispatch = useDispatch();

useStore.subscribe((state) => {
  counter.textContent = state.counter.toString();
});

decrementButton.addEventListener('click', () => {
  dispatch({ type: 'decrement', payload: undefined });
});

incrementButton.addEventListener('click', () => {
  dispatch({ type: 'increment', payload: undefined });
});
