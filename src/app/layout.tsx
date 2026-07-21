import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";
import { LanguageProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "uSocial — Social Publisher AI",
  description: "Scrivi una volta, pubblica ovunque.",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <LanguageProvider>
          <Shell>{children}</Shell>
        </LanguageProvider>
      </body>
    </html>
  );
}
