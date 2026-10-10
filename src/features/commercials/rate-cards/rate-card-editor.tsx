"use client";

import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
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
  Title2,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, ArrowLeft20Regular, ArrowUpload20Regular, Copy20Regular, Delete20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { commercialsApi, commercialsKeys } from "../api";
import { formatDate, formatMoney, supersededEndDate } from "../format";
import type { ImportRowError, RateCardLine, RateCardOut, RateUnit } from "../types";
import { RATE_CARD_STATUS } from "./client-rate-cards-tab";

const useStyles = makeStyles({
  header: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalM },
  grow: { flex: 1 },
  surface: { backgroundColor: tokens.colorNeutralBackground1, borderRadius: tokens.borderRadiusMedium, boxShadow: tokens.shadow4, overflowX: "auto" },
  cellInput: { minWidth: "90px" },
  roleInput: { minWidth: "180px" },
});

const UNITS: RateUnit[] = ["hour", "day", "month", "year", "fixed"];
const NEW_LINE: RateCardLine = {
  role: "",
  location: null,
  experience_min_years: null,
  experience_max_years: null,
  min_bill_rate: "",
  max_bill_rate: "",
  currency: "INR",
  rate_unit: "hour",
  max_vendor_rate: null,
  markup_pct: null,
};
const nullable = (v: string) => (v.trim() ? v.trim() : null);

/** Rate card editor (`/clients/[id]/rate-cards/[cardId]`, also templates): editable lines grid in draft,
 * read-only otherwise; CSV import, publish (shows the computed end of the current version) and new version. */
