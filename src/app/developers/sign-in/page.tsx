import type { Metadata } from "next";
import { SignInForm } from "@/features/developers/auth-forms";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default function Page() {
  return <SignInForm />;
}
