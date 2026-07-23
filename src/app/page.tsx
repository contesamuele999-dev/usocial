/**
 * Home "/":
 * - visitatori NON autenticati → landing pubblica (requisito review TikTok:
 *   il sito pubblico non deve essere una pagina di login).
 * - utenti autenticati → dashboard.
 * La scelta avviene lato server leggendo il cookie di sessione.
 */
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/constants";
import { Landing } from "@/components/Landing";
import { DashboardClient } from "./DashboardClient";

export default async function Home() {
  const store = await cookies();
  const hasSession = store.has(SESSION_COOKIE);
  return hasSession ? <DashboardClient /> : <Landing />;
}
