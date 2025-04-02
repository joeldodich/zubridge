import { createUseStore } from '@zubridge/electron';
import type { State } from '../../features';

// Create a shared store hook for the entire application
export const useStore = createUseStore<State>();
