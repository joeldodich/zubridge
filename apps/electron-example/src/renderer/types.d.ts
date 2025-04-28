// Type declarations for Electron IPC APIs exposed to the renderer
interface ElectronAPI {
  createRuntimeWindow: () => Promise<{ success: boolean; windowId: number }>;
  closeCurrentWindow: () => void;
  quitApp: () => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}

export {};
