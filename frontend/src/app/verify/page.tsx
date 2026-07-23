"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, AuthLink } from "@/components/AuthShell";
import { PhoneVerifyPrompt } from "@/components/PhoneVerifyPrompt";
import { useAuth } from "@/lib/auth-context";
import { authApi } from "@/lib/api";
import type { VerifyStatus } from "@/lib/types";

function VerifyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading, adoptSession } = useAuth();

  const code = params.get("code") ?? "";
  const sessionId = params.get("session") ?? "";
  const phone = params.get("phone") ?? undefined;

  const session = useMemo(
    () => ({
      sessionId,
      code,
      // The SMS body is exactly the code; 144773 is verify.mn's shortcode.
      smsUri: `sms:144773?body=${encodeURIComponent(code)}`,
    }),
    [sessionId, code],
  );

  useEffect(() => {
    if (!loading && user) router.replace("/home");
  }, [loading, user, router]);

  if (!sessionId || !code) {
    return (
      <AuthShell
        title="Утас баталгаажуулах"
        subtitle="Баталгаажуулах сесс олдсонгүй. Дахин эхлүүлнэ үү."
        footer={
          <>
            <AuthLink href="/register">Бүртгүүлэх</AuthLink> ·{" "}
            <AuthLink href="/login">Нэвтрэх</AuthLink>
          </>
        }
      >
        <p className="text-sm text-muted">
          Баталгаажуулах холбоос дуусжээ. Бүртгэлээ дахин эхлүүлнэ үү.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Утсаа баталгаажуулах"
      subtitle="Доорх кодыг 144773 руу SMS-ээр илгээхэд бид автоматаар таньж баталгаажуулна."
      footer={
        <>
          Буруу дугаар уу? <AuthLink href="/register">Дахин бүртгүүлэх</AuthLink>
        </>
      }
    >
      <PhoneVerifyPrompt
        phone={phone}
        session={session}
        poll={(sid) => authApi.verifyStatus(sid)}
        restart={async (sid) => {
          const p = await authApi.verifyRestart(sid);
          return { sessionId: p.sessionId, code: p.code, smsUri: p.smsUri };
        }}
        onVerified={(r: VerifyStatus) => {
          if (r.auth) {
            adoptSession(r.auth.accessToken, r.auth.refreshToken, r.auth.user);
            router.replace("/home");
          }
        }}
      />
    </AuthShell>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}
