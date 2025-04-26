import { is } from '@electron-toolkit/utils'
import { app, BaseWindow } from 'electron'
import icon from '../../resources/icon.png?asset'
import { createWebContentsView, showContent } from './create-view'
import { initializeZustandBridge } from './store'

/**
 * Accessible instance of the BaseWindow.
 */
let baseWindow: BaseWindow | null = null

/**
 * Creates a BaseWindow and populates it with a WebContentsView to serve the renderer.
 */
export const initializeWindowAndViews = async (
  storeBridge: ReturnType<typeof initializeZustandBridge>
) => {
  baseWindow = new BaseWindow({
    width: 900,
    height: 770,
    show: false,
    autoHideMenuBar: true,
    titleBarOverlay: true,
    resizable: true,
    movable: true,
    titleBarStyle: 'default',
    backgroundColor: '#292524',
    ...(process.platform === 'linux' ? { icon } : {})
  })

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    showBaseWindow(storeBridge)
  })

  const mainContent = await createWebContentsView()

  if (mainContent === null) {
    console.error('Failed to load mainContent')
    return
  }

  // Subscribe the window to the store
  storeBridge.subscribe([
    { webContents: mainContent.webContents, isDestroyed: mainContent.webContents.isDestroyed }
  ])

  mainContent.webContents.once('destroyed', () => {
    storeBridge.unsubscribe()
  })

  baseWindow.contentView.addChildView(mainContent)

  showContent(mainContent)
  mainContent.webContents.focus()
  showBaseWindow(storeBridge)

  if (is.dev) {
    mainContent.webContents.openDevTools({
      mode: 'detach'
    })
    mainContent.webContents.setDevToolsTitle(`${app.name} DevTools: ${mainContent.webContents.id}`)
  }
}

/**
 * Returns the main application window instance.
 */
export const getBaseWindow = () => {
  return baseWindow
}

/**
 * Shows the main application window.
 */
const showBaseWindow = (storeBridge: ReturnType<typeof initializeZustandBridge>) => {
  if (!baseWindow || baseWindow.isDestroyed()) {
    initializeWindowAndViews(storeBridge)
    return
  }

  baseWindow.show()
}
