// Import the window type but use dynamic import for runtime functions
import type { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export const handlers = () => {
  console.log('Window handlers initialized');

  return {
    'WINDOW:CREATE': async () => {
      console.log('WINDOW:CREATE handler called');
      try {
        // Create a runtime window with a unique label
        const windowLabel = `runtime-${Date.now()}`;
        console.log('Creating window with label:', windowLabel);

        // In Tauri v2, we need to use WebviewWindow constructor
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        console.log('WebviewWindow imported successfully');

        // Create a new window using Tauri v2 API
        console.log('Instantiating new WebviewWindow...');
        const webview = new WebviewWindow(windowLabel, {
          url: '/',
          title: 'Runtime Window',
          width: 320,
          height: 380,
        });
        console.log('WebviewWindow instantiated:', webview);

        // Listen for window creation events
        webview.once('tauri://created', () => {
          console.log('New window created successfully:', windowLabel);
        });

        // Listen for window creation errors
        webview.once('tauri://error', (e) => {
          console.error('Error creating window:', e);
        });
      } catch (error) {
        console.error('Error in WINDOW:CREATE handler:', error);
      }
    },

    'WINDOW:CLOSE': async (payload: { windowId?: string }) => {
      console.log('WINDOW:CLOSE handler called with payload:', payload);
      try {
        const windowId = payload?.windowId;

        if (windowId) {
          // Try to find the window by ID/label and close it
          try {
            const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
            console.log('Getting window by label:', windowId);

            try {
              // Use type assertion for Tauri v2's API
              const window = WebviewWindow.getByLabel(windowId) as unknown as WebviewWindow;

              if (window) {
                // Directly call close - it's available on the real API
                // @ts-ignore - TypeScript doesn't know the API here
                window.close();
                console.log('Window closed:', windowId);
              } else {
                console.error('Window not found:', windowId);
              }
            } catch (windowErr) {
              console.error('Error handling window:', windowErr);
            }
          } catch (err) {
            console.error('Error closing window:', windowId, err);
          }
        } else {
          // If no window ID provided, close the current window
          console.log('Closing current window');
          try {
            const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
            const currentWindow = getCurrentWebviewWindow();
            // @ts-ignore - TypeScript doesn't know the API here
            currentWindow.close();
          } catch (closeErr) {
            console.error('Error closing current window:', closeErr);
          }
        }
      } catch (error) {
        console.error('Error in WINDOW:CLOSE handler:', error);
      }
    },
  };
};
