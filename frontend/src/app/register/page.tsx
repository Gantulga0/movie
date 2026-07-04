"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell, AuthLink } from "@/components/AuthShell";
import { Field } from "@/components/Field";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";

interface FormState {
  name: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

const PHONE_RE = /^\+?[0-9]{6,15}$/;

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading: authLoading, register } = useAuth();

  const [form, setForm] = useState<FormState>({
    name: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user) router.replace("/home");
  }, [authLoading, user, router]);

  function update(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function validate() {
    const next: FieldErrors = {};
    if (form.name.trim().length < 2) next.name = "Нэр дор хаяж 2 тэмдэгт байх ёстой.";
    if (!PHONE_RE.test(form.phone.trim()))
      next.phone = "Зөв утасны дугаар оруулна уу (6-15 орон).";
    if (form.password.length < 6)
      next.password = "Нууц үг дор хаяж 6 тэмдэгт байх ёстой.";
    if (form.confirmPassword !== form.password)
      next.confirmPassword = "Нууц үг таарахгүй байна.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await register({
        name: form.name.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      // Account created — the OTP screen finishes sign-up.
      router.replace(
        `/verify?identifier=${encodeURIComponent(res.otp.target)}` +
          (res.otp.devCode ? `&dev=${res.otp.devCode}` : ""),
      );
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : "Бүртгүүлэхэд алдаа гарлаа. Дахин оролдоно уу.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Бүртгэл үүсгэх"
      subtitle="Утасны дугаараараа хэдхэн секундэд бүртгүүлээрэй."
      footer={
        <>
          Бүртгэлтэй юу? <AuthLink href="/login">Нэвтрэх</AuthLink>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {formError ? (
          <div className="mb-4 rounded-lg border border-brand/40 bg-brand/10 px-4 py-3 text-sm text-red-200">
            {formError}
          </div>
        ) : null}

        <Field
          label="Нэр"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Таны нэр"
          value={form.name}
          onChange={update("name")}
          error={errors.name}
        />
        <Field
          label="Утасны дугаар"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="99xxxxxx"
          value={form.phone}
          onChange={update("phone")}
          error={errors.phone}
        />
        <Field
          label="Нууц үг"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Дор хаяж 6 тэмдэгт"
          value={form.password}
          onChange={update("password")}
          error={errors.password}
        />
        <Field
          label="Нууц үг баталгаажуулах"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Нууц үгээ давтана уу"
          value={form.confirmPassword}
          onChange={update("confirmPassword")}
          error={errors.confirmPassword}
        />

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 w-full rounded-lg bg-brand py-3 text-base font-bold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Бүртгэж байна…" : "Бүртгүүлэх"}
        </button>
      </form>
    </AuthShell>
  );
}
