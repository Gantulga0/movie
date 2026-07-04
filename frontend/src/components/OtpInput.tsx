"use client";

import { useEffect, useRef } from "react";

interface OtpInputProps {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  disabled?: boolean;
}

/** Six-box one-time-code input with auto-advance and paste support. */
export function OtpInput({ value, onChange, length = 6, disabled }: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  // Focus the first empty box when the component mounts.
  useEffect(() => {
    refs.current[Math.min(value.length, length - 1)]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setDigit(index: number, digit: string) {
    const chars = value.padEnd(length, " ").split("");
    chars[index] = digit || " ";
    const next = chars.join("").trimEnd().replace(/ /g, "");
    onChange(next);
  }

  function handleChange(index: number, raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      setDigit(index, "");
      return;
    }
    // Pasting a whole code fills every box at once.
    if (digits.length > 1) {
      onChange(digits.slice(0, length));
      refs.current[Math.min(digits.length, length) - 1]?.focus();
      return;
    }
    setDigit(index, digits);
    refs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="Баталгаажуулах код">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={length}
          disabled={disabled}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          aria-label={`${i + 1}-р орон`}
          className="h-14 w-12 rounded-lg border border-white/15 bg-white/5 text-center text-2xl font-bold text-white outline-none transition focus:border-brand focus:bg-white/10 disabled:opacity-50"
        />
      ))}
    </div>
  );
}
