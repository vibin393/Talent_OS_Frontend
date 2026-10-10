"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Spinner,
} from "@fluentui/react-components";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { applyServerFieldErrors } from "@/features/auth/server-errors";
import { TextField } from "@/features/auth/text-field";
import { usePermission } from "@/features/auth/use-permission";
import { adminApi, adminKeys } from "./api";
import { adminErrorMessage } from "./errors";
import { type InviteValues, inviteSchema, optionalText } from "./schemas";
import { ErrorBar, IdMultiSelect, IdSelect, useAdminStyles } from "./ui";
import { useAdminMutation, useBusinessUnitLookup, useRoles, useTeamLookup } from "./use-admin-data";

/** "Add a user" dialog: sends an invitation with roles and optional business unit / teams. */
export function InviteUserDialog({ onClose }: { onClose: () => void }) {
  const styles = useAdminStyles();
  const canReadRoles = usePermission("role:read");
  const canReadTeams = usePermission("team:read");
  const canReadBUs = usePermission("business_unit:read");
  const roles = useRoles(canReadRoles);
  const teams = useTeamLookup(canReadTeams);
  const units = useBusinessUnitLookup(canReadBUs);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", name: "", role_ids: [], business_unit_id: null, team_ids: [] },
  });
  const invite = useAdminMutation({
    mutationFn: (values: InviteValues) =>
      adminApi.inviteUser({
        email: values.email,
        name: optionalText(values.name),
        role_ids: values.role_ids,
        business_unit_id: values.business_unit_id,
        team_ids: values.team_ids,
      }),
    invalidate: [adminKeys.invitations],
    success: (inv) => `Invitation sent to ${inv.email}`,
  });

  async function onSubmit(values: InviteValues) {
    setFormError(null);
    try {
      await invite.mutateAsync(values);
      onClose();
    } catch (e) {
      if (!applyServerFieldErrors(e, form.setError, ["email", "name", "role_ids"])) setFormError(adminErrorMessage(e));
    }
  }

  const busy = form.formState.isSubmitting;
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <DialogBody>
            <DialogTitle>Add a user</DialogTitle>
            <DialogContent className={styles.form}>
              <ErrorBar message={formError} />
              <ErrorBar
                message={!canReadRoles ? "You need the role:read permission to choose roles for new users." : null}
              />
              <TextField control={form.control} name="email" label="Email" type="email" required autoComplete="off" />
              <TextField
                control={form.control}
                name="name"
                label="Display name"
                hint="Optional. The person can change it when accepting."
              />
              <Controller
                control={form.control}
                name="role_ids"
                render={({ field, fieldState }) => (
                  <IdMultiSelect
                    label="Roles"
                    required
                    placeholder="Choose roles"
                    options={(roles.data ?? []).map((r) => ({ id: r.id, label: r.name }))}
                    value={field.value}
                    onChange={field.onChange}
                    validationMessage={fieldState.error?.message}
                  />
                )}
              />
              {canReadBUs && (
                <Controller
                  control={form.control}
                  name="business_unit_id"
                  render={({ field }) => (
                    <IdSelect
                      label="Business unit"
                      noneLabel="None"
                      options={(units.data?.items ?? []).map((b) => ({ id: b.id, label: b.name }))}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              )}
              {canReadTeams && (
                <Controller
                  control={form.control}
                  name="team_ids"
                  render={({ field }) => (
                    <IdMultiSelect
                      label="Teams"
                      placeholder="No teams"
                      options={(teams.data?.items ?? []).map((t) => ({ id: t.id, label: t.name }))}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              )}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button appearance="primary" type="submit" disabled={busy} icon={busy ? <Spinner size="tiny" /> : undefined}>
                Send invitation
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
