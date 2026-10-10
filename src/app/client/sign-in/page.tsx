import { ClientSignIn } from "@/features/external-portal/sign-in-forms";

export default async function ClientSignInPage({ searchParams }: PageProps<"/client/sign-in">) {
  const { next, sso_error, mfa } = await searchParams;
  return (
    <ClientSignIn
      next={typeof next === "string" ? next : undefined}
      // Epic 50: company sign-in (SSO) callback outcomes.
      ssoError={typeof sso_error === "string" ? sso_error : undefined}
      mfa={typeof mfa === "string" ? mfa : undefined}
    />
  );
}
