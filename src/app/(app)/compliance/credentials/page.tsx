import type { Metadata } from "next";
import { CredentialsView } from "@/features/compliance/credentials-view";

export const metadata: Metadata = { title: "Credentials" };

export default function Page() {
  return <CredentialsView />;
}
