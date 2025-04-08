import { expect } from '@wdio/globals';
import { browser } from 'wdio-electron-service';

const windowHandles = new Map<string, string>();

const waitUntilWindowsAvailable = async (desiredWindows: number) =>
  await browser.waitUntil(
    async () => {
      const windowCount = await refreshWindowHandles();
      return windowCount === desiredWindows;
    },
    {
      timeout: 10000,
      timeoutMsg: `Expected ${desiredWindows} windows to be available`,
    },
  );

// Helper to switch to window by title
const switchToWindowByTitle = async (title: string) => {
  const handle = windowHandles.get(title);
  if (handle) {
    await browser.switchToWindow(handle);
    return true;
  }
  return false;
};

// Helper to get counter value from current window
const getCounterValue = async () => {
  const counterElement = await browser.$('h2');
  const counterText = await counterElement.getText();
  return parseInt(counterText.replace('Counter: ', ''));
};

// Helper to refresh window handles
const refreshWindowHandles = async () => {
  const handles = await browser.getWindowHandles();

  // Clear old handle mapping
  windowHandles.clear();

  // Re-map window handles
  for (const handle of handles) {
    try {
      await browser.switchToWindow(handle);
      await browser.pause(100); // Give window time to load
      const title = await browser.getTitle();
      windowHandles.set(title, handle);
      console.log(`Mapped window: ${title} -> ${handle}`);
    } catch (error) {
      console.error(`Failed to switch to window ${handle}:`, error);
    }
  }

  console.log(`Available windows:`, [...windowHandles.keys()]);
  return handles.length;
};

// Helper to reset counter to zero
const resetCounter = async () => {
  // First get the current counter value
  const counterElement = await browser.$('h2');
  const counterText = await counterElement.getText();
  const currentCount = parseInt(counterText.replace('Counter: ', ''));

  // Use decrement button to reset to zero
  if (currentCount > 0) {
    const decrementButton = await browser.$('button=-');
    // Click the decrement button as many times as needed
    for (let i = 0; i < currentCount; i++) {
      await decrementButton.click();
      // Small wait to ensure state update
      await browser.pause(100);
    }
  }

  // Verify we're at zero
  const newCounterElement = await browser.$('h2');
  const newCounterText = await newCounterElement.getText();
  return parseInt(newCounterText.replace('Counter: ', ''));
};

// Helper function to get button based on window type
const getButtonInCurrentWindow = async (buttonType: 'increment' | 'decrement' | 'create' | 'close') => {
  // Determine if we're in main window or runtime window
  const title = await browser.getTitle();
  const isMainWindow = title.includes('Main Window');

  switch (buttonType) {
    case 'increment':
      return await browser.$('button=+');
    case 'decrement':
      return await browser.$('button=-');
    case 'create':
      return await browser.$('button=Create Window');
    case 'close':
      return isMainWindow ? await browser.$('button=Quit App') : await browser.$('button=Close Window');
    default:
      throw new Error(`Unknown button type: ${buttonType}`);
  }
};

