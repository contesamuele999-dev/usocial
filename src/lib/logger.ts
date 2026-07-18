/**
 * Logging centralizzato: console + tabella `logs` in SQLite,
 * così la cronologia errori è consultabile dalla pagina "Cronologia".
 * `userId` è opzionale: null = log di sistema (es. scheduler), visibile a tutti.
 */
import { getDb } from "./db";

type Level = "info" | "warn" | "error";

function write(level: Level, scope: string, message: string, detail?: unknown, userId?: number) {
  const detailStr =
    detail === undefined
      ? null
      : typeof detail === "string"
        ? detail
        : JSON.stringify(detail, null, 2).slice(0, 8000);

  const line = `[${level.toUpperCase()}] [${scope}] ${message}`;
  if (level === "error") console.error(line, detailStr ?? "");
  else if (level === "warn") console.warn(line, detailStr ?? "");
  else console.log(line);

  try {
    getDb()
      .prepare("INSERT INTO logs (user_id, level, scope, message, detail) VALUES (?, ?, ?, ?, ?)")
      .run(userId ?? null, level, scope, message, detailStr);
  } catch {
    // il DB potrebbe non essere pronto durante la build: non bloccare mai per un log
  }
}

export const logger = {
  info: (scope: string, message: string, detail?: unknown, userId?: number) =>
    write("info", scope, message, detail, userId),
  warn: (scope: string, message: string, detail?: unknown, userId?: number) =>
    write("warn", scope, message, detail, userId),
  error: (scope: string, message: string, detail?: unknown, userId?: number) =>
    write("error", scope, message, detail, userId),
};
