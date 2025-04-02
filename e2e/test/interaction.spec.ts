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
      const incrementButton = await browser.$('button=increment');

      await incrementButton.click();
      const counterElement1 = await browser.$('pre');
      expect(await counterElement1.getText()).toBe('1');
      await incrementButton.click();
      const counterElement2 = await browser.$('pre');
      expect(await counterElement2.getText()).toBe('2');
      await incrementButton.click();
      const counterElement3 = await browser.$('pre');
      expect(await counterElement3.getText()).toBe('3');
    });

    it('should decrement the counter', async () => {
      const decrementButton = await browser.$('button=decrement');

      await decrementButton.click();
      const counterElement1 = await browser.$('pre');
      expect(await counterElement1.getText()).toBe('2');
      await decrementButton.click();
      const counterElement2 = await browser.$('pre');
      expect(await counterElement2.getText()).toBe('1');
      await decrementButton.click();
      const counterElement3 = await browser.$('pre');
      expect(await counterElement3.getText()).toBe('0');
    });

    // Setting badge count is supported on macOS and Linux
    // However, Linux support is limited to Unity, which is not the default desktop environment for Ubuntu
    if (process.platform === 'darwin') {
      it('should increment the badgeCount', async () => {
        let badgeCount: number;
        const incrementButton = await browser.$('button=increment');

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
        const decrementButton = await browser.$('button=decrement');

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
      const createWindowButton = await browser.$('button=create window');
      await createWindowButton.click();

      await waitUntilWindowsAvailable(2);
      const windows = await browser.electron.execute((electron) => {
        return electron.BrowserWindow.getAllWindows().length;
      });

      expect(windows).toBe(2);
    });

    it('should close a window', async () => {
      const closeWindowButton = await browser.$('button=close window');
      await closeWindowButton.click();

      await waitUntilWindowsAvailable(1);
      const windows = await browser.electron.execute((electron) => {
        return electron.BrowserWindow.getAllWindows().length;
      });

      expect(windows).toBe(1);
    });

    it('should maintain state across windows', async () => {
      // Increment counter in main window
      const incrementButton = await browser.$('button=increment');
      await incrementButton.click();
      await incrementButton.click();
      await incrementButton.click();

      // Create new window
      const createWindowButton = await browser.$('button=create window');
      await createWindowButton.click();

      // Wait for new window and switch to it
      await waitUntilWindowsAvailable(2);
      const runtimeHandle = windowHandles.get('Runtime Window');
      if (runtimeHandle) {
        await browser.switchToWindow(runtimeHandle);
      }

      // Verify counter state in new window
      const counterElement = await browser.$('pre');
      expect(await counterElement.getText()).toBe('3');
    });
  });
});
