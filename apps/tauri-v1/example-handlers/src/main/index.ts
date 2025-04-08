import { initBridge } from './store.js';

console.log('Main process starting...');
console.log('Main: Initializing bridge...');

// Initialize the bridge when the app starts
initBridge().catch((err) => {
  console.error('Main: Bridge initialization failed:', err);
});
