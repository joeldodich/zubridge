import { createUseStore } from '@zubridge/electron'
import type { AppState } from '../../../types/index'

// Create a hook to access the store
export const useStore = createUseStore<AppState>()
