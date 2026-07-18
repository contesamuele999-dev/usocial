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
  /** Credenziali OAuth per piattaforma (vuote = piattaforma non configurata). */
  oauth(platform: string): { clientId: string; clientSecret: string } {
    const map: Record<string, [string, string]> = {
      facebook: ["META_CLIENT_ID", "META_CLIENT_SECRET"],
      instagram: ["META_CLIENT_ID", "META_CLIENT_SECRET"],
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
