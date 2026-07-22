/**
 * Registro dei font dei caroselli.
 *
 * Perché esiste: il canvas disegna con `ctx.font = "... <family>"`. Se quella
 * famiglia non è ancora stata caricata dal browser, il canvas ripiega
 * silenziosamente su un font di sistema — ed è per questo che lo stesso
 * carosello risultava diverso su Windows, Mac e telefono.
 *
 * Soluzione: font self-hostati in /public/fonts, dichiarati in CSS e attesi
 * esplicitamente con `document.fonts.load()` PRIMA di disegnare.
 *
 * I file .ttf si scaricano con `npm run fonts`. Se mancano, il fallback della
 * famiglia entra in gioco e l'app continua a funzionare.
 */

export interface FontOption {
  /** Etichetta mostrata nella UI. */
  label: string;
  /** Valore CSS salvato nel brand kit (famiglia + fallback). */
  css: string;
  /** Famiglia principale, usata per document.fonts.load(). */
  family: string;
  /** Pesi disponibili come file locali. */
  weights: number[];
  /** true se serviamo noi i file (quindi resa identica ovunque). */
  embedded: boolean;
}

/**
 * Font disponibili per i template carosello.
 * Montserrat è il primo: è il font più richiesto per i caroselli social.
 */
export const CAROUSEL_FONTS: FontOption[] = [
  {
    label: "Montserrat",
    css: "'Montserrat', Inter, system-ui, sans-serif",
    family: "Montserrat",
    weights: [400, 700, 900],
    embedded: true,
  },
  {
    label: "Inter",
    css: "'Inter', system-ui, sans-serif",
    family: "Inter",
    weights: [400, 700],
    embedded: true,
  },
  {
    label: "Bebas Neue",
    css: "'Bebas Neue', Impact, sans-serif",
    family: "Bebas Neue",
    weights: [400],
    embedded: true,
  },
  {
    label: "Playfair Display",
    css: "'Playfair Display', Georgia, serif",
    family: "Playfair Display",
    weights: [700],
    embedded: true,
  },
  {
    label: "Roboto Mono",
    css: "'Roboto Mono', 'Courier New', monospace",
    family: "Roboto Mono",
    weights: [400],
    embedded: true,
  },
  // Font di sistema: nessun file da scaricare, ma la resa può variare
  // leggermente tra dispositivi. Restano per retrocompatibilità con i
  // template già salvati.
  {
    label: "Georgia (sistema)",
    css: "Georgia, serif",
    family: "Georgia",
    weights: [400, 700],
    embedded: false,
  },
  {
    label: "Impact (sistema)",
    css: "Impact, sans-serif",
    family: "Impact",
    weights: [400],
    embedded: false,
  },
];

/** Font predefinito dei nuovi template. */
export const DEFAULT_FONT_CSS = CAROUSEL_FONTS[0].css;

/** Ritrova l'opzione a partire dal valore CSS salvato nel brand kit. */
export function fontOptionFromCss(css: string): FontOption | undefined {
  return CAROUSEL_FONTS.find((f) => f.css === css);
}

/**
 * Attende che i font necessari siano realmente pronti.
 *
 * `document.fonts.load()` va chiamato con la stessa sintassi shorthand usata
 * poi da `ctx.font`, altrimenti il browser non sa quale face caricare.
 * Va invocata PRIMA di ogni disegno su canvas.
 */
export async function ensureFontsReady(cssFamily: string): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;

  const opt = fontOptionFromCss(cssFamily);
  const weights = opt?.weights ?? [400, 700];
  const family = opt ? `'${opt.family}'` : cssFamily;

  try {
    await Promise.all(
      weights.map((w) =>
        // il testo campione forza il caricamento del subset latino
        document.fonts.load(`${w} 64px ${family}`, "AaBbCcÀàÈèÌìÒòÙù0123456789")
      )
    );
    await document.fonts.ready;
  } catch {
    // font non disponibile: si prosegue col fallback della famiglia CSS
  }
}

/** Precarica tutti i font incorporati (usato dalle pagine di editing). */
export async function preloadAllCarouselFonts(): Promise<void> {
  await Promise.all(
    CAROUSEL_FONTS.filter((f) => f.embedded).map((f) => ensureFontsReady(f.css))
  );
}
