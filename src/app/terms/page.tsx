import type { Metadata } from "next";
import { TermsContent } from "./content";

export const metadata: Metadata = {
  title: "uSocial Terms of Service",
  description: "Termini e condizioni d'uso di uSocial.",
  icons: { icon: "/icon.png" },
};

export default function TermsPage() {
  return <TermsContent />;
}
