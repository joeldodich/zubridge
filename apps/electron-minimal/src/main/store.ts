import { createZustandBridge } from '@zubridge/electron/main'
import { createStore } from 'zustand/vanilla'
import type { AppState } from '../types/index'

const initialState: AppState = {
  counter: 0
}

// create app store
export const store = createStore<AppState>()(() => initialState)

export const initializeZustandBridge = () => {
  return createZustandBridge(store)
}
