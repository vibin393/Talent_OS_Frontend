"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Checkbox,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Subtitle2,
  Tab,
  TabList,
  Text,
  Textarea,
  Title2,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { ArrowLeft20Regular, ErrorCircle16Filled, Sparkle20Regular, Warning16Filled } from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog, ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { marketingKeys } from "../api";
import { copyApi, copyKeys } from "./api";
import { applyModes, approveDisabledReason, blocking, draftBadge, findingLabel, shouldMarkOpened, summaryLine, warnings } from "./logic";
import type { ApplyMode, CopyDraftOut, CopyRequestDetailOut, SegmentOut } from "./types";

const FALLBACK = "The AI couldn't draft copy. Start from one of your templates.";

const useStyles = makeStyles({
  back: { marginBottom: tokens.spacingVerticalS },
  header: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalS },
  muted: { color: tokens.colorNeutralForeground3 },
  layout: {
    display: "grid",
    gridTemplateColumns: "220px minmax(0, 1fr)",
    gap: tokens.spacingHorizontalL,
    marginTop: tokens.spacingVerticalM,
    "@media (max-width: 720px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
  tabsDesktop: { "@media (max-width: 720px)": { display: "none" } },
  selectMobile: { display: "none", "@media (max-width: 720px)": { display: "block" } },
  variants: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: tokens.spacingHorizontalM },
  card: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  preview: { width: "100%", minHeight: "180px", border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium, background: "white" },
  findings: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  finding: { display: "flex", gap: tokens.spacingHorizontalXS, alignItems: "flex-start" },
  excerpt: { backgroundColor: tokens.colorPaletteYellowBackground2, paddingInline: "2px" },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap", alignItems: "center" },
  applyBar: {
    position: "sticky",
    bottom: 0,
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalL,
    backgroundColor: tokens.colorNeutralBackground2,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
});

/** `/marketing/campaigns/[id]/copy/[requestId]`: AI copy drafts side by side, checks, ★ approval and apply (Epic 78). */
export function CopyReviewPage({ campaignId, requestId }: { campaignId: string; requestId: string }) {
  const styles = useStyles();
  const canRead = usePermission("campaign:read");
  const query = useQuery({
    queryKey: copyKeys.request(requestId),
    queryFn: ({ signal }) => copyApi.get(requestId, signal),
    enabled: canRead,
    refetchInterval: (q) => (q.state.data && ["requested", "generating"].includes(q.state.data.status) ? 3000 : false),
  });
  if (!canRead) return <NoAccess what="campaigns" />;
  const back = (
    <div className={styles.back}>
      <AppLink href={`/marketing/campaigns/${campaignId}`}>
        <ArrowLeft20Regular style={{ verticalAlign: "middle" }} aria-hidden /> Campaign
      </AppLink>
    </div>
  );
  if (query.isPending)
    return (
      <>
        {back}
        <GridSkeleton rows={6} />
      </>
    );
  if (query.isError)
    return (
      <>
        {back}
        <ErrorBar title="Could not load the AI copy drafts." message={errorMessage(query.error)} />
      </>
    );
  return (
    <>
      {back}
      <ReviewBody request={query.data} campaignId={campaignId} />
    </>
  );
}

