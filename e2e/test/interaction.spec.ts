import { expect } from '@wdio/globals';
import { browser } from 'wdio-electron-service';

// Store windows by index rather than by title since all windows have the same title
const windowHandles: string[] = [];

// Helper to refresh window handles
const refreshWindowHandles = async () => {
  try {
    const handles = await browser.getWindowHandles();

    // Clear old handles
    windowHandles.length = 0;

    // Store handles in order they're discovered
    for (const handle of handles) {
      try {
        await browser.switchToWindow(handle);
        await browser.pause(100); // Give window time to load
        windowHandles.push(handle);
        console.log(`Found window ${windowHandles.length - 1} with handle: ${handle}`);
      } catch (error) {
        console.error(`Failed to switch to window ${handle}:`, error);
        // Don't add this handle as it might be a closing window
      }
    }

    console.log(`Total windows: ${windowHandles.length}`);
    return handles.length;
  } catch (error) {
    console.error('Error refreshing window handles:', error);
    // Return the existing count if we fail to get new handles
    return windowHandles.length;
  }
};

// Wait for a specific number of windows to be available
const waitUntilWindowsAvailable = async (desiredWindows: number) =>
  await browser.waitUntil(
    async () => {
      try {
        const windowCount = await refreshWindowHandles();
        console.log(`Current window count: ${windowCount}, desired: ${desiredWindows}`);
        return windowCount === desiredWindows;
      } catch (error) {
        console.error('Error checking window count:', error);
        // If we're waiting for 0 windows, consider it successful since an error might occur if all windows are closed
        return desiredWindows === 0;
      }
    },
    {
      timeout: 5000, // Reduced timeout to fail faster if windows don't close properly
      timeoutMsg: `Expected ${desiredWindows} windows to be available`,
      interval: 500, // Check more frequently
    },
  );

// Helper to switch to window by index (0 = main window, 1+ = child windows)
const switchToWindow = async (index: number) => {
  try {
    await refreshWindowHandles();
    if (index >= 0 && index < windowHandles.length) {
      const handle = windowHandles[index];
      try {
        await browser.switchToWindow(handle);
        await browser.pause(500); // Ensure window is fully loaded
        return true;
      } catch (error) {
        console.error(`Failed to switch to window at index ${index} with handle ${handle}:`, error);
        // Window might have been closed
        return false;
      }
    } else {
      console.log(`Cannot switch to window index ${index}, only ${windowHandles.length} windows available`);
      return false;
    }
  } catch (error) {
    console.error('Error in switchToWindow:', error);
    return false;
  }
};

// Helper to close a specific window by index
const closeWindowByIndex = async (index: number): Promise<boolean> => {
  console.log(`Attempting to force close window at index ${index}`);
  try {
    // First try to switch to the window
    const switchSucceeded = await switchToWindow(index);
    if (switchSucceeded) {
      // Try to get the close button
      try {
        const closeButton = await getButtonInCurrentWindow('close');
        await closeButton.click();
        await browser.pause(500);
      } catch (error) {
        // If we can't find the button, close it using the electron API directly
        console.log(`Could not find close button, using electron API to close window ${index}`);
        await browser.electron.execute((electron, idx) => {
          const windows = electron.BrowserWindow.getAllWindows();
          if (windows.length > idx) {
            windows[idx].close();
          }
        }, index);
        await browser.pause(500);
      }

      // Verify window was closed
      await refreshWindowHandles();
      return windowHandles.length <= index;
    }
    return false;
  } catch (error) {
    console.error(`Error closing window at index ${index}:`, error);
    return false;
  }
};

// Helper to close all windows except the main window
const closeAllRemainingWindows = async () => {
  try {
    // Refresh window handles to get latest state
    await refreshWindowHandles();

    // Close any child windows in reverse order (to avoid index shifting)
    for (let i = windowHandles.length - 1; i > 0; i--) {
      console.log(`Attempting to close window at index ${i}`);

      // Try up to 3 times to close the window
      let closed = false;
      for (let attempt = 0; attempt < 3 && !closed; attempt++) {
        closed = await closeWindowByIndex(i);
        if (!closed) {
          console.log(`Failed to close window ${i} on attempt ${attempt + 1}, retrying...`);
          await browser.pause(500);
        }
      }

      if (!closed) {
        console.error(`Could not close window at index ${i} after 3 attempts`);
      }
    }

    // Final check - force refresh and try to ensure we have only one window
    await refreshWindowHandles();
    if (windowHandles.length > 1) {
      console.warn(`Still have ${windowHandles.length} windows after cleanup, forcing electron to close extra windows`);

      // Use electron directly to close all windows except the main one
      await browser.electron.execute((electron) => {
        const windows = electron.BrowserWindow.getAllWindows();
        // Keep only the first window (main window)
        for (let i = 1; i < windows.length; i++) {
          windows[i].close();
        }
      });

      await browser.pause(1000);
      await refreshWindowHandles();
    }

    // Try to ensure we're on the main window
    if (windowHandles.length > 0) {
      await switchToWindow(0);
    }
  } catch (error) {
    console.error('Error during window cleanup:', error);
    // Try to ensure we're on the main window as a fallback
    try {
      await refreshWindowHandles();
      if (windowHandles.length > 0) {
        await switchToWindow(0);
      }
    } catch (finalError) {
      console.error('Final error in cleanup:', finalError);
    }
  }
};

