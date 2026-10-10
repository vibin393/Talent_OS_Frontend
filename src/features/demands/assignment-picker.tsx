"use client";

import {
  Avatar,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  makeStyles,
  Radio,
  RadioGroup,
  Spinner,
  Tag,
  TagPicker,
  TagPickerControl,
  TagPickerGroup,
  TagPickerInput,
  TagPickerList,
  TagPickerOption,
  Text,
  tokens,
} from "@fluentui/react-components";
import { PeopleTeam20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { usePeopleSearch } from "@/features/activity/people";
import { adminApi, adminKeys, LOOKUP_PAGE_SIZE } from "@/features/admin/api";
import { ErrorBar } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import type { AssignmentOut } from "@/lib/api/types";
import { demandErrorMessage } from "./errors";
import { useSetAssignments } from "./use-assignments";

const useStyles = makeStyles({
  content: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  muted: { color: tokens.colorNeutralForeground3 },
});

type Named = { id: string; name: string };
const NONE = "__none__";

function toMap(items: readonly Named[]): Map<string, string> {
  return new Map(items.map((i) => [i.id, i.name]));
}

/**
 * Assign recruiters: users and teams (`TagPicker`s) plus the primary recruiter (`RadioGroup` over the
 * selected users). Saving replaces the demand's active assignments.
 */
export function AssignmentPicker({
  demandId,
  current,
  onClose,
}: {
  demandId: string;
  current: readonly AssignmentOut[];
  onClose: () => void;
}) {
  const styles = useStyles();
  const canTeams = usePermission("team:read");
  const save = useSetAssignments(demandId);
  const [users, setUsers] = useState<Named[]>(() =>
    current.filter((a) => a.user_id).map((a) => ({ id: a.user_id!, name: a.name ?? "Unknown user" })),
  );
  const [teams, setTeams] = useState<Named[]>(() =>
    current.filter((a) => a.team_id).map((a) => ({ id: a.team_id!, name: a.name ?? "Unknown team" })),
  );
  const [primary, setPrimary] = useState<string | null>(() => current.find((a) => a.is_primary)?.user_id ?? null);
  const [userQuery, setUserQuery] = useState("");
  const [teamQuery, setTeamQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const deferredUserQuery = useDeferredValue(userQuery);
  const people = usePeopleSearch(deferredUserQuery, true);
  const teamList = useQuery({
    queryKey: [...adminKeys.teams, "list", 1, LOOKUP_PAGE_SIZE],
    queryFn: ({ signal }) => adminApi.listTeams(1, LOOKUP_PAGE_SIZE, signal),
    enabled: canTeams,
    staleTime: 60_000,
  });

  const userNames = toMap(users);
  const teamNames = toMap(teams);
  const userOptions = people.people.filter((p) => !userNames.has(p.id));
  const teamOptions = (teamList.data?.items ?? [])
    .filter((t) => !teamNames.has(t.id) && t.name.toLowerCase().includes(teamQuery.trim().toLowerCase()))
    .slice(0, 20);

  const submit = async () => {
    setError(null);
    try {
      await save.mutateAsync({
        user_ids: users.map((u) => u.id),
        team_ids: teams.map((t) => t.id),
        primary_user_id: primary && userNames.has(primary) ? primary : null,
      });
      onClose();
    } catch (e) {
      setError(demandErrorMessage(e));
    }
  };

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !save.isPending && onClose()}>
      <DialogSurface style={{ maxWidth: 640 }}>
        <DialogBody>
          <DialogTitle>Assign recruiters</DialogTitle>
          <DialogContent className={styles.content}>
            <ErrorBar message={error} />
            <Field label="Recruiters" hint={!people.available ? "You cannot browse people in this workspace." : undefined}>
              <TagPicker
                disabled={!people.available}
                selectedOptions={users.map((u) => u.id)}
                onOptionSelect={(_, d) => {
                  if (d.value === NONE) return;
                  const ids = d.selectedOptions;
                  const found = people.people.find((p) => p.id === d.value);
                  const next = ids.map((id) => ({ id, name: userNames.get(id) ?? found?.name ?? "Unknown user" }));
                  setUsers(next);
                  if (primary && !ids.includes(primary)) setPrimary(null);
                  if (!primary && next.length === 1) setPrimary(next[0].id);
                  setUserQuery("");
                }}
              >
                <TagPickerControl>
                  <TagPickerGroup aria-label="Selected recruiters">
                    {users.map((u) => (
                      <Tag key={u.id} shape="circular" value={u.id} media={<Avatar name={u.name} size={20} color="colorful" aria-hidden />}>
                        {u.name}
                      </Tag>
                    ))}
                  </TagPickerGroup>
                  <TagPickerInput aria-label="Search recruiters" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} />
                </TagPickerControl>
                <TagPickerList>
                  {userOptions.length > 0 ? (
                    userOptions.map((p) => (
                      <TagPickerOption
                        key={p.id}
                        value={p.id}
                        text={p.name}
                        secondaryContent={p.secondary ?? undefined}
                        media={<Avatar name={p.name} size={24} color="colorful" aria-hidden />}
                      >
                        {p.name}
                      </TagPickerOption>
                    ))
                  ) : (
                    <TagPickerOption value={NONE} text="">
                      {people.loading ? "Searching…" : "No matching people"}
                    </TagPickerOption>
                  )}
                </TagPickerList>
              </TagPicker>
            </Field>

            <Field label="Teams" hint={!canTeams ? "You cannot browse teams." : "Every member of the team sees the demand."}>
              <TagPicker
                disabled={!canTeams}
                selectedOptions={teams.map((t) => t.id)}
                onOptionSelect={(_, d) => {
                  if (d.value === NONE) return;
                  const found = teamList.data?.items.find((t) => t.id === d.value);
                  setTeams(d.selectedOptions.map((id) => ({ id, name: teamNames.get(id) ?? found?.name ?? "Unknown team" })));
                  setTeamQuery("");
                }}
              >
                <TagPickerControl>
                  <TagPickerGroup aria-label="Selected teams">
                    {teams.map((t) => (
                      <Tag key={t.id} value={t.id} media={<PeopleTeam20Regular aria-hidden />}>
                        {t.name}
                      </Tag>
                    ))}
                  </TagPickerGroup>
                  <TagPickerInput aria-label="Search teams" value={teamQuery} onChange={(e) => setTeamQuery(e.target.value)} />
                </TagPickerControl>
                <TagPickerList>
                  {teamOptions.length > 0 ? (
                    teamOptions.map((t) => (
                      <TagPickerOption key={t.id} value={t.id} text={t.name} media={<PeopleTeam20Regular aria-hidden />}>
                        {t.name}
                      </TagPickerOption>
                    ))
                  ) : (
                    <TagPickerOption value={NONE} text="">
                      No matching teams
                    </TagPickerOption>
                  )}
                </TagPickerList>
              </TagPicker>
            </Field>

            <Field label="Primary recruiter" hint="The primary recruiter owns the demand's SLA milestones.">
              {users.length === 0 ? (
                <Text size={200} className={styles.muted}>
                  Add a recruiter to choose the primary one.
                </Text>
              ) : (
                <RadioGroup value={primary ?? ""} onChange={(_, d) => setPrimary(d.value || null)}>
                  {users.map((u) => (
                    <Radio key={u.id} value={u.id} label={u.name} />
                  ))}
                  <Radio value="" label="No primary yet" />
                </RadioGroup>
              )}
            </Field>
          </DialogContent>
          <DialogActions>
            <Button
              appearance="primary"
              disabled={save.isPending}
              icon={save.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={submit}
            >
              Save
            </Button>
            <Button appearance="secondary" disabled={save.isPending} onClick={onClose}>
              Cancel
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
