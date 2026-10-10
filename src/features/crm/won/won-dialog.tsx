"use client";

import {
  Button,
  Checkbox,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerHeaderTitle,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Option,
  OverlayDrawer,
  SpinButton,
  Spinner,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Dismiss24Regular, Attach20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { api } from "@/lib/api/client";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { crmApi } from "../api";
import type { CreatedRecord, OpportunityOut, WinOut } from "../types";
import { invalidateCrm } from "../use-leads";
import { buildWinIn, createWinSession, selectionErrors, selectionFromPreview, selectionSummary, type WonSelection } from "./won-logic";

const useStyles = makeStyles({
  surface: { height: "100%" },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    paddingBlock: tokens.spacingVerticalM,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: tokens.spacingHorizontalM },
  footer: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalM, width: "100%", flexWrap: "wrap" },
  summary: { flex: 1, minWidth: "200px" },
  muted: { color: tokens.colorNeutralForeground3 },
  files: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
});

const RECORD_ROUTES: Record<CreatedRecord["kind"], (id: string) => string | null> = {
  client: (id) => `/clients/${id}`,
  demand: (id) => `/demands/${id}`,
  contract: (id) => `/contracts/${id}`,
  rate_card: () => null,
};
const RECORD_LABELS: Record<CreatedRecord["kind"], string> = { client: "Client", contract: "Contract", rate_card: "Rate card", demand: "Demand" };

