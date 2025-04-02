import { createUseStore } from '@zubridge/tauri-v1';
import type { State } from '../../features/index.js';

console.log('useStore: Creating hook');
export const useStore = createUseStore<State>();
