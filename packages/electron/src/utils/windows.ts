import type { WebContents } from 'electron';
import type { WebContentsWrapper } from '@zubridge/types';

// Debug logger with timestamp
const debugWindows = (message: string, ...args: any[]) => {
  const timestamp = new Date().toISOString();
  console.log(`[WINDOWS ${timestamp}] ${message}`, ...args);
};

/**
 * Type guard to check if an object is an Electron WebContents
 */
export const isWebContents = (
  wrapperOrWebContents: WebContentsWrapper | WebContents,
): wrapperOrWebContents is WebContents => {
  const result = wrapperOrWebContents && typeof wrapperOrWebContents === 'object' && 'id' in wrapperOrWebContents;
  if (result) {
    debugWindows(`isWebContents: TRUE for id ${(wrapperOrWebContents as WebContents).id}`);
  } else {
    debugWindows('isWebContents: FALSE', wrapperOrWebContents);
  }
  return result;
};

/**
 * Type guard to check if an object is a WebContentsWrapper
 */
export const isWrapper = (
  wrapperOrWebContents: WebContentsWrapper | WebContents,
): wrapperOrWebContents is WebContentsWrapper => {
  const result =
    wrapperOrWebContents && typeof wrapperOrWebContents === 'object' && 'webContents' in wrapperOrWebContents;

  if (result) {
    debugWindows(`isWrapper: TRUE for id ${(wrapperOrWebContents as WebContentsWrapper).webContents?.id}`);
  } else {
    debugWindows('isWrapper: FALSE', wrapperOrWebContents);
  }
  return result;
};

/**
 * Get the WebContents object from either a WebContentsWrapper or WebContents
 */
export const getWebContents = (wrapperOrWebContents: WebContentsWrapper | WebContents): WebContents | undefined => {
  // Create a more readable description of the input for logging
  let description = 'Invalid input';

  if (wrapperOrWebContents && typeof wrapperOrWebContents === 'object') {
    if ('id' in wrapperOrWebContents) {
      description = `WebContents ID: ${wrapperOrWebContents.id}`;
    } else if ('webContents' in wrapperOrWebContents) {
      description = `Wrapper with WebContents ID: ${wrapperOrWebContents.webContents?.id}`;
    } else {
      description = 'Unknown object type';
    }
  }

  debugWindows(`getWebContents called with: ${description}`);

  if (isWebContents(wrapperOrWebContents)) {
    debugWindows(`getWebContents: Returning direct WebContents with ID: ${wrapperOrWebContents.id}`);
    return wrapperOrWebContents;
  }

  if (isWrapper(wrapperOrWebContents)) {
    const webContents = wrapperOrWebContents.webContents;
    debugWindows(`getWebContents: Extracting from wrapper, ID: ${webContents?.id || 'undefined'}`);
    return webContents;
  }

  debugWindows('getWebContents: Could not extract WebContents, returning undefined');
  return undefined;
};

/**
 * Check if a WebContents is destroyed
 */
export const isDestroyed = (webContents: WebContents): boolean => {
  try {
    if (typeof webContents.isDestroyed === 'function') {
      const destroyed = webContents.isDestroyed();
      debugWindows(`isDestroyed check for WebContents ID ${webContents.id}: ${destroyed}`);
      return destroyed;
    }
    debugWindows(`isDestroyed: WebContents ID ${webContents?.id} has no isDestroyed function`);
    return false;
  } catch (error) {
    debugWindows(`isDestroyed: Exception while checking ID ${webContents?.id}`, error);
    return true;
  }
};

/**
 * Safely send a message to a WebContents
 */
export const safelySendToWindow = (webContents: WebContents, channel: string, data: unknown): boolean => {
  try {
    debugWindows(`safelySendToWindow: Attempting to send to WebContents ID ${webContents?.id}, channel: ${channel}`);

    if (!webContents || isDestroyed(webContents)) {
      debugWindows(`safelySendToWindow: WebContents is undefined or destroyed, aborting send`);
      return false;
    }

    // Type check for WebContents API
    const hasWebContentsAPI = typeof webContents.send === 'function';
    if (!hasWebContentsAPI) {
      debugWindows(`safelySendToWindow: WebContents ID ${webContents.id} missing 'send' function`);
      return false;
    }

    // Check if isLoading is a function before calling it
    const isLoading = typeof webContents.isLoading === 'function' ? webContents.isLoading() : false;
    debugWindows(`safelySendToWindow: WebContents ID ${webContents.id} isLoading: ${isLoading}`);

    if (isLoading) {
      debugWindows(`safelySendToWindow: WebContents ID ${webContents.id} is loading, queueing message for later`);
      webContents.once('did-finish-load', () => {
        try {
          if (!webContents.isDestroyed()) {
            debugWindows(`safelySendToWindow: Now sending delayed message to WebContents ID ${webContents.id}`);
            webContents.send(channel, data);
          } else {
            debugWindows(`safelySendToWindow: WebContents ID ${webContents.id} was destroyed before load finished`);
          }
        } catch (e) {
          debugWindows(`safelySendToWindow: Error sending delayed message to WebContents ID ${webContents.id}`, e);
        }
      });
      return true;
    }

    debugWindows(`safelySendToWindow: Sending message immediately to WebContents ID ${webContents.id}`);
    webContents.send(channel, data);
    return true;
  } catch (error) {
    debugWindows(`safelySendToWindow: Exception while sending to WebContents ID ${webContents?.id}`, error);
    return false;
  }
};

