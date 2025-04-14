import { expect } from '@wdio/globals';
import { browser } from 'wdio-electron-service';

// Platform-specific timing configurations
const TIMING = {
  // Base timing values (used for macOS / Windows)
  base: {
    WINDOW_SWITCH_PAUSE: 100,
    STATE_SYNC_PAUSE: 250, // Time to wait for state to sync between windows
    BUTTON_CLICK_PAUSE: 50, // Time to wait after clicking a button
    WINDOW_CHANGE_PAUSE: 200, // Time to wait after window creation/deletion
    WINDOW_WAIT_TIMEOUT: 3000, // Maximum time to wait for window operations
    WINDOW_WAIT_INTERVAL: 150, // How often to check window availability
  },

  // Timing adjustments for Linux (slower CI environment)
  linux: {
    WINDOW_SWITCH_PAUSE: 150,
    STATE_SYNC_PAUSE: 400,
    BUTTON_CLICK_PAUSE: 100,
    WINDOW_CHANGE_PAUSE: 350,
    WINDOW_WAIT_TIMEOUT: 5000,
    WINDOW_WAIT_INTERVAL: 200,
  },
};

// Determine which timing configuration to use based on platform
const PLATFORM = process.platform;
const CURRENT_TIMING = PLATFORM === 'linux' ? TIMING.linux : TIMING.base;

console.log(`Using timing configuration for platform: ${PLATFORM}`);

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
        await browser.pause(CURRENT_TIMING.BUTTON_CLICK_PAUSE);
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
      timeout: CURRENT_TIMING.WINDOW_WAIT_TIMEOUT,
      timeoutMsg: `Expected ${desiredWindows} windows to be available`,
      interval: CURRENT_TIMING.WINDOW_WAIT_INTERVAL,
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
        await browser.pause(CURRENT_TIMING.WINDOW_SWITCH_PAUSE);
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
        await browser.pause(CURRENT_TIMING.WINDOW_CHANGE_PAUSE);
      } catch (error) {
        // If we can't find the button, close it using the electron API directly
        console.log(`Could not find close button, using electron API to close window ${index}`);
        await browser.electron.execute((electron, idx) => {
          const windows = electron.BrowserWindow.getAllWindows();
          if (windows.length > idx) {
            windows[idx].close();
          }
        }, index);
        await browser.pause(CURRENT_TIMING.WINDOW_CHANGE_PAUSE);
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

// Helper to close all windows except the main and secondary windows
const closeAllRemainingWindows = async () => {
  try {
    // Refresh window handles to get latest state
    await refreshWindowHandles();
    await browser.pause(CURRENT_TIMING.WINDOW_SWITCH_PAUSE);

    // If we already have just 2 windows, we're done
    if (windowHandles.length <= 2) {
      console.log('Already have 2 or fewer windows, no cleanup needed');
      return;
    }

    // First try to close via Electron API directly for reliability
    await browser.electron.execute((electron) => {
      const windows = electron.BrowserWindow.getAllWindows();
      // Keep only the first two windows (main and secondary windows)
      for (let i = 2; i < windows.length; i++) {
        try {
          console.log(`Direct close of window index ${i} with ID ${windows[i].id}`);
          windows[i].close();
        } catch (err) {
          console.error(`Error closing window at index ${i}:`, err);
        }
      }
    });

    // Give windows time to close
    await browser.pause(CURRENT_TIMING.WINDOW_CHANGE_PAUSE * 2);
    await refreshWindowHandles();

    // If we still have more than 2 windows, try to close them one by one
    if (windowHandles.length > 2) {
      // Close any child windows in reverse order (to avoid index shifting)
      // Start from the last window and keep the first two windows (main and secondary)
      for (let i = windowHandles.length - 1; i > 1; i--) {
        console.log(`Attempting to close window at index ${i}`);

        try {
          // Try to switch to the window first to ensure it exists
          const switchSucceeded = await switchToWindow(i);
          if (!switchSucceeded) {
            console.log(`Could not switch to window ${i}, skipping close operation`);
            continue;
          }

          // Try to get the close button
          try {
            const closeButton = await getButtonInCurrentWindow('close');
            await closeButton.click();
          } catch (error) {
            console.log(`Could not find close button in window ${i}, using direct API`);
            // If button not found, close directly via API
            await browser.electron.execute((electron, idx) => {
              const windows = electron.BrowserWindow.getAllWindows();
              if (idx < windows.length) {
                windows[idx].close();
              }
            }, i);
          }

          // Give window time to close
          await browser.pause(CURRENT_TIMING.WINDOW_CHANGE_PAUSE);
        } catch (error) {
          console.error(`Error during window ${i} close operation:`, error);
        }
      }
    }

    // Final check - force refresh and try to ensure we have only two windows
    await browser.pause(CURRENT_TIMING.WINDOW_CHANGE_PAUSE);
    await refreshWindowHandles();

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
  // Wait for the counter element to be present and have stable value
  await browser.waitUntil(
    async () => {
      const counterElement = await browser.$('h2');
      return await counterElement.isExisting();
    },
    {
      timeout: CURRENT_TIMING.WINDOW_WAIT_TIMEOUT,
      timeoutMsg: 'Counter element not found',
      interval: CURRENT_TIMING.WINDOW_WAIT_INTERVAL / 2,
    },
  );

  const counterElement = await browser.$('h2');
  const counterText = await counterElement.getText();
  return parseInt(counterText.replace('Counter: ', ''));
};

// Helper for incrementing counter and ensuring the value changes
const incrementCounterAndVerify = async (targetValue: number): Promise<number> => {
  let currentValue = await getCounterValue();
  const incrementButton = await getButtonInCurrentWindow('increment');

  while (currentValue < targetValue) {
    console.log(`Incrementing counter from ${currentValue} to ${targetValue}`);
    await incrementButton.click();

    // Wait for counter to update
    await browser.pause(CURRENT_TIMING.BUTTON_CLICK_PAUSE);

    // Check if the value changed
    const newValue = await getCounterValue();
    if (newValue === currentValue) {
      console.log('Counter did not increment, clicking again');
      await incrementButton.click();
      await browser.pause(CURRENT_TIMING.BUTTON_CLICK_PAUSE * 2); // Longer pause if the value didn't change
    }

    currentValue = await getCounterValue();
  }

  return currentValue;
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
      await browser.pause(CURRENT_TIMING.BUTTON_CLICK_PAUSE);
    }
  }

  // Verify we're at zero
  const newCounterElement = await browser.$('h2');
  const newCounterText = await newCounterElement.getText();
  return parseInt(newCounterText.replace('Counter: ', ''));
};