/** Full-height Won conversion drawer: preview, selection, Confirm (stable Idempotency-Key), success links. */
export function WonDialog({ opportunity, onClose }: { opportunity: OpportunityOut; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  // One key per dialog open, reused on every retry.
  const [session] = useState(() => createWinSession());
  const fileInput = useRef<HTMLInputElement>(null);
  const [sel, setSel] = useState<WonSelection | null>(null);
  const [files, setFiles] = useState<{ id: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<WinOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = useQuery({
    queryKey: ["opportunity", "won-preview", opportunity.id],
    queryFn: async () => {
      const p = await crmApi.wonPreview(opportunity.id);
      setSel((s) => s ?? selectionFromPreview(p));
      return p;
    },
    staleTime: Infinity,
    gcTime: 0,
  });

  const win = useMutation({
    mutationFn: (s: WonSelection) => session.submit((key) => crmApi.win(opportunity.id, buildWinIn({ ...s, fileIds: files.map((f) => f.id) }), key)),
    onSuccess: (out) => {
      setResult(out);
      void invalidateCrm(qc);
      toast.success(`${opportunity.human_id} won`);
    },
    onError: (e) => {
      const step = isApiError(e) && typeof e.details.step === "string" ? ` (step: ${e.details.step})` : "";
      setError(`${errorMessage(e)}${step}`);
    },
  });

  const set = (p: Partial<WonSelection>) => setSel((s) => (s ? { ...s, ...p } : s));
  const setDemand = (i: number, p: Partial<WonSelection["demands"][number]>) =>
    setSel((s) => (s ? { ...s, demands: s.demands.map((d, j) => (j === i ? { ...d, ...p } : d)) } : s));

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("category", "other");
      form.append("note", "Contract document (Won conversion)");
      const att = await api.post<{ file: { id: string; original_name: string } }>(
        `/api/v1/opportunities/${encodeURIComponent(opportunity.id)}/attachments`,
        form,
      );
      setFiles((f) => [...f, { id: att.file.id, name: att.file.original_name }]);
    } catch (e) {
      toast.error(errorMessage(e, "Could not upload the file."));
    } finally {
      setUploading(false);
    }
  }

  const p = preview.data;
  const errs = sel ? selectionErrors(sel) : [];

  return (
    <OverlayDrawer position="end" size="large" open className={styles.surface} onOpenChange={(_, d) => !d.open && !win.isPending && onClose()}>
      <DrawerHeader>
        <DrawerHeaderTitle action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={onClose} disabled={win.isPending} />}>
          Close {opportunity.human_id} as won
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        {preview.isPending && <GridSkeleton rows={6} />}
        {preview.isError && <ErrorBar title="Could not prepare the conversion." message={errorMessage(preview.error)} />}
        {result && (
          <MessageBar intent="success" layout="multiline">
            <MessageBarBody>
              <MessageBarTitle>Opportunity won</MessageBarTitle>
              <ul>
                {result.records.map((r) => {
                  const href = RECORD_ROUTES[r.kind](r.id);
                  const text = `${RECORD_LABELS[r.kind]}${r.label ? `: ${r.label}` : ""}`;
                  return <li key={`${r.kind}:${r.id}`}>{href ? <AppLink href={href}>{text}</AppLink> : text}</li>;
                })}
                {result.client_activated && <li>Client activated</li>}
              </ul>
            </MessageBarBody>
          </MessageBar>
        )}
        {p && sel && !result && (
          <>
            {error && <ErrorBar message={error} />}
            {!p.commercials_available && (
              <MessageBar intent="info">
                <MessageBarBody>Contracts and rate cards are not available in this workspace.</MessageBarBody>
              </MessageBar>
            )}
            <section className={styles.section}>
              <Subtitle2 as="h3">Client</Subtitle2>
              <Checkbox
                label={`Activate ${p.client.name} (currently ${p.client.current_status})`}
                checked={sel.activateClient}
                disabled={!p.client.will_activate}
                onChange={(_, d) => set({ activateClient: !!d.checked })}
              />
            </section>
            {p.commercials_available && (
              <section className={styles.section}>
                <Checkbox label={<Subtitle2>Create contract</Subtitle2>} checked={sel.createContract} onChange={(_, d) => set({ createContract: !!d.checked })} />
                {sel.createContract && (
                  <div className={styles.grid}>
                    <Field label="Type">
                      <Dropdown
                        value={sel.contractType.toUpperCase()}
                        selectedOptions={[sel.contractType]}
                        onOptionSelect={(_, d) => d.optionValue && set({ contractType: d.optionValue as WonSelection["contractType"] })}
                      >
                        <Option value="msa">MSA</Option>
                        <Option value="sow">SOW</Option>
                      </Dropdown>
                    </Field>
                    <Field label="Title">
                      <Input value={sel.contractTitle} maxLength={300} onChange={(_, d) => set({ contractTitle: d.value })} />
                    </Field>
                    <Field label="Legal entity" required>
                      <Dropdown
                        value={p.legal_entities.find((l) => l.id === sel.legalEntityId)?.name ?? ""}
                        selectedOptions={sel.legalEntityId ? [sel.legalEntityId] : []}
                        onOptionSelect={(_, d) => set({ legalEntityId: d.optionValue ?? null })}
                      >
                        {p.legal_entities.map((l) => (
                          <Option key={l.id} value={l.id}>
                            {l.name}
                          </Option>
                        ))}
                      </Dropdown>
                    </Field>
                    <Field label="Start date" required>
                      <Input type="date" value={sel.startDate} onChange={(_, d) => set({ startDate: d.value })} />
                    </Field>
                    <Field label="End date">
                      <Input type="date" value={sel.endDate} onChange={(_, d) => set({ endDate: d.value })} />
                    </Field>
                    <Field label="Documents">
                      <div className={styles.files}>
                        <input
                          ref={fileInput}
                          type="file"
                          hidden
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void uploadFile(f);
                            e.target.value = "";
                          }}
                        />
                        <Button
                          icon={uploading ? <Spinner size="tiny" /> : <Attach20Regular />}
                          disabled={uploading || files.length >= 20}
                          onClick={() => fileInput.current?.click()}
                        >
                          Attach file
                        </Button>
                        {files.map((f) => (
                          <Text key={f.id} size={200}>
                            {f.name}
                          </Text>
                        ))}
                      </div>
                    </Field>
                  </div>
                )}
              </section>
            )}
            {p.commercials_available && (
              <section className={styles.section}>
                <Checkbox
                  label={<Subtitle2>Copy rate card template</Subtitle2>}
                  checked={sel.copyRateCard}
                  disabled={p.rate_card_templates.length === 0}
                  onChange={(_, d) => set({ copyRateCard: !!d.checked })}
                />
                {p.rate_card_templates.length === 0 && <Text className={styles.muted}>No rate card templates yet.</Text>}
                {sel.copyRateCard && (
                  <div className={styles.grid}>
                    <Field label="Template" required>
                      <Dropdown
                        value={p.rate_card_templates.find((t) => t.id === sel.templateId)?.name ?? ""}
                        selectedOptions={sel.templateId ? [sel.templateId] : []}
                        onOptionSelect={(_, d) => set({ templateId: d.optionValue ?? null })}
                      >
                        {p.rate_card_templates.map((t) => (
                          <Option key={t.id} value={t.id}>
                            {t.name}
                          </Option>
                        ))}
                      </Dropdown>
                    </Field>
                    <Field label="Effective from" required>
                      <Input type="date" value={sel.effectiveFrom} onChange={(_, d) => set({ effectiveFrom: d.value })} />
                    </Field>
                  </div>
                )}
              </section>
            )}
            <section className={styles.section}>
              <Subtitle2 as="h3">Demands</Subtitle2>
              <Text className={styles.muted}>
                One draft demand per role line, owned by {opportunity.account_manager?.name ?? "the account manager"}.
              </Text>
              {sel.demands.length === 0 ? (
                <Text className={styles.muted}>This opportunity has no role lines.</Text>
              ) : (
                <Table size="small" aria-label="Demands to create">
                  <TableHeader>
                    <TableRow>
                      <TableHeaderCell style={{ width: 44 }}>Create</TableHeaderCell>
                      <TableHeaderCell>Title</TableHeaderCell>
                      <TableHeaderCell style={{ width: 110 }}>Positions</TableHeaderCell>
                      <TableHeaderCell>Location</TableHeaderCell>
                      <TableHeaderCell style={{ width: 160 }}>Bill rate</TableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sel.demands.map((d, i) => (
                      <TableRow key={d.lineId}>
                        <TableCell>
                          <Checkbox aria-label={`Create demand ${d.title}`} checked={d.create} onChange={(_, v) => setDemand(i, { create: !!v.checked })} />
                        </TableCell>
                        <TableCell>
                          <Input aria-label="Title" value={d.title} disabled={!d.create} onChange={(_, v) => setDemand(i, { title: v.value })} />
                        </TableCell>
                        <TableCell>
                          <SpinButton
                            aria-label="Positions"
                            min={1}
                            value={d.positions}
                            disabled={!d.create}
                            onChange={(_, v) => {
                              const n = v.value ?? Number(v.displayValue);
                              if (Number.isFinite(n) && (n as number) >= 1) setDemand(i, { positions: Math.round(n as number) });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input aria-label="Location" value={d.location} disabled={!d.create} onChange={(_, v) => setDemand(i, { location: v.value })} />
                        </TableCell>
                        <TableCell>
                          <Input
                            aria-label="Bill rate"
                            inputMode="decimal"
                            value={d.billRate}
                            disabled={!d.create}
                            contentAfter={<Text size={200}>{`${d.currency}${d.rateUnit ? `/${d.rateUnit}` : ""}`}</Text>}
                            onChange={(_, v) => setDemand(i, { billRate: v.value })}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          </>
        )}
      </DrawerBody>
      <DrawerFooter>
        <div className={styles.footer}>
          {result ? (
            <Button appearance="primary" onClick={onClose}>
              Done
            </Button>
          ) : (
            <>
              <Text className={styles.summary} aria-live="polite">
                {sel ? selectionSummary(sel) : ""}
                {errs.length > 0 && <Text block className={styles.muted}>{errs[0]}</Text>}
              </Text>
              <Button appearance="secondary" onClick={onClose} disabled={win.isPending}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                disabled={!sel || errs.length > 0 || win.isPending || uploading}
                icon={win.isPending ? <Spinner size="tiny" /> : undefined}
                onClick={() => {
                  setError(null);
                  if (sel) win.mutate(sel);
                }}
              >
                Confirm
              </Button>
            </>
          )}
        </div>
      </DrawerFooter>
    </OverlayDrawer>
  );
}
