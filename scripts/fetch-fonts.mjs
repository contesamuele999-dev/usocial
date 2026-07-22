/**
 * Scarica i font self-hosted usati dai caroselli in public/fonts/.
 * Eseguire una volta per macchina/VM:  npm run fonts
 *
 * I font sono sotto SIL Open Font License 1.1 (uso commerciale + self-hosting
 * consentiti). Non sono versionati su git per non appesantire il repo.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "fonts");

const FONTS = [
  ["montserrat-400.ttf", "https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Ew-.ttf"],
  ["montserrat-700.ttf", "https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM70w-.ttf"],
  ["montserrat-900.ttf", "https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCvC70w-.ttf"],
  ["inter-400.ttf", "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf"],
  ["inter-700.ttf", "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf"],
  ["bebasneue-400.ttf", "https://fonts.gstatic.com/s/bebasneue/v16/JTUSjIg69CK48gW7PXooxW4.ttf"],
  ["playfair-700.ttf", "https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKeiukDQ.ttf"],
  ["robotomono-400.ttf", "https://fonts.gstatic.com/s/robotomono/v31/L0xuDF4xlVMF-BfR8bXMIhJHg45mwgGEFl0_3vqPQw.ttf"],
];

fs.mkdirSync(OUT_DIR, { recursive: true });

let ok = 0;
let failed = 0;

for (const [name, url] of FONTS) {
  const dest = path.join(OUT_DIR, name);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
    console.log(`• ${name} già presente, salto`);
    ok++;
    continue;
  }
  try {
    const res = await fetch(url, {
      // Google serve formati diversi in base allo user-agent: questo UA ottiene TTF.
      headers: { "User-Agent": "Mozilla/5.0 (compatible; uSocial font fetcher)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) throw new Error("file troppo piccolo");
    fs.writeFileSync(dest, buf);
    console.log(`✓ ${name} (${(buf.length / 1024).toFixed(0)} KB)`);
    ok++;
  } catch (e) {
    console.error(`✗ ${name}: ${e instanceof Error ? e.message : e}`);
    failed++;
  }
}

console.log(`\nCompletato: ${ok} font pronti, ${failed} falliti.`);
if (failed) {
  console.log("I font mancanti non bloccano l'app: i caroselli useranno i font di sistema.");
}
