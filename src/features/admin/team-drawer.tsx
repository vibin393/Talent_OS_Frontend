"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Avatar,
  Button,
  Combobox,
  Field,
  makeStyles,
  Option,
  Spinner,
  Subtitle2,
  Switch,
  Text,
  tokens, mergeClasses } from "@fluentui/react-components";
import { Dismiss20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useAppToast } from "@/components/toast";
import { applyServerFieldErrors } from "@/features/auth/server-errors";
import { TextField } from "@/features/auth/text-field";
import { usePermission } from "@/features/auth/use-permission";
import type { TeamDetailOut, TeamMemberOut } from "@/lib/api/types";
import { adminApi, adminKeys } from "./api";
import { adminErrorMessage } from "./errors";
import { EMPTY_USER_FILTERS } from "./query";
import { optionalText, orgUnitSchema } from "./schemas";
import { TextAreaField } from "./text-area-field";
import { DetailsDrawer, ErrorBar, GridSkeleton, IdSelect, useAdminStyles } from "./ui";
import { useAdminMutation, useBusinessUnitLookup } from "./use-admin-data";
import { z } from "zod";

const teamSchema = orgUnitSchema.extend({ business_unit_id: z.string().nullable() });
type TeamValues = z.infer<typeof teamSchema>;

const useStyles = makeStyles({
  member: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    paddingBlock: tokens.spacingVerticalS,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  memberName: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
});

/** Create / edit a team; in edit mode also manage members and team leads. */
export function TeamDrawer({
  teamId,
  canManage,
  onClose,
}: {
  teamId: string | null;
  canManage: boolean;
  onClose: () => void;
}) {
  const team = useQuery({
    queryKey: adminKeys.team(teamId ?? ""),
    queryFn: ({ signal }) => adminApi.getTeam(teamId!, signal),
    enabled: !!teamId,
  });
  const styles = useAdminStyles();
  const title = teamId ? (team.data?.name ?? "Team") : "Add a team";

  return (
    <DetailsDrawer open size="medium" title={title} onClose={onClose}>
      {teamId && team.isPending ? (
        <GridSkeleton rows={4} />
      ) : teamId && team.isError ? (
        <ErrorBar title="Could not load the team." message={adminErrorMessage(team.error)} />
      ) : (
        <div className={styles.form}>
          <TeamForm team={team.data ?? null} canManage={canManage} onClose={onClose} />
          {team.data && <TeamMembers team={team.data} canManage={canManage} />}
        </div>
      )}
    </DetailsDrawer>
  );
}

function TeamForm({
  team,
  canManage,
  onClose,
}: {
  team: TeamDetailOut | null;
  canManage: boolean;
  onClose: () => void;
}) {
  const styles = useAdminStyles();
  const canReadBUs = usePermission("business_unit:read");
  const units = useBusinessUnitLookup(canReadBUs);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<TeamValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: team?.name ?? "",
      description: team?.description ?? "",
      business_unit_id: team?.business_unit_id ?? null,
    },
  });
  const save = useAdminMutation({
    mutationFn: (values: TeamValues) => {
      const body = {
        name: values.name,
        description: optionalText(values.description),
        business_unit_id: values.business_unit_id,
      };
      return team ? adminApi.updateTeam(team.id, body) : adminApi.createTeam(body);
    },
    invalidate: [adminKeys.teams, adminKeys.users],
    success: (t) => (team ? `Saved ${t.name}` : `Created ${t.name}`),
  });

  async function onSubmit(values: TeamValues) {
    setFormError(null);
    try {
      await save.mutateAsync(values);
      if (!team) onClose();
      else form.reset(values);
    } catch (e) {
      if (!applyServerFieldErrors(e, form.setError, ["name", "description"])) setFormError(adminErrorMessage(e));
    }
  }

  const busy = form.formState.isSubmitting;
  const unitOptions = (units.data?.items ?? []).map((b) => ({ id: b.id, label: b.name }));
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className={styles.form}>
      <ErrorBar message={formError} />
      <TextField control={form.control} name="name" label="Name" required disabled={!canManage} />
      <TextAreaField control={form.control} name="description" label="Description" disabled={!canManage} />
      {(canReadBUs || team?.business_unit_id) && (
        <Controller
          control={form.control}
          name="business_unit_id"
          render={({ field }) => (
            <IdSelect
              label="Business unit"
              noneLabel="None"
              options={unitOptions}
              value={field.value}
              disabled={!canManage || !canReadBUs}
              onChange={field.onChange}
            />
          )}
        />
      )}
      {canManage && (
        <div className={styles.footer}>
          <Button
            appearance="primary"
            type="submit"
            disabled={busy || (!!team && !form.formState.isDirty)}
            icon={busy ? <Spinner size="tiny" /> : undefined}
          >
            {team ? "Save changes" : "Create team"}
          </Button>
        </div>
      )}
    </form>
  );
}

