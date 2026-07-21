"use client";

import { useEffect } from "react";

/**
 * Casual-copy deterrents: blocks the right-click menu, the common DevTools
 * shortcuts, and image/video dragging. This raises the bar for casual users
 * only — it is NOT real security. A browser can never fully prevent DevTools,
 * network inspection, or screen capture; the real protection is short-lived
 * signed playback URLs on the backend.
 */
export function ContentProtection() {
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onDragStart = (e: DragEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "IMG" || el.tagName === "VIDEO") e.preventDefault();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.key) return; // some IME / autofill events carry no key
      const k = e.key.toLowerCase();
      const devtools =
        e.key === "F12" ||
        ((e.ctrlKey || e.metaKey) &&
          e.shiftKey &&
          (k === "i" || k === "j" || k === "c")) ||
        ((e.ctrlKey || e.metaKey) && k === "u"); // view-source
      if (devtools) e.preventDefault();
    };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return null;
}
