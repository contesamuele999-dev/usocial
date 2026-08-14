/**
 * /robots.txt — consente esplicitamente i crawler (incluso facebookexternalhit
 * di Meta, usato per generare le anteprime Open Graph dei link e per l'App Review).
 */
import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Non esporre le rotte API e le aree autenticate agli indicizzatori.
        disallow: ["/api/", "/studio/", "/settings"],
      },
      // Bot di Meta: accesso pieno per lo scraping delle anteprime.
      { userAgent: "facebookexternalhit", allow: "/" },
      { userAgent: "facebookcatalog", allow: "/" },
      { userAgent: "Facebot", allow: "/" },
    ],
    sitemap: `${env.appUrl}/sitemap.xml`,
  };
}