function TeamMembers({ team, canManage }: { team: TeamDetailOut; canManage: boolean }) {
  const styles = useAdminStyles();
  const local = useStyles();
  const toast = useAppToast();
  const canReadUsers = usePermission("user:read");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());

  const candidates = useQuery({
    queryKey: adminKeys.userSearch(deferredSearch),
    queryFn: ({ signal }) =>
      adminApi.listUsers({ ...EMPTY_USER_FILTERS, q: deferredSearch, status: "active" }, 1, 20, signal),
    enabled: canManage && canReadUsers,
  });

  const invalidate = [adminKeys.team(team.id), adminKeys.teams, adminKeys.users] as const;
  const setMember = useAdminMutation({
    mutationFn: ({ userId, isLead }: { userId: string; isLead: boolean }) =>
      adminApi.setTeamMember(team.id, userId, isLead),
    invalidate,
    toastErrors: true,
  });
  const removeMember = useAdminMutation({
    mutationFn: (m: TeamMemberOut) => adminApi.removeTeamMember(team.id, m.user_id),
    invalidate,
    success: (_, m) => `Removed ${m.name} from ${team.name}`,
    toastErrors: true,
  });

  const memberIds = new Set(team.members.map((m) => m.user_id));
  const options = (candidates.data?.items ?? []).filter((u) => !memberIds.has(u.id));
  const busy = setMember.isPending || removeMember.isPending;

  return (
    <section aria-labelledby="team-members-title">
      <Subtitle2 as="h3" id="team-members-title" className={styles.sectionTitle}>
        Members ({team.members.length})
      </Subtitle2>
      {canManage && canReadUsers && (
        <Field label="Add member">
          <Combobox
            placeholder="Search people by name or email"
            freeform
            value={search}
            selectedOptions={[]}
            disabled={busy}
            onChange={(e) => setSearch(e.target.value)}
            onOptionSelect={(_, d) => {
              if (!d.optionValue) return;
              const user = options.find((u) => u.id === d.optionValue);
              setSearch("");
              setMember.mutate(
                { userId: d.optionValue, isLead: false },
                { onSuccess: () => toast.success(`Added ${user?.name || user?.email || "member"} to ${team.name}`) },
              );
            }}
          >
            {options.map((u) => (
              <Option key={u.id} value={u.id} text={u.name || u.email}>
                {u.name ? `${u.name} (${u.email})` : u.email}
              </Option>
            ))}
            {candidates.isSuccess && options.length === 0 && (
              <Option value="" disabled text="">
                No matching people
              </Option>
            )}
          </Combobox>
        </Field>
      )}
      {team.members.length === 0 ? (
        <Text className={styles.muted}>This team has no members yet.</Text>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {team.members.map((m) => (
            <li key={m.user_id} className={local.member}>
              <Avatar name={m.name} size={32} color="colorful" aria-hidden />
              <span className={local.memberName}>
                <Text className={styles.truncate}>
                  {m.name}
                  {m.is_active === false && " (deactivated)"}
                </Text>
                {m.email && (
                  <Text size={200} className={mergeClasses(styles.muted, styles.truncate)}>
                    {m.email}
                  </Text>
                )}
              </span>
              <Switch
                label="Lead"
                checked={m.is_lead}
                disabled={!canManage || busy}
                onChange={(_, d) =>
                  setMember.mutate(
                    { userId: m.user_id, isLead: d.checked },
                    {
                      onSuccess: () =>
                        toast.success(d.checked ? `${m.name} is now a team lead` : `${m.name} is no longer a team lead`),
                    },
                  )
                }
              />
              {canManage && (
                <Button
                  appearance="subtle"
                  icon={<Dismiss20Regular />}
                  aria-label={`Remove ${m.name}`}
                  disabled={busy}
                  onClick={() => removeMember.mutate(m)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
