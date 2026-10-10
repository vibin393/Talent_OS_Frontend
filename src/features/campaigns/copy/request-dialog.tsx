"use client";

import {
  Button,
  Caption1,
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
  Option,
  Spinner,
  SpinButton,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Textarea,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { Add20Regular, Delete20Regular, Sparkle20Regular } from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { useAiFeatures } from "@/features/ai-admin/use-ai-features";
import { audienceKeys, audiencesApi } from "@/features/audiences/api";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { OptionCombobox } from "../option-combobox";
import type { Channel } from "../types";
import { useMarketingOptions } from "../use-marketing";
import { copyApi, copyKeys } from "./api";
import { emptyRequest, MAX_SEGMENTS, MAX_VARIANTS, PURPOSE_OPTIONS, type RequestDraft, segmentKey, TONE_OPTIONS, toRequest, validateRequest } from "./logic";
import type { AttributeField, CopySegment } from "./types";

const ATTRIBUTE_FIELDS: { value: AttributeField; label: string }[] = [
  { value: "city", label: "City" },
  { value: "primary_skill", label: "Primary skill" },
  { value: "experience_band", label: "Experience" },
  { value: "last_active_band", label: "Last active" },
];

const useStyles = makeStyles({
  surface: { maxWidth: "860px", width: "calc(100vw - 32px)" },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  row: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: tokens.spacingHorizontalM },
  tableWrap: { overflowX: "auto" },
  segActions: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalM },
  muted: { color: tokens.colorNeutralForeground3 },
  progress: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalM, paddingBlock: tokens.spacingVerticalL },
});

/** Toolbar entry "Draft copy with AI": hidden when the feature is off, disabled while only the master switch is off. */
export function DraftCopyButton({
  campaignId,
  audienceId,
  channel,
  label = "Draft copy with AI",
}: {
  campaignId: string;
  audienceId: string;
  channel: Channel;
  label?: string;
}) {
  const { data, isEnabled } = useAiFeatures();
  const canWrite = usePermission("campaign:write");
  const [open, setOpen] = useState(false);
  if (!canWrite || !data || !isEnabled("agent_campaign_copy")) return null;
  const masterOff = !isEnabled("agentic");
  const button = (
    <Button icon={<Sparkle20Regular />} disabled={masterOff} onClick={() => setOpen(true)}>
      {label}
    </Button>
  );
  return (
    <>
      {masterOff ? (
        <Tooltip content="AI campaign copy is off" relationship="description">
          {button}
        </Tooltip>
      ) : (
        button
      )}
      {open && <RequestDialog campaignId={campaignId} audienceId={audienceId} channel={channel} onClose={() => setOpen(false)} />}
    </>
  );
}

