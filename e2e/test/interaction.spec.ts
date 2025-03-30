import { expect } from '@wdio/globals';
import { browser } from 'wdio-electron-service';
import { setupBrowser, type WebdriverIOQueries } from '@testing-library/webdriverio';

const windowHandles = new Map<string, string>();

const waitUntilWindowsAvailable = async (desiredWindows: number) =>
  await browser.waitUntil(async () => {
    const handles = await browser.getWindowHandles();
    for (const handle of handles) {
      if (!windowHandles.has(handle)) {
        await browser.switchToWindow(handle);
        const title = await browser.getTitle();
        windowHandles.set(title, handle);
      }
    }
    return handles.length === desiredWindows;
  });

describe('application loading', () => {
  let screen: WebdriverIOQueries;

  before(async () => {
    screen = setupBrowser(browser as any);
    await waitUntilWindowsAvailable(1);
  });

  describe('click events', () => {
    it('should increment the counter', async () => {
      const incrementButton = await screen.getByText('increment');

      await incrementButton.click();
      expect(await screen.getByText('1')).toBeDefined();
      await incrementButton.click();
      expect(await screen.getByText('2')).toBeDefined();
      await incrementButton.click();
      expect(await screen.getByText('3')).toBeDefined();
    });

    it('should decrement the counter', async () => {
      const decrementButton = await screen.getByText('decrement');

      await decrementButton.click();
      expect(await screen.getByText('2')).toBeDefined();
      await decrementButton.click();
      expect(await screen.getByText('1')).toBeDefined();
      await decrementButton.click();
      expect(await screen.getByText('0')).toBeDefined();
    });

    // Setting badge count is supported on macOS and Linux
    // However, Linux support is limited to Unity, which is not the default desktop environment for Ubuntu
    if (process.platform === 'darwin') {
      it('should increment the badgeCount', async () => {
        let badgeCount: number;
        const incrementButton = await screen.getByText('increment');

        await incrementButton.click();
        badgeCount = await browser.electron.execute((electron) => {
          return electron.app.getBadgeCount();
        });

        expect(badgeCount).toBe(1);

        await incrementButton.click();
        badgeCount = await browser.electron.execute((electron) => {
          return electron.app.getBadgeCount();
        });

        expect(badgeCount).toBe(2);

        await incrementButton.click();
        badgeCount = await browser.electron.execute((electron) => {
          return electron.app.getBadgeCount();
        });

        expect(badgeCount).toBe(3);
      });

      it('should decrement the badgeCount', async () => {
        let badgeCount: number;
        const decrementButton = await screen.getByText('decrement');

        await decrementButton.click();
        badgeCount = await browser.electron.execute((electron) => {
          return electron.app.getBadgeCount();
        });

        expect(badgeCount).toBe(2);

        await decrementButton.click();
        badgeCount = await browser.electron.execute((electron) => {
          return electron.app.getBadgeCount();
        });

        expect(badgeCount).toBe(1);

        await decrementButton.click();
        badgeCount = await browser.electron.execute((electron) => {
          return electron.app.getBadgeCount();
        });

        expect(badgeCount).toBe(0);
      });
    }
  });

  describe('window management', () => {
    it('should create a new window', async () => {
      const createWindowButton = await screen.getByText('create window');
      await createWindowButton.click();

      await waitUntilWindowsAvailable(2);
      const windows = await browser.electron.execute((electron) => {
        return electron.BrowserWindow.getAllWindows().length;
      });

      expect(windows).toBe(2);
    });

    it('should close a window', async () => {
      const closeWindowButton = await screen.getByText('close window');
      await closeWindowButton.click();

      await waitUntilWindowsAvailable(1);
      const windows = await browser.electron.execute((electron) => {
        return electron.BrowserWindow.getAllWindows().length;
      });

      expect(windows).toBe(1);
    });

    it('should maintain state across windows', async () => {
      // Increment counter in main window
      const incrementButton = await screen.getByText('increment');
      await incrementButton.click();
      await incrementButton.click();
      await incrementButton.click();

      // Create new window
      const createWindowButton = await screen.getByText('create window');
      await createWindowButton.click();

      // Wait for new window and switch to it
      await waitUntilWindowsAvailable(2);
      const runtimeHandle = windowHandles.get('Runtime Window');
      if (runtimeHandle) {
        await browser.switchToWindow(runtimeHandle);
      }

      // Verify counter state in new window
      expect(await screen.getByText('3')).toBeDefined();
    });
  });
});
