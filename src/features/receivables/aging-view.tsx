"use client";

import {
  Button,
  Field,
  Input,
  Link,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
} from "@fluentui/react-components";
import { ArrowDownload20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { hasAnyPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { receivablesApi, receivablesKeys } from "./api";
import { Amount, LegalEntitySelect, ReceivablesTabs, useRcvStyles } from "./components";
import { bucketLabel, todayIso } from "./logic";
import type { AgingRow } from "./types";

function monthStart(iso: string): string {
  return `${iso.slice(0, 8)}01`;
}

function rowLink(r: AgingRow): string | null {
  if (r.document_id) return `/billing/${r.document_kind === "debit_note" ? "debit-notes" : "invoices"}/${r.document_id}`;
  if (r.client_id) return `/clients/${r.client_id}`;
  return null;
}

/** AR aging (`/receivables/aging`): as-of date, Legal Entity / Client / Document grouping, buckets plus Disputed
 * and Unallocated columns, a DSO tile with a period picker and CSV / XLSX export. */
export function AgingView() {
  const s = useRcvStyles();
  const perms = usePermissions();
  const allowed = hasAnyPermission(perms, ["receivables:read"]);
  const [le, setLe] = useState<string | null>(null);
  const [asOf, setAsOf] = useState(todayIso());
  const [groupBy, setGroupBy] = useState<"entity" | "client" | "document">("client");
  const [dsoStart, setDsoStart] = useState(monthStart(todayIso()));
  const [dsoEnd, setDsoEnd] = useState(todayIso());
  const q = useQuery({
    queryKey: receivablesKeys.aging(le ?? "", asOf, groupBy),
    queryFn: ({ signal }) => receivablesApi.aging(le!, asOf, groupBy, signal),
    enabled: allowed && !!le && !!asOf,
  });
  const dso = useQuery({
    queryKey: receivablesKeys.dso(le ?? "", dsoStart, dsoEnd),
    queryFn: ({ signal }) => receivablesApi.dso(le!, dsoStart, dsoEnd, signal),
    enabled: allowed && !!le && !!dsoStart && !!dsoEnd,
  });
  if (!allowed) return <NoAccess what="receivables" />;
  const data = q.data;
  return (
    <div className={s.page}>
      <PageHeader title="AR aging" subtitle="Reproducible as of any date from posted facts" />
      <ReceivablesTabs />
      <div className={s.row}>
        <LegalEntitySelect value={le} onChange={setLe} />
        <Field label="As of">
          <Input type="date" value={asOf} onChange={(_, d) => setAsOf(d.value)} />
        </Field>
        <Field label="Group by">
          <RadioGroup layout="horizontal" value={groupBy} onChange={(_, d) => setGroupBy(d.value as typeof groupBy)}>
            <Radio value="entity" label="Legal entity" />
            <Radio value="client" label="Client" />
            <Radio value="document" label="Document" />
          </RadioGroup>
        </Field>
        {le && (
          <>
            <Button as="a" href={receivablesApi.agingExportUrl(le, asOf, groupBy, "csv")} icon={<ArrowDownload20Regular />}>
              CSV
            </Button>
            <Button as="a" href={receivablesApi.agingExportUrl(le, asOf, groupBy, "xlsx")} icon={<ArrowDownload20Regular />}>
              XLSX
            </Button>
          </>
        )}
      </div>
      <div className={s.tiles}>
        <div className={s.tile}>
          <Text className={s.muted}>Total open (INR)</Text>
          <span className={s.tileValue}>
            <Amount amount={data?.totals_inr.total ?? "0.00"} currency="INR" />
          </span>
        </div>
        <div className={s.tile}>
          <Text className={s.muted}>DSO (days)</Text>
          <span className={s.tileValue}>{dso.data ? (dso.data.dso ?? "n/a") : "-"}</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
            <Input aria-label="DSO from" type="date" size="small" value={dsoStart} onChange={(_, d) => setDsoStart(d.value)} style={{ width: "100%" }} />
            <Input aria-label="DSO to" type="date" size="small" value={dsoEnd} onChange={(_, d) => setDsoEnd(d.value)} style={{ width: "100%" }} />
          </div>
        </div>
      </div>
      <ErrorBar message={q.error ? errorMessage(q.error) : null} />
      {!data ? (
        <GridSkeleton />
      ) : data.rows.length === 0 ? (
        <Text className={s.muted}>Nothing open as of {data.as_of}.</Text>
      ) : (
        <div className={s.scroll}>
          <Table size="small" aria-label="Aging">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>{groupBy === "document" ? "Document" : groupBy === "client" ? "Client" : "Entity"}</TableHeaderCell>
                <TableHeaderCell>Ccy</TableHeaderCell>
                {data.bucket_labels.map((b) => (
                  <TableHeaderCell key={b}>{bucketLabel(b)}</TableHeaderCell>
                ))}
                <TableHeaderCell>Total</TableHeaderCell>
                <TableHeaderCell>Total INR</TableHeaderCell>
                <TableHeaderCell>Disputed</TableHeaderCell>
                <TableHeaderCell>Unallocated</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => {
                const href = rowLink(r);
                return (
                  <TableRow key={`${r.key}-${r.currency}`}>
                    <TableCell>
                      {href ? (
                        <Link href={href}>{r.label}</Link>
                      ) : (
                        r.label
                      )}
                    </TableCell>
                    <TableCell>{r.currency}</TableCell>
                    {data.bucket_labels.map((b) => (
                      <TableCell key={b}>
                        <Amount amount={r.buckets[b]} currency={r.currency} />
                      </TableCell>
                    ))}
                    <TableCell>
                      <Amount amount={r.total_open} currency={r.currency} strong />
                    </TableCell>
                    <TableCell>
                      <Amount amount={r.total_open_inr} currency="INR" />
                    </TableCell>
                    <TableCell>
                      <Amount amount={r.disputed} currency={r.currency} />
                    </TableCell>
                    <TableCell>
                      <Amount amount={r.unallocated_credit} currency={r.currency} />
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
