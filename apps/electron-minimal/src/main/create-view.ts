import { is } from '@electron-toolkit/utils'
import { shell, WebContentsView } from 'electron'
import { join } from 'path'
import { getBaseWindow } from './initialize-window'

const webContentsViews: WebContentsView[] = []

export const createWebContentsView = (): Promise<WebContentsView | null> => {
  return new Promise((resolve) => {
    const baseWindow = getBaseWindow()
    if (baseWindow === null) resolve(null)

    const newContentView = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })

    newContentView.setBackgroundColor('#020203')

    newContentView.webContents.on('did-finish-load', () => {
      // if (bringToFront) {
      showContent(newContentView)
      // }
      resolve(newContentView)
    })

    newContentView.webContents.on('did-fail-load', () => {
      resolve(null)
    })

    newContentView.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    webContentsViews.push(newContentView)

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      newContentView.webContents.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      newContentView.webContents.loadFile(join(__dirname, '../renderer/index.html'))
    }
  })
}

/**
 * Displays a WebContentView in the main window and sets it as the active tab.
 * @param webContentsView The WebContentView to display
 */
export const showContent = (webContentsView: WebContentsView) => {
  const baseWindow = getBaseWindow()
  if (!baseWindow) {
    return
  }

  const setWebContentBounds = () => {
    const newBounds = baseWindow.getBounds()
    webContentsView.setBounds({
      x: 0,
      y: 0,
      width: newBounds.width,
      height: newBounds.height
    })
  }

  setWebContentBounds()

  baseWindow.removeAllListeners('resize')

  baseWindow.on('resize', () => {
    setWebContentBounds()
  })

  baseWindow.contentView.addChildView(webContentsView)
}
