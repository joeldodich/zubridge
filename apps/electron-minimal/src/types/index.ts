// Reduced example from https://github.com/goosewobbler/zubridge/blob/main/packages/electron/docs/getting-started.md#approach-1-using-the-zustand-adapter
export interface AppState {
  counter: number
  [key: string]: any // Add index signature to satisfy AnyState constraint
}
