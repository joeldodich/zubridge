export interface ElectronAPI {
  getWindowInfo: () => Promise<{ id: number }>;
  getMode: () => Promise<{ name: string }>;
  createRuntimeWindow: () => Promise<any>;
  closeCurrentWindow: () => void;
  quitApp: () => void;
}
