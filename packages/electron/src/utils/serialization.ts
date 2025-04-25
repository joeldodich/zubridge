import type { AnyState } from '@zubridge/types';

/**
 * Removes functions and non-serializable objects from a state object
 * to prevent IPC serialization errors when sending between processes
 *
 * @param state The state object to sanitize
 * @returns A new state object with functions and non-serializable parts removed
 */
export const sanitizeState = (state: AnyState): Record<string, unknown> => {
  if (!state || typeof state !== 'object') return state as any;

  const safeState: Record<string, unknown> = {};

  for (const key in state) {
    const value = state[key];

    // Skip functions which cannot be cloned over IPC
    if (typeof value !== 'function') {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively sanitize nested objects
        safeState[key] = sanitizeState(value as AnyState);
      } else {
        safeState[key] = value;
      }
    }
  }

  return safeState;
};
