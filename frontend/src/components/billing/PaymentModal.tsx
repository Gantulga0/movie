"use client";

import { useEffect, useState } from "react";
import { billingApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { PaymentCheck, QpayInvoice } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { IconCheck } from "@/components/ui/icons";
import { formatMnt } from "@/lib/format";

const POLL_MS = 3000;

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  /** e.g. "QPay төлбөр" heading context line. */
  title: string;
  subtitle: string;
  amount: number;
  paymentId: string;
  invoice: QpayInvoice;
  /** Fired once when the payment lands. */
  onPaid: (check: PaymentCheck) => void;
  /** Success-state contents (message + follow-up actions). */
  successContent: React.ReactNode;
}

/**
 * Shared QPay invoice dialog used by plan checkout and movie rentals:
 * QR + bank deep links, payment polling, dev-mode mock settle button.
 */
export function PaymentModal({
  open,
  onClose,
  title,
  subtitle,
  amount,
  paymentId,
  invoice,
  onPaid,
  successContent,
}: PaymentModalProps) {
  const { token } = useAuth();
  const [paid, setPaid] = useState(false);

  // Reset the success state when a new invoice comes in.
  useEffect(() => {
    queueMicrotask(() => setPaid(false));
  }, [paymentId]);

  // Poll until the payment lands while the dialog is open.
  useEffect(() => {
    if (!open || !token || paid) return;
    const timer = setInterval(async () => {
      const res = await billingApi.check(token, paymentId).catch(() => null);
      if (res?.status === "PAID") {
        setPaid(true);
        onPaid(res);
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [open, token, paid, paymentId, onPaid]);

  async function mockPay() {
    if (!token) return;
    const res = await billingApi.mockPay(token, paymentId).catch(() => null);
    if (res?.status === "PAID") {
      setPaid(true);
      onPaid(res);
    }
  }

  return (
    <Modal open={open} onClose={onClose} label={title}>
      <div className="p-6 sm:p-8">
        {paid ? (
          <div className="text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success">
              <IconCheck size={30} />
            </div>
            <h2 className="display mt-4 text-2xl font-semibold text-foreground">
              Төлбөр амжилттай
            </h2>
            <div className="mt-2">{successContent}</div>
          </div>
        ) : (
          <>
            <h2 className="display text-xl font-semibold text-foreground">
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {subtitle} — {formatMnt(amount)}
            </p>

            {invoice.qrImage ? (
              <div className="mt-5 flex justify-center rounded-xl bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${invoice.qrImage}`}
                  alt="QPay QR код"
                  className="h-52 w-52"
                />
              </div>
            ) : invoice.mock ? (
              <div className="mt-5 rounded-xl border border-gold/30 bg-gold/10 px-4 py-5 text-center">
                <p className="text-sm font-semibold text-gold">
                  Тест горим (QPay холбогдоогүй)
                </p>
                <p className="mt-1 text-xs text-muted">
                  QPay merchant бүртгэл холбогдсоны дараа энд жинхэнэ QR код
                  гарна.
                </p>
              </div>
            ) : null}

            {invoice.urls.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Банкны апп-аар төлөх
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {invoice.urls.slice(0, 8).map((u) => (
                    <a
                      key={u.name}
                      href={u.link}
                      className="truncate rounded-lg border border-line bg-white/[.04] px-3 py-2 text-center text-xs font-semibold text-foreground/85 transition hover:bg-white/10"
                    >
                      {u.description || u.name}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-center gap-2 text-sm text-muted">
              <span className="h-2 w-2 animate-pulse rounded-full bg-gold" />
              Төлбөр хүлээгдэж байна…
            </div>

            {invoice.mock ? (
              <Button
                variant="outline"
                className="mt-4 w-full border-gold/40 text-gold hover:bg-gold/10"
                onClick={mockPay}
              >
                [Тест] Төлбөр төлөгдсөн гэж үзэх
              </Button>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}
