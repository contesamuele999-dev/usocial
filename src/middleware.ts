/**
 * Middleware di protezione delle rotte.
 * Controlla SOLO la presenza del cookie di sessione (l'edge runtime non può
 * accedere a SQLite): la validazione reale del token avviene nelle API.
 * - senza cookie → redirect a /login;
 * - con cookie su /login o /register → redirect alla dashboard.
 * Le API restano accessibili: validano da sé (e il callback OAuth e il file
 * media devono poter rispondere anche a richieste esterne).
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

const PUBLIC_PAGES = ["/login", "/register"];
// Pagine sempre accessibili, con o senza login (richieste anche dai revisori
// delle piattaforme social, es. TikTok, che le visitano senza autenticarsi).
const ALWAYS_PUBLIC = ["/privacy", "/terms"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(SESSION_COOKIE);

  // Le route API si autogestiscono (auth, callback OAuth, file media pubblici).
  if (pathname.startsWith("/api")) return NextResponse.next();

  // Pagine legali: accessibili a chiunque, nessun redirect.
  if (ALWAYS_PUBLIC.includes(pathname)) return NextResponse.next();

  if (PUBLIC_PAGES.includes(pathname)) {
    if (hasSession) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  if (!hasSession) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // esclude asset statici; include pagine e (per semplicità) le api, gestite sopra
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
