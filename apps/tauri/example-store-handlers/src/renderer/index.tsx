console.log('Renderer starting up...');

// Initialize main process first
import '../main/index.js';

// Wait for main process to be ready before importing App
const init = async () => {
  const { StrictMode } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { App } = await import('./App.js');

  const container = document.getElementById('root') as HTMLElement;
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};

init().catch(console.error);
