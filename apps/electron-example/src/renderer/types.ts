// Window interface extensions for TypeScript
declare global {
  interface Window {
    electronAPI?: {
      getWindowInfo: () => Promise<{ id: number; type: 'main' | 'secondary' | 'runtime' }>;
      getMode: () => Promise<{ mode: string; modeName: string }>;
      closeCurrentWindow: () => Promise<boolean>;
      quitApp: () => Promise<boolean>;
      createRuntimeWindow: () => Promise<{ success: boolean; windowId: number }>;
    };
  }
}

export {};
