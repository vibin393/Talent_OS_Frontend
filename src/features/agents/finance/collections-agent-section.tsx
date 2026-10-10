"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Link,
  makeStyles,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Subtitle2,
  Switch,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { MoreHorizontal20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AiBadge } from "@/components/ai/ai-badge";
import { ErrorBar, formatDateTime } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { financeAgentApi, financeAgentKeys, type HoldIn } from "./api";
import { agentStateLabel, clientHold, invoiceHold, planLine, sendClassLabel, takeoverMessage } from "./logic";

const useStyles = makeStyles({
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, paddingBlock: tokens.spacingVerticalS },
  row: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "center", flexWrap: "wrap" },
  muted: { color: tokens.colorNeutralForeground3 },
  list: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
});

function useInvalidate(clientId: string) {
  const qc = useQueryClient();
  return () => {
    for (const key of [financeAgentKeys.state(clientId), financeAgentKeys.plan(clientId), financeAgentKeys.clientLog(clientId)]) {
      void qc.invalidateQueries({ queryKey: key });
    }
  };
}

/** "Collections agent" (Epic 63) in the Client collections dialog: pause / take over / hand back, what the agent will
 * do today and the agent timeline. `receivables:read` to see it, `collections:write` to act. */
export function CollectionsAgentSection({
  clientId,
  clientName,
  invoiceId,
  invoiceNumber,
}: {
  clientId: string;
  clientName: string;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
}) {
  const styles = useStyles();
  const canRead = usePermission("receivables:read");
  const canWrite = usePermission("collections:write");
  const invalidate = useInvalidate(clientId);
  const [asking, setAsking] = useState<HoldIn | null>(null);
  const [reason, setReason] = useState("");
  const state = useQuery({ queryKey: financeAgentKeys.state(clientId), queryFn: ({ signal }) => financeAgentApi.state(clientId, signal), enabled: canRead });
  const plan = useQuery({ queryKey: financeAgentKeys.plan(clientId), queryFn: ({ signal }) => financeAgentApi.plan(clientId, signal), enabled: canRead });
  const log = useQuery({ queryKey: financeAgentKeys.clientLog(clientId), queryFn: ({ signal }) => financeAgentApi.clientLog(clientId, signal), enabled: canRead });
  const hold = useMutation({
    mutationFn: (body: HoldIn) => financeAgentApi.hold(body),
    onSuccess: () => {
      setAsking(null);
      setReason("");
      invalidate();
    },
  });
  const release = useMutation({ mutationFn: (id: string) => financeAgentApi.release(id), onSuccess: invalidate });
  if (!canRead) return null;
  const paused = clientHold(state.data);
  const taken = invoiceId ? invoiceHold(state.data, invoiceId) : null;
  const error = state.isError ? state.error : plan.isError ? plan.error : hold.isError ? hold.error : release.isError ? release.error : null;
  return (
    <section className={styles.section} aria-label="Collections agent">
      <Subtitle2 as="h3">
        Collections agent <AiBadge agentName="Collections Agent" />
      </Subtitle2>
      <ErrorBar message={error ? errorMessage(error) : null} />
      <div className={styles.row}>
        <Switch
          label="Pause collections agent for this client"
          checked={Boolean(paused)}
          disabled={!canWrite || hold.isPending || release.isPending}
          onChange={(_, d) => (d.checked ? setAsking({ client_id: clientId, mode: "paused" }) : paused && release.mutate(paused.id))}
        />
        <Badge appearance="tint" color={state.data?.state === "active" ? "success" : "warning"}>
          {agentStateLabel(state.data?.state)}
        </Badge>
        {invoiceId && canWrite && (
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button appearance="subtle" icon={<MoreHorizontal20Regular />} aria-label={`Agent actions for ${invoiceNumber ?? "this invoice"}`} />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem disabled={Boolean(taken)} onClick={() => setAsking({ client_id: clientId, document_kind: "invoice", document_id: invoiceId, mode: "paused" })}>
                  Pause agent for this invoice
                </MenuItem>
                <MenuItem disabled={Boolean(taken)} onClick={() => setAsking({ client_id: clientId, document_kind: "invoice", document_id: invoiceId, mode: "takeover" })}>
                  Take over this thread
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        )}
      </div>
      {taken?.mode === "takeover" && (
        <MessageBar intent="info">
          <MessageBarBody>{takeoverMessage(clientName, invoiceNumber ?? "this invoice")}</MessageBarBody>
          <MessageBarActions>
            <Button size="small" disabled={!canWrite || release.isPending} onClick={() => release.mutate(taken.id)}>
              Hand back to agent
            </Button>
          </MessageBarActions>
        </MessageBar>
      )}
      <Body1>What the agent will do today</Body1>
      <div className={styles.list}>
        {plan.isSuccess && plan.data.items.length === 0 && <Caption1 className={styles.muted}>Nothing is due today.</Caption1>}
        {(plan.data?.items ?? []).map((item) => (
          <div key={item.step_id} className={styles.row}>
            <Caption1>{planLine(item)}</Caption1>
            <Badge appearance="outline" color={item.send_class === "pre_due_auto_eligible" ? "brand" : "informative"}>
              {sendClassLabel(item)}
            </Badge>
          </div>
        ))}
      </div>
      <Link href="/settings/collection-rules">
        Edit collection rule
      </Link>
      <div className={styles.list} aria-label="Agent timeline">
        {(log.data ?? []).map((entry) => (
          <Caption1 key={entry.id}>
            {formatDateTime(entry.at)} · {entry.label}
          </Caption1>
        ))}
      </div>
      <Dialog open={asking !== null} onOpenChange={(_, d) => !d.open && setAsking(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{asking?.mode === "takeover" ? "Take over this thread" : "Pause collections agent"}</DialogTitle>
            <DialogContent>
              <Field label="Reason" required>
                <Textarea value={reason} onChange={(_, d) => setReason(d.value)} maxLength={500} />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setAsking(null)}>Cancel</Button>
              <Button appearance="primary" disabled={!reason.trim() || hold.isPending} onClick={() => asking && hold.mutate({ ...asking, reason })}>
                {asking?.mode === "takeover" ? "Take over" : "Pause"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </section>
  );
}

/** Queue grid "Agent" column cell: Active / Paused / Taken over for the row's Client and document. */
export function AgentStateCell({ clientId, documentId }: { clientId: string; documentId: string }) {
  const canRead = usePermission("receivables:read");
  const state = useQuery({ queryKey: financeAgentKeys.state(clientId), queryFn: ({ signal }) => financeAgentApi.state(clientId, signal), enabled: canRead });
  if (!state.data) return null;
  const label = clientHold(state.data) ? "Paused" : invoiceHold(state.data, documentId)?.mode === "takeover" ? "Taken over" : invoiceHold(state.data, documentId) ? "Paused" : "Active";
  return <>{label}</>;
}
