import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebContents } from 'electron';
import type { WebContentsWrapper } from '@zubridge/types';
import {
  isWebContents,
  isWrapper,
  getWebContents,
  isDestroyed,
  safelySendToWindow,
  setupDestroyListener,
  createWebContentsTracker,
  prepareWebContents,
} from '../src/utils/windows';

// Create mock WebContents object
function mockWebContents(id = 1, destroyed = false): WebContents {
  return {
    id,
    isDestroyed: vi.fn(() => destroyed),
    isLoading: vi.fn(() => false),
    send: vi.fn(),
    once: vi.fn(),
  } as unknown as WebContents;
}

// Create mock WebContentsWrapper object
function mockWrapper(id = 1, destroyed = false, webContentsDestroyed = false): WebContentsWrapper {
  return {
    webContents: mockWebContents(id, webContentsDestroyed),
    isDestroyed: vi.fn(() => destroyed),
  };
}

describe('windows.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isWebContents', () => {
    it('should return true for WebContents objects', () => {
      const webContents = mockWebContents();
      expect(isWebContents(webContents)).toBe(true);
    });

    it('should return false for wrapper objects', () => {
      const wrapper = mockWrapper();
      expect(isWebContents(wrapper)).toBe(false);
    });
  });

  describe('isWrapper', () => {
    it('should return true for wrapper objects', () => {
      const wrapper = mockWrapper();
      expect(isWrapper(wrapper)).toBe(true);
    });

    it('should return false for WebContents objects', () => {
      const webContents = mockWebContents();
      expect(isWrapper(webContents)).toBe(false);
    });
  });

  describe('getWebContents', () => {
    it('should return WebContents from a WebContents object', () => {
      const webContents = mockWebContents();
      expect(getWebContents(webContents)).toBe(webContents);
    });

    it('should return WebContents from a wrapper object', () => {
      const wrapper = mockWrapper();
      expect(getWebContents(wrapper)).toBe(wrapper.webContents);
    });

    it('should return undefined for invalid input', () => {
      expect(getWebContents(null as any)).toBeUndefined();
      expect(getWebContents(undefined as any)).toBeUndefined();
      expect(getWebContents({} as any)).toBeUndefined();
    });
  });

  describe('isDestroyed', () => {
    it('should return true for destroyed WebContents', () => {
      const webContents = mockWebContents(1, true);
      expect(isDestroyed(webContents)).toBe(true);
    });

    it('should return false for active WebContents', () => {
      const webContents = mockWebContents(1, false);
      expect(isDestroyed(webContents)).toBe(false);
    });

    it('should return true if isDestroyed throws an error', () => {
      const webContents = mockWebContents();
      vi.mocked(webContents.isDestroyed).mockImplementation(() => {
        throw new Error('Test error');
      });
      expect(isDestroyed(webContents)).toBe(true);
    });
  });

  describe('safelySendToWindow', () => {
    it('should send message to active WebContents', () => {
      const webContents = mockWebContents();
      const result = safelySendToWindow(webContents, 'test-channel', { data: 'test' });

      expect(result).toBe(true);
      expect(webContents.send).toHaveBeenCalledWith('test-channel', { data: 'test' });
    });

    it('should not send to destroyed WebContents', () => {
      const webContents = mockWebContents(1, true);
      const result = safelySendToWindow(webContents, 'test-channel', { data: 'test' });

      expect(result).toBe(false);
      expect(webContents.send).not.toHaveBeenCalled();
    });

    it('should handle loading WebContents by setting up a listener', () => {
      const webContents = mockWebContents();
      vi.mocked(webContents.isLoading).mockReturnValue(true);

      const result = safelySendToWindow(webContents, 'test-channel', { data: 'test' });

      expect(result).toBe(true);
      expect(webContents.once).toHaveBeenCalledWith('did-finish-load', expect.any(Function));
      expect(webContents.send).not.toHaveBeenCalled();

      // Simulate the load finishing
      const callback = vi.mocked(webContents.once).mock.calls[0][1] as Function;
      callback();

      expect(webContents.send).toHaveBeenCalledWith('test-channel', { data: 'test' });
    });

    it('should handle invalid WebContents', () => {
      expect(safelySendToWindow(null as any, 'test-channel', {})).toBe(false);
    });
  });

  describe('setupDestroyListener', () => {
    it('should set up a destroy listener', () => {
      const webContents = mockWebContents();
      const cleanup = vi.fn();

      setupDestroyListener(webContents, cleanup);

      expect(webContents.once).toHaveBeenCalledWith('destroyed', cleanup);
    });
  });

  describe('WebContentsTracker', () => {
    it('should track and retrieve active WebContents', () => {
      const tracker = createWebContentsTracker();
      const webContents1 = mockWebContents(1);
      const webContents2 = mockWebContents(2);

      tracker.track(webContents1);
      tracker.track(webContents2);

      expect(tracker.isTracked(webContents1)).toBe(true);
      expect(tracker.isTracked(webContents2)).toBe(true);
      expect(tracker.hasId(1)).toBe(true);
      expect(tracker.hasId(2)).toBe(true);
      expect(tracker.getActiveIds()).toEqual([1, 2]);
      expect(tracker.getActiveWebContents()).toEqual([webContents1, webContents2]);
    });

    it('should ignore destroyed WebContents during tracking', () => {
      const tracker = createWebContentsTracker();
      const webContents = mockWebContents(1, true);

      const result = tracker.track(webContents);

      expect(result).toBe(false);
      expect(tracker.isTracked(webContents)).toBe(false);
      expect(tracker.hasId(1)).toBe(false);
    });

    it('should untrack WebContents correctly', () => {
      const tracker = createWebContentsTracker();
      const webContents1 = mockWebContents(1);
      const webContents2 = mockWebContents(2);

      tracker.track(webContents1);
      tracker.track(webContents2);
      tracker.untrack(webContents1);

      expect(tracker.isTracked(webContents1)).toBe(false);
      expect(tracker.isTracked(webContents2)).toBe(true);
      expect(tracker.hasId(1)).toBe(false);
      expect(tracker.hasId(2)).toBe(true);
    });

    it('should untrack by ID', () => {
      const tracker = createWebContentsTracker();
      const webContents1 = mockWebContents(1);
      const webContents2 = mockWebContents(2);

      tracker.track(webContents1);
      tracker.track(webContents2);
      tracker.untrackById(1);

      expect(tracker.hasId(1)).toBe(false);
      expect(tracker.hasId(2)).toBe(true);
    });

    it('should cleanup all tracked items', () => {
      const tracker = createWebContentsTracker();
      const webContents1 = mockWebContents(1);
      const webContents2 = mockWebContents(2);

      tracker.track(webContents1);
      tracker.track(webContents2);
      tracker.cleanup();

      expect(tracker.getActiveIds()).toEqual([]);
      expect(tracker.getActiveWebContents()).toEqual([]);
    });

    it('should remove destroyed WebContents from active list', () => {
      const tracker = createWebContentsTracker();
      const webContents1 = mockWebContents(1);
      const webContents2 = mockWebContents(2);

      tracker.track(webContents1);
      tracker.track(webContents2);

      // Now mark webContents1 as destroyed
      vi.mocked(webContents1.isDestroyed).mockReturnValue(true);

      // When we get active WebContents, it should filter out the destroyed one
      expect(tracker.getActiveWebContents()).toEqual([webContents2]);
    });
  });

  describe('prepareWebContents', () => {
    it('should extract WebContents from wrappers', () => {
      const webContents1 = mockWebContents(1);
      const wrapper = mockWrapper(2);

      const result = prepareWebContents([webContents1, wrapper]);

      expect(result).toEqual([webContents1, wrapper.webContents]);
    });

    it('should filter out destroyed WebContents', () => {
      const webContents1 = mockWebContents(1, true); // Destroyed
      const wrapper = mockWrapper(2);

      const result = prepareWebContents([webContents1, wrapper]);

      expect(result).toEqual([wrapper.webContents]);
    });

    it('should handle invalid inputs', () => {
      const result = prepareWebContents([null as any, undefined as any]);
      expect(result).toEqual([]);
    });
  });
});
