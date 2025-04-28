import React from 'react';

// Common component props
export interface BaseProps {
  className?: string;
  id?: string;
}

// Button variants
export type ButtonVariant = 'primary' | 'secondary' | 'reset' | 'create' | 'close';

// Button props
export interface ButtonProps extends BaseProps {
  onClick?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  children: React.ReactNode;
}

// Counter props
export interface CounterProps extends BaseProps {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onDouble: (method: 'thunk' | 'object') => void;
  onReset: () => void;
  isLoading?: boolean;
}

// Header props
export interface HeaderProps extends BaseProps {
  windowId: number | string;
  windowTitle: string;
  bridgeStatus?: 'ready' | 'error' | 'initializing';
}

// Theme props
export interface ThemeToggleProps extends BaseProps {
  isDark: boolean;
  onToggle: () => void;
}

// Window Display props
export interface WindowDisplayProps extends BaseProps {
  windowId: number | string;
  windowTitle: string;
  bridgeStatus?: 'ready' | 'error' | 'initializing';
  isRuntimeWindow?: boolean;
  children: React.ReactNode;
}

// Window Actions props
export interface WindowActionsProps extends BaseProps {
  onCreateWindow?: () => void;
  onCloseWindow?: () => void;
  onQuitApp?: () => void;
  isMainWindow?: boolean;
}

/**
 * Type definitions for zubridge UI components
 */

// Don't re-export ButtonProps as it's already exported from components
// export type { ButtonProps } from './components/Button';

// Add global type augmentation for window.electronAPI
declare global {
  interface Window {
    electronAPI?: {
      createRuntimeWindow: () => Promise<{ success: boolean; windowId?: number }>;
      closeCurrentWindow: () => void;
      quitApp: () => void;
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      openDevTools: () => void;
    };
  }
}
