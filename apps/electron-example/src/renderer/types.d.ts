// Type declarations for Electron IPC APIs exposed to the renderer
interface ElectronAPI {
  createRuntimeWindow: () => Promise<{ success: boolean; windowId?: number }>;
  closeCurrentWindow: () => void;
  quitApp: () => void;
  getWindowInfo: () => Promise<{ id: number; type: string }>;
  getMode: () => Promise<{ name: string }>;
  minimizeWindow?: () => void;
  maximizeWindow?: () => void;
  openDevTools?: () => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}

export {};
