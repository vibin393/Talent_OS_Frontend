"use client";

import { Avatar, Badge, Button, Field, Input, Spinner, Subtitle2, Text } from "@fluentui/react-components";
import { useState } from "react";
import { authKeys } from "@/features/auth/api";
import { usePermission } from "@/features/auth/use-permission";
import { fieldErrors, isApiError } from "@/lib/api/errors";
import type { AdminUserOut } from "@/lib/api/types";
import { adminApi, adminKeys } from "./api";
import { adminErrorMessage } from "./errors";
import { DetailsDrawer, ErrorBar, formatDateTime, IdMultiSelect, IdSelect, useAdminStyles } from "./ui";
import { useAdminMutation, useBusinessUnitLookup, useRoles, useTeamLookup } from "./use-admin-data";
import { buildUserUpdate, isEmptyUpdate, type UserDraft, userDraft } from "./user-update";

/**
 * User details panel (Microsoft 365 admin center style): profile summary plus editable name, roles,
 * business unit and teams. Only changed fields the viewer may change are sent.
 */
export function UserDrawer({
  user,
  isSelf,
  onSaved,
  onClose,
}: {
  user: AdminUserOut;
  isSelf: boolean;
  onSaved: (user: AdminUserOut) => void;
  onClose: () => void;
}) {
  const styles = useAdminStyles();
  const canManage = usePermission("user:manage");
  const canReadRoles = usePermission("role:read");
  const canReadTeams = usePermission("team:read");
  const canReadBUs = usePermission("business_unit:read");
  const canManageTeams = usePermission("team:manage");
  const canManageBUs = usePermission("business_unit:manage");
  const rights = { teams: canManageTeams && !isSelf, businessUnit: canManageBUs && !isSelf };

  const roles = useRoles(canReadRoles);
  const teams = useTeamLookup(canReadTeams);
  const units = useBusinessUnitLookup(canReadBUs);

  const [draft, setDraft] = useState<UserDraft>(() => userDraft(user));
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | undefined>();
  const update = (patch: Partial<UserDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = useAdminMutation({
    mutationFn: () => adminApi.updateUser(user.id, buildUserUpdate(user, draft, rights)),
    invalidate: [adminKeys.users, adminKeys.roles, adminKeys.teams, authKeys.me],
    success: (u) => `Saved ${u.name || u.email}`,
  });

  const body = buildUserUpdate(user, draft, rights);
  const dirty = !isEmptyUpdate(body);
  const nameInvalid = draft.name.trim() === "";

  async function onSave() {
    setError(null);
    setNameError(undefined);
    try {
      const saved = await save.mutateAsync();
      onSaved(saved);
    } catch (e) {
      const fields = fieldErrors(e);
      if (isApiError(e) && e.status === 422 && fields.name) setNameError(fields.name);
      else setError(adminErrorMessage(e));
    }
  }

  // Options include the user's current assignments even when a lookup page does not.
  const roleOptions = mergeOptions(
    (roles.data ?? []).map((r) => ({ id: r.id, label: r.name })),
    user.roles.map((r) => ({ id: r.id, label: r.name })),
  );
  const teamOptions = mergeOptions(
    (teams.data?.items ?? []).map((t) => ({ id: t.id, label: t.name })),
    user.teams.map((t) => ({ id: t.id, label: t.name })),
  );
  const unitOptions = mergeOptions(
    (units.data?.items ?? []).map((b) => ({ id: b.id, label: b.name })),
    user.business_unit ? [{ id: user.business_unit.id, label: user.business_unit.name }] : [],
  );
  const displayName = user.name || user.email;

  return (
    <DetailsDrawer
      open
      size="medium"
      onClose={onClose}
      title={
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={displayName} size={48} color="colorful" aria-hidden />
          <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span className={styles.truncate}>{displayName}</span>
            <Text size={200} className={styles.muted}>
              {user.email}
            </Text>
          </span>
        </span>
      }
      footer={
        canManage && (
          <div className={styles.footer}>
            <Button
              appearance="primary"
              disabled={!dirty || nameInvalid || save.isPending}
              icon={save.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={onSave}
            >
              Save changes
            </Button>
            <Button appearance="secondary" onClick={onClose} disabled={save.isPending}>
              {dirty ? "Cancel" : "Close"}
            </Button>
          </div>
        )
      }
    >
      <div className={styles.form}>
        <dl className={styles.detailList}>
          <dt>Status</dt>
          <dd>
            {user.is_active ? (
              <Badge appearance="tint" color="success">
                Active
              </Badge>
            ) : (
              <Badge appearance="tint" color="subtle">
                Deactivated
              </Badge>
            )}
          </dd>
          <dt>Multi-factor authentication</dt>
          <dd>{user.mfa_enabled ? "Enabled" : "Not set up"}</dd>
          <dt>Last sign-in</dt>
          <dd>{formatDateTime(user.last_login_at)}</dd>
          <dt>Created</dt>
          <dd>{formatDateTime(user.created_at)}</dd>
        </dl>

        <ErrorBar message={error} />

        <Subtitle2 as="h3" className={styles.sectionTitle}>
          Profile and access
        </Subtitle2>
        <Field
          label="Display name"
          required
          validationState={nameError || nameInvalid ? "error" : "none"}
          validationMessage={nameError ?? (nameInvalid ? "Enter a name" : undefined)}
        >
          <Input
            value={draft.name}
            maxLength={200}
            disabled={!canManage}
            onChange={(_, d) => update({ name: d.value })}
          />
        </Field>
        <IdMultiSelect
          label="Roles"
          placeholder="No roles"
          options={roleOptions}
          value={draft.roleIds}
          disabled={!canManage || !canReadRoles}
          onChange={(roleIds) => update({ roleIds })}
          hint={draft.roleIds.length === 0 ? "Without roles the user can sign in but cannot do anything." : undefined}
        />
        <IdSelect
          label="Business unit"
          noneLabel="None"
          options={unitOptions}
          value={draft.businessUnitId}
          disabled={!canManage || !rights.businessUnit}
          hint={isSelf ? "You cannot change your own business unit." : undefined}
          onChange={(businessUnitId) => update({ businessUnitId })}
        />
        <IdMultiSelect
          label="Teams"
          placeholder="No teams"
          options={teamOptions}
          value={draft.teamIds}
          disabled={!canManage || !rights.teams}
          hint={isSelf ? "You cannot change your own teams." : undefined}
          onChange={(teamIds) => update({ teamIds })}
        />
      </div>
    </DetailsDrawer>
  );
}

function mergeOptions(primary: { id: string; label: string }[], extra: { id: string; label: string }[]) {
  const seen = new Set(primary.map((o) => o.id));
  return [...primary, ...extra.filter((o) => !seen.has(o.id))];
}
