"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Trap focus within a container (for modals, dialogs, drawers).
 * Returns a ref to attach to the container and a release function.
 */
export function useFocusTrap(active: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    previousRef.current = document.activeElement as HTMLElement;
    return () => {
      previousRef.current?.focus();
    };
  }, [active]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !containerRef.current) return;
      const focusable = containerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!active) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [active, handleKeyDown]);

  // Auto-focus first focusable element when trap activates
  useEffect(() => {
    if (!active || !containerRef.current) return;
    const first = containerRef.current.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    first?.focus();
  }, [active]);

  return containerRef;
}

/**
 * Focus the first error element after form validation failure.
 */
export function focusFirstError(formRef: React.RefObject<HTMLFormElement | null>) {
  if (!formRef.current) return;
  const firstError = formRef.current.querySelector<HTMLElement>(
    '[aria-invalid="true"], .border-red-500, [data-error]',
  );
  firstError?.focus();
}
