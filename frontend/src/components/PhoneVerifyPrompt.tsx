"use client";

import { useEffect, useRef, useState } from "react";

export interface VerifySession {
  sessionId: string;
  /** The code the user must text to the shortcode. */
  code: string;
  /** "sms:144773?body=..." tap-to-open link. */
  smsUri: string;
}

const SHORTCODE = "144773";
const POLL_MS = 3000;

interface Props<R extends { verified: boolean; status: string }> {
  /** Shown so the user knows which number must send the SMS. */
  phone?: string;
  session: VerifySession;
  /** Called every ~3s; resolve with the current verification status. */
  poll: (sessionId: string) => Promise<R>;
  /** Open a fresh session (MO-SMS "resend"), e.g. after expiry. */
  restart?: (sessionId: string) => Promise<VerifySession>;
  /** Fired once when the SMS is confirmed; carries the poll result + session. */
  onVerified: (result: R, sessionId: string) => void;
}

/**
 * verify.mn Mobile-Originated flow: the user sends the shown code by SMS to
 * 144773 from their own phone; we poll the backend every 3s and fire
 * `onVerified` the moment it lands. No code entry — the phone proves itself.
 */
export function PhoneVerifyPrompt<
  R extends { verified: boolean; status: string },
>({ phone, session: initial, poll, restart, onVerified }: Props<R>) {
  const [sess, setSess] = useState(initial);
  const [expired, setExpired] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Keep the latest callbacks without re-subscribing the poll loop each render.
  const pollRef = useRef(poll);
  const verifiedRef = useRef(onVerified);
  pollRef.current = poll;
  verifiedRef.current = onVerified;

  useEffect(() => {
    if (expired) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const r = await pollRef.current(sess.sessionId);
        if (!active) return;
        if (r.verified) {
          verifiedRef.current(r, sess.sessionId);
          return; // stop polling; the parent takes over
        }
        if (r.status === "EXPIRED") {
          setExpired(true);
          return;
        }
      } catch {
        // Transient network error — keep polling.
      }
      if (active) timer = setTimeout(tick, POLL_MS);
    };

    timer = setTimeout(tick, POLL_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [sess.sessionId, expired]);

  async function handleRestart() {
    if (!restart) return;
    setRestarting(true);
    setError("");
    try {
      const next = await restart(sess.sessionId);
      setSess(next);
      setExpired(false);
    } catch {
      setError("Шинэ код авахад алдаа гарлаа. Дахин оролдоно уу.");
    } finally {
      setRestarting(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(sess.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the code is visible anyway */
    }
  }

  if (expired) {
    return (
      <div className="text-center">
        <p className="mb-5 text-sm text-muted">
          Кодын хугацаа дууслаа. Шинэ код авч дахин илгээнэ үү.
        </p>
        {error ? (
          <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}
        <button
          type="button"
          onClick={handleRestart}
          disabled={restarting || !restart}
          className="w-full rounded-lg bg-accent-strong py-3 text-base font-bold text-white transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {restarting ? "Авч байна…" : "Шинэ код авах"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <ol className="mb-5 space-y-2 text-sm text-muted">
        <li>
          1. Доорх <span className="font-semibold text-foreground">кодыг</span>{" "}
          <span className="font-mono font-bold text-foreground">
            {SHORTCODE}
          </span>{" "}
          дугаар руу мессежээр илгээнэ үү.
        </li>
        <li>2. Илгээсний дараа энэ хуудас автоматаар баталгаажна.</li>
      </ol>

      {/* The code the user must SMS — the star of the screen. */}
      <div className="mb-5 rounded-xl border border-gold/30 bg-gold/10 px-4 py-5 text-center">
        <p className="mb-1 text-xs uppercase tracking-wide text-gold/80">
          Илгээх код
        </p>
        <div className="flex items-center justify-center gap-3">
          <span className="font-mono text-3xl font-bold tracking-[0.3em] text-gold">
            {sess.code}
          </span>
          <button
            type="button"
            onClick={copyCode}
            className="rounded-md border border-gold/30 px-2 py-1 text-xs text-gold/90 transition hover:bg-gold/10"
          >
            {copied ? "Хууллаа" : "Хуулах"}
          </button>
        </div>
        {phone ? (
          <p className="mt-2 text-xs text-muted">
            <span className="font-medium text-foreground">{phone}</span>{" "}
            дугаараас илгээнэ үү
          </p>
        ) : null}
      </div>

      {/* Mobile shortcut: opens the SMS app pre-filled. */}
      <a
        href={sess.smsUri}
        className="mb-4 block w-full rounded-lg bg-accent-strong py-3 text-center text-base font-bold text-white transition hover:bg-accent"
      >
        {SHORTCODE} руу SMS илгээх
      </a>

      <div className="flex items-center justify-center gap-2 text-sm text-muted">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
        Мессеж хүлээж байна…
      </div>

      {restart ? (
        <button
          type="button"
          onClick={handleRestart}
          disabled={restarting}
          className="mt-5 w-full text-sm text-muted transition hover:text-foreground disabled:opacity-60"
        >
          {restarting ? "Авч байна…" : "Шинэ код авах"}
        </button>
      ) : null}
    </div>
  );
}
