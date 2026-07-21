import type { Metadata } from "next";
import { PrivacyContent } from "./content";

export const metadata: Metadata = {
  title: "Privacy Policy — uSocial",
  description: "Informativa sulla privacy di uSocial.",
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
