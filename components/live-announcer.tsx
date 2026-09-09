"use client";

import { createContext, useContext, useRef, useCallback, type ReactNode } from "react";

interface LiveAnnouncerContextValue {
  announce: (message: string, priority?: "polite" | "assertive") => void;
}

const LiveAnnouncerContext = createContext<LiveAnnouncerContextValue>({
  announce: () => {},
});

export function useLiveAnnouncer() {
  return useContext(LiveAnnouncerContext);
}

/**
 * Global live announcer for screen readers. Renders two aria-live regions
 * (polite + assertive). Call `announce()` from anywhere via context or
 * ref to trigger announcements on route changes, async status, etc.
 */
export function LiveAnnouncer({ children }: { children: ReactNode }) {
  const politeRef = useRef<HTMLDivElement>(null);
  const assertiveRef = useRef<HTMLDivElement>(null);

  const announce = useCallback(
    (message: string, priority: "polite" | "assertive" = "polite") => {
      const region = priority === "assertive" ? assertiveRef.current : politeRef.current;
      if (!region) return;
      // Clear then set to trigger re-announcement
      region.textContent = "";
      requestAnimationFrame(() => {
        region.textContent = message;
      });
    },
    [],
  );

  return (
    <LiveAnnouncerContext.Provider value={{ announce }}>
      {/* Polite region: announced after current speech finishes */}
      <div
        ref={politeRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      {/* Assertive region: interrupts current speech */}
      <div
        ref={assertiveRef}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
      {children}
    </LiveAnnouncerContext.Provider>
  );
}
