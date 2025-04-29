import type { Handler } from '@zubridge/types';

/**
 * Helper function to find a case-insensitive match in an object
 */
export function findCaseInsensitiveMatch<T>(obj: Record<string, T>, key: string): [string, T] | undefined {
  // Try exact match first
  if (key in obj) {
    return [key, obj[key]];
  }

  // Try case-insensitive match
  const keyLower = key.toLowerCase();
  const matchingKey = Object.keys(obj).find((k) => k.toLowerCase() === keyLower);

  if (matchingKey) {
    return [matchingKey, obj[matchingKey]];
  }

  return undefined;
}

/**
 * Helper function to find a handler by nested path
 * Example: "counter.increment" -> obj.counter.increment
 */
export function findNestedHandler<T>(obj: Record<string, any>, path: string): T | undefined {
  try {
    const parts = path.split('.');
    let current = obj;

    // Navigate through each part of the path
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      // Case-insensitive comparison for each level
      const keys = Object.keys(current);
      const matchingKey = keys.find((k) => k.toLowerCase() === part.toLowerCase());

      if (matchingKey === undefined) {
        return undefined;
      }

      current = current[matchingKey];
    }

    return typeof current === 'function' ? (current as T) : undefined;
  } catch (error) {
    console.error('Error resolving nested handler:', error);
    return undefined;
  }
}

/**
 * Resolves a handler function from provided handlers using action type
 * This handles both direct matches and nested path resolution
 */
export function resolveHandler(handlers: Record<string, Handler | any>, actionType: string): Handler | undefined {
  // Try direct match with handlers
  const handlerMatch = findCaseInsensitiveMatch(handlers, actionType);
  if (handlerMatch && typeof handlerMatch[1] === 'function') {
    return handlerMatch[1] as Handler;
  }

  // Try nested path resolution in handlers
  return findNestedHandler<Handler>(handlers, actionType);
}
