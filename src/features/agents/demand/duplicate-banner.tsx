"use client";

import {
  Body1,
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  makeStyles,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  MessageBarTitle,
  Subtitle2,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { usePermission } from "@/features/auth/use-permission";
import { useDemand } from "@/features/demands/use-demand";
import { errorMessage } from "@/lib/api/errors";
import { demandAgentApi, demandAgentKeys } from "./api";
import { duplicateBannerText, LINKED_MESSAGE, openDuplicateFlags } from "./logic";
import type { DemandFlag, FlagResolution } from "./types";

const useStyles = makeStyles({
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, marginBottom: tokens.spacingVerticalM },
  compare: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.spacingHorizontalL },
  col: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
});

/** "Possible duplicate" banner under the Demand header (one per open duplicate flag). A flag never blocks or merges. */
export function DuplicateBanner({ demandId }: { demandId: string }) {
  const canRead = usePermission("demand:read");
  const styles = useStyles();
  const query = useQuery({
    queryKey: demandAgentKeys.insights(demandId),
    queryFn: ({ signal }) => demandAgentApi.insights(demandId, signal),
    enabled: canRead,
    retry: false,
  });
  const [linked, setLinked] = useState(false);
  const flags = openDuplicateFlags(query.data?.flags ?? []);
  if (!linked && flags.length === 0) return null;
  return (
    <div className={styles.stack}>
      {linked && (
        <MessageBar intent="success">
          <MessageBarBody>{LINKED_MESSAGE}</MessageBarBody>
        </MessageBar>
      )}
      {flags.map((f) => (
        <FlagBar key={f.id} demandId={demandId} flag={f} onLinked={() => setLinked(true)} />
      ))}
    </div>
  );
}

export function FlagBar({ demandId, flag, onLinked }: { demandId: string; flag: DemandFlag; onLinked: () => void }) {
  const toast = useAppToast();
  const qc = useQueryClient();
  const canUpdate = usePermission("demand:update");
  const [comparing, setComparing] = useState(false);
  const resolve = useMutation({
    mutationFn: (resolution: FlagResolution) => demandAgentApi.resolveFlag(flag.id, resolution),
    onSuccess: (_, resolution) => {
      if (resolution === "linked_duplicate") onLinked();
      void qc.invalidateQueries({ queryKey: demandAgentKeys.insights(demandId) });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const visible = flag.related?.related_visible === true;
  return (
    <MessageBar intent="warning" layout="multiline">
      <MessageBarBody>
        <MessageBarTitle>Possible duplicate</MessageBarTitle>
        {duplicateBannerText(flag)}
      </MessageBarBody>
      <MessageBarActions>
        {visible && <Button onClick={() => setComparing(true)}>Compare</Button>}
        {canUpdate && (
          <>
            <Button disabled={resolve.isPending} onClick={() => resolve.mutate("linked_duplicate")}>
              Link as duplicate
            </Button>
            <Button disabled={resolve.isPending} onClick={() => resolve.mutate("distinct")}>
              Mark as distinct
            </Button>
            <Button disabled={resolve.isPending} onClick={() => resolve.mutate("dismissed")}>
              Dismiss
            </Button>
          </>
        )}
      </MessageBarActions>
      {comparing && flag.related?.demand_id && (
        <CompareDialog leftId={demandId} rightId={flag.related.demand_id} onClose={() => setComparing(false)} />
      )}
    </MessageBar>
  );
}

const COMPARE_FIELDS: [string, string][] = [
  ["title", "Title"],
  ["status", "Status"],
  ["location", "Location"],
  ["work_mode", "Work mode"],
  ["positions", "Positions"],
  ["start_date", "Start date"],
];

function DemandColumn({ id }: { id: string }) {
  const styles = useStyles();
  const query = useDemand(id);
  const d = query.data as unknown as Record<string, unknown> | undefined;
  if (!d) return <Caption1>Loading…</Caption1>;
  const skills = ((d.skills as { label: string }[] | undefined) ?? []).map((s) => s.label).join(", ");
  return (
    <div className={styles.col}>
      <Subtitle2>{String(d.req_id ?? "")}</Subtitle2>
      {COMPARE_FIELDS.map(([key, label]) => (
        <Body1 key={key}>
          {label}: {d[key] == null ? "—" : String(d[key])}
        </Body1>
      ))}
      <Body1>Skills: {skills || "—"}</Body1>
    </div>
  );
}

function CompareDialog({ leftId, rightId, onClose }: { leftId: string; rightId: string; onClose: () => void }) {
  const styles = useStyles();
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Compare demands</DialogTitle>
          <DialogContent className={styles.compare}>
            <DemandColumn id={leftId} />
            <DemandColumn id={rightId} />
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Close</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
