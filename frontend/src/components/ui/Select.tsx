"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { IconCheck, IconChevronDown, IconSearch } from "@/components/ui/icons";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Adds a filter input at the top of the dropdown (for long lists). */
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
}

/**
 * Custom dropdown select: labelled trigger, panel with an optional
 * borderless search field and a scrollable option list. Fully keyboard
 * accessible (arrows, Enter, Escape) and closes on outside click.
 */
export function Select({
  label,
  value,
  onChange,
  options,
  searchable = false,
  searchPlaceholder = "Хайх…",
  className = "",
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) => o.label.toLowerCase().includes(term));
  }, [options, search]);

  function openPanel() {
    setSearch("");
    const idx = options.findIndex((o) => o.value === value);
    setHighlighted(idx >= 0 ? idx : 0);
    setOpen(true);
  }

  function closePanel(refocus = false) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function commit(option: SelectOption) {
    onChange(option.value);
    closePanel(true);
  }

  // Outside click closes the panel.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Focus lands in the panel once it opens.
  useEffect(() => {
    if (!open) return;
    (searchable ? searchRef.current : panelRef.current)?.focus();
  }, [open, searchable]);

  // Keep the highlighted option visible while navigating with arrows.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector('[data-highlighted="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [open, highlighted]);

  function onPanelKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      closePanel(true);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (filtered.length === 0) return;
      const dir = e.key === "ArrowDown" ? 1 : -1;
      setHighlighted((h) => (h + dir + filtered.length) % filtered.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const option = filtered[highlighted];
      if (option) commit(option);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <span className="mb-1.5 block text-[13px] font-bold text-foreground">
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => (open ? closePanel() : openPanel())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            openPanel();
          }
        }}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm font-medium outline-none transition hover:border-line-strong focus-visible:border-accent ${
          value ? "text-foreground" : "text-muted"
        }`}
      >
        <span className="truncate">{selected?.label ?? label}</span>
        <span
          aria-hidden
          className={`shrink-0 text-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <IconChevronDown size={16} />
        </span>
      </button>

      {open ? (
        <div
          ref={panelRef}
          tabIndex={-1}
          onKeyDown={onPanelKeyDown}
          className="animate-dropdown absolute left-0 top-full z-50 mt-2 w-full min-w-[13rem] overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-card outline-none"
        >
          {searchable ? (
            <div className="px-2.5 pt-2.5">
              <div className="relative">
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setHighlighted(0);
                  }}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="no-focus-ring w-full rounded-full border border-line bg-background-deep/60 py-2 pl-4 pr-10 text-sm text-foreground placeholder-muted/70 outline-none transition focus:border-accent/40"
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted">
                  <IconSearch size={15} />
                </span>
              </div>
            </div>
          ) : null}

          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={label}
            className="max-h-64 overflow-y-auto p-1.5"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted">
                Илэрц олдсонгүй
              </li>
            ) : (
              filtered.map((option, i) => {
                const isSelected = option.value === value;
                const isHighlighted = i === highlighted;
                return (
                  <li key={option.value} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      tabIndex={-1}
                      data-highlighted={isHighlighted}
                      onClick={() => commit(option)}
                      onMouseMove={() => setHighlighted(i)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                        isSelected
                          ? "font-semibold text-accent"
                          : "text-foreground/85"
                      } ${isHighlighted ? "bg-white/[.07]" : ""}`}
                    >
                      <span className="truncate">{option.label}</span>
                      {isSelected ? (
                        <span className="shrink-0 text-accent" aria-hidden>
                          <IconCheck size={15} />
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