function ReviewBody({ request: r, campaignId }: { request: CopyRequestDetailOut; campaignId: string }) {
  const styles = useStyles();
  const [segment, setSegment] = useState<string>(r.segments[0]?.key ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const opened = useRef(new Set<string>());
  const canApprove = usePermission("campaign:copy_approve");
  const current = r.segments.find((s) => s.key === segment) ?? r.segments[0];

  useEffect(() => {
    if (r.status !== "generated" || !current || !canApprove) return;
    if (shouldMarkOpened(current.key, opened.current)) {
      opened.current.add(current.key);
      void copyApi.segmentOpened(r.id, current.key).catch(() => undefined);
    }
  }, [r.id, r.status, current, canApprove]);

  const header = (
    <>
      <div className={styles.header}>
        <Title2 as="h1">AI copy drafts</Title2>
        <Badge appearance="tint" color="brand" icon={<Sparkle20Regular />}>
          AI-generated
        </Badge>
      </div>
      {r.status === "generated" && <Body1 className={styles.muted}>{summaryLine(r.summary)}</Body1>}
    </>
  );
  if (r.status === "requested" || r.status === "generating")
    return (
      <>
        {header}
        <div className={styles.actions} role="status" style={{ marginTop: 16 }}>
          <Spinner size="small" />
          <Text>Drafting copy for {r.segment_count} segments…</Text>
          <Button onClick={() => void copyApi.cancel(r.id)}>Cancel</Button>
        </div>
      </>
    );
  if (r.status !== "generated" || r.segments.every((s) => s.drafts.length === 0))
    return (
      <>
        {header}
        <MessageBar intent="warning" style={{ marginTop: 16 }}>
          <MessageBarBody>
            {r.fallback_message ?? FALLBACK} <AppLink href="/admin/email-templates">Open templates</AppLink>
          </MessageBarBody>
        </MessageBar>
      </>
    );

  const allDrafts = r.segments.flatMap((s) => s.drafts);
  const chosen = allDrafts.filter((d) => selected.includes(d.id));
  const toggle = (id: string, on: boolean) => setSelected((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));

  return (
    <>
      {header}
      <div className={styles.layout}>
        <div>
          <TabList
            className={styles.tabsDesktop}
            vertical
            selectedValue={current?.key}
            onTabSelect={(_, data) => setSegment(String(data.value))}
            aria-label="Segments"
          >
            {r.segments.map((s) => (
              <Tab key={s.key} value={s.key}>
                {s.label}
              </Tab>
            ))}
          </TabList>
          <Field label="Segment" className={styles.selectMobile}>
            <Dropdown value={current?.label} selectedOptions={[current?.key ?? ""]} onOptionSelect={(_, o) => setSegment(String(o.optionValue))}>
              {r.segments.map((s) => (
                <Option key={s.key} value={s.key}>
                  {s.label}
                </Option>
              ))}
            </Dropdown>
          </Field>
        </div>
        {current && <SegmentVariants segment={current} requestId={r.id} selected={selected} onToggle={toggle} />}
      </div>
      <ApplyBar campaignId={campaignId} requestId={r.id} chosen={chosen} onDone={() => setSelected([])} />
    </>
  );
}

function SegmentVariants({
  segment,
  requestId,
  selected,
  onToggle,
}: {
  segment: SegmentOut;
  requestId: string;
  selected: string[];
  onToggle: (id: string, on: boolean) => void;
}) {
  const styles = useStyles();
  return (
    <div>
      <Subtitle2>{segment.label}</Subtitle2>
      {segment.reachable !== null && <Caption1 className={styles.muted}> · {segment.reachable} reachable</Caption1>}
      <div className={styles.variants} style={{ marginTop: 8 }}>
        {segment.drafts.map((d) => (
          <VariantCard key={d.id} draft={d} requestId={requestId} checked={selected.includes(d.id)} onToggle={(on) => onToggle(d.id, on)} />
        ))}
      </div>
    </div>
  );
}

function VariantCard({ draft: d, requestId, checked, onToggle }: { draft: CopyDraftOut; requestId: string; checked: boolean; onToggle: (on: boolean) => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const canApprove = usePermission("campaign:copy_approve");
  const canWrite = usePermission("campaign:write");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ subject: d.subject ?? "", preheader: d.preheader ?? "", body: d.body_html ?? "", values: d.template_values ?? {} });
  const refresh = () => qc.invalidateQueries({ queryKey: copyKeys.request(requestId) });
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      void refresh();
    } catch (e) {
      toast.error(errorMessage(e, "That did not work."));
    }
  };
  const disabledReason = approveDisabledReason(d, canApprove);
  const badge = draftBadge(d);
  const warns = warnings(d.findings);
  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Text weight="semibold">Variant {d.variant_no}</Text>}
        action={
          d.status === "approved" ? (
            <Checkbox aria-label={`Select variant ${d.variant_no}`} checked={checked} onChange={(_, v) => onToggle(Boolean(v.checked))} />
          ) : undefined
        }
      />
      {badge && (
        <Badge appearance="tint" color={d.status === "edited" ? "warning" : "success"}>
          {badge}
        </Badge>
      )}
      {editing ? (
        <>
          {d.channel === "email" ? (
            <>
              <Field label="Subject">
                <Input value={form.subject} maxLength={200} onChange={(_, v) => setForm({ ...form, subject: v.value })} />
              </Field>
              <Field label="Preheader">
                <Input value={form.preheader} maxLength={200} onChange={(_, v) => setForm({ ...form, preheader: v.value })} />
              </Field>
              <Field label="Body (HTML)">
                <Textarea value={form.body} resize="vertical" rows={8} onChange={(_, v) => setForm({ ...form, body: v.value })} />
              </Field>
            </>
          ) : (
            Object.keys(form.values).map((k) => (
              <Field key={k} label={k}>
                <Input value={form.values[k]} onChange={(_, v) => setForm({ ...form, values: { ...form.values, [k]: v.value } })} />
              </Field>
            ))
          )}
          <div className={styles.actions}>
            <Button
              appearance="primary"
              onClick={() =>
                run(async () => {
                  await copyApi.edit(
                    d.id,
                    d.channel === "email" ? { subject: form.subject, preheader: form.preheader, body_html: form.body } : { template_values: form.values },
                  );
                  setEditing(false);
                }, "Draft saved. It needs approval again.")
              }
            >
              Save
            </Button>
            <Button onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </>
      ) : d.channel === "email" ? (
        <>
          <Text weight="semibold">{d.subject}</Text>
          {d.preheader && <Caption1 className={styles.muted}>{d.preheader}</Caption1>}
          <iframe title={`Variant ${d.variant_no} preview`} className={styles.preview} sandbox="" srcDoc={d.body_html ?? ""} />
        </>
      ) : (
        <ul className={styles.findings}>
          {Object.entries(d.template_values ?? {}).map(([k, v]) => (
            <li key={k}>
              <Caption1 className={styles.muted}>{k}: </Caption1>
              <Text>{v}</Text>
            </li>
          ))}
        </ul>
      )}
      {d.findings.length > 0 && (
        <ul className={styles.findings} aria-label="Checks">
          {d.findings.map((f, i) => (
            <li key={i} className={styles.finding}>
              {f.severity === "block" ? (
                <ErrorCircle16Filled primaryFill={tokens.colorPaletteRedForeground1} aria-label="Must fix" />
              ) : (
                <Warning16Filled primaryFill={tokens.colorPaletteMarigoldForeground1} aria-label="Check" />
              )}
              <Caption1>
                <strong>{f.severity === "block" ? "Must fix" : "Check"}:</strong> {findingLabel(f)}
                {f.excerpt && (
                  <>
                    {" "}
                    — <span className={styles.excerpt}>{f.excerpt}</span>
                  </>
                )}
              </Caption1>
            </li>
          ))}
        </ul>
      )}
      {!editing && d.status !== "used" && d.status !== "discarded" && (
        <div className={styles.actions}>
          {warns.length > 0 && blocking(d.findings).length === 0 && canApprove && (
            <Checkbox
              label="I've reviewed the checks"
              checked={d.warnings_acknowledged}
              disabled={d.warnings_acknowledged}
              onChange={() => run(() => copyApi.acknowledge(d.id), "Checks acknowledged.")}
            />
          )}
          {canWrite && <Button onClick={() => setEditing(true)}>Edit</Button>}
          {disabledReason ? (
            <Tooltip content={disabledReason} relationship="description">
              <Button appearance="primary" disabledFocusable>
                Approve
              </Button>
            </Tooltip>
          ) : (
            <Button appearance="primary" onClick={() => run(() => copyApi.approve(d.id), "Copy approved.")}>
              Approve
            </Button>
          )}
          {canWrite && <Button onClick={() => run(() => copyApi.discard(d.id), "Draft discarded.")}>Discard</Button>}
        </div>
      )}
    </Card>
  );
}

