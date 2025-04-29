import React from 'react';
import clsx from 'clsx';
import { Header } from '../Header';

interface WindowDisplayProps {
  windowId: number | string;
  windowTitle: string;
  mode?: string;
  bridgeStatus?: 'ready' | 'error' | 'initializing';
  isMainWindow?: boolean;
  isRuntimeWindow?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * WindowDisplay component that shows information about the current window
 */
export const WindowDisplay: React.FC<WindowDisplayProps> = ({
  windowId,
  windowTitle,
  mode,
  bridgeStatus = 'ready',
  isMainWindow = false,
  isRuntimeWindow = false,
  className = '',
  children,
}) => {
  const displayClasses = clsx(
    'window-display',
    isMainWindow && 'main-window',
    isRuntimeWindow && 'runtime-window',
    className,
  );

  return (
    <div className={displayClasses}>
      <Header
        windowId={windowId}
        windowTitle={windowTitle}
        mode={mode}
        bridgeStatus={bridgeStatus}
        className="window-header"
      />

      <div className="window-content">{children}</div>
    </div>
  );
};

export default WindowDisplay;
