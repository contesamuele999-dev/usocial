/**
 * Configurazione Next.js.
 * - `standalone`: output minimale per l'immagine Docker.
 * - `serverExternalPackages`: better-sqlite3 (nativo) e ffmpeg-static (binario
 *   esterno) non vanno bundlati da webpack.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "ffmpeg-static"],
  experimental: {},
};

export default nextConfig;
