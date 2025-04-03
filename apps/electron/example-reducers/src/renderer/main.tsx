import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/main-window.css';

import { App } from './App.main';
import { RuntimeApp } from './App.runtime';

// Check if this is a runtime window (specified by the URL parameter)
const urlParams = new URLSearchParams(window.location.search);
const isRuntimeWindow = urlParams.get('runtime') === 'true';

// Get the DOM container element
const container = document.getElementById('root');

// Create React root and render the appropriate app
const root = createRoot(container!);
root.render(<React.StrictMode>{isRuntimeWindow ? <RuntimeApp /> : <App />}</React.StrictMode>);
