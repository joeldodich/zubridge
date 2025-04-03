export const handlers = () => ({
  'WINDOW:CREATE': async () => {
    try {
      // Create a runtime window with a unique label
      const windowLabel = `runtime-${Date.now()}`;

      // In Tauri v2, we need to use WebviewWindow constructor, not Window.create
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');

      // Create a new window using Tauri v2 API
      const webview = new WebviewWindow(windowLabel, {
        url: '/',
        title: 'Runtime Window',
        width: 320,
        height: 380,
      });

      // Listen for window creation events
      webview.once('tauri://created', () => {
        console.log('New window created:', windowLabel);
      });

      // Listen for window creation errors
      webview.once('tauri://error', (e) => {
        console.error('Error creating window:', e);
      });
    } catch (error) {
      console.error('Error creating window:', error);
    }
  },

  'WINDOW:CLOSE': async (payload: { windowId?: string }) => {
    try {
      const windowId = payload?.windowId;

      if (windowId) {
        // Try to find the window by ID/label and close it
        try {
          const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
          const window = await WebviewWindow.getByLabel(windowId);
          if (window) {
            await window.close();
            console.log('Window closed:', windowId);
          } else {
            console.error('Window found but is null:', windowId);
          }
        } catch (err) {
          console.error('Could not find window to close:', windowId);
        }
      } else {
        // If no window ID provided, close the current window
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const currentWindow = getCurrentWebviewWindow();
        await currentWindow.close();
      }
    } catch (error) {
      console.error('Error closing window:', error);
    }
  },
});
