import type { WebContents } from 'electron';
import type { WebContentsWrapper } from '@zubridge/types';

/**
 * Type guard to check if an object is an Electron WebContents
 */
export const isWebContents = (
  wrapperOrWebContents: WebContentsWrapper | WebContents,
): wrapperOrWebContents is WebContents => {
  return wrapperOrWebContents && typeof wrapperOrWebContents === 'object' && 'id' in wrapperOrWebContents;
};

/**
 * Type guard to check if an object is a WebContentsWrapper
 */
export const isWrapper = (
  wrapperOrWebContents: WebContentsWrapper | WebContents,
): wrapperOrWebContents is WebContentsWrapper => {
  return wrapperOrWebContents && typeof wrapperOrWebContents === 'object' && 'webContents' in wrapperOrWebContents;
};

/**
 * Get the WebContents object from either a WebContentsWrapper or WebContents
 */
export const getWebContents = (wrapperOrWebContents: WebContentsWrapper | WebContents): WebContents | undefined => {
  if (isWebContents(wrapperOrWebContents)) {
    return wrapperOrWebContents;
  }

  if (isWrapper(wrapperOrWebContents)) {
    return wrapperOrWebContents.webContents;
  }

  return undefined;
};

/**
 * Check if a WebContents is destroyed
 */
export const isDestroyed = (webContents: WebContents): boolean => {
  try {
    if (typeof webContents.isDestroyed === 'function') {
      return webContents.isDestroyed();
    }
    return false;
  } catch (error) {
    return true;
  }
};

/**
 * Safely send a message to a WebContents
 */
export const safelySendToWindow = (webContents: WebContents, channel: string, data: unknown): boolean => {
  try {
    if (!webContents || isDestroyed(webContents)) {
      return false;
    }

    // Type check for WebContents API
    const hasWebContentsAPI = typeof webContents.send === 'function';
    if (!hasWebContentsAPI) {
      return false;
    }

    // Check if isLoading is a function before calling it
    const isLoading = typeof webContents.isLoading === 'function' ? webContents.isLoading() : false;

    if (isLoading) {
      webContents.once('did-finish-load', () => {
        try {
          if (!webContents.isDestroyed()) {
            webContents.send(channel, data);
          }
        } catch (e) {
          // Ignore errors during load
        }
      });
      return true;
    }

    webContents.send(channel, data);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Set up cleanup when WebContents is destroyed
 */
export const setupDestroyListener = (webContents: WebContents, cleanup: () => void): void => {
  try {
    if (typeof webContents.once === 'function') {
      webContents.once('destroyed', cleanup);
    }
  } catch (e) {
    // Ignore errors
  }
};

/**
 * Creates a tracker for WebContents objects using WeakMap for automatic garbage collection
 * and a Set to keep track of active IDs
 */
export interface WebContentsTracker {
  track(webContents: WebContents): boolean;
  untrack(webContents: WebContents): void;
  untrackById(id: number): void;
  isTracked(webContents: WebContents): boolean;
  hasId(id: number): boolean;
  getActiveIds(): number[];
  getActiveWebContents(): WebContents[];
  cleanup(): void;
}

/**
 * Creates a WebContents tracker that uses WeakMap for automatic garbage collection
 * but maintains a set of active IDs for tracking purposes
 */
export const createWebContentsTracker = (): WebContentsTracker => {
  // WeakMap for the primary storage - won't prevent garbage collection
  const webContentsTracker = new WeakMap<WebContents, { id: number }>();

  // Set to track active subscription IDs (not object references)
  const activeIds = new Set<number>();

  // Strong reference map of WebContents by ID - we need this to retrieve active WebContents
  // This will be maintained alongside the WeakMap
  const webContentsById = new Map<number, WebContents>();

  return {
    track: (webContents: WebContents): boolean => {
      if (!webContents || isDestroyed(webContents)) return false;

      const id = webContents.id;
      webContentsTracker.set(webContents, { id });
      activeIds.add(id);
      webContentsById.set(id, webContents);

      // Set up the destroyed listener for cleanup
      setupDestroyListener(webContents, () => {
        activeIds.delete(id);
        webContentsTracker.delete(webContents);
        webContentsById.delete(id);
      });

      return true;
    },

    untrack: (webContents: WebContents): void => {
      if (!webContents) return;

      const id = webContents.id;
      // Explicitly delete from all tracking structures
      webContentsTracker.delete(webContents);
      activeIds.delete(id);
      webContentsById.delete(id);
    },

    untrackById: (id: number): void => {
      activeIds.delete(id);
      const webContents = webContentsById.get(id);
      if (webContents) {
        webContentsTracker.delete(webContents);
      }
      webContentsById.delete(id);
    },

    isTracked: (webContents: WebContents): boolean => {
      return webContents && webContentsTracker.has(webContents) && activeIds.has(webContents.id);
    },

    hasId: (id: number): boolean => {
      return activeIds.has(id);
    },

    getActiveIds: (): number[] => {
      return [...activeIds];
    },

    getActiveWebContents: (): WebContents[] => {
      const result: WebContents[] = [];

      // Filter out any destroyed WebContents that might still be in our map
      for (const [id, webContents] of webContentsById.entries()) {
        if (!isDestroyed(webContents)) {
          result.push(webContents);
        } else {
          // Clean up any destroyed WebContents we find
          activeIds.delete(id);
          webContentsById.delete(id);
        }
      }

      return result;
    },

    cleanup: (): void => {
      activeIds.clear();
      webContentsById.clear();
    },
  };
};

/**
 * Helper function to prepare a batch of WebContents objects for tracking
 * from various input types
 */
export const prepareWebContents = (wrappers: Array<WebContentsWrapper | WebContents>): WebContents[] => {
  const result: WebContents[] = [];

  for (const wrapper of wrappers) {
    const webContents = getWebContents(wrapper);
    if (webContents && !isDestroyed(webContents)) {
      result.push(webContents);
    }
  }

  return result;
};
