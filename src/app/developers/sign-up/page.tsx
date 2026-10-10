import type { Metadata } from "next";
import { SignUpForm } from "@/features/developers/auth-forms";

export const metadata: Metadata = { title: "Create your developer account", robots: { index: false, follow: false } };

export default function Page() {
  return <SignUpForm />;
}
