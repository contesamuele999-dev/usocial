/**
 * Accesso centralizzato alle variabili d'ambiente (file .env).
 * Nessuna libreria: Next.js carica .env automaticamente.
 */
import path from "node:path";

export const env = {
  get appUrl(): string {
    return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  },
  /** Se false, la registrazione di nuovi utenti è bloccata (default: true). */
  get allowRegistration(): boolean {
    return (process.env.ALLOW_REGISTRATION || "true").toLowerCase() !== "false";
  },
  get dataDir(): string {
    return path.resolve(process.env.DATA_DIR || "./data");
  },
  get mediaDir(): string {
    return path.join(this.dataDir, "media");
  },
  get dbPath(): string {
    return path.join(this.dataDir, "usocial.db");
  },
  /**
   * Quota di spazio per utente, in byte (default 2 GB).
   * La VM ha un disco da ~30 GB condiviso: 2 GB a utente permette una quindicina
   * di account lasciando margine a sistema, database e file temporanei di ffmpeg.
   * Configurabile con USER_QUOTA_MB nel file .env.
   */
  get userQuotaBytes(): number {
    const mb = Number(process.env.USER_QUOTA_MB);
    return (Number.isFinite(mb) && mb > 0 ? mb : 2048) * 1024 * 1024;
  },
  /** Credenziali OAuth per piattaforma (vuote = piattaforma non configurata). */
  oauth(platform: string): { clientId: string; clientSecret: string } {
    const map: Record<string, [string, string]> = {
      facebook: ["META_CLIENT_ID", "META_CLIENT_SECRET"],
      instagram: ["META_CLIENT_ID", "META_CLIENT_SECRET"],
      // Threads ha id e segreto PROPRI (caso d'uso "Threads API" dell'app Meta):
      // usare qui META_CLIENT_ID fa fallire lo scambio del token.
      threads: ["THREADS_CLIENT_ID", "THREADS_CLIENT_SECRET"],
      linkedin: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
      youtube: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
      tiktok: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    };
    const [idKey, secretKey] = map[platform] || ["", ""];
    return {
      clientId: process.env[idKey] || "",
      clientSecret: process.env[secretKey] || "",
    };
  },
};
