"use client";

import {
  Badge,
  Button,
  Caption1,
  Checkbox,
  Dropdown,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, formatDateTime, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { complianceAgentApi, complianceAgentKeys } from "./api";
import { portalSeen, runStartedMessage } from "./logic";

const useStyles = makeStyles({
  filters: { display: "flex", gap: tokens.spacingHorizontalL, alignItems: "flex-end", flexWrap: "wrap", marginBottom: tokens.spacingVerticalM },
  wrap: { overflowX: "auto" },
  empty: { padding: tokens.spacingVerticalXXL, color: tokens.colorNeutralForeground3 },
  items: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
});

const WINDOWS = ["7", "14", "30"] as const;

export function PreStartRisk() {
  const styles = useStyles();
  const canRead = usePermission("compliance:read");
  const canRun = usePermission("compliance:read");
  const [days, setDays] = useState<string>("14");
  const [clientId, setClientId] = useState<string>("");
  const [escalatedOnly, setEscalatedOnly] = useState(false);
  const [notice, setNotice] = useState<{ intent: "success" | "warning"; text: string } | null>(null);
  const query = { days: Number(days), clientId: clientId || null, escalatedOnly };
  const q = useQuery({
    queryKey: complianceAgentKeys.risk(query),
    queryFn: ({ signal }) => complianceAgentApi.risk(query, signal),
    enabled: canRead,
  });
  const chase = useMutation({
    mutationFn: (candidateId: string) => complianceAgentApi.chaseNow(candidateId),
    onSuccess: (ref) => setNotice(runStartedMessage(ref, "Compliance Agent")),
  });
  const clients = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of q.data?.rows ?? []) m.set(r.client_id, r.client_name ?? "Client");
    return [...m.entries()];
  }, [q.data]);
  if (!canRead) return <NoAccess what="the pre-start compliance risk list" />;
  const rows = q.data?.rows ?? [];
  return (
    <div>
      <PageHeader
        title="Pre-start compliance risk"
        subtitle="Workers starting soon with missing items, and what the Compliance Agent has done."
      />
      <div className={styles.filters}>
        <Field label="Starting within">
          <Dropdown value={`${days} days`} selectedOptions={[days]} onOptionSelect={(_, d) => setDays(String(d.optionValue))}>
            {WINDOWS.map((w) => (
              <Option key={w} value={w}>{`${w} days`}</Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Client">
          <Dropdown
            value={clients.find(([id]) => id === clientId)?.[1] ?? "All clients"}
            selectedOptions={[clientId]}
            onOptionSelect={(_, d) => setClientId(String(d.optionValue ?? ""))}
          >
            <Option value="">All clients</Option>
            {clients.map(([id, name]) => (
              <Option key={id} value={id}>
                {name}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Checkbox label="Escalated only" checked={escalatedOnly} onChange={(_, d) => setEscalatedOnly(Boolean(d.checked))} />
      </div>
      {notice && (
        <MessageBar intent={notice.intent}>
          <MessageBarBody>{notice.text}</MessageBarBody>
        </MessageBar>
      )}
      <ErrorBar message={chase.isError ? errorMessage(chase.error) : null} />
      {q.isPending && <GridSkeleton />}
      {q.isError && <ErrorBar message={errorMessage(q.error)} />}
      {q.isSuccess && rows.length === 0 && <div className={styles.empty}>No Workers at risk in this window.</div>}
      {rows.length > 0 && (
        <div className={styles.wrap}>
          <Table aria-label="Pre-start compliance risk" size="small">
            <TableHeader>
              <TableRow>
                {["Worker", "Client", "Start date", "Missing items", "Last contact", "Portal last seen", "Chases sent", "Escalation", "BGV", ""].map((h) => (
                  <TableHeaderCell key={h || "actions"}>{h}</TableHeaderCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const seen = portalSeen(r);
                return (
                  <TableRow key={r.placement_id}>
                    <TableCell>
                      <AppLink href={`/placements/${r.placement_id}`}>{r.worker_name}</AppLink>
                    </TableCell>
                    <TableCell>{r.client_name ?? "—"}</TableCell>
                    <TableCell>
                      {r.start_date}
                      <Caption1> ({r.days_to_start} days)</Caption1>
                    </TableCell>
                    <TableCell>
                      <div className={styles.items}>
                        {r.missing_items.map((m) => (
                          <Badge key={m.label} appearance="tint" color={m.status === "expired" ? "danger" : "warning"}>
                            {m.label}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{formatDateTime(r.last_contact)}</TableCell>
                    <TableCell>{seen.warn ? <Badge color="warning">Never</Badge> : seen.text}</TableCell>
                    <TableCell>{r.chases_sent}</TableCell>
                    <TableCell>{r.escalated ? <Badge color="danger" appearance="tint">Escalated</Badge> : "—"}</TableCell>
                    <TableCell>{r.bgv_status ?? "—"}</TableCell>
                    <TableCell>
                      {canRun && (
                        <Button size="small" disabled={chase.isPending} onClick={() => chase.mutate(r.candidate_id)}>
                          Chase now
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
