import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { Shell } from "@/components/Shell";
import { LanguageProvider } from "@/lib/i18n";
import { SESSION_COOKIE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "uSocial — Social Publisher AI",
  description: "Scrivi una volta, pubblica ovunque.",
  // Favicon e apple-icon sono generati automaticamente dalla convenzione Next
  // (src/app/icon.png e src/app/apple-icon.png): non dichiararli qui per
  // evitare conflitti sul percorso /icon.png.
};

/** Script inline: applica tema e lingua salvati prima del paint (niente flash). */
const bootScript = `
try {
  const t = localStorage.getItem("theme");
  if (t === "dark" || (!t && matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark");
  }
  const l = localStorage.getItem("lang");
  if (l === "it" || l === "en") document.documentElement.lang = l;
} catch {}
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const hasSession = store.has(SESSION_COOKIE);
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <LanguageProvider>
          <Shell hasSession={hasSession}>{children}</Shell>
        </LanguageProvider>
      </body>
    </html>
  );
}
