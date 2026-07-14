"use client";

import { forwardRef, useState } from "react";

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, id, type, className = "", ...props },
  ref,
) {
  const fieldId = id ?? props.name;
  const isPassword = type === "password";
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="mb-4">
      <label
        htmlFor={fieldId}
        className="mb-1.5 block text-sm font-medium text-white/80"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={fieldId}
          ref={ref}
          type={isPassword && revealed ? "text" : type}
          className={`no-focus-ring w-full rounded-xl border bg-white/5 px-4 py-3 text-white placeholder-white/35 outline-none transition focus:border-accent/40 focus:bg-white/10 ${
            isPassword ? "pr-12" : ""
          } ${error ? "border-brand/70" : "border-line"} ${className}`}
          aria-invalid={error ? true : undefined}
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Нууц үг нуух" : "Нууц үг харах"}
            aria-pressed={revealed}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-white/45 transition hover:text-white"
          >
            {revealed ? (
              // Eye-off
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M3 3l18 18"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
                <path
                  d="M10.58 10.58a2.5 2.5 0 003.54 3.54"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
                <path
                  d="M9.36 5.32A9.66 9.66 0 0112 5c5 0 8.57 3.6 10 7a13.5 13.5 0 01-1.95 3.03M6.1 6.35C4.23 7.6 2.83 9.36 2 12c1.43 3.4 5 7 10 7 1.36 0 2.64-.27 3.8-.74"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              // Eye
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M2 12c1.43-3.4 5-7 10-7s8.57 3.6 10 7c-1.43 3.4-5 7-10 7S3.43 15.4 2 12z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
                <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" />
              </svg>
            )}
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-1.5 text-xs text-brand">{error}</p> : null}
    </div>
  );
});
