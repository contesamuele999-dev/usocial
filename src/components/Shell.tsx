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
import type { User } from "@/types";

const NAV = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/calendar", label: "Calendario", icon: "🗓️" },
  { href: "/media", label: "Media", icon: "🖼️" },
  { href: "/history", label: "Cronologia", icon: "📜" },
  { href: "/settings", label: "Impostazioni", icon: "⚙️" },
];

const AUTH_PAGES = ["/login", "/register"];

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };
  return (
    <button onClick={toggle} className="btn-secondary w-full" title="Cambia tema">
      {dark ? "☀️ Tema chiaro" : "🌙 Tema scuro"}
    </button>
  );
}

function UserBox() {
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
        🚪 Esci
      </button>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Pagine di autenticazione: nessuna sidebar, solo il contenuto centrato.
  if (AUTH_PAGES.includes(pathname)) {
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
        <Link href="/posts/new" className="btn-primary md:mb-4">
          ✍️ <span className="hidden sm:inline">Nuovo Post</span>
        </Link>
        <nav className="flex flex-1 flex-row gap-1 overflow-x-auto md:flex-col">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                pathname === item.href
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              <span>{item.icon}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="hidden md:block">
          <ThemeToggle />
          <UserBox />
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
