"use client";

import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Text,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminApi } from "@/features/admin/api";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { reportBuilderApi, reportBuilderKeys } from "./api";
import type { ReportOut, ShareTarget } from "./types";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** Share a report with teams, roles or everyone. Each viewer still sees only their own data. */
export function ShareDialog({ report, open, onClose }: { report: ReportOut; open: boolean; onClose: () => void }) {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const canTenant = usePermission("report:share_tenant");
  const [tenant, setTenant] = useState(report.shares.some((s) => s.target_kind === "tenant"));
  const [teams, setTeams] = useState<string[]>(report.shares.filter((s) => s.team_id).map((s) => s.team_id as string));
  const [roles, setRoles] = useState<string[]>(report.shares.filter((s) => s.role_id).map((s) => s.role_id as string));
  const teamList = useQuery({ queryKey: ["report-builder", "share-teams"], queryFn: ({ signal }) => adminApi.listTeams(1, 100, signal), enabled: open, retry: false });
  const roleList = useQuery({ queryKey: ["report-builder", "share-roles"], queryFn: ({ signal }) => adminApi.listRoles(signal), enabled: open && canTenant, retry: false });
  const save = useMutation({
    mutationFn: () => {
      const targets: ShareTarget[] = [
        ...(tenant ? [{ target_kind: "tenant" as const }] : []),
        ...teams.map((team_id) => ({ target_kind: "team" as const, team_id })),
        ...roles.map((role_id) => ({ target_kind: "role" as const, role_id })),
      ];
      return reportBuilderApi.putShares(report.id, targets);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reportBuilderKeys.all });
      onClose();
    },
  });
  const roleError = save.error && isApiError(save.error) && save.error.code === "share_role_lacks_permission" ? save.error.message : null;
  const teamName = (id: string) => teamList.data?.items.find((t) => t.id === id)?.name ?? id;
  const roleName = (id: string) => roleList.data?.find((r) => r.id === id)?.name ?? id;
  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Share “{report.name}”</DialogTitle>
          <DialogContent className={styles.form}>
            <Text className={styles.muted}>Sharing never widens access: every viewer runs the report with their own data scope, and hidden fields stay hidden.</Text>
            <Checkbox label="Everyone in the workspace" checked={tenant} disabled={!canTenant} onChange={(_, d) => setTenant(!!d.checked)} />
            <Field label="Teams">
              <Dropdown multiselect placeholder="Choose teams" selectedOptions={teams} value={teams.map(teamName).join(", ")} onOptionSelect={(_, d) => setTeams(d.selectedOptions)}>
                {(teamList.data?.items ?? []).map((t) => (
                  <Option key={t.id} value={t.id}>
                    {t.name}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field
              label="Roles"
              hint={canTenant ? "A role must be able to read this report's data." : "Sharing with roles needs the 'share tenant-wide' permission."}
              validationState={roleError ? "error" : "none"}
              validationMessage={roleError ?? undefined}
            >
              <Dropdown multiselect disabled={!canTenant} placeholder="Choose roles" selectedOptions={roles} value={roles.map(roleName).join(", ")} onOptionSelect={(_, d) => setRoles(d.selectedOptions)}>
                {(roleList.data ?? []).map((r) => (
                  <Option key={r.id} value={r.id}>
                    {r.name}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            {save.error && !roleError && (
              <MessageBar intent="error">
                <MessageBarBody>{errorMessage(save.error)}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={save.isPending} onClick={() => save.mutate()}>
              Save sharing
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
