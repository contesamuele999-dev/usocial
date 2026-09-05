"use client";
/**
 * Layout dell'app: sidebar di navigazione + area contenuto.
 * Include il toggle tema chiaro/scuro, il pulsante "Nuovo Post", l'utente
 * corrente e il logout. Sulle pagine di autenticazione (/login, /register)
 * non mostra la sidebar.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useI18n, LANGS, type Lang } from "@/lib/i18n";
import type { User } from "@/types";

const NAV = [
  { href: "/", key: "nav.dashboard", icon: "📊" },
  { href: "/studio", key: "nav.studio", icon: "🧠" },
  { href: "/calendar", key: "nav.calendar", icon: "🗓️" },
  { href: "/media", key: "nav.media", icon: "🖼️" },
  { href: "/stats", key: "nav.stats", icon: "📈" },
  { href: "/autoreply", key: "nav.autoreply", icon: "💬" },
  { href: "/history", key: "nav.history", icon: "📜" },
  { href: "/settings", key: "nav.settings", icon: "⚙️" },
];

/** Link legali: raccolti in una sezione dedicata in fondo alla sidebar. */
const LEGAL = [
  { href: "/privacy", key: "nav.privacy", icon: "🔒" },
  { href: "/terms", key: "nav.terms", icon: "📄" },
  { href: "/data-deletion", key: "nav.dataDeletion", icon: "🗑️" },
];

const AUTH_PAGES = ["/login", "/register", "/privacy", "/terms", "/data-deletion"];

/** Byte → stringa leggibile (es. "1.4 GB"). */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const dec = v >= 10 || i === 0 || Number.isInteger(v) ? 0 : 1;
  return `${v.toFixed(dec)} ${units[i]}`;
}

interface Quota {
  used: number;
  limit: number;
  percent: number;
  files: number;
  warning: boolean;
  full: boolean;
}

/**
 * Barra della memoria occupata.
 * Su VM condivisa lo spazio è la risorsa più scarsa: mostrarlo sempre evita
 * che l'utente scopra il problema solo quando un upload fallisce.
 */
function StorageBar() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [quota, setQuota] = useState<Quota | null>(null);

  // Si aggiorna a ogni cambio pagina: dopo un upload o un'eliminazione il
  // valore mostrato resta coerente senza bisogno di polling.
  useEffect(() => {
    let alive = true;
    api<Quota>("/api/storage")
      .then((q) => {
        if (alive) setQuota(q);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  if (!quota) return null;

  const pct = Math.min(100, quota.percent);
  const color = quota.full ? "bg-red-500" : quota.warning ? "bg-amber-500" : "bg-brand-600";

  return (
    <Link
      href="/media"
      className="mt-2 block rounded-lg px-2 py-1.5 transition hover:bg-gray-100 dark:hover:bg-gray-800"
      title={t("storage.tooltip", {
        used: formatBytes(quota.used),
        limit: formatBytes(quota.limit),
        files: quota.files,
      })}
    >
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>💾 {t("storage.label")}</span>
        <span className={quota.warning ? "font-semibold text-amber-600" : ""}>{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-gray-400">
        {formatBytes(quota.used)} / {formatBytes(quota.limit)}
      </p>
      {quota.full && <p className="mt-0.5 text-[11px] text-red-500">{t("storage.full")}</p>}
    </Link>
  );
}

/** Sezione con i link legali (privacy, termini, cancellazione dati). */
function LegalLinks() {
  const { t } = useI18n();
  const pathname = usePathname();
  return (
    <div className="mt-2 border-t border-gray-200 pt-2 dark:border-gray-800">
      <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {t("nav.legal")}
      </p>
      <div className="flex flex-col gap-0.5">
        {LEGAL.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs transition ${
              pathname === item.href
                ? "bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100"
                : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            <span>{item.icon}</span>
            <span>{t(item.key)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { t } = useI18n();
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };
  return (
    <button onClick={toggle} className="btn-secondary w-full" title={t("shell.themeToggle")}>
      {dark ? t("shell.themeLight") : t("shell.themeDark")}
    </button>
  );
}

function LanguageSelector() {
  const { lang, setLang, t } = useI18n();
  return (
    <label className="mt-2 block">
      <span className="sr-only">{t("shell.language")}</span>
      <select
        className="input w-full text-sm"
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        title={t("shell.language")}
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.flag} {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function UserBox() {
  const { t } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    api<{ user: User | null }>("/api/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => {});
  }, []);

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  if (!user) return null;
  return (
    <div className="mt-2 border-t border-gray-200 pt-2 dark:border-gray-800">
      <p className="truncate px-2 text-xs text-gray-500" title={user.email}>
        👤 {user.name || user.email}
      </p>
      <button onClick={logout} className="btn-secondary mt-1 w-full text-xs">
        {t("shell.logout")}
      </button>
    </div>
  );
}

/** Rotellina di attesa mostrata sul link appena cliccato. */
function NavSpinner() {
  return (
    <span
      aria-hidden
      className="ml-auto h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

export function Shell({
  children,
  hasSession = false,
}: {
  children: React.ReactNode;
  hasSession?: boolean;
}) {
  const pathname = usePathname();
  const { t } = useI18n();

  /**
   * Destinazione del clic in corso. Le pagine sono tutte client-side e caricano
   * i dati dopo il mount: senza questo segnale un clic non produce alcun
   * riscontro visibile finché la risposta non arriva, e sembra ignorato.
   * Si azzera da sé quando il percorso cambia davvero.
   */
  const [navTo, setNavTo] = useState<string | null>(null);
  useEffect(() => setNavTo(null), [pathname]);
  const isNavigating = (href: string) => navTo === href && pathname !== href;

  // Pagine di autenticazione: nessuna sidebar, solo il contenuto centrato.
  // La home "/" senza sessione mostra la landing pubblica, anch'essa senza sidebar.
  if (AUTH_PAGES.includes(pathname) || (pathname === "/" && !hasSession)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex w-full shrink-0 flex-row items-center gap-2 border-b border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900 md:min-h-screen md:w-56 md:flex-col md:items-stretch md:p-4">
        <Link href="/" className="mb-0 flex items-center gap-2 px-2 md:mb-6">
          <span className="text-2xl">🚀</span>
          <span className="text-lg font-bold tracking-tight">
            u<span className="text-brand-600">Social</span>
          </span>
        </Link>
        <Link
          href="/posts/new"
          className="btn-primary md:mb-4"
          onClick={() => setNavTo("/posts/new")}
        >
          ✍️ <span className="hidden sm:inline">{t("shell.newPost")}</span>
          {isNavigating("/posts/new") && <NavSpinner />}
        </Link>
        <nav className="flex flex-1 flex-row gap-1 overflow-x-auto md:flex-col">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setNavTo(item.href)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                pathname === item.href
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              <span>{item.icon}</span>
              <span className="hidden sm:inline">{t(item.key)}</span>
              {isNavigating(item.href) && <NavSpinner />}
            </Link>
          ))}
        </nav>
        <div className="hidden md:block">
          <StorageBar />
          <LegalLinks />
          <LanguageSelector />
          <ThemeToggle />
          <UserBox />
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
