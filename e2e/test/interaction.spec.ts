import { expect } from '@wdio/globals';
import { browser } from 'wdio-electron-service';

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
  before(async () => {
    await waitUntilWindowsAvailable(1);
  });

  describe('click events', () => {
    it('should increment the counter', async () => {
      const incrementButton = await browser.$('button=+');

      await incrementButton.click();
      const counterElement1 = await browser.$('h2');
      expect(await counterElement1.getText()).toContain('1');
      await incrementButton.click();
      const counterElement2 = await browser.$('h2');
      expect(await counterElement2.getText()).toContain('2');
      await incrementButton.click();
      const counterElement3 = await browser.$('h2');
      expect(await counterElement3.getText()).toContain('3');
    });

    it('should decrement the counter', async () => {
      const decrementButton = await browser.$('button=-');

      await decrementButton.click();
      const counterElement1 = await browser.$('h2');
      expect(await counterElement1.getText()).toContain('2');
      await decrementButton.click();
      const counterElement2 = await browser.$('h2');
      expect(await counterElement2.getText()).toContain('1');
      await decrementButton.click();
      const counterElement3 = await browser.$('h2');
      expect(await counterElement3.getText()).toContain('0');
    });

    // Setting badge count is supported on macOS and Linux
    // However, Linux support is limited to Unity, which is not the default desktop environment for Ubuntu
    if (process.platform === 'darwin') {
      it('should increment the badgeCount', async () => {
        let badgeCount: number;
        const incrementButton = await browser.$('button=+');

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
        const decrementButton = await browser.$('button=-');

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
      const createWindowButton = await browser.$('button=Create New Window');
      await createWindowButton.click();

      await waitUntilWindowsAvailable(2);
      const windows = await browser.electron.execute((electron) => {
        return electron.BrowserWindow.getAllWindows().length;
      });

      expect(windows).toBe(2);
    });

    it('should close a window', async () => {
      const runtimeHandle = windowHandles.get('Runtime Window');
      if (runtimeHandle) {
        await browser.switchToWindow(runtimeHandle);
      }

      const closeWindowButton = await browser.$('button=Close Window');
      await closeWindowButton.click();

      await waitUntilWindowsAvailable(1);
      const windows = await browser.electron.execute((electron) => {
        return electron.BrowserWindow.getAllWindows().length;
      });

      expect(windows).toBe(1);
    });

    it('should maintain state across windows', async () => {
      const incrementButton = await browser.$('button=+');
      await incrementButton.click();
      await incrementButton.click();
      await incrementButton.click();

      const createWindowButton = await browser.$('button=Create New Window');
      await createWindowButton.click();

      await waitUntilWindowsAvailable(2);
      const runtimeHandle = windowHandles.get('Runtime Window');
      if (runtimeHandle) {
        await browser.switchToWindow(runtimeHandle);
      }

      const counterElement = await browser.$('h2');
      expect(await counterElement.getText()).toContain('3');
    });
  });
});