/**
 * Set up cleanup when WebContents is destroyed
 */
export const setupDestroyListener = (webContents: WebContents, cleanup: () => void): void => {
  try {
    debugWindows(`setupDestroyListener: Setting up cleanup for WebContents ID ${webContents?.id}`);
    if (typeof webContents.once === 'function') {
      webContents.once('destroyed', () => {
        debugWindows(`WebContents ID ${webContents.id} destroyed, running cleanup`);
        cleanup();
      });
    } else {
      debugWindows(`setupDestroyListener: WebContents ID ${webContents.id} missing 'once' function`);
    }
  } catch (e) {
    debugWindows(`setupDestroyListener: Exception for WebContents ID ${webContents?.id}`, e);
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
  debugWindows('Creating new WebContentsTracker');

  // WeakMap for the primary storage - won't prevent garbage collection
  const webContentsTracker = new WeakMap<WebContents, { id: number }>();

  // Set to track active subscription IDs (not object references)
  const activeIds = new Set<number>();

  // Strong reference map of WebContents by ID - we need this to retrieve active WebContents
  // This will be maintained alongside the WeakMap
  const webContentsById = new Map<number, WebContents>();

  const logTrackerState = () => {
    debugWindows(`WebContentsTracker state: ${activeIds.size} active IDs, ${webContentsById.size} tracked WebContents`);
    debugWindows(`Active IDs: ${[...activeIds].join(', ')}`);
  };

  return {
    track: (webContents: WebContents): boolean => {
      if (!webContents) {
        debugWindows('track: Called with undefined WebContents');
        return false;
      }

      if (isDestroyed(webContents)) {
        debugWindows(`track: WebContents ID ${webContents.id} is already destroyed`);
        return false;
      }

      const id = webContents.id;
      debugWindows(`track: Adding WebContents ID ${id} to tracker`);

      webContentsTracker.set(webContents, { id });
      activeIds.add(id);
      webContentsById.set(id, webContents);

      // Set up the destroyed listener for cleanup
      setupDestroyListener(webContents, () => {
        debugWindows(`track: Cleanup handler for WebContents ID ${id} triggered`);
        activeIds.delete(id);
        webContentsById.delete(id);
      });

      logTrackerState();
      return true;
    },

    untrack: (webContents: WebContents): void => {
      if (!webContents) {
        debugWindows('untrack: Called with undefined WebContents');
        return;
      }

      const id = webContents.id;
      debugWindows(`untrack: Removing WebContents ID ${id} from tracker`);

      // Explicitly delete from all tracking structures
      webContentsTracker.delete(webContents);
      activeIds.delete(id);
      webContentsById.delete(id);

      logTrackerState();
    },

    untrackById: (id: number): void => {
      debugWindows(`untrackById: Removing ID ${id} from tracker`);

      activeIds.delete(id);
      const webContents = webContentsById.get(id);
      if (webContents) {
        debugWindows(`untrackById: Found and removing WebContents for ID ${id}`);
        webContentsTracker.delete(webContents);
      }
      webContentsById.delete(id);

      logTrackerState();
    },

    isTracked: (webContents: WebContents): boolean => {
      if (!webContents) {
        debugWindows('isTracked: Called with undefined WebContents');
        return false;
      }

      const tracked = webContents && webContentsTracker.has(webContents) && activeIds.has(webContents.id);

      debugWindows(`isTracked: WebContents ID ${webContents.id} tracked: ${tracked}`);
      return tracked;
    },

    hasId: (id: number): boolean => {
      const has = activeIds.has(id);
      debugWindows(`hasId: ID ${id} in tracker: ${has}`);
      return has;
    },

    getActiveIds: (): number[] => {
      const ids = [...activeIds];
      debugWindows(`getActiveIds: Returning ${ids.length} active IDs: ${ids.join(', ')}`);
      return ids;
    },

    getActiveWebContents: (): WebContents[] => {
      debugWindows('getActiveWebContents: Collecting active WebContents');
      const result: WebContents[] = [];

      // Filter out any destroyed WebContents that might still be in our map
      for (const [id, webContents] of webContentsById.entries()) {
        if (!isDestroyed(webContents)) {
          debugWindows(`getActiveWebContents: Adding active WebContents ID ${id}`);
          result.push(webContents);
        } else {
          // Clean up any destroyed WebContents we find
          debugWindows(`getActiveWebContents: Found destroyed WebContents ID ${id}, cleaning up`);
          activeIds.delete(id);
          webContentsById.delete(id);
        }
      }

      debugWindows(`getActiveWebContents: Returning ${result.length} active WebContents`);
      return result;
    },

    cleanup: (): void => {
      debugWindows(`cleanup: Clearing all tracked WebContents (${activeIds.size} IDs)`);
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
  debugWindows(`prepareWebContents: Processing ${wrappers.length} wrappers/WebContents`);
  const result: WebContents[] = [];

  for (const wrapper of wrappers) {
    const webContents = getWebContents(wrapper);
    if (webContents && !isDestroyed(webContents)) {
      debugWindows(`prepareWebContents: Adding WebContents ID ${webContents.id} to result`);
      result.push(webContents);
    } else {
      debugWindows('prepareWebContents: Skipping undefined or destroyed WebContents');
    }
  }

  debugWindows(`prepareWebContents: Returning ${result.length} valid WebContents objects`);
  return result;
};