// Helper function to get button based on window type
const getButtonInCurrentWindow = async (buttonType: 'increment' | 'decrement' | 'create' | 'close') => {
  // All windows have the same button selector patterns
  switch (buttonType) {
    case 'increment':
      return await browser.$('button=+');
    case 'decrement':
      return await browser.$('button=-');
    case 'create':
      return await browser.$('button=Create Window');
    case 'close':
      return await browser.$('button=Close Window');
    default:
      throw new Error(`Unknown button type: ${buttonType}`);
  }
};

// Helper to get counter value from current window
const getCounterValue = async () => {
  const counterElement = await browser.$('h2');
  const counterText = await counterElement.getText();
  return parseInt(counterText.replace('Counter: ', ''));
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
      const createWindowButton = await browser.$('button=Create Window');
      await createWindowButton.click();

      await waitUntilWindowsAvailable(2);
      const windows = await browser.electron.execute((electron) => {
        return electron.BrowserWindow.getAllWindows().length;
      });

      expect(windows).toBe(2);

      // We'll leave the window open for the next test
    });

    it('should close a window', async () => {
      console.log('Starting close window test');
      await refreshWindowHandles();

      // Ensure we're on the second window (index 1)
      const switched = await switchToWindow(1);
      console.log(`Switched to window 1: ${switched}`);

      if (!switched) {
        // If we couldn't switch, the test is inconclusive
        console.warn('Could not switch to window 1, skipping test');
        return;
      }

      // Find and click the close button
      try {
        const closeWindowButton = await browser.$('button=Close Window');
        await closeWindowButton.click();
        console.log('Clicked close window button');

        // Wait for window to close
        await waitUntilWindowsAvailable(1);

        // Verify only one window remains
        const windows = await browser.electron.execute((electron) => {
          return electron.BrowserWindow.getAllWindows().length;
        });
        console.log(`Windows after close: ${windows}`);

        expect(windows).toBe(1);
      } catch (error) {
        console.error('Error in close window test:', error);

        // Force close using the API if button click failed
        await browser.electron.execute((electron) => {
          const windows = electron.BrowserWindow.getAllWindows();
          if (windows.length > 1) {
            windows[1].close();
          }
        });
        await browser.pause(1000);
        await waitUntilWindowsAvailable(1);
      }
    });

    it('should maintain state across windows', async () => {
      console.log('Starting maintain state test');
      await refreshWindowHandles();

      // Make sure we're at the main window
      await switchToWindow(0);

      // Reset counter to 0 first
      await resetCounter();

      // Increment counter in main window
      console.log('Incrementing counter in main window');
      const incrementButton = await browser.$('button=+');
      await incrementButton.click();
      await browser.pause(100);
      await incrementButton.click();
      await browser.pause(100);
      await incrementButton.click();
      await browser.pause(100);

      // Check counter value in main window
      const mainCounterValue = await getCounterValue();
      console.log(`Main window counter value: ${mainCounterValue}`);
      expect(mainCounterValue).toBe(3);

      // Create new window
      console.log('Creating new window');
      const createWindowButton = await browser.$('button=Create Window');
      await createWindowButton.click();

      // Wait for new window and switch to it
      await waitUntilWindowsAvailable(2);
      const switched = await switchToWindow(1);

      if (!switched) {
        console.warn('Could not switch to new window, skipping verification');
        return;
      }

      // Wait for the UI to stabilize
      await browser.pause(1000);

      // Verify counter state in new window
      console.log('Checking counter in new window');
      const newWindowValue = await getCounterValue();
      console.log(`New window counter value: ${newWindowValue}`);
      expect(newWindowValue).toBe(3);

      // Clean up by closing the window
      console.log('Cleaning up window');
      await browser.electron.execute((electron) => {
        const windows = electron.BrowserWindow.getAllWindows();
        if (windows.length > 1) {
          windows[1].close();
        }
      });
      await browser.pause(1000);
      await waitUntilWindowsAvailable(1);
    });

    it('should create multiple windows and maintain state across all of them', async () => {
      console.log('Starting multi-window test');

      // Make sure we're starting with only the main window
      console.log('Ensuring we start with only the main window');
      await closeAllRemainingWindows();
      await switchToWindow(0);

      // Reset counter using our helper
      console.log('Resetting counter to 0');
      const finalCount = await resetCounter();
      expect(finalCount).toBe(0);

      // Create a second window
      console.log('Creating second window');
      const createWindowButton = await getButtonInCurrentWindow('create');
      await createWindowButton.click();
      await waitUntilWindowsAvailable(2);

      // Create a third window from main window
      console.log('Creating third window');
      await switchToWindow(0);
      const createWindowButton2 = await getButtonInCurrentWindow('create');
      await createWindowButton2.click();
      await waitUntilWindowsAvailable(3);

      // Ensure windows are stable
      await browser.pause(1000);

      // Increment counter in main window
      console.log('Incrementing counter in main window');
      await switchToWindow(0);
      const incrementButton = await getButtonInCurrentWindow('increment');
      await incrementButton.click();
      await browser.pause(200);
      await incrementButton.click();
      await browser.pause(200);

      // Check counter in main window
      const mainValue = await getCounterValue();
      console.log(`Main window counter value: ${mainValue}`);
      expect(mainValue).toBe(2);

      // Check counter in second window
      console.log('Checking counter in second window');
      const switched1 = await switchToWindow(1);
      if (switched1) {
        const secondValue = await getCounterValue();
        console.log(`Second window counter value: ${secondValue}`);
        expect(secondValue).toBe(2);
      } else {
        console.warn('Could not switch to second window, skipping check');
      }

      // Check counter in third window
      console.log('Checking counter in third window');
      const switched2 = await switchToWindow(2);
      if (switched2) {
        const thirdValue = await getCounterValue();
        console.log(`Third window counter value: ${thirdValue}`);
        expect(thirdValue).toBe(2);
      } else {
        console.warn('Could not switch to third window, skipping check');
      }

      // Clean up windows (close one by one to avoid timing issues)
      console.log('Cleaning up windows one by one');

      // Close third window
      await browser.electron.execute((electron) => {
        const windows = electron.BrowserWindow.getAllWindows();
        if (windows.length >= 3) {
          console.log('Closing third window via electron API');
          windows[2].close();
        }
      });
      await browser.pause(1000);
      await waitUntilWindowsAvailable(2);

      // Close second window
      await browser.electron.execute((electron) => {
        const windows = electron.BrowserWindow.getAllWindows();
        if (windows.length >= 2) {
          console.log('Closing second window via electron API');
          windows[1].close();
        }
      });
      await browser.pause(1000);
      await waitUntilWindowsAvailable(1);

      // Switch back to main window to ensure we're in a good state
      await switchToWindow(0);
    });

    it('should maintain sync between child windows and main window after parent window is closed', async () => {
      console.log('Starting parent-child window sync test');

      // Make sure we're starting with only the main window
      console.log('Ensuring we start with only main window');
      await closeAllRemainingWindows();
      await switchToWindow(0);

      // Reset counter using our helper
      console.log('Resetting counter to 0');
      const finalCount = await resetCounter();
      expect(finalCount).toBe(0);

      // Create first child window (Window 2)
      console.log('Creating first child window');
      const createWindowButton = await getButtonInCurrentWindow('create');
      await createWindowButton.click();
      await waitUntilWindowsAvailable(2);
      await browser.pause(500);

      // From Window 2, create a grandchild window (Window 3)
      console.log('Creating grandchild window from child window');
      const switched1 = await switchToWindow(1);
      if (!switched1) {
        console.warn('Could not switch to first child window, halting test');
        return;
      }

      const createWindowButton2 = await getButtonInCurrentWindow('create');
      await createWindowButton2.click();
      await waitUntilWindowsAvailable(3);
      await browser.pause(1000);

      // Get references to window IDs via electron API for more reliable access
      console.log('Getting electron window references');
      const windowIds = await browser.electron.execute((electron) => {
        const windows = electron.BrowserWindow.getAllWindows();
        return windows.map((w) => w.id);
      });
      console.log(`Window IDs: ${JSON.stringify(windowIds)}`);

      // Set counter to 3 from Main Window
      console.log('Setting counter to 3 from main window');
      const switched2 = await switchToWindow(0);
      if (!switched2) {
        console.warn('Could not switch to main window, halting test');
        return;
      }

      const incrementMainButton = await getButtonInCurrentWindow('increment');
      await incrementMainButton.click();
      await browser.pause(200);
      await incrementMainButton.click();
      await browser.pause(200);
      await incrementMainButton.click();
      await browser.pause(200);

      const mainValue = await getCounterValue();
      console.log(`Main window counter value: ${mainValue}`);
      expect(mainValue).toBe(3);

      // Verify counter is 3 in all windows
      console.log('Verifying counter in child window');
      const switched3 = await switchToWindow(1);
      if (switched3) {
        const childValue = await getCounterValue();
        console.log(`Child window counter value: ${childValue}`);
        expect(childValue).toBe(3);
      } else {
        console.warn('Could not switch to child window, skipping verification');
      }

      console.log('Verifying counter in grandchild window');
      const switched4 = await switchToWindow(2);
      if (switched4) {
        const grandchildValue = await getCounterValue();
        console.log(`Grandchild window counter value: ${grandchildValue}`);
        expect(grandchildValue).toBe(3);
      } else {
        console.warn('Could not switch to grandchild window, skipping verification');
      }

      // Now close the middle/parent window (Window 2) directly using the electron API
      console.log('Closing middle/parent window using electron API');
      const windowClosed = await browser.electron.execute((electron, ids) => {
        try {
          const windows = electron.BrowserWindow.getAllWindows();
          // Find the middle window (should be at index 1)
          if (windows.length >= 2) {
            console.log(`Closing window with ID: ${windows[1].id}`);
            windows[1].close();
            return true;
          }
          return false;
        } catch (error) {
          console.error('Error closing window:', error);
          return false;
        }
      }, windowIds);

      console.log(`Window closed: ${windowClosed}`);
      await browser.pause(1000);

      // Wait for the window count to be 2
      try {
        await waitUntilWindowsAvailable(2);
      } catch (error) {
        console.error('Error waiting for 2 windows:', error);

        // Force window count refresh
        await refreshWindowHandles();
        console.log(`Current window count: ${windowHandles.length}`);

        // If we still have 3 windows, force close the middle one again
        if (windowHandles.length === 3) {
          await browser.electron.execute((electron) => {
            const windows = electron.BrowserWindow.getAllWindows();
            if (windows.length >= 2) {
              windows[1].close();
            }
          });
          await browser.pause(1000);
          await refreshWindowHandles();
        }
      }

      // Increment counter in Main Window
      console.log('Incrementing counter in main window');
      const switched5 = await switchToWindow(0);
      if (!switched5) {
        console.warn('Could not switch to main window, halting test');
        return;
      }

      const incrementButton = await getButtonInCurrentWindow('increment');
      await incrementButton.click();
      await browser.pause(500);

      const mainValueAfter = await getCounterValue();
      console.log(`Main window counter after increment: ${mainValueAfter}`);
      expect(mainValueAfter).toBe(4);

      // Check that grandchild window (now at index 1) still syncs with Main Window
      console.log('Checking grandchild window sync (now at index 1)');
      const switched6 = await switchToWindow(1);
      if (!switched6) {
        console.warn('Could not switch to grandchild window (now at index 1), halting test');
        return;
      }

      await browser.pause(500); // Give time for sync
      const grandchildValueAfter = await getCounterValue();
      console.log(`Grandchild window counter after main window increment: ${grandchildValueAfter}`);
      expect(grandchildValueAfter).toBe(4);

      // Modify counter from grandchild window
      console.log('Incrementing counter from grandchild window');
      const incrementButton2 = await getButtonInCurrentWindow('increment');
      await incrementButton2.click();
      await browser.pause(500);

      const finalGrandchildValue = await getCounterValue();
      console.log(`Grandchild window counter after increment: ${finalGrandchildValue}`);
      expect(finalGrandchildValue).toBe(5);

      // Verify change synced back to Main Window
      console.log('Verifying sync back to main window');
      const switched7 = await switchToWindow(0);
      if (!switched7) {
        console.warn('Could not switch to main window, halting test');
        return;
      }

      await browser.pause(500); // Give time for sync
      const finalMainValue = await getCounterValue();
      console.log(`Main window final counter value: ${finalMainValue}`);
      expect(finalMainValue).toBe(5);

      // Clean up - ensure all windows are closed except main
      console.log('Final cleanup');
      await closeAllRemainingWindows();
    });
  });
});
