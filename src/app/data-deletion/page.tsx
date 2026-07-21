import type { Metadata } from "next";
import { DataDeletionContent } from "./content";

export const metadata: Metadata = {
  title: "Cancellazione dei dati — uSocial",
  description: "Come eliminare il tuo account e tutti i dati associati su uSocial.",
};

export default function DataDeletionPage() {
  return <DataDeletionContent />;
}
