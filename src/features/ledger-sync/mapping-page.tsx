"use client";

import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Button,
  Caption1,
  Combobox,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useAppToast } from "@/components/toast";
import { legalEntitiesApi, legalEntityKeys } from "@/features/legal-entities/api";
import { errorMessage } from "@/lib/api/errors";
import { type LedgerMappingIn, type MappingKind, ledgerApi, ledgerKeys } from "./api";
import { GST_OUTPUT_ROWS } from "./logic";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  header: { display: "flex", gap: tokens.spacingHorizontalM, alignItems: "end", flexWrap: "wrap" },
  row: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap", alignItems: "center" },
  wrap: { overflowX: "auto" },
});

type Cell = { ref: string; label: string };

/** Ledger mapping for one installation × Legal Entity: revenue, GST, TDS, round-off, banks, customers, items. */
export function LedgerMappingPage({ installationId, connectorKey, legalEntityIds }: { installationId: string; connectorKey: string; legalEntityIds: string[] }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const isZoho = connectorKey === "zoho_books";
  const [le, setLe] = useState<string | null>(legalEntityIds[0] ?? null);
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [masters, setMasters] = useState<Record<string, string>>({});

  const les = useQuery({ queryKey: legalEntityKeys.list, queryFn: ({ signal }) => legalEntitiesApi.list(signal) });
  const leName = useMemo(() => (les.data ?? []).find((e) => e.id === le)?.name ?? "", [les.data, le]);
  const q = useQuery({
    queryKey: ledgerKeys.mappings(installationId, le ?? ""),
    queryFn: ({ signal }) => ledgerApi.mappings(installationId, le!, signal),
    enabled: !!le,
  });

  useEffect(() => {
    if (!q.data) return;
    const next: Record<string, Cell> = {};
    for (const m of q.data.items) next[`${m.kind}:${m.key}`] = { ref: m.external_ref, label: m.external_label ?? "" };
    setCells(next);
  }, [q.data]);

  const loadMasters = useMutation({
    mutationFn: () => ledgerApi.loadMasters(installationId, le!),
    onSuccess: (d) => {
      setMasters(d.options);
      toast.success("Loaded ledgers from Zoho Books.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const save = useMutation({
    mutationFn: () => {
      const items: LedgerMappingIn[] = Object.entries(cells)
        .filter(([, c]) => c.ref.trim())
        .map(([k, c]) => {
          const [kind, ...rest] = k.split(":");
          return { kind: kind as MappingKind, key: rest.join(":"), external_ref: c.ref.trim(), external_label: c.label || null };
        });
      return ledgerApi.saveMappings(installationId, le!, items);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ledgerKeys.mappings(installationId, le ?? "") });
      toast.success("Mapping saved.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const setCell = (kind: MappingKind, key: string, patch: Partial<Cell>) =>
    setCells((prev) => {
      const base: Cell = prev[`${kind}:${key}`] ?? { ref: "", label: "" };
      return { ...prev, [`${kind}:${key}`]: { ...base, ...patch } };
    });

  // Helper functions return JSX inline (not components) so controlled inputs keep focus between keystrokes.
  const masterOptions = Object.entries(masters);
  const refInput = (kind: MappingKind, rowKey: string) => {
    const id = `${kind}:${rowKey}`;
    const cell = cells[id] ?? { ref: "", label: "" };
    if (isZoho && masterOptions.length) {
      return (
        <Combobox
          placeholder="Pick a ledger"
          freeform
          value={cell.label || cell.ref}
          onInput={(e) => setCell(kind, rowKey, { ref: (e.target as HTMLInputElement).value, label: "" })}
          onOptionSelect={(_, o) => setCell(kind, rowKey, { ref: o.optionValue ?? "", label: masters[o.optionValue ?? ""] ?? "" })}
        >
          {masterOptions.map(([ref, label]) => (
            <Option key={ref} value={ref}>
              {label}
            </Option>
          ))}
        </Combobox>
      );
    }
    return <Input size="small" placeholder={isZoho ? "Zoho account id" : "Tally ledger name"} value={cell.ref} onChange={(_, d) => setCell(kind, rowKey, { ref: d.value })} />;
  };

  const simpleRows = (kind: MappingKind, rows: { key: string; label: string }[]) => (
    <div className={styles.wrap}>
      <Table size="small" aria-label={kind}>
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Ledger</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key}>
              <TableCell>{r.label}</TableCell>
              <TableCell>{refInput(kind, r.key)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  if (les.isPending) return <Spinner label="Loading" />;
  const data = q.data;

  const revenueRows = [...(data?.categories ?? []).map((c) => ({ key: c, label: c })), { key: "*", label: "All other income" }];
  const customerRows = (data?.clients ?? []).map((c) => ({
    key: c.billing_profile_id ? `${c.id}:${c.billing_profile_id}` : c.id,
    label: c.billing_profile_name ? `${c.name} — ${c.billing_profile_name}` : c.name,
  }));
  const itemRows = [...(data?.sac_codes ?? []).map((s) => ({ key: s, label: s })), { key: "*", label: "All services" }];
  const bankRows = (data?.bank_accounts ?? []).map((b) => ({ key: b.id, label: b.name }));

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Subtitle2 as="h2">Ledger mapping — {leName}</Subtitle2>
        <Field label="Legal entity">
          <Dropdown value={leName} selectedOptions={le ? [le] : []} onOptionSelect={(_, d) => d.optionValue && setLe(d.optionValue)}>
            {legalEntityIds.map((id) => (
              <Option key={id} value={id}>
                {(les.data ?? []).find((e) => e.id === id)?.name ?? id}
              </Option>
            ))}
          </Dropdown>
        </Field>
      </div>
      {q.error ? (
        <MessageBar intent="error">
          <MessageBarBody>{errorMessage(q.error)}</MessageBarBody>
        </MessageBar>
      ) : null}
      {q.isPending && le ? <Spinner label="Loading mapping" /> : null}
      {data ? (
        <>
          <Accordion multiple collapsible defaultOpenItems={["revenue", "gst_output"]}>
            <AccordionItem value="revenue">
              <AccordionHeader>Revenue ledgers</AccordionHeader>
              <AccordionPanel>{simpleRows("revenue", revenueRows)}</AccordionPanel>
            </AccordionItem>
            <AccordionItem value="gst_output">
              <AccordionHeader>GST output ledgers</AccordionHeader>
              <AccordionPanel>{simpleRows("gst_output", GST_OUTPUT_ROWS)}</AccordionPanel>
            </AccordionItem>
            <AccordionItem value="tds_receivable">
              <AccordionHeader>TDS receivable</AccordionHeader>
              <AccordionPanel>{simpleRows("tds_receivable", [{ key: "*", label: "TDS receivable" }])}</AccordionPanel>
            </AccordionItem>
            <AccordionItem value="round_off">
              <AccordionHeader>Round-off</AccordionHeader>
              <AccordionPanel>{simpleRows("round_off", [{ key: "*", label: "Round-off" }])}</AccordionPanel>
            </AccordionItem>
            <AccordionItem value="bank_account">
              <AccordionHeader>Bank accounts</AccordionHeader>
              <AccordionPanel>{simpleRows("bank_account", bankRows)}</AccordionPanel>
            </AccordionItem>
            <AccordionItem value="customer">
              <AccordionHeader>Customers</AccordionHeader>
              <AccordionPanel>
                <Caption1>{isZoho ? "Customers missing here are created in Zoho Books on first sync." : "Enter the party ledger name exactly as in Tally."}</Caption1>
                {simpleRows("customer", customerRows)}
              </AccordionPanel>
            </AccordionItem>
            <AccordionItem value="item">
              <AccordionHeader>Services and items</AccordionHeader>
              <AccordionPanel>{simpleRows("item", itemRows)}</AccordionPanel>
            </AccordionItem>
            <AccordionItem value="discount">
              <AccordionHeader>Discount</AccordionHeader>
              <AccordionPanel>{simpleRows("discount", [{ key: "*", label: "Discount" }])}</AccordionPanel>
            </AccordionItem>
          </Accordion>
          <div className={styles.row}>
            {isZoho ? (
              <Button disabled={loadMasters.isPending || !le} onClick={() => loadMasters.mutate()}>
                Load from Zoho Books
              </Button>
            ) : null}
            <Button appearance="primary" disabled={!le || save.isPending} onClick={() => save.mutate()}>
              Save mapping
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
