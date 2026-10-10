"use client";

import { Body1, Card, CardHeader, makeStyles, Spinner, Subtitle2, Switch, Text, tokens } from "@fluentui/react-components";
import { ShieldKeyhole24Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AppLink } from "@/components/app-link";
import { authApi, authKeys } from "@/features/auth/api";
import { useMe } from "@/features/auth/use-me";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { adminErrorMessage } from "./errors";
import { ConfirmDialog, ErrorBar, GridSkeleton, NoAccess } from "./ui";

const useStyles = makeStyles({
  card: { maxWidth: "720px", padding: tokens.spacingHorizontalXL, gap: tokens.spacingVerticalM },
  row: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalM },
  muted: { color: tokens.colorNeutralForeground2 },
});

/** `/admin/security`: tenant-wide "Require multi-factor authentication" (story 1.4 `GET/PATCH /tenant/security`). */
export function SecurityView() {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const canRead = usePermission("settings:read");
  const canManage = usePermission("settings:manage");
  const [confirming, setConfirming] = useState<boolean | null>(null);

  const security = useQuery({
    queryKey: authKeys.tenantSecurity,
    queryFn: ({ signal }) => authApi.tenantSecurity(signal),
    enabled: canRead,
  });
  const update = useMutation({
    mutationFn: (required: boolean) => authApi.updateTenantSecurity(required),
    onSuccess: async (out) => {
      queryClient.setQueryData(authKeys.tenantSecurity, out);
      toast.success(out.mfa_required ? "Multi-factor authentication is now required" : "Multi-factor authentication is now optional");
      // Turning the requirement on restricts the admin too when they have not enrolled.
      await queryClient.invalidateQueries({ queryKey: authKeys.me });
    },
  });

  if (!canRead) return <NoAccess what="security settings" />;

  const required = security.data?.mfa_required ?? false;
  const selfWithoutMfa = me ? !me.user.mfa_enabled : false;

  return (
    <>
      <PageHeader title="Security" subtitle="Sign-in requirements for everyone in this organization." />
      {security.isPending ? (
        <GridSkeleton rows={2} />
      ) : security.isError ? (
        <ErrorBar title="Could not load security settings." message={errorMessage(security.error)} />
      ) : (
        <Card className={styles.card}>
          <CardHeader
            image={<ShieldKeyhole24Regular aria-hidden />}
            header={<Subtitle2 as="h2">Multi-factor authentication</Subtitle2>}
          />
          <div className={styles.row}>
            <Switch
              checked={required}
              disabled={!canManage || update.isPending}
              onChange={(_, d) => setConfirming(d.checked)}
              label="Require multi-factor authentication for everyone"
            />
            {update.isPending && <Spinner size="tiny" aria-label="Saving" />}
          </div>
          <Body1 className={styles.muted}>
            When required, people who have not set up an authenticator app must do so the next time they use Talent OS
            before they can do anything else. People who already use it are not affected.
          </Body1>
          {!canManage && (
            <Text size={200} className={styles.muted}>
              You can view this setting but need the settings:manage permission to change it.
            </Text>
          )}
          <Text size={200}>
            Your own account: {me?.user.mfa_enabled ? "multi-factor authentication is on." : "multi-factor authentication is off."}{" "}
            <AppLink href="/settings/security">Manage your security settings</AppLink>
          </Text>
        </Card>
      )}
      <ConfirmDialog
        open={confirming !== null}
        title={confirming ? "Require multi-factor authentication?" : "Make multi-factor authentication optional?"}
        confirmLabel={confirming ? "Require" : "Make optional"}
        onClose={() => setConfirming(null)}
        onConfirm={() =>
          update.mutateAsync(!!confirming).catch((e) => {
            toast.error(adminErrorMessage(e));
            throw e;
          })
        }
      >
        {confirming
          ? selfWithoutMfa
            ? "Everyone without an authenticator app, including you, will have to set one up before continuing. You will be asked to do so right away."
            : "Everyone without an authenticator app will have to set one up the next time they use Talent OS."
          : "People can turn multi-factor authentication off for their own account. Accounts that already use it keep it."}
      </ConfirmDialog>
    </>
  );
}
