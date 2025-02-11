import { createUseStore } from 'zubridge-electron';
import type { State } from '../../features/index.js';

export const useStore = createUseStore<State>(window.zubridge - electron);