export function RequestDialog({
  campaignId,
  audienceId,
  channel,
  onClose,
}: {
  campaignId: string;
  audienceId: string;
  channel: Channel;
  onClose: () => void;
}) {
  const styles = useStyles();
  const toast = useAppToast();
  const router = useRouter();
  const qc = useQueryClient();
  const options = useMarketingOptions(true);
  const [d, setD] = useState<RequestDraft>(() => emptyRequest(channel));
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const set = (patch: Partial<RequestDraft>) => setD((prev) => ({ ...prev, ...patch }));
  const errors = validateRequest(d);
  const templates = channel === "sms" ? (options.data?.sms_templates ?? []) : (options.data?.whatsapp_templates ?? []);
  // Segments "based on an audience source" use the sources of the campaign's audience (pools / saved segments).
  const audience = useQuery({ queryKey: audienceKeys.detail(audienceId), queryFn: ({ signal }) => audiencesApi.get(audienceId, signal) });
  const audienceSources = (audience.data?.sources ?? [])
    .filter((x) => x.mode === "include")
    .map((x) => ({ id: x.id, name: x.name ?? (x.kind === "pool" ? "Talent pool" : "Segment") }));

  const setSegment = (i: number, patch: Partial<CopySegment>) =>
    set({ segments: d.segments.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const addSegment = () => {
    const label = `Segment ${d.segments.length + 1}`;
    set({ segments: [...d.segments, { key: segmentKey(label, d.segments.map((s) => s.key)), label, source: { kind: "attribute", field: "city", value: "" } }] });
  };

  const generate = async () => {
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;
    setBusy(true);
    try {
      const taken: string[] = [];
      const keyed = d.segments.map((s) => {
        const key = segmentKey(s.label, taken);
        taken.push(key);
        return { ...s, key };
      });
      const out = await copyApi.request(toRequest({ ...d, segments: keyed }, { campaignId }));
      setRequestId(out.id);
      void qc.invalidateQueries({ queryKey: copyKeys.list(campaignId) });
      router.push(`/marketing/campaigns/${campaignId}/copy/${out.id}`);
    } catch (e) {
      toast.error(errorMessage(e, "Could not start drafting copy."));
      setBusy(false);
    }
  };

  const cancelRun = async () => {
    if (requestId) await copyApi.cancel(requestId).catch(() => undefined);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(_, data) => !data.open && !busy && onClose()}>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle>Draft copy with AI</DialogTitle>
          <DialogContent>
            {busy ? (
              <div className={styles.progress} role="status">
                <Spinner size="small" />
                <Text>Drafting copy for {d.segments.length} segments…</Text>
              </div>
            ) : (
              <div className={styles.form}>
                <div className={styles.row}>
                  <Field label="Channel">
                    <Input value={channel === "email" ? "Email" : channel === "sms" ? "SMS" : "WhatsApp"} readOnly />
                  </Field>
                  {channel !== "email" && (
                    <OptionCombobox
                      label="Template"
                      required
                      options={templates}
                      value={d.templateId}
                      onChange={(o) => set({ templateId: o?.id ?? null })}
                      hint="AI fills only this template's variables"
                      validationMessage={showErrors ? errors.template : undefined}
                    />
                  )}
                </div>
                <div className={styles.row}>
                  <Field label="Purpose">
                    <Dropdown
                      value={PURPOSE_OPTIONS.find((p) => p.value === d.purpose)?.label}
                      selectedOptions={[d.purpose]}
                      onOptionSelect={(_, o) => set({ purpose: o.optionValue as RequestDraft["purpose"] })}
                    >
                      {PURPOSE_OPTIONS.map((p) => (
                        <Option key={p.value} value={p.value}>
                          {p.label}
                        </Option>
                      ))}
                    </Dropdown>
                  </Field>
                  <Field label="Tone">
                    <Dropdown
                      value={TONE_OPTIONS.find((t) => t.value === d.tone)?.label}
                      selectedOptions={[d.tone]}
                      onOptionSelect={(_, o) => set({ tone: o.optionValue as RequestDraft["tone"] })}
                    >
                      {TONE_OPTIONS.map((t) => (
                        <Option key={t.value} value={t.value}>
                          {t.label}
                        </Option>
                      ))}
                    </Dropdown>
                  </Field>
                </div>
                <Field label="What's this campaign about?" hint={`${d.note.length}/300`} validationMessage={showErrors ? errors.note : undefined}>
                  <Textarea value={d.note} maxLength={300} onChange={(_, v) => set({ note: v.value })} />
                </Field>
                <div className={styles.row}>
                  <Field label="Call to action" validationMessage={showErrors ? errors.cta : undefined}>
                    <Input value={d.cta} maxLength={80} onChange={(_, v) => set({ cta: v.value })} />
                  </Field>
                  <OptionCombobox
                    label="Link jobs"
                    placeholder="Search postings (max 10)"
                    options={(options.data?.postings ?? []).filter((p) => !d.postingIds.includes(p.id))}
                    onChange={(o) => o && d.postingIds.length < 10 && set({ postingIds: [...d.postingIds, o.id] })}
                    hint={d.postingIds.length ? `${d.postingIds.length} linked` : undefined}
                  />
                </div>
                <div>
                  <div className={styles.segActions}>
                    <Text weight="semibold">Segments</Text>
                    <Caption1 className={styles.muted}>
                      {d.segments.length}/{MAX_SEGMENTS}
                    </Caption1>
                    <Button size="small" icon={<Add20Regular />} disabled={d.segments.length >= MAX_SEGMENTS} onClick={addSegment}>
                      Add segment
                    </Button>
                  </div>
                  {showErrors && errors.segments && <Caption1 style={{ color: tokens.colorPaletteRedForeground1 }}>{errors.segments}</Caption1>}
                  <div className={styles.tableWrap}>
                    <Table size="small" aria-label="Segments">
                      <TableHeader>
                        <TableRow>
                          <TableHeaderCell>Segment name</TableHeaderCell>
                          <TableHeaderCell>Based on</TableHeaderCell>
                          <TableHeaderCell>Reachable</TableHeaderCell>
                          <TableHeaderCell />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {d.segments.map((s, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Input
                                aria-label="Segment name"
                                value={s.label}
                                maxLength={120}
                                onChange={(_, v) => setSegment(i, { label: v.value })}
                              />
                            </TableCell>
                            <TableCell>
                              <SegmentSourcePicker segment={s} sources={audienceSources} onChange={(source) => setSegment(i, { source })} />
                            </TableCell>
                            <TableCell>
                              <Caption1 className={styles.muted}>{s.source.kind === "audience_source" ? "Counted after drafting" : "—"}</Caption1>
                            </TableCell>
                            <TableCell>
                              <Button
                                aria-label="Remove segment"
                                appearance="subtle"
                                icon={<Delete20Regular />}
                                onClick={() => set({ segments: d.segments.filter((_, j) => j !== i) })}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <Field label="Variants per segment" validationMessage={showErrors ? errors.variants : undefined}>
                  <SpinButton min={1} max={MAX_VARIANTS} value={d.variants} onChange={(_, v) => set({ variants: Number(v.value ?? v.displayValue ?? d.variants) })} />
                </Field>
                <Caption1 className={styles.muted}>AI never sees individual candidates. Drafts must be approved before use.</Caption1>
              </div>
            )}
          </DialogContent>
          <DialogActions>
            {busy ? (
              <Button onClick={cancelRun}>Cancel</Button>
            ) : (
              <>
                <Button appearance="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button appearance="primary" icon={<Sparkle20Regular />} onClick={generate}>
                  Generate drafts
                </Button>
              </>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function SegmentSourcePicker({
  segment,
  sources,
  onChange,
}: {
  segment: CopySegment;
  sources: { id: string; name: string }[];
  onChange: (source: CopySegment["source"]) => void;
}) {
  const s = segment.source;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Dropdown
        aria-label="Based on"
        value={s.kind === "audience_source" ? "Audience source" : "Attribute"}
        selectedOptions={[s.kind]}
        onOptionSelect={(_, o) =>
          onChange(o.optionValue === "audience_source" ? { kind: "audience_source", id: sources[0]?.id ?? "" } : { kind: "attribute", field: "city", value: "" })
        }
      >
        <Option value="attribute">Attribute</Option>
        <Option value="audience_source" disabled={sources.length === 0}>
          Audience source
        </Option>
      </Dropdown>
      {s.kind === "audience_source" ? (
        <Dropdown
          aria-label="Audience source"
          value={sources.find((x) => x.id === s.id)?.name ?? ""}
          selectedOptions={[s.id]}
          onOptionSelect={(_, o) => onChange({ kind: "audience_source", id: String(o.optionValue) })}
        >
          {sources.map((x) => (
            <Option key={x.id} value={x.id}>
              {x.name}
            </Option>
          ))}
        </Dropdown>
      ) : (
        <>
          <Dropdown
            aria-label="Attribute"
            value={ATTRIBUTE_FIELDS.find((f) => f.value === s.field)?.label}
            selectedOptions={[s.field]}
            onOptionSelect={(_, o) => onChange({ kind: "attribute", field: o.optionValue as AttributeField, value: s.value })}
          >
            {ATTRIBUTE_FIELDS.map((f) => (
              <Option key={f.value} value={f.value}>
                {f.label}
              </Option>
            ))}
          </Dropdown>
          <Input aria-label="Value" value={s.value} maxLength={80} onChange={(_, v) => onChange({ kind: "attribute", field: s.field, value: v.value })} />
        </>
      )}
    </div>
  );
}
