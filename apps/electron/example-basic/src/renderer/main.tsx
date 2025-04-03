import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.main';
import { RuntimeApp } from './App.runtime';

// Check if this is a runtime window by looking at the URL path
const isRuntimeWindow = window.location.pathname.includes('runtime-window.html');

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(<StrictMode>{isRuntimeWindow ? <RuntimeApp /> : <App />}</StrictMode>);
