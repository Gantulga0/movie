"use client";

import { useEffect, useState } from "react";
import { billingApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { PaymentCheck, PaymentInvoice } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { IconCheck } from "@/components/ui/icons";
import { formatMnt } from "@/lib/format";

const POLL_MS = 3000;

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  /** e.g. "wire.mn төлбөр" heading context line. */
  title: string;
  subtitle: string;
  amount: number;
  paymentId: string;
  invoice: PaymentInvoice;
  /** Fired once when the payment lands. */
  onPaid: (check: PaymentCheck) => void;
  /** Success-state contents (message + follow-up actions). */
  successContent: React.ReactNode;
}

/**
 * Shared payment dialog used by plan checkout and movie rentals in mock
 * mode: payment polling and the dev-mode mock settle button. (Real wire.mn
 * payments redirect to the hosted checkout page instead of opening this.)
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
  const [openHint, setOpenHint] = useState(false);
  const [inAppBrowser, setInAppBrowser] = useState(false);

  // Facebook/Instagram/Messenger-ийн доторх browser банкны custom-scheme
  // deeplink нээхийг хориглодог — урьдчилж анхааруулна.
  useEffect(() => {
    setInAppBrowser(
      /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|MicroMessenger|TikTok|musical_ly|Snapchat/i.test(
        navigator.userAgent,
      ),
    );
  }, []);

  // Reset the success state when a new invoice comes in.
  useEffect(() => {
    queueMicrotask(() => setPaid(false));
  }, [paymentId]);

  /**
   * Custom-scheme deeplink: top-frame navigation is the most reliable way
   * across devices. If the app opened, the page goes hidden — if we're still
   * visible after the grace period, the scheme wasn't handled (app not
   * installed / blocked browser), so show a hint instead of failing silently.
   */
  function openBankApp(link: string) {
    setOpenHint(false);
    setTimeout(() => {
      if (document.visibilityState === "visible") setOpenHint(true);
    }, 2000);
    window.location.href = link;
  }

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
    <Modal
      open={open}
      onClose={onClose}
      label={title}
      className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden"
    >
      {paid ? (
        <div className="p-7 text-center sm:p-9">
          <div className="animate-scale-in mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success ring-1 ring-success/30">
            <IconCheck size={30} />
          </div>
          <h2 className="display mt-4 text-2xl font-semibold text-foreground">
            Төлбөр амжилттай
          </h2>
          <div className="mt-2">{successContent}</div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Header — pinned (right padding clears the close button) */}
          <div className="flex items-end justify-between gap-3 px-6 pb-4 pr-14 pt-6 sm:px-7 sm:pr-16">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">
                {title}
              </p>
              <p className="mt-1 truncate text-sm text-muted">{subtitle}</p>
            </div>
            <p className="display shrink-0 text-xl font-bold tabular-nums text-foreground">
              {formatMnt(amount)}
            </p>
          </div>

          {/* Body — the only scroll region */}
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-6 sm:px-7">
            {inAppBrowser ? (
              <div className="mb-4 rounded-lg border border-gold/30 bg-gold/10 px-3.5 py-2.5 text-xs leading-relaxed text-gold">
                Та Facebook/Instagram доторх browser ашиглаж байгаа тул банкны
                апп нээгдэхгүй байж магадгүй. Баруун дээд цэснээс{" "}
                <span className="font-semibold">
                  “Open in browser / Хөтчөөр нээх”
                </span>
                -ийг сонгоно уу.
              </div>
            ) : null}
            {invoice.qrImage ? (
              <div className="flex flex-col items-center">
                <div className="rounded-2xl bg-white p-3.5 shadow-[0_8px_30px_rgba(3,6,18,0.5)] ring-1 ring-black/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/png;base64,${invoice.qrImage}`}
                    alt="Төлбөрийн QR код"
                    className="h-44 w-44 sm:h-52 sm:w-52"
                  />
                </div>
                <p className="mt-3 text-center text-xs text-muted">
                  Банкныхаа аппаар QR кодыг уншуулна уу
                </p>
              </div>
            ) : invoice.mock ? (
              <div className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-5 text-center">
                <p className="text-sm font-semibold text-gold">
                  Тест горим (wire.mn холбогдоогүй)
                </p>
                <p className="mt-1 text-xs text-muted">
                  wire.mn түлхүүр холбогдсоны дараа энд QR код гарна.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-line bg-surface-raised/40 px-4 py-6 text-center text-sm text-muted">
                Төлбөрийн мэдээлэл ачаалж байна…
              </div>
            )}

            {invoice.urls.length > 0 ? (
              <div className="mt-6">
                <div className="mb-3 flex items-center gap-3">
                  <span className="h-px flex-1 bg-line" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    эсвэл банкны апп
                  </span>
                  <span className="h-px flex-1 bg-line" />
                </div>
                <div className="grid grid-cols-4 gap-2 pb-2 sm:grid-cols-5">
                  {invoice.urls.map((u) => (
                    <a
                      key={u.name}
                      href={u.link}
                      onClick={(e) => {
                        e.preventDefault();
                        openBankApp(u.link);
                      }}
                      title={u.description || u.name}
                      className="group flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-xl border border-line bg-white/[0.03] p-2 transition active:scale-95 hover:-translate-y-0.5 hover:border-accent/50 hover:bg-white/[0.07]"
                    >
                      {u.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.logo}
                          alt=""
                          loading="lazy"
                          className="h-9 w-9 rounded-lg bg-white/95 object-contain p-0.5"
                          onError={(e) => {
                            e.currentTarget.style.visibility = "hidden";
                          }}
                        />
                      ) : (
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-raised text-[11px] font-bold text-foreground/70">
                          {(u.description || u.name).slice(0, 2)}
                        </span>
                      )}
                      <span className="w-full truncate text-center text-[10px] font-medium leading-tight text-foreground/80">
                        {u.description || u.name}
                      </span>
                    </a>
                  ))}
                </div>
                {openHint ? (
                  <p className="mt-3 rounded-lg border border-gold/30 bg-gold/10 px-3.5 py-2.5 text-center text-xs leading-relaxed text-gold">
                    Банкны апп нээгдсэнгүй юу? Тухайн банкны апп суусан эсэхийг
                    шалгаарай — эсвэл өөр төхөөрөмжөөс дээрх QR кодыг
                    уншуулаарай.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Footer — pinned */}
          <div className="border-t border-line px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-7">
            <div className="flex items-center justify-center gap-2 text-sm text-muted">
              <span className="h-2 w-2 animate-pulse rounded-full bg-gold shadow-[0_0_8px_rgba(230,185,94,0.7)]" />
              Төлбөр хүлээгдэж байна…
            </div>
            {invoice.mock ? (
              <Button
                variant="outline"
                className="mt-3 w-full border-gold/40 text-gold hover:bg-gold/10"
                onClick={mockPay}
              >
                [Тест] Төлбөр төлөгдсөн гэж үзэх
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </Modal>
  );
}
