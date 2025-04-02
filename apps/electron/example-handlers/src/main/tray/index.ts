import { type BrowserWindow, Menu, Tray, app, nativeImage } from 'electron';
import { createDispatch } from '@zubridge/electron/main';
import trayIconFile from '../../../../../../resources/trayIcon.png';

import { type State, type Store, type Handlers } from '../../features/index.js';

const trayIcon = nativeImage.createFromDataURL(trayIconFile).resize({
  width: 18,
  height: 18,
});

class SystemTray {
  private dispatch?: ReturnType<typeof createDispatch<State, Store>>;
  private electronTray?: Tray;
  private window?: BrowserWindow;

  private update = (state: State) => {
    if (!this.dispatch) {
      return;
    }
    if (!this.electronTray) {
      this.electronTray = new Tray(trayIcon);
    }

    const dispatch = this.dispatch;
    const showWindow = () => this.window?.show();
    const stateText = `state: ${state.counter ?? 'loading...'}`;
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'decrement',
        type: 'normal',
        click: () => {
          dispatch('COUNTER:DECREMENT');
          showWindow();
        },
      },
      {
        label: stateText,
        type: 'normal',
        click: () => showWindow(),
      },
      {
        label: 'increment',
        type: 'normal',
        click: () => {
          dispatch('COUNTER:INCREMENT');
          showWindow();
        },
      },
      { type: 'separator' },
      {
        label: 'quit',
        click: () => {
          app.exit(0);
        },
      },
    ]);

    this.electronTray.setContextMenu(contextMenu);
    this.electronTray.setToolTip(stateText);
  };

  public init = (store: Store, window: BrowserWindow, handlers: Handlers) => {
    this.window = window;

    // Create the dispatch function with the SAME handlers that are used in the bridge
    // This ensures that when we dispatch an action, it uses the same handler logic
    this.dispatch = createDispatch(store, { handlers });

    // Initialize immediately with current state
    this.update(store.getState());

    // Subscribe to state changes to update the tray UI
    store.subscribe((state) => this.update(state));
  };

  public destroy = () => {
    this.electronTray?.destroy();
    this.electronTray = undefined;
  };
}

export const tray = new SystemTray();
