"use client";

import { Button } from "@fluentui/react-components";
import { SignOut20Regular } from "@fluentui/react-icons";
import type { AuthOut } from "@/lib/api/types";
import { AuthCard, AuthFrame } from "./auth-frame";
import { MfaSetup } from "./mfa-setup";
import { useLogout } from "./use-logout";

/**
 * Shown instead of the app when `me.mfa_enrollment_required`: the tenant requires MFA and this user has
 * not enrolled, so every API except `auth/me`, `auth/logout` and `auth/mfa/*` answers 403. `onDone` runs
 * after the recovery codes were acknowledged (the caller refreshes `me` and shows the app).
 */
export function ForcedMfaEnrollment({ me, onDone }: { me: AuthOut; onDone: () => void }) {
  const logout = useLogout();
  return (
    <AuthFrame>
      <AuthCard
        title="Set up multi-factor authentication"
        description={`${me.tenant.name} requires a second sign-in step for every account. Set it up to continue as ${me.user.email}.`}
      >
        <MfaSetup workspace={me.tenant.slug} email={me.user.email} onDone={onDone} />
        <div>
          <Button
            appearance="subtle"
            icon={<SignOut20Regular />}
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            Sign out
          </Button>
        </div>
      </AuthCard>
    </AuthFrame>
  );
}
