import { createUseStore } from '@zubridge/tauri-v1';
import type { State } from '../../features/index.js';

// Create a shared store hook for the entire application
export const useStore = createUseStore<State>();
