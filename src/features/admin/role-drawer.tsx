"use client";

import {
  Badge,
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Button,
  Checkbox,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Subtitle2,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useState } from "react";
import { authKeys } from "@/features/auth/api";
import { SCOPE_LABELS, type Scope } from "@/features/auth/permissions";
import { fieldErrors, isApiError } from "@/lib/api/errors";
import type { PermissionOut, RoleOut } from "@/lib/api/types";
import { adminApi, adminKeys } from "./api";
import { adminErrorMessage } from "./errors";
import {
  buildRoleUpdate,
  type Grants,
  groupPermissions,
  groupState,
  type RoleDraft,
  roleKeyFromName,
  setGrantScope,
  toggleGrant,
  toggleGroup,
} from "./role-grants";
import { optionalText, roleSchema } from "./schemas";
import { DetailsDrawer, ErrorBar, GridSkeleton, useAdminStyles } from "./ui";
import { useAdminMutation, usePermissionCatalog } from "./use-admin-data";

const useStyles = makeStyles({
  permRow: {
    display: "grid",
    gridTemplateColumns: "1fr 180px",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    paddingBlock: tokens.spacingVerticalXXS,
    "@media (max-width: 599px)": { gridTemplateColumns: "1fr" },
  },
  permLabel: { display: "flex", flexDirection: "column" },
  groupHeader: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, width: "100%" },
  count: { marginInlineStart: "auto", color: tokens.colorNeutralForeground3 },
  scope: { minWidth: "160px" },
});

type FormErrors = Partial<Record<"name" | "key" | "description", string>>;

function scopeLabel(scope: string): string {
  return SCOPE_LABELS[scope as Scope] ?? scope;
}

