import { VendorSignIn } from "@/features/external-portal/sign-in-forms";

export default async function VendorSignInPage({ searchParams }: PageProps<"/vendor/sign-in">) {
  const { next } = await searchParams;
  return <VendorSignIn next={typeof next === "string" ? next : undefined} />;
}
