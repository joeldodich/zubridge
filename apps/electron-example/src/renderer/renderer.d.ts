import type { State } from '../types/state.js';

declare global {
  interface Window {
    // Define the exact API exposed by the preload script under the new name
    electronAPI: {
      closeCurrentWindow: () => Promise<boolean>;
      getWindowInfo: () => Promise<{ type: 'main' | 'secondary' | 'runtime'; id: number } | null>;
      getMode: () => Promise<{ mode: string; modeName: string } | null>;
      quitApp: () => Promise<boolean>;
      createRuntimeWindow: () => Promise<{ success: boolean; windowId: number } | null>;
    };
    // Assuming zubridge and wdioElectron types are provided elsewhere
  }
}

export {};
