import { createUseStore, rendererZustandBridge } from 'zubridge-tauri';
import type { State } from '../../features/index.js';

console.log('useStore: Creating renderer bridge');
const { handlers } = rendererZustandBridge<State>();

console.log('useStore: Creating hook');
export const useStore = createUseStore<State>(handlers);
export { handlers };
