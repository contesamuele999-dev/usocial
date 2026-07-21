"use client";
/**
 * Form condiviso per login e registrazione (differenziato dalla prop `mode`).
 * In caso di successo reindirizza alla dashboard.
 */
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client";
import { useI18n } from "@/lib/i18n";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { t } = useI18n();
  const isRegister = mode === "register";
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(isRegister ? { email, name, password } : { email, password }),
      });
      // ricarica completa: il middleware ora vede il cookie di sessione
      window.location.href = "/";
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-3xl">🚀</div>
          <h1 className="mt-1 text-xl font-bold">
            u<span className="text-brand-600">Social</span>
          </h1>
          <p className="text-sm text-gray-500">
            {isRegister ? t("auth.createAccount") : t("auth.loginAccount")}
          </p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {isRegister && (
            <input
              className="input"
              placeholder={t("auth.name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <input
            className="input"
            type="email"
            placeholder={t("auth.email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder={isRegister ? t("auth.passwordRegister") : t("auth.password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={isRegister ? 8 : undefined}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? t("auth.waiting") : isRegister ? t("auth.register") : t("auth.login")}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          {isRegister ? (
            <>
              {t("auth.haveAccount")}
              <Link href="/login" className="font-medium text-brand-600 hover:underline">
                {t("auth.login")}
              </Link>
            </>
          ) : (
            <>
              {t("auth.noAccount")}
              <Link href="/register" className="font-medium text-brand-600 hover:underline">
                {t("auth.register")}
              </Link>
            </>
          )}
        </p>
        <p className="mt-3 text-center text-xs text-gray-400">
          <Link href="/privacy" className="hover:underline">
            {t("auth.privacy")}
          </Link>{" "}
          ·{" "}
          <Link href="/terms" className="hover:underline">
            {t("auth.terms")}
          </Link>
        </p>
      </div>
    </div>
  );
}
