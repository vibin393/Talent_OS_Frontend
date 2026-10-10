import { ClientVerify } from "@/features/external-portal/sign-in-forms";

export default async function ClientVerifyPage({ searchParams }: PageProps<"/client/sign-in/verify">) {
  const { next } = await searchParams;
  return <ClientVerify next={typeof next === "string" ? next : undefined} />;
}
