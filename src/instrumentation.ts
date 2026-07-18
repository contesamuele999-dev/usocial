/**
 * Hook di avvio di Next.js: parte insieme al server e avvia lo scheduler
 * dei post programmati (solo nel runtime Node, non in edge/browser).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
  }
}
