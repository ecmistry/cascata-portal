import { useEffect, useRef, useCallback } from "react";

/**
 * Configuration for inactivity timer
 */
export interface InactivityTimerConfig {
  /**
   * Time in milliseconds before auto-logout (default: 30 minutes)
   */
  timeoutMs?: number;
  /**
   * Time in milliseconds before showing warning (default: 5 minutes before timeout)
   */
  warningTimeMs?: number;
  /**
   * Callback when inactivity timeout is reached
   */
  onTimeout: () => void;
  /**
   * Optional callback when warning should be shown
   */
  onWarning?: () => void;
  /**
   * Whether the timer is enabled (default: true)
   */
  enabled?: boolean;
}

/**
 * useInactivityTimer Hook
 * 
 * Tracks user activity and triggers callbacks after periods of inactivity.
 * Monitors mouse movements, clicks, keyboard input, scroll events, and touch events.
 * 
 * @param config - Configuration object for the inactivity timer
 * 
 * @example
 * ```tsx
 * const { resetTimer, timeRemaining } = useInactivityTimer({
 *   timeoutMs: 30 * 60 * 1000, // 30 minutes
 *   onTimeout: () => logout(),
 *   onWarning: () => showWarning(),
 * });
 * ```
 */
export function useInactivityTimer(config: InactivityTimerConfig) {
  const {
    timeoutMs = 30 * 60 * 1000, // 30 minutes default
    warningTimeMs = 5 * 60 * 1000, // 5 minutes before timeout
    onTimeout,
    onWarning,
    enabled = true,
  } = config;

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const warningShownRef = useRef<boolean>(false);

  /**
   * Reset the inactivity timer
   */
  const resetTimer = useCallback(() => {
    if (!enabled) return;

    // Clear existing timers
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }

    // Reset warning flag
    warningShownRef.current = false;

    // Update last activity time
    lastActivityRef.current = Date.now();

    // Set warning timer (if warning callback is provided)
    if (onWarning && warningTimeMs > 0) {
      warningTimeoutRef.current = setTimeout(() => {
        if (!warningShownRef.current) {
          warningShownRef.current = true;
          onWarning();
        }
      }, timeoutMs - warningTimeMs);
    }

    // Set main timeout
    timeoutRef.current = setTimeout(() => {
      onTimeout();
    }, timeoutMs);
  }, [enabled, timeoutMs, warningTimeMs, onTimeout, onWarning]);

  /**
   * Handle user activity events
   */
  const handleActivity = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    if (!enabled) {
      // Clear timers if disabled
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }
      return;
    }

    // Initial timer setup
    resetTimer();

    // List of events that indicate user activity
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
      "keydown",
    ];

    // Add event listeners with throttling for mousemove
    const throttledHandleActivity = (() => {
      let lastCall = 0;
      const throttleMs = 1000; // Only reset timer once per second for mousemove

      return (event: Event) => {
        const now = Date.now();
        if (event.type === "mousemove") {
          if (now - lastCall < throttleMs) {
            return; // Throttle mousemove events
          }
          lastCall = now;
        }
        handleActivity();
      };
    })();

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, throttledHandleActivity, { passive: true });
    });

    // Cleanup function
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, throttledHandleActivity);
      });

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, [enabled, handleActivity, resetTimer]);

  /**
   * Calculate time remaining until timeout
   */
  const timeRemaining = enabled
    ? Math.max(0, timeoutMs - (Date.now() - lastActivityRef.current))
    : Infinity;

  return {
    resetTimer,
    timeRemaining,
  };
}

