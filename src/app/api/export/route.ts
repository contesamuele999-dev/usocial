/**
 * GET /api/export — backup dei dati dell'utente in JSON (post, media, impostazioni).
 * I token degli account e l'API key AI sono esclusi per sicurezza.
 */
import { withUser } from "@/lib/api";
import { exportAll } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const GET = withUser("export", async (_req, _ctx, user) => {
  const data = exportAll(user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="usocial-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});
