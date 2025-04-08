import type { Action } from '@zubridge/tauri';

type WindowState = {
  isOpen: boolean;
};

type WindowPayload = {
  windowId?: string;
};

const createWindow = async () => {
  try {
    const label = `window-${Date.now()}`;
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');

    // Create a new window using Tauri v2 API
    const webview = new WebviewWindow(label, {
      url: '/',
      title: 'New Window',
      width: 800,
      height: 600,
    });

    // Listen for window creation events
    webview.once('tauri://created', () => {
      console.log('Window created successfully', label);
    });

    // Listen for window creation errors
    webview.once('tauri://error', (e) => {
      console.error('Error creating window:', e);
    });

    return true;
  } catch (error) {
    console.error('Error creating window:', error);
    return false;
  }
};

const closeWindow = async (windowId?: string) => {
  try {
    const { WebviewWindow, getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');

    if (windowId) {
      // Close specific window by ID
      try {
        const window = await WebviewWindow.getByLabel(windowId);
        if (window) {
          await window.close();
          console.log(`Window ${windowId} closed successfully`);
        } else {
          console.error(`Window ${windowId} found but is null`);
        }
      } catch (err) {
        console.error(`Error getting window ${windowId}:`, err);
      }
    } else {
      // Close current window
      const current = getCurrentWebviewWindow();
      await current.close();
      console.log('Current window closed successfully');
    }
    return true;
  } catch (error) {
    console.error('Error closing window:', error);
    return false;
  }
};

export const windowReducer = (state: WindowState = { isOpen: false }, action: Action): WindowState => {
  switch (action.type) {
    case 'WINDOW:CREATE':
      createWindow();
      return { ...state, isOpen: true };
    case 'WINDOW:CLOSE': {
      const payload = action.payload as WindowPayload | undefined;
      closeWindow(payload?.windowId);
      return { ...state, isOpen: false };
    }
    default:
      return state;
  }
};
