/**
 * Configurazione Next.js.
 * - `standalone`: output minimale per l'immagine Docker.
 * - `serverExternalPackages`: better-sqlite3 è un modulo nativo, non va bundlato.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  experimental: {},
};

export default nextConfig;