/** Create / edit a role: name, key, description and a permission checklist with a scope per permission. */
export function RoleDrawer({
  role,
  canManage,
  onClose,
}: {
  role: RoleOut | null;
  canManage: boolean;
  onClose: () => void;
}) {
  const styles = useAdminStyles();
  const local = useStyles();
  const catalog = usePermissionCatalog();
  const readOnly = !canManage || !!role?.is_immutable;

  const [draft, setDraft] = useState<RoleDraft>(() => ({
    name: role?.name ?? "",
    key: role?.key ?? "",
    description: role?.description ?? "",
    permissions: { ...(role?.permissions ?? {}) },
  }));
  const [keyTouched, setKeyTouched] = useState(!!role);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const setGrants = (fn: (g: Grants) => Grants) => setDraft((d) => ({ ...d, permissions: fn(d.permissions) }));

  const save = useAdminMutation({
    mutationFn: () =>
      role
        ? adminApi.updateRole(role.id, buildRoleUpdate(role, draft))
        : adminApi.createRole({
            key: draft.key.trim(),
            name: draft.name.trim(),
            description: optionalText(draft.description),
            permissions: draft.permissions,
          }),
    invalidate: [adminKeys.roles, adminKeys.users, authKeys.me],
    success: (r) => (role ? `Saved ${r.name}` : `Created ${r.name}`),
  });

  const dirty = role ? Object.keys(buildRoleUpdate(role, draft)).length > 0 : true;

  async function onSave() {
    setFormError(null);
    const parsed = roleSchema.safeParse(draft);
    if (!parsed.success) {
      const next: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FormErrors;
        next[field] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      await save.mutateAsync();
      onClose();
    } catch (e) {
      const fields = fieldErrors(e);
      if (isApiError(e) && e.status === 422 && (fields.name || fields.key || fields.description)) {
        setErrors({ name: fields.name, key: fields.key, description: fields.description });
      } else if (isApiError(e) && e.code === "role_exists") {
        setErrors({ key: adminErrorMessage(e) });
      } else {
        setFormError(adminErrorMessage(e));
      }
    }
  }

  const groups = groupPermissions(catalog.data ?? []);
  const selectedCount = Object.keys(draft.permissions).length;
  const title = role ? (readOnly ? role.name : `Edit ${role.name}`) : "Create custom role";

  return (
    <DetailsDrawer
      open
      size="large"
      title={title}
      onClose={onClose}
      footer={
        !readOnly && (
          <div className={styles.footer}>
            <Button
              appearance="primary"
              disabled={!dirty || save.isPending}
              icon={save.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={onSave}
            >
              {role ? "Save changes" : "Create role"}
            </Button>
            <Button appearance="secondary" onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
          </div>
        )
      }
    >
      <div className={styles.form}>
        {role?.is_immutable && (
          <MessageBar intent="info">
            <MessageBarBody>
              The Tenant Admin role always has every permission for the whole organization and cannot be changed.
            </MessageBarBody>
          </MessageBar>
        )}
        {role?.is_system && !role.is_immutable && !readOnly && (
          <MessageBar intent="info">
            <MessageBarBody>This is a system role: its permissions can be edited, but it cannot be deleted.</MessageBarBody>
          </MessageBar>
        )}
        <ErrorBar message={formError} />
        <Field
          label="Name"
          required
          validationState={errors.name ? "error" : "none"}
          validationMessage={errors.name}
        >
          <Input
            value={draft.name}
            maxLength={200}
            disabled={readOnly}
            onChange={(_, d) =>
              setDraft((prev) => ({ ...prev, name: d.value, key: keyTouched ? prev.key : roleKeyFromName(d.value) }))
            }
          />
        </Field>
        <Field
          label="Key"
          required
          hint={role?.is_system ? "System role keys cannot be changed." : "Used by integrations. Lowercase letters, digits and underscores."}
          validationState={errors.key ? "error" : "none"}
          validationMessage={errors.key}
        >
          <Input
            value={draft.key}
            maxLength={64}
            disabled={readOnly || !!role?.is_system}
            onChange={(_, d) => {
              setKeyTouched(true);
              setDraft((prev) => ({ ...prev, key: d.value }));
            }}
          />
        </Field>
        <Field
          label="Description"
          validationState={errors.description ? "error" : "none"}
          validationMessage={errors.description}
        >
          <Textarea
            value={draft.description}
            maxLength={1000}
            disabled={readOnly}
            resize="vertical"
            onChange={(_, d) => setDraft((prev) => ({ ...prev, description: d.value }))}
          />
        </Field>

        <Subtitle2 as="h3" className={styles.sectionTitle}>
          Permissions ({selectedCount})
        </Subtitle2>
        {catalog.isPending ? (
          <GridSkeleton rows={6} />
        ) : catalog.isError ? (
          <ErrorBar message={adminErrorMessage(catalog.error)} title="Could not load permissions." />
        ) : (
          <Accordion multiple collapsible defaultOpenItems={groups.map((g) => g.group)}>
            {groups.map(({ group, permissions }) => {
              const state = groupState(draft.permissions, permissions);
              const count = permissions.filter((p) => p.key in draft.permissions).length;
              return (
                <AccordionItem key={group} value={group}>
                  <AccordionHeader>
                    <span className={local.groupHeader}>
                      {group}
                      <Text size={200} className={local.count}>
                        {count} of {permissions.length}
                      </Text>
                    </span>
                  </AccordionHeader>
                  <AccordionPanel>
                    {!readOnly && (
                      <Checkbox
                        label={`All ${group.toLowerCase()} permissions`}
                        checked={state}
                        onChange={(_, d) => setGrants((g) => toggleGroup(g, permissions, d.checked === true))}
                      />
                    )}
                    {permissions.map((perm) => (
                      <PermissionRow
                        key={perm.key}
                        perm={perm}
                        scope={draft.permissions[perm.key]}
                        readOnly={readOnly}
                        onToggle={(checked) => setGrants((g) => toggleGrant(g, perm, checked))}
                        onScope={(scope) => setGrants((g) => setGrantScope(g, perm, scope))}
                      />
                    ))}
                  </AccordionPanel>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    </DetailsDrawer>
  );
}

function PermissionRow({
  perm,
  scope,
  readOnly,
  onToggle,
  onScope,
}: {
  perm: PermissionOut;
  scope: string | undefined;
  readOnly: boolean;
  onToggle: (checked: boolean) => void;
  onScope: (scope: string) => void;
}) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const checked = scope !== undefined;
  return (
    <div className={styles.permRow}>
      <Checkbox
        checked={checked}
        disabled={readOnly}
        onChange={(_, d) => onToggle(d.checked === true)}
        label={
          <span className={styles.permLabel}>
            <span>
              {perm.description}
              {perm.sensitive && (
                <Badge appearance="tint" color="danger" size="small" style={{ marginInlineStart: 6 }}>
                  Sensitive
                </Badge>
              )}
            </span>
            <Text size={200} className={admin.muted}>
              {perm.key}
            </Text>
          </span>
        }
      />
      {checked && (
        <Dropdown
          className={styles.scope}
          aria-label={`Scope for ${perm.description}`}
          value={scopeLabel(scope)}
          selectedOptions={[scope]}
          disabled={readOnly || perm.scopes.length < 2}
          onOptionSelect={(_, d) => d.optionValue && onScope(d.optionValue)}
        >
          {perm.scopes.map((s) => (
            <Option key={s} value={s}>
              {scopeLabel(s)}
            </Option>
          ))}
        </Dropdown>
      )}
    </div>
  );
}
