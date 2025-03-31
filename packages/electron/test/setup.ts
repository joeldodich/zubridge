import { vi } from 'vitest';

// Create a mock zubridge object on global
const mockZubridge = {
  dispatch: vi.fn(),
  getState: vi.fn(),
  subscribe: vi.fn(),
};

// Add mockZubridge to window
(global as any).window = {
  ...(global as any).window,
  zubridge: mockZubridge,
};

// Make mockEventCallback accessible globally
(global as any).mockEventCallback = undefined;

// Mock Electron IPC modules
vi.mock('electron', () => ({
  ipcRenderer: {
    send: vi.fn(),
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  },
  ipcMain: {
    on: vi.fn(),
    handle: vi.fn(),
    emit: vi.fn(),
    removeHandler: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));
