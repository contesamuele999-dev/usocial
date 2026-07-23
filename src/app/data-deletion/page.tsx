import type { Metadata } from "next";
import { DataDeletionContent } from "./content";

export const metadata: Metadata = {
  title: "uSocial Data Deletion",
  description: "Come eliminare il tuo account e tutti i dati associati su uSocial.",
};

export default function DataDeletionPage() {
  return <DataDeletionContent />;
}
