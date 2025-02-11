import { createUseStore, rendererZustandBridge } from 'zuri';
import type { State } from '../../features/index.js';

console.log('useStore: Creating renderer bridge');
const { handlers } = rendererZustandBridge<State>();

console.log('useStore: Creating hook');
export const useStore = createUseStore<State>(handlers);
export { handlers };

// Add type declaration
declare global {
  interface Window {
    zuri: typeof handlers;
  }
}