const APPLY_LABELS: Record<ApplyMode, string> = {
  single: "Use for this campaign",
  ab_subjects: "Use as A/B subjects",
  per_segment_campaigns: "Create a campaign per segment",
};

function ApplyBar({ campaignId, requestId, chosen, onDone }: { campaignId: string; requestId: string; chosen: CopyDraftOut[]; onDone: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const router = useRouter();
  const canWrite = usePermission("campaign:write");
  const [mode, setMode] = useState<ApplyMode | null>(null);
  if (!canWrite) return null;
  const modes = applyModes(chosen, "campaign");
  return (
    <div className={styles.applyBar}>
      <Caption1 className={styles.muted} style={{ alignSelf: "center" }}>
        {chosen.length ? `${chosen.length} approved variant(s) selected` : "Select approved variants to use them"}
      </Caption1>
      {(Object.keys(APPLY_LABELS) as ApplyMode[]).map((m) => (
        <Button key={m} appearance={m === "single" ? "primary" : "secondary"} disabled={!modes[m]} onClick={() => setMode(m)}>
          {APPLY_LABELS[m]}
        </Button>
      ))}
      <ConfirmDialog
        open={mode !== null}
        title={mode ? APPLY_LABELS[mode] : ""}
        confirmLabel="Use copy"
        onClose={() => setMode(null)}
        onConfirm={async () => {
          if (!mode) return;
          try {
            const out = await copyApi.apply({ draft_ids: chosen.map((d) => d.id), mode });
            toast.success(mode === "per_segment_campaigns" ? `${out.campaign_ids.length} draft campaigns created.` : "Copy added to the campaign.");
            onDone();
            void qc.invalidateQueries({ queryKey: copyKeys.request(requestId) });
            void qc.invalidateQueries({ queryKey: marketingKeys.campaigns });
            void qc.invalidateQueries({ queryKey: copyKeys.status(campaignId) });
            if (mode !== "per_segment_campaigns") router.push(`/marketing/campaigns/${campaignId}`);
          } catch (e) {
            toast.error(errorMessage(e, "The copy could not be used."));
            throw e;
          }
        }}
      >
        This replaces the campaign&apos;s current copy. The campaign still goes through your normal approval before sending.
      </ConfirmDialog>
    </div>
  );
}