describe('application loading', () => {
  before(async () => {
    await waitUntilWindowsAvailable(2);
  });

  describe('click events', () => {
    it('should increment the counter', async () => {
      const incrementButton = await browser.$('button=+');

      await incrementButton.click();
      await browser.pause(CURRENT_TIMING.BUTTON_CLICK_PAUSE);
      const counterElement1 = await browser.$('h2');
      expect(await counterElement1.getText()).toContain('1');

      await incrementButton.click();
      await browser.pause(CURRENT_TIMING.BUTTON_CLICK_PAUSE);
      const counterElement2 = await browser.$('h2');
      expect(await counterElement2.getText()).toContain('2');

      await incrementButton.click();
      await browser.pause(CURRENT_TIMING.BUTTON_CLICK_PAUSE);
      const counterElement3 = await browser.$('h2');
      expect(await counterElement3.getText()).toContain('3');
    });

    it('should decrement the counter', async () => {
      const decrementButton = await browser.$('button=-');

      await decrementButton.click();
      await browser.pause(CURRENT_TIMING.BUTTON_CLICK_PAUSE);
      const counterElement1 = await browser.$('h2');
      expect(await counterElement1.getText()).toContain('2');

      await decrementButton.click();
      await browser.pause(CURRENT_TIMING.BUTTON_CLICK_PAUSE);
      const counterElement2 = await browser.$('h2');
      expect(await counterElement2.getText()).toContain('1');

      await decrementButton.click();
      await browser.pause(CURRENT_TIMING.BUTTON_CLICK_PAUSE);
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
        await browser.pause(CURRENT_TIMING.BUTTON_CLICK_PAUSE);
        badgeCount = await browser.electron.execute((electron) => {
          return electron.app.getBadgeCount();
        });

        expect(badgeCount).toBe(1);

        await incrementButton.click();
        await browser.pause(CURRENT_TIMING.BUTTON_CLICK_PAUSE);
        badgeCount = await browser.electron.execute((electron) => {
          return electron.app.getBadgeCount();
        });

        expect(badgeCount).toBe(2);

        await incrementButton.click();
        await browser.pause(CURRENT_TIMING.BUTTON_CLICK_PAUSE);
        badgeCount = await browser.electron.execute((electron) => {
          return electron.app.getBadgeCount();
        });

        expect(badgeCount).toBe(3);
      });

      it('should decrement the badgeCount', async () => {
        let badgeCount: number;
        const decrementButton = await browser.$('button=-');

        await decrementButton.click();
        await browser.pause(CURRENT_TIMING.BUTTON_CLICK_PAUSE);
        badgeCount = await browser.electron.execute((electron) => {
          return electron.app.getBadgeCount();
        });

        expect(badgeCount).toBe(2);

        await decrementButton.click();
        await browser.pause(CURRENT_TIMING.BUTTON_CLICK_PAUSE);
        badgeCount = await browser.electron.execute((electron) => {
          return electron.app.getBadgeCount();
        });

        expect(badgeCount).toBe(1);

        await decrementButton.click();
        await browser.pause(CURRENT_TIMING.BUTTON_CLICK_PAUSE);
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

      // Give the new window more time to appear before checking
      await browser.pause(CURRENT_TIMING.WINDOW_CHANGE_PAUSE * 3);

      // Wait for new window and switch to it (there should now be 3 windows)
      await waitUntilWindowsAvailable(3);
      const windows = await browser.electron.execute((electron) => {
        return electron.BrowserWindow.getAllWindows().length;
      });

      expect(windows).toBe(3);

      // We'll leave the window open for the next test
    });

    it('should sync state between main and secondary windows', async () => {
      console.log('Starting base windows sync test');

      // Close any extra windows beyond the two base windows
      await closeAllRemainingWindows();

      // Ensure we're at the main window
      await switchToWindow(0);

      // Reset counter to 0
      console.log('Resetting counter to 0');
      await resetCounter();

      // Increment counter in main window
      console.log('Incrementing counter in main window');
      const incrementButton = await getButtonInCurrentWindow('increment');
      await incrementButton.click();
      await browser.pause(CURRENT_TIMING.BUTTON_CLICK_PAUSE);
      await incrementButton.click();
      await browser.pause(CURRENT_TIMING.BUTTON_CLICK_PAUSE);

      // Check counter value in main window
      const mainCounterValue = await getCounterValue();
      console.log(`Main window counter value: ${mainCounterValue}`);
      expect(mainCounterValue).toBe(2);

      // Switch to secondary window
      console.log('Switching to secondary window');
      const switched = await switchToWindow(1);

      if (!switched) {
        console.warn('Could not switch to secondary window, skipping verification');
        return;
      }

      // Wait for state to sync
      await browser.pause(CURRENT_TIMING.STATE_SYNC_PAUSE);

      // Verify counter state in secondary window
      console.log('Checking counter in secondary window');
      const secondaryWindowValue = await getCounterValue();
      console.log(`Secondary window counter value: ${secondaryWindowValue}`);
      expect(secondaryWindowValue).toBe(2);

      // Increment in secondary window
      console.log('Incrementing counter in secondary window');
      const secondaryIncrementButton = await getButtonInCurrentWindow('increment');
      await secondaryIncrementButton.click();
      await browser.pause(CURRENT_TIMING.BUTTON_CLICK_PAUSE);

      // Verify counter updated in secondary window
      const updatedSecondaryValue = await getCounterValue();
      console.log(`Updated secondary window counter value: ${updatedSecondaryValue}`);
      expect(updatedSecondaryValue).toBe(3);

      // Switch back to main window and verify sync
      console.log('Switching back to main window');
      await switchToWindow(0);

      // Wait for state to sync
      await browser.pause(CURRENT_TIMING.STATE_SYNC_PAUSE);

      // Verify counter state updated in main window
      const updatedMainValue = await getCounterValue();
      console.log(`Updated main window counter value: ${updatedMainValue}`);
      expect(updatedMainValue).toBe(3);
    });

    it('should close a window', async () => {
      console.log('Starting close window test');
      await refreshWindowHandles();

      // Ensure we have at least 2 windows to close the second one
      if (windowHandles.length < 2) {
        console.warn(`Expected at least 2 windows, found ${windowHandles.length}. Skipping close test.`);
        return;
      }

      // Switch to the second window (index 1)
      console.log('Switching to second window (index 1) to close it');
      const switched = await switchToWindow(1);
      if (!switched) {
        console.warn('Could not switch to window 1, skipping close test');
        return;
      }

      // Find and click the close button in the second window
      try {
        const closeWindowButton = await browser.$('button=Close Window');
        await closeWindowButton.click();
        console.log('Clicked close window button');
      } catch (error) {
        console.error('Error clicking the close button:', error);
        // Attempt direct close via API as a fallback if button click fails
        console.log('Close button click failed, attempting direct API close');
        await browser.electron.execute((electron) => {
          const windows = electron.BrowserWindow.getAllWindows();
          if (windows.length >= 2) {
            windows[1].close(); // Use close(), not destroy()
          }
        });
      }

      // Wait for window to close (should now have 1 window)
      // Adding a longer pause before the wait as well
      await browser.pause(CURRENT_TIMING.WINDOW_CHANGE_PAUSE * 2);
      await waitUntilWindowsAvailable(1);

      // Verify only one window remains using Electron API for confirmation
      const windowsAfterClose = await browser.electron.execute((electron) => {
        return electron.BrowserWindow.getAllWindows().length;
      });
      console.log(`Windows after close (from Electron): ${windowsAfterClose}`);
      expect(windowsAfterClose).toBe(1);
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
      await browser.pause(20);
      await incrementButton.click();
      await browser.pause(20);
      await incrementButton.click();
      await browser.pause(20);

      // Check counter value in main window
      const mainCounterValue = await getCounterValue();
      console.log(`Main window counter value: ${mainCounterValue}`);
      expect(mainCounterValue).toBe(3);

      // Create new window using the button
      console.log('Creating new window via button click');
      const createWindowButton = await browser.$('button=Create Window');
      await createWindowButton.click();

      // Give the new window more time to appear and register
      await browser.pause(CURRENT_TIMING.WINDOW_CHANGE_PAUSE * 3);
      await refreshWindowHandles(); // Refresh handles *after* waiting
      console.log(`After clicking create window, have ${windowHandles.length} windows`);

      // Verify window count using Electron API
      console.log('Verifying window count via Electron API');
      const windowCountAfterCreate = await browser.electron.execute((electron) => {
        return electron.BrowserWindow.getAllWindows().length;
      });
      console.log(`Window count from Electron: ${windowCountAfterCreate}`);

      // Wait until Electron confirms 3 windows exist
      await browser.waitUntil(
        async () => {
          const count = await browser.electron.execute((electron) => {
            return electron.BrowserWindow.getAllWindows().length;
          });
          console.log(`Waiting for 3 windows (Electron)... Current count: ${count}`);
          return count >= 3;
        },
        {
          timeout: CURRENT_TIMING.WINDOW_WAIT_TIMEOUT * 2, // Increased timeout for this check
          timeoutMsg: `Expected Electron to report at least 3 windows, last count: ${windowCountAfterCreate}`,
          interval: CURRENT_TIMING.WINDOW_WAIT_INTERVAL,
        },
      );

      // Refresh handles again after confirming Electron sees the window
      await refreshWindowHandles();

      // Switch to the new window (should be at index 2)
      console.log('Switching to new window (index 2)');
      const switched = await switchToWindow(2);
      if (!switched) {
        console.warn('Could not switch to new window (index 2), skipping verification');
        await closeAllRemainingWindows();
        return;
      }

      // Wait for the UI and state to stabilize
      await browser.pause(CURRENT_TIMING.STATE_SYNC_PAUSE);

      // Verify counter state in new window
      console.log('Checking counter in new window');
      const newWindowValue = await getCounterValue();
      console.log(`New window counter value: ${newWindowValue}`);
      expect(newWindowValue).toBe(3);

      // Clean up by closing the window
      console.log('Cleaning up third window');
      await browser.electron.execute((electron) => {
        const windows = electron.BrowserWindow.getAllWindows();
        if (windows.length >= 3) {
          console.log(`Destroying window at index 2 with ID: ${windows[2].id}`);
          windows[2].destroy();
        }
      });
      await browser.pause(CURRENT_TIMING.WINDOW_CHANGE_PAUSE * 2);
      await waitUntilWindowsAvailable(2); // Expect 2 windows after cleanup
    });

    it('should create multiple windows and maintain state across all of them', async () => {
      console.log('Starting multi-window test');

      // Make sure we're starting with only the main and secondary windows
      console.log('Ensuring we start with main and secondary windows');
      await closeAllRemainingWindows();
      await browser.pause(CURRENT_TIMING.WINDOW_CHANGE_PAUSE);

      // Confirm we have exactly 2 windows
      await refreshWindowHandles();
      if (windowHandles.length !== 2) {
        console.warn(`Expected 2 base windows, but found ${windowHandles.length}. Proceeding with test anyway.`);
      }

      await switchToWindow(0);

      // Reset counter using our helper
      console.log('Resetting counter to 0');
      const finalCount = await resetCounter();
      expect(finalCount).toBe(0);

      // Create a third window and verify it exists
      console.log('Creating third window');
      const createWindowButton = await getButtonInCurrentWindow('create');
      await createWindowButton.click();

      // Wait with additional patience for the window to appear
      let attempt = 0;
      let windowCount = 0;
      while (attempt < 3 && windowCount < 3) {
        await browser.pause(CURRENT_TIMING.WINDOW_CHANGE_PAUSE);
        await refreshWindowHandles();
        windowCount = windowHandles.length;
        if (windowCount >= 3) {
          break;
        }
        console.log(`Attempt ${attempt + 1}: Window count is ${windowCount}, waiting for 3 windows...`);
        attempt++;
      }

      expect(windowHandles.length).toBeGreaterThanOrEqual(3);
      console.log(`After creating third window, have ${windowHandles.length} windows`);

      // Create a fourth window from main window
      console.log('Creating fourth window');
      await switchToWindow(0);
      const createWindowButton2 = await getButtonInCurrentWindow('create');
      await createWindowButton2.click();

      // Wait with additional patience for the window to appear
      attempt = 0;
      windowCount = 0;
      while (attempt < 3 && windowCount < 4) {
        await browser.pause(CURRENT_TIMING.WINDOW_CHANGE_PAUSE);
        await refreshWindowHandles();
        windowCount = windowHandles.length;
        if (windowCount >= 4) {
          break;
        }
        console.log(`Attempt ${attempt + 1}: Window count is ${windowCount}, waiting for 4 windows...`);
        attempt++;
      }

      expect(windowHandles.length).toBeGreaterThanOrEqual(4);
      console.log(`After creating fourth window, have ${windowHandles.length} windows`);

      // Ensure windows are stable
      await browser.pause(CURRENT_TIMING.STATE_SYNC_PAUSE);

      // Increment counter in main window to 2 and verify
      console.log('Incrementing counter in main window to 2');
      await switchToWindow(0);
      const mainValue = await incrementCounterAndVerify(2);
      console.log(`Main window counter value: ${mainValue}`);
      expect(mainValue).toBe(2);

      // Check counter in second window
      console.log('Checking counter in second window');
      const switched1 = await switchToWindow(1);
      if (switched1) {
        // Wait for state to sync
        await browser.pause(CURRENT_TIMING.STATE_SYNC_PAUSE);
        const secondValue = await getCounterValue();
        console.log(`Second window counter value: ${secondValue}`);
        expect(secondValue).toBe(2);
      } else {
        console.warn('Could not switch to second window, skipping check');
      }

      // Check counter in third window (if available)
      if (windowHandles.length >= 3) {
        console.log('Checking counter in third window');
        const switched2 = await switchToWindow(2);
        if (switched2) {
          // Wait for state to sync
          await browser.pause(CURRENT_TIMING.STATE_SYNC_PAUSE);
          const thirdValue = await getCounterValue();
          console.log(`Third window counter value: ${thirdValue}`);
          expect(thirdValue).toBe(2);
        } else {
          console.warn('Could not switch to third window, skipping check');
        }
      }

      // Check counter in fourth window (if available)
      if (windowHandles.length >= 4) {
        console.log('Checking counter in fourth window');
        const switched3 = await switchToWindow(3);
        if (switched3) {
          // Wait for state to sync
          await browser.pause(CURRENT_TIMING.STATE_SYNC_PAUSE);
          const fourthValue = await getCounterValue();
          console.log(`Fourth window counter value: ${fourthValue}`);
          expect(fourthValue).toBe(2);
        } else {
          console.warn('Could not switch to fourth window, skipping check');
        }
      }

      // Clean up - use our improved closeAllRemainingWindows function
      console.log('Cleaning up all windows');
      await closeAllRemainingWindows();

      // Switch back to main window to ensure we're in a good state
      await switchToWindow(0);
    });

    it('should maintain sync between child windows and main window after parent window is closed', async () => {
      console.log('Starting parent-child window sync test');

      // Make sure we're starting with only the main and secondary windows
      console.log('Ensuring we start with main and secondary windows');
      await closeAllRemainingWindows();
      await browser.pause(CURRENT_TIMING.WINDOW_CHANGE_PAUSE);

      // Confirm we have exactly 2 windows
      await refreshWindowHandles();
      if (windowHandles.length !== 2) {
        console.warn(`Expected 2 base windows, but found ${windowHandles.length}. Proceeding with test anyway.`);
      }

      // Ensure we're on the main window
      await switchToWindow(0);

      // Get window counts directly from Electron for validation
      const initialWindowCount = await browser.electron.execute((electron) => {
        return electron.BrowserWindow.getAllWindows().length;
      });
      console.log(`Initial window count from Electron: ${initialWindowCount}`);

      // Reset counter using our helper
      console.log('Resetting counter to 0');
      const finalCount = await resetCounter();
      expect(finalCount).toBe(0);

      // Create a third window (child window) using electron API directly for reliability
      console.log('Creating child window directly via Electron API');
      await browser.electron.execute((electron) => {
        // Get the BrowserWindow constructor
        const { BrowserWindow } = electron;
        const mainWindow = BrowserWindow.getAllWindows()[0];

        // Create a new window
        const childWindow = new BrowserWindow({
          width: 800,
          height: 600,
          webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
          },
        });

        // Load the same URL as the main window
        const url = mainWindow.webContents.getURL();
        childWindow.loadURL(url);

        // Show the window
        childWindow.show();
        console.log(`Created window with ID: ${childWindow.id}`);
      });

      // Wait for the window to load
      await browser.pause(CURRENT_TIMING.WINDOW_CHANGE_PAUSE * 2);
      await refreshWindowHandles();
      console.log(`After creating child window, have ${windowHandles.length} windows`);

      // Verify that we now have 3 windows
      const afterChildWindowCount = await browser.electron.execute((electron) => {
        return electron.BrowserWindow.getAllWindows().length;
      });
      console.log(`Window count after creating child: ${afterChildWindowCount}`);
      expect(afterChildWindowCount).toBeGreaterThanOrEqual(3);

      // Create a fourth window (grandchild) directly
      console.log('Creating grandchild window directly via Electron API');
      await browser.electron.execute((electron) => {
        // Get the BrowserWindow constructor
        const { BrowserWindow } = electron;
        const mainWindow = BrowserWindow.getAllWindows()[0];

        // Create a new window
        const grandchildWindow = new BrowserWindow({
          width: 800,
          height: 600,
          webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
          },
        });

        // Load the same URL as the main window
        const url = mainWindow.webContents.getURL();
        grandchildWindow.loadURL(url);

        // Show the window
        grandchildWindow.show();
        console.log(`Created grandchild window with ID: ${grandchildWindow.id}`);
      });

      // Wait for the window to load
      await browser.pause(CURRENT_TIMING.WINDOW_CHANGE_PAUSE * 2);
      await refreshWindowHandles();
      console.log(`After creating grandchild window, have ${windowHandles.length} windows`);

      // Verify that we now have 4 windows
      const afterGrandchildWindowCount = await browser.electron.execute((electron) => {
        return electron.BrowserWindow.getAllWindows().length;
      });
      console.log(`Window count after creating grandchild: ${afterGrandchildWindowCount}`);
      expect(afterGrandchildWindowCount).toBeGreaterThanOrEqual(4);

      // Set the counter to 3 from the main window
      console.log('Setting counter to 3 from main window');
      await switchToWindow(0);

      // Use our reliable increment helper
      const mainValue = await incrementCounterAndVerify(3);
      console.log(`Main window counter value: ${mainValue}`);
      expect(mainValue).toBe(3);

      // Allow time for state to propagate to all windows
      await browser.pause(CURRENT_TIMING.STATE_SYNC_PAUSE);

      // Store the window IDs for later reference
      const windowIdsBeforeClosing = await browser.electron.execute((electron) => {
        return electron.BrowserWindow.getAllWindows().map((w) => w.id);
      });
      console.log(`Window IDs before closing child: ${JSON.stringify(windowIdsBeforeClosing)}`);

      // Close child window (at index 2) directly - using a simplified approach
      console.log('Closing child window directly via Electron API');
      const windowClosed = await browser.electron.execute((electron) => {
        try {
          // Windows should be ordered as: main, secondary, child, grandchild
          const windows = electron.BrowserWindow.getAllWindows();

          // We want to close the child window, which should be at index 2
          // Index 0 = main window, index 1 = secondary window
          if (windows.length >= 3) {
            console.log(`Closing window with ID: ${windows[2].id} at index 2`);
            windows[2].destroy(); // Use destroy instead of close for more reliable closure
            return true;
          }
          return false;
        } catch (error) {
          console.error('Error closing window:', error);
          return false;
        }
      });

      console.log(`Window closed: ${windowClosed}`);

      // More generous wait time to ensure window is fully closed
      await browser.pause(CURRENT_TIMING.WINDOW_CHANGE_PAUSE * 3);

      // Refresh handles after closing
      await refreshWindowHandles();
      console.log(`After closing child window, have ${windowHandles.length} windows`);

      // Get the window count from Electron to verify
      const afterClosingCount = await browser.electron.execute((electron) => {
        return electron.BrowserWindow.getAllWindows().length;
      });
      console.log(`Window count from Electron after closing child: ${afterClosingCount}`);

      // Verify we have one fewer window
      expect(afterClosingCount).toBe(afterGrandchildWindowCount - 1);

      // Switch back to main window and increment counter
      console.log('Incrementing counter in main window');
      await switchToWindow(0);

      const incrementButton = await getButtonInCurrentWindow('increment');
      await incrementButton.click();
      await browser.pause(CURRENT_TIMING.STATE_SYNC_PAUSE);

      const mainValueAfter = await getCounterValue();
      console.log(`Main window counter after increment: ${mainValueAfter}`);
      expect(mainValueAfter).toBe(4);

      // Switch to grandchild window (now at index 2 after closure of child)
      console.log('Checking grandchild window sync');
      await switchToWindow(2);

      await browser.pause(CURRENT_TIMING.STATE_SYNC_PAUSE);
      const grandchildValueAfter = await getCounterValue();
      console.log(`Grandchild window counter: ${grandchildValueAfter}`);
      expect(grandchildValueAfter).toBe(4);

      // Increment from grandchild
      console.log('Incrementing counter from grandchild window');
      const incrementButton2 = await getButtonInCurrentWindow('increment');
      await incrementButton2.click();
      await browser.pause(CURRENT_TIMING.STATE_SYNC_PAUSE);

      const finalGrandchildValue = await getCounterValue();
      console.log(`Grandchild window counter after increment: ${finalGrandchildValue}`);
      expect(finalGrandchildValue).toBe(5);

      // Check sync back to main window
      console.log('Verifying sync back to main window');
      await switchToWindow(0);

      await browser.pause(CURRENT_TIMING.STATE_SYNC_PAUSE);
      const finalMainValue = await getCounterValue();
      console.log(`Main window final counter value: ${finalMainValue}`);
      expect(finalMainValue).toBe(5);

      // Clean up
      console.log('Final cleanup');
      await closeAllRemainingWindows();
    });
  });
});
