import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.main';
import { RuntimeApp } from './App.runtime';

// Check if this is a runtime window by looking for the runtime query parameter
const urlParams = new URLSearchParams(window.location.search);
const isRuntimeWindow = urlParams.get('runtime') === 'true';

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(<StrictMode>{isRuntimeWindow ? <RuntimeApp /> : <App />}</StrictMode>);
