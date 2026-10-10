import type { Metadata } from "next";
import { ImmigrationSettings } from "@/features/immigration/visa-types-admin";

export const metadata: Metadata = { title: "Immigration settings" };

export default function Page() {
  return <ImmigrationSettings />;
}