export function RateCardEditor({ cardId, clientId }: { cardId: string; clientId?: string }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const toast = useAppToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const canRead = usePermission("rate_card:read");
  const canWrite = usePermission("rate_card:write");
  const card = useQuery({ queryKey: commercialsKeys.rateCard(cardId), queryFn: ({ signal }) => commercialsApi.rateCard(cardId, signal), enabled: canRead });
  const [lines, setLines] = useState<RateCardLine[]>([]);
  const [dirty, setDirty] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [seen, setSeen] = useState<RateCardOut | undefined>(undefined);
  if (card.data && card.data !== seen) {
    setSeen(card.data);
    setLines(card.data.lines ?? []);
    setDirty(false);
  }
  const refresh = () => queryClient.invalidateQueries({ queryKey: commercialsKeys.all });
  const save = useMutation({
    mutationFn: () => commercialsApi.putLines(cardId, lines.map((l) => ({ ...l, location: l.location ? l.location : null }))),
    onSuccess: async () => {
      toast.success("Lines saved");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const newVersion = useMutation({
    mutationFn: () => commercialsApi.newVersion(cardId),
    onSuccess: async (c) => {
      await refresh();
      router.push(clientId ? `/clients/${clientId}/rate-cards/${c.id}` : `/settings/rate-card-templates`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!canRead) return <NoAccess what="rate cards" />;
  if (card.isPending) return <GridSkeleton rows={6} />;
  if (card.isError) return <ErrorBar title="Could not load this rate card." message={errorMessage(card.error)} />;
  const c = card.data;
  const editable = canWrite && c.status === "draft";
  const update = (i: number, patch: Partial<RateCardLine>) => {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
    setDirty(true);
  };
  const backHref = c.is_template ? "/settings/rate-card-templates" : `/clients/${c.client_id}?tab=rate-cards`;

  return (
    <>
      <AppLink href={backHref}>
        <ArrowLeft20Regular style={{ verticalAlign: "middle" }} aria-hidden /> {c.is_template ? "Rate card templates" : "Client"}
      </AppLink>
      <div className={styles.header}>
        <Title2 as="h1">
          {c.human_id} · {c.name} {!c.is_template && `v${c.version}`}
        </Title2>
        <Badge appearance="tint" color={RATE_CARD_STATUS[c.status].color}>
          {RATE_CARD_STATUS[c.status].label}
        </Badge>
        {!c.is_template && (
          <span className={admin.muted}>
            {c.effective_from ? `${formatDate(c.effective_from)} – ${c.effective_to ? formatDate(c.effective_to) : "open"}` : "No start date"}
          </span>
        )}
        <span className={styles.grow} />
        {editable && (
          <>
            <Button icon={<ArrowUpload20Regular />} onClick={() => setImporting(true)}>
              Import CSV
            </Button>
            <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
              Save lines
            </Button>
            {!c.is_template && (
              <Button appearance="primary" disabled={dirty} onClick={() => setPublishing(true)}>
                Publish
              </Button>
            )}
          </>
        )}
        {canWrite && !c.is_template && c.status !== "draft" && (
          <Button icon={<Copy20Regular />} disabled={newVersion.isPending} onClick={() => newVersion.mutate()}>
            New version
          </Button>
        )}
      </div>
      {!editable && c.status !== "draft" && (
        <MessageBar intent="info" style={{ marginBottom: tokens.spacingVerticalM }}>
          <MessageBarBody>Published rate cards are read-only. Create a new version to change rates; existing placements keep their rates.</MessageBarBody>
        </MessageBar>
      )}
      <div className={styles.surface}>
        <Table aria-label="Rate card lines" size="small">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Role</TableHeaderCell>
              <TableHeaderCell>Location</TableHeaderCell>
              <TableHeaderCell>Experience (yrs)</TableHeaderCell>
              <TableHeaderCell>Bill rate min</TableHeaderCell>
              <TableHeaderCell>Bill rate max</TableHeaderCell>
              <TableHeaderCell>Unit</TableHeaderCell>
              <TableHeaderCell>Max vendor rate</TableHeaderCell>
              <TableHeaderCell>Markup %</TableHeaderCell>
              {editable && <TableHeaderCell aria-label="Actions" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((l, i) =>
              editable ? (
                <TableRow key={l.id ?? `new-${i}`}>
                  <TableCell>
                    <Input className={styles.roleInput} aria-label="Role" value={l.role} onChange={(_, d) => update(i, { role: d.value })} />
                  </TableCell>
                  <TableCell>
                    <Input className={styles.cellInput} aria-label="Location" placeholder="Any" value={l.location ?? ""} onChange={(_, d) => update(i, { location: nullable(d.value) })} />
                  </TableCell>
                  <TableCell>
                    <Input className={styles.cellInput} aria-label="Minimum experience" placeholder="min" value={l.experience_min_years ?? ""} onChange={(_, d) => update(i, { experience_min_years: nullable(d.value) })} />
                    <Input className={styles.cellInput} aria-label="Maximum experience" placeholder="max" value={l.experience_max_years ?? ""} onChange={(_, d) => update(i, { experience_max_years: nullable(d.value) })} />
                  </TableCell>
                  <TableCell>
                    <Input className={styles.cellInput} aria-label="Minimum bill rate" inputMode="decimal" value={l.min_bill_rate} onChange={(_, d) => update(i, { min_bill_rate: d.value })} />
                  </TableCell>
                  <TableCell>
                    <Input className={styles.cellInput} aria-label="Maximum bill rate" inputMode="decimal" value={l.max_bill_rate} onChange={(_, d) => update(i, { max_bill_rate: d.value })} />
                  </TableCell>
                  <TableCell>
                    <Dropdown aria-label="Rate unit" value={l.rate_unit} selectedOptions={[l.rate_unit]} onOptionSelect={(_, d) => update(i, { rate_unit: d.optionValue as RateUnit })}>
                      {UNITS.map((u) => (
                        <Option key={u} value={u}>
                          {u}
                        </Option>
                      ))}
                    </Dropdown>
                  </TableCell>
                  <TableCell>
                    <Input className={styles.cellInput} aria-label="Maximum vendor rate" value={l.max_vendor_rate ?? ""} onChange={(_, d) => update(i, { max_vendor_rate: nullable(d.value) })} />
                  </TableCell>
                  <TableCell>
                    <Input className={styles.cellInput} aria-label="Markup percent" value={l.markup_pct ?? ""} onChange={(_, d) => update(i, { markup_pct: nullable(d.value) })} />
                  </TableCell>
                  <TableCell>
                    <Button
                      appearance="subtle"
                      icon={<Delete20Regular />}
                      aria-label="Remove line"
                      onClick={() => {
                        setLines((ls) => ls.filter((_, j) => j !== i));
                        setDirty(true);
                      }}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={l.id ?? i}>
                  <TableCell>{l.role}</TableCell>
                  <TableCell>{l.location ?? "Any"}</TableCell>
                  <TableCell>
                    {l.experience_min_years ?? "0"}–{l.experience_max_years ?? "∞"}
                  </TableCell>
                  <TableCell>{formatMoney(l.min_bill_rate, l.currency)}</TableCell>
                  <TableCell>{formatMoney(l.max_bill_rate, l.currency)}</TableCell>
                  <TableCell>{l.rate_unit}</TableCell>
                  <TableCell>{formatMoney(l.max_vendor_rate, l.currency)}</TableCell>
                  <TableCell>{l.markup_pct ?? "—"}</TableCell>
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>
        {editable && (
          <Button
            appearance="transparent"
            icon={<Add20Regular />}
            onClick={() => {
              setLines((ls) => [...ls, { ...NEW_LINE }]);
              setDirty(true);
            }}
          >
            Add line
          </Button>
        )}
      </div>
      {publishing && <PublishDialog card={c} onClose={() => setPublishing(false)} onDone={refresh} />}
      {importing && <ImportDialog cardId={c.id} onClose={() => setImporting(false)} onDone={refresh} />}
    </>
  );
}

function PublishDialog({ card, onClose, onDone }: { card: RateCardOut; onClose: () => void; onDone: () => Promise<unknown> }) {
  const toast = useAppToast();
  const versions = useQuery({
    queryKey: commercialsKeys.clientRateCards(card.client_id ?? ""),
    queryFn: ({ signal }) => commercialsApi.clientRateCards(card.client_id!, signal),
    enabled: !!card.client_id,
  });
  const current = versions.data?.find((v) => v.status === "published" && v.contract_id === card.contract_id && v.id !== card.id);
  const endDate = supersededEndDate(current?.effective_from, card.effective_from);
  const publish = useMutation({
    mutationFn: () => commercialsApi.publishRateCard(card.id),
    onSuccess: async () => {
      toast.success("Rate card published");
      await onDone();
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Publish {card.name} v{card.version}?</DialogTitle>
          <DialogContent>
            <ErrorBar message={publish.error ? (isApiError(publish.error) && publish.error.code === "rate_card_overlap" ? "The new version must start after the current version's start date." : errorMessage(publish.error)) : null} />
            <p>Effective from {formatDate(card.effective_from)}. Published rate cards cannot be edited.</p>
            {current &&
              (endDate ? (
                <p>
                  The current version (v{current.version}) will end on <strong>{formatDate(endDate)}</strong>.
                </p>
              ) : (
                <p>The effective date overlaps the current version (v{current.version}); change it before publishing.</p>
              ))}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={publish.isPending || (!!current && !endDate)} onClick={() => publish.mutate()}>
              Publish
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function ImportDialog({ cardId, onClose, onDone }: { cardId: string; onClose: () => void; onDone: () => Promise<unknown> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [errors, setErrors] = useState<ImportRowError[]>([]);
  const run = useMutation({
    mutationFn: () => commercialsApi.importRateCard(cardId, file!, skipInvalid),
    onSuccess: async (out) => {
      setErrors(out.errors);
      if (out.applied > 0 || out.duplicate) await onDone();
      if (!out.errors.length) onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Import lines from CSV</DialogTitle>
          <DialogContent>
            <ErrorBar message={run.error ? errorMessage(run.error) : null} />
            <p>
              Columns: role, location, experience_min_years, experience_max_years, min_bill_rate, max_bill_rate, currency, rate_unit,
              max_vendor_rate, markup_pct. Up to 2,000 rows; the same file is applied only once.
            </p>
            <Field label="CSV file">
              <Button onClick={() => fileRef.current?.click()}>{file ? file.name : "Choose file"}</Button>
            </Field>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Checkbox label="Skip invalid rows" checked={skipInvalid} onChange={(_, d) => setSkipInvalid(!!d.checked)} />
            {errors.length > 0 && (
              <Table size="extra-small" aria-label="Import errors">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Row</TableHeaderCell>
                    <TableHeaderCell>Field</TableHeaderCell>
                    <TableHeaderCell>Problem</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errors.slice(0, 100).map((e, i) => (
                    <TableRow key={i}>
                      <TableCell>{e.row}</TableCell>
                      <TableCell>{e.field ?? "—"}</TableCell>
                      <TableCell>{e.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Close</Button>
            <Button appearance="primary" disabled={!file || run.isPending} onClick={() => run.mutate()}>
              Import
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
