"use client";

import { useEffect, useRef } from "react";
import { IconX } from "./icons";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name of the dialog. */
  label: string;
  children: React.ReactNode;
  /** Max width utility class. */
  size?: "md" | "lg" | "xl";
  /** Extra classes on the panel (e.g. p-0 for full-bleed media). */
  className?: string;
  /** Hide the default close button (caller renders its own). */
  hideClose?: boolean;
}

const SIZES = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

/**
 * Accessible dialog: focus is trapped inside, Escape closes, background
 * scroll is locked, and focus returns to the opener on close.
 */
export function Modal({
  open,
  onClose,
  label,
  children,
  size = "md",
  className = "",
  hideClose = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // Scroll lock + focus capture/restore.
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the dialog once it exists.
    const frame = requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panelRef.current)?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previous;
      restoreRef.current?.focus?.();
    };
  }, [open]);

  // Escape + Tab cycling.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto bg-background-deep/80 backdrop-blur-sm"
      onMouseDown={(e) => {
        // Only a true backdrop press closes — not clicks inside the panel.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Center within the DYNAMIC viewport (dvh), not the iOS layout viewport,
          so the dialog stays vertically centered and clear of the toolbars. */}
      <div className="flex min-h-dvh items-center justify-center p-4 sm:p-6">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
          className={`animate-scale-in relative w-full ${SIZES[size]} rounded-2xl border border-line bg-surface shadow-pop outline-none ${className}`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {hideClose ? null : (
            <button
              type="button"
              onClick={onClose}
              aria-label="Хаах"
              className="absolute right-3 top-3 z-10 rounded-full bg-background-deep/60 p-2 text-muted transition hover:bg-background-deep hover:text-foreground"
            >
              <IconX size={18} />
            </button>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
