# Frontend Process

## Accessing State

In the frontend process, you access the store using the `useStore` hook. This hook works similar to Zustand's own hook but connects to the backend process state:

```typescript
import { useStore } from './store';

function Counter() {
  // Access the entire state
  const state = useStore();

  // Or use a selector to access specific parts (recommended for performance)
  const counter = useStore(state => state.counter);

  return <div>{counter}</div>;
}
```

The `useStore` hook is memoized by default and will only trigger re-renders when the selected state changes.

## Dispatching Actions

To update state, dispatch actions that will be processed by the backend process:

```typescript
import { useStore, dispatch } from './store';

function Counter() {
  const counter = useStore(state => state.counter);

  return (
    <div>
      <p>Count: {counter}</p>
      <button onClick={() => dispatch('COUNTER:INCREMENT')}>Increment</button>
      <button onClick={() => dispatch('COUNTER:DECREMENT')}>Decrement</button>
      <button onClick={() => dispatch('COUNTER:SET', 0)}>Reset</button>
    </div>
  );
}
```

### Action Types

You can dispatch actions in different formats:

1. **String action type with optional payload**:

   ```typescript
   dispatch('COUNTER:INCREMENT');
   dispatch('COUNTER:SET', 5);
   ```

2. **Action object**:
   ```typescript
   dispatch({ type: 'COUNTER:INCREMENT' });
   dispatch({ type: 'COUNTER:SET', payload: 5 });
   ```

## Handling State Updates

Zubridge automatically synchronizes state between windows. When the state is updated in the backend process, all frontend processes receive the update.

### State Update Metadata

Each state update includes metadata that can help with debugging:

```typescript
const updateMeta = useStore((state) => (state as any).__meta);

console.log(updateMeta);
// {
//   updateId: "uniqueId123",
//   timestamp: 1650123456789,
//   sourceWindow: "backend",
//   reason: "COUNTER:INCREMENT"
// }
```

This metadata can be useful for tracking the source of state changes, especially in multi-window applications.

## Performance Considerations

For optimal performance:

1. Use selectors to access only the state you need:

   ```typescript
   // Good - only re-renders when counter changes
   const counter = useStore((state) => state.counter);

   // Avoid - re-renders on any state change
   const state = useStore();
   const counter = state.counter;
   ```

2. When dispatching actions that trigger rapid state changes, Zubridge includes built-in debouncing to prevent UI freezing.

## Multi-Window Interaction

Zubridge handles multi-window state synchronization automatically. When dispatching an action from any window, the action is processed in the backend process, and the updated state is broadcast to all windows.

```typescript
// In window A
dispatch('COUNTER:INCREMENT');

// Window B automatically receives the updated counter value
```

## Debugging

You can monitor state updates in the browser console. Zubridge logs detailed information about state changes, including the source window and a unique ID for each update.

For deeper debugging, add a useEffect to monitor state changes:

```typescript
useEffect(() => {
  console.log('Counter changed:', counter);
  // You can also inspect state metadata
  const meta = (state as any).__meta;
  if (meta) {
    console.log('Update source:', meta.sourceWindow);
    console.log('Update reason:', meta.reason);
  }
}, [counter]);
```