describe('application loading', () => {
  before(async () => {
    await waitUntilWindowsAvailable(1);
  });

  describe('click events', () => {
    it('should increment the counter', async () => {
      // Use + button instead of "increment" text
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
      // Use - button instead of "decrement" text
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
        // Use + button instead of "increment" text
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
        // Use - button instead of "decrement" text
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
      const createWindowButton = await browser.$('button=Create Window');
      await createWindowButton.click();

      await waitUntilWindowsAvailable(2);
      const windows = await browser.electron.execute((electron) => {
        return electron.BrowserWindow.getAllWindows().length;
      });

      expect(windows).toBe(2);
    });

    it('should close a window', async () => {
      // Switch to the runtime window first
      const runtimeHandle = windowHandles.get('Runtime Window');
      if (runtimeHandle) {
        await browser.switchToWindow(runtimeHandle);
      }

      // Use "Close Window" text instead of "close window"
      const closeWindowButton = await browser.$('button=Close Window');
      await closeWindowButton.click();

      await waitUntilWindowsAvailable(1);
      const windows = await browser.electron.execute((electron) => {
        return electron.BrowserWindow.getAllWindows().length;
      });

      expect(windows).toBe(1);
    });

    it('should maintain state across windows', async () => {
      // Increment counter in main window
      // Use + button instead of "increment" text
      const incrementButton = await browser.$('button=+');
      await incrementButton.click();
      await incrementButton.click();
      await incrementButton.click();

      // Create new window
      const createWindowButton = await browser.$('button=Create Window');
      await createWindowButton.click();

      // Wait for new window and switch to it
      await waitUntilWindowsAvailable(2);
      const runtimeHandle = windowHandles.get('Runtime Window');
      if (runtimeHandle) {
        await browser.switchToWindow(runtimeHandle);
      }

      // Verify counter state in new window using h2 instead of pre
      const counterElement = await browser.$('h2');
      expect(await counterElement.getText()).toContain('3');
    });
  });

  describe('multi-window counter synchronization', () => {
    // Create two windows for testing
    before(async () => {
      // Make sure we're in the main window first
      await switchToWindowByTitle('Main Window');

      // Reset counter to 0 using our helper
      const finalCount = await resetCounter();
      expect(finalCount).toBe(0);

      // Create a new window if needed
      const windowCount = await browser.electron.execute((electron) => {
        return electron.BrowserWindow.getAllWindows().length;
      });

      if (windowCount < 2) {
        const createWindowButton = await browser.$('button=Create Window');
        await createWindowButton.click();
        await waitUntilWindowsAvailable(2);
      }
    });

    it('should increment counter from main window and sync to runtime window', async () => {
      // Switch to main window
      await switchToWindowByTitle('Main Window');

      // Increment counter in main window
      const incrementButton = await browser.$('button=+');
      await incrementButton.click();
      expect(await getCounterValue()).toBe(1);

      // Switch to runtime window and verify counter
      await switchToWindowByTitle('Runtime Window');
      expect(await getCounterValue()).toBe(1);
    });

    it('should increment counter from runtime window and sync to main window', async () => {
      // Switch to runtime window
      await switchToWindowByTitle('Runtime Window');

      // Increment counter in runtime window
      const incrementButton = await browser.$('button=+');
      await incrementButton.click();
      expect(await getCounterValue()).toBe(2);

      // Switch to main window and verify counter
      await switchToWindowByTitle('Main Window');
      expect(await getCounterValue()).toBe(2);
    });

    it('should decrement counter from main window and sync to runtime window', async () => {
      // Switch to main window
      await switchToWindowByTitle('Main Window');

      // Decrement counter in main window
      const decrementButton = await browser.$('button=-');
      await decrementButton.click();
      expect(await getCounterValue()).toBe(1);

      // Switch to runtime window and verify counter
      await switchToWindowByTitle('Runtime Window');
      expect(await getCounterValue()).toBe(1);
    });

    it('should decrement counter from runtime window and sync to main window', async () => {
      // Switch to runtime window
      await switchToWindowByTitle('Runtime Window');

      // Decrement counter in runtime window
      const decrementButton = await browser.$('button=-');
      await decrementButton.click();
      expect(await getCounterValue()).toBe(0);

      // Switch to main window and verify counter
      await switchToWindowByTitle('Main Window');
      expect(await getCounterValue()).toBe(0);
    });

    it('should handle rapid counter changes across multiple windows', async () => {
      // Increment in main window
      await switchToWindowByTitle('Main Window');
      await browser.pause(500); // Ensure window is fully loaded

      const mainIncrementButton = await getButtonInCurrentWindow('increment');
      await mainIncrementButton.click();
      await browser.pause(100);
      await mainIncrementButton.click();
      await browser.pause(100);
      expect(await getCounterValue()).toBe(2);

      // Increment in runtime window
      await switchToWindowByTitle('Runtime Window');
      await browser.pause(500); // Ensure window is fully loaded

      const runtimeIncrementButton = await getButtonInCurrentWindow('increment');
      await runtimeIncrementButton.click();
      await browser.pause(100);
      expect(await getCounterValue()).toBe(3);

      // Decrement in main window
      await switchToWindowByTitle('Main Window');
      await browser.pause(500); // Ensure window is fully loaded

      const mainDecrementButton = await getButtonInCurrentWindow('decrement');
      await mainDecrementButton.click();
      await browser.pause(100);
      expect(await getCounterValue()).toBe(2);

      // Check sync in runtime window
      await switchToWindowByTitle('Runtime Window');
      await browser.pause(500); // Ensure window is fully loaded
      expect(await getCounterValue()).toBe(2);
    });

    it('should create multiple windows and maintain state across all of them', async () => {
      // Switch to main window
      await switchToWindowByTitle('Main Window');
      await browser.pause(500); // Ensure window is fully loaded

      // Reset counter using our helper
      const finalCount = await resetCounter();
      expect(finalCount).toBe(0);

      // Create another window (will be the third one)
      const createWindowButton = await getButtonInCurrentWindow('create');
      await createWindowButton.click();
      await waitUntilWindowsAvailable(3);
      await browser.pause(500); // Ensure new window is fully loaded

      // Increment counter in main window
      const incrementButton = await getButtonInCurrentWindow('increment');
      await incrementButton.click();
      await browser.pause(100);
      await incrementButton.click();
      await browser.pause(100);
      expect(await getCounterValue()).toBe(2);

      // Check counter in all runtime windows
      await refreshWindowHandles();
      const handles = await browser.getWindowHandles();
      for (const handle of handles) {
        await browser.switchToWindow(handle);
        await browser.pause(300);
        const title = await browser.getTitle();
        if (title !== 'Main Window') {
          expect(await getCounterValue()).toBe(2);
        }
      }

      // Clean up - close extra windows
      await refreshWindowHandles();
      for (const handle of handles) {
        await browser.switchToWindow(handle);
        await browser.pause(300);
        const title = await browser.getTitle();
        if (title !== 'Main Window') {
          const closeWindowButton = await getButtonInCurrentWindow('close');
          await closeWindowButton.click();
          await browser.pause(300);
        }
      }

      // Wait for only main window to remain
      await waitUntilWindowsAvailable(1);
    });

    it('should maintain sync between child windows and main window after parent window is closed', async () => {
      // Make sure we're starting with only the main window
      await switchToWindowByTitle('Main Window');
      await browser.pause(500); // Ensure window is fully loaded

      // Reset counter using our helper
      const finalCount = await resetCounter();
      expect(finalCount).toBe(0);

      // Create first child window (Window 2)
      const createWindowButton = await getButtonInCurrentWindow('create');
      await createWindowButton.click();
      await waitUntilWindowsAvailable(2);
      await browser.pause(500); // Ensure new window is fully loaded

      // From Window 2, create a grandchild window (Window 3)
      await switchToWindowByTitle('Runtime Window');
      await browser.pause(500); // Ensure window is fully loaded

      const createWindowButton2 = await getButtonInCurrentWindow('create');
      await createWindowButton2.click();
      await waitUntilWindowsAvailable(3);
      await browser.pause(500); // Ensure new window is fully loaded

      // Refresh window handles to ensure we have the latest mapping
      await refreshWindowHandles();

      // We now have 3 windows: Main Window, Window 2 (child), Window 3 (grandchild)
      // Store window handles for reference
      const mainWindowHandle = windowHandles.get('Main Window');
      const childWindowHandles = [...windowHandles.entries()]
        .filter(([title]) => title !== 'Main Window')
        .map(([_, handle]) => handle);

      // Make sure we have the right number of windows
      expect(childWindowHandles.length).toBe(2);

      // Set counter to 3 from Main Window
      await browser.switchToWindow(mainWindowHandle);
      await browser.pause(500); // Ensure window is fully loaded

      const incrementMainButton = await getButtonInCurrentWindow('increment');
      await incrementMainButton.click();
      await browser.pause(100);
      await incrementMainButton.click();
      await browser.pause(100);
      await incrementMainButton.click();
      await browser.pause(100);

      expect(await getCounterValue()).toBe(3);

      // Verify counter is 3 in all windows
      for (const handle of childWindowHandles) {
        await browser.switchToWindow(handle);
        await browser.pause(500); // Ensure window is fully loaded
        expect(await getCounterValue()).toBe(3);
      }

      // Now close the middle/parent window (Window 2)
      // Find the first Runtime Window (which should be Window 2)
      await switchToWindowByTitle('Runtime Window');
      await browser.pause(500); // Ensure window is fully loaded

      const closeButton = await getButtonInCurrentWindow('close');
      await closeButton.click();

      // Refresh window handles
      await waitUntilWindowsAvailable(2);
      await browser.pause(500); // Ensure windows are stable

      // Increment counter in Main Window
      await switchToWindowByTitle('Main Window');
      await browser.pause(500); // Ensure window is fully loaded

      const incrementButton = await getButtonInCurrentWindow('increment');
      await incrementButton.click();
      await browser.pause(100);
      expect(await getCounterValue()).toBe(4);

      // Check that grandchild window (Window 3) still syncs with Main Window
      // even though its parent (Window 2) was closed
      await switchToWindowByTitle('Runtime Window');
      await browser.pause(500); // Ensure window is fully loaded
      expect(await getCounterValue()).toBe(4);

      // Modify counter from grandchild window
      const incrementButton2 = await getButtonInCurrentWindow('increment');
      await incrementButton2.click();
      await browser.pause(100);
      expect(await getCounterValue()).toBe(5);

      // Verify change synced back to Main Window
      await switchToWindowByTitle('Main Window');
      await browser.pause(500); // Ensure window is fully loaded
      expect(await getCounterValue()).toBe(5);

      // Clean up by closing all remaining windows except Main Window
      await refreshWindowHandles();
      const handles = await browser.getWindowHandles();
      for (const handle of handles) {
        await browser.switchToWindow(handle);
        await browser.pause(300);
        const title = await browser.getTitle();
        if (title !== 'Main Window') {
          const closeWindowButton = await getButtonInCurrentWindow('close');
          await closeWindowButton.click();
          await browser.pause(300);
        }
      }

      // Wait for only main window to remain
      await waitUntilWindowsAvailable(1);
    });
  });
});
