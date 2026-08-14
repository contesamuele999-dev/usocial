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
// La home "/" mostra una landing pubblica agli utenti non autenticati e la
// dashboard a quelli loggati (la pagina stessa decide in base alla sessione),
// quindi NON deve essere redirezionata al login.
const ALWAYS_PUBLIC = ["/", "/privacy", "/terms", "/data-deletion"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(SESSION_COOKIE);

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
  // Esclude:
  // - /api: le route si autenticano da sé. Soprattutto, il middleware bufferizza
  //   il body a max 10 MB ("Request body exceeded 10MB… only the first 10MB will
  //   be available"): passandoci dentro, l'upload di un video da 144 MB arrivava
  //   troncato e faceva fallire la richiesta. Fuori dal matcher il body arriva intero.
  // - gli asset di Next e QUALSIASI file statico con estensione (es. /icon.png,
  //   /apple-icon.png in public/): senza questa esclusione il middleware li
  //   redirigerebbe a /login per gli utenti non autenticati, impedendo a
  //   next/image di caricare l'icona nelle pagine pubbliche.
  matcher: ["/((?!api|_next/static|_next/image|.*\\.[\\w]+$).*)"],
};
