// Export interfaces for use elsewhere
export interface ElectronAPI {
  getWindowInfo: () => Promise<{ id: number; type: 'main' | 'secondary' | 'runtime' }>;
  getMode: () => Promise<{ mode: string; modeName: string }>;
  closeCurrentWindow: () => Promise<boolean>;
  quitApp: () => Promise<boolean>;
  createRuntimeWindow: () => Promise<{ success: boolean; windowId: number }>;
}
