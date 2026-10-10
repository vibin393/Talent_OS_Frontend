import type { Metadata } from "next";
import { SignInView } from "@/features/portal/sign-in";

export const metadata: Metadata = { title: "Sign in" };

export default async function Page({ searchParams }: PageProps<"/portal/sign-in">) {
  const { tenant } = await searchParams;
  return <SignInView tenant={typeof tenant === "string" ? tenant : null} />;
}
