import { is } from '@electron-toolkit/utils'
import { app, BaseWindow } from 'electron'
import icon from '../../resources/icon.png?asset'
import { createWebContentsView, showContent } from './create-view'

let baseWindow: BaseWindow | null = null

/**
 * Creates a BaseWindow and populates it with a WebContentsView to serve the renderer.
 */
export const initializeBaseWindow = async () => {
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

  // Add handler to show the BaseWindow when it's ready
  app.on('activate', () => {
    showBaseWindow()
  })

  const mainContent = await createWebContentsView()

  if (mainContent === null) {
    console.error('Failed to load mainContent')
    return
  }

  baseWindow.contentView.addChildView(mainContent)

  showContent(mainContent)
  mainContent.webContents.focus()
  showBaseWindow()
}

/**
 * Returns the main application window instance.
 */
export const getBaseWindow = () => {
  return baseWindow
}

/**
 * Shows the main application window.
 * Handles different behavior for development and production environments.
 */
const showBaseWindow = () => {
  if (!baseWindow) {
    return
  }

  //? This is to prevent the window from gaining focus everytime we make a change in code.
  if (!is.dev && !process.env['ELECTRON_RENDERER_URL']) {
    baseWindow!.show()
    return
  }

  if (!baseWindow.isVisible()) {
    baseWindow!.show()
  }
}
