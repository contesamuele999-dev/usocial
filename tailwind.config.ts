import type { Config } from "tailwindcss";

/**
 * Tema uSocial: dark/light con classe `dark` sul tag <html>.
 * Palette neutra + accento "brand" (indaco) riutilizzabile ovunque.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
        },
      },
    },
  },
  plugins: [],
};

export default config;
