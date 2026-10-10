"use client";

import {
  Avatar,
  Body1,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  makeStyles,
  Spinner,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Dismiss20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { adminApi, adminKeys, LOOKUP_PAGE_SIZE } from "@/features/admin/api";
import { shortId } from "@/features/admin/audit-format";
import { EMPTY_USER_FILTERS } from "@/features/admin/query";
import { ErrorBar, IdMultiSelect } from "@/features/admin/ui";
import { useTeamLookup } from "@/features/admin/use-admin-data";
import { UserPicker, userLabel } from "@/features/admin/user-picker";
import { usePermission } from "@/features/auth/use-permission";
import type { CandidateListOut } from "@/lib/api/types";
import { candidateKeys, candidatesApi } from "./api";
import { candidateErrorMessage } from "./errors";
import { useCandidateMutation } from "./use-candidates";

const useStyles = makeStyles({
  people: { listStyle: "none", margin: 0, padding: 0 },
  person: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    paddingBlock: tokens.spacingVerticalXS,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  grow: { flex: 1 },
  content: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
});

/** Share a list with people (search) and teams (multi-select). Only the owner can share. */
export function ShareListDialog({ list, onClose }: { list: CandidateListOut; onClose: () => void }) {
  const styles = useStyles();
  const canReadUsers = usePermission("user:read");
  const canReadTeams = usePermission("team:read");
  const [userIds, setUserIds] = useState<string[]>(list.shared_user_ids);
  const [teamIds, setTeamIds] = useState<string[]>(list.shared_team_ids);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // Names for already-shared people come from one page of users (ids without a match show shortened).
  const users = useQuery({
    queryKey: adminKeys.userList(EMPTY_USER_FILTERS, 1, LOOKUP_PAGE_SIZE),
    queryFn: ({ signal }) => adminApi.listUsers(EMPTY_USER_FILTERS, 1, LOOKUP_PAGE_SIZE, signal),
    enabled: canReadUsers,
    staleTime: 60_000,
  });
  const teams = useTeamLookup(canReadTeams);
  const known = new Map((users.data?.items ?? []).map((u) => [u.id, userLabel(u)]));
  const nameOf = (id: string) => names[id] ?? known.get(id) ?? shortId(id);

  const save = useCandidateMutation({
    mutationFn: () => candidatesApi.shareList(list.id, { user_ids: userIds, team_ids: teamIds }),
    invalidate: [candidateKeys.savedLists],
    success: (l) => `Sharing updated for ${l.name}`,
  });

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !save.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Share “{list.name}”</DialogTitle>
          <DialogContent className={styles.content}>
            <ErrorBar message={error} />
            <Body1>People and team members you share with can see the list and add or remove candidates. Only you can rename, share or delete it.</Body1>
            {canReadUsers ? (
              <UserPicker
                label="Add people"
                value={null}
                excludeIds={userIds}
                onChange={(id, user) => {
                  if (!id || !user) return;
                  setNames((n) => ({ ...n, [id]: userLabel(user) }));
                  setUserIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
                }}
              />
            ) : (
              <Text>You need permission to view users to share with people.</Text>
            )}
            {userIds.length > 0 && (
              <ul className={styles.people} aria-label="Shared with people">
                {userIds.map((id) => (
                  <li key={id} className={styles.person}>
                    <Avatar name={nameOf(id)} size={24} aria-hidden />
                    <span className={styles.grow}>{nameOf(id)}</span>
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={<Dismiss20Regular />}
                      aria-label={`Stop sharing with ${nameOf(id)}`}
                      onClick={() => setUserIds((ids) => ids.filter((x) => x !== id))}
                    />
                  </li>
                ))}
              </ul>
            )}
            {canReadTeams ? (
              <IdMultiSelect
                label="Teams"
                placeholder="No teams"
                options={(teams.data?.items ?? []).map((t) => ({ id: t.id, label: t.name }))}
                value={teamIds}
                onChange={setTeamIds}
              />
            ) : (
              teamIds.length > 0 && <Text>Shared with {teamIds.length} team(s).</Text>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={save.isPending}
              icon={save.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={async () => {
                setError(null);
                try {
                  await save.mutateAsync(undefined);
                  onClose();
                } catch (e) {
                  setError(candidateErrorMessage(e));
                }
              }}
            >
              Save
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
