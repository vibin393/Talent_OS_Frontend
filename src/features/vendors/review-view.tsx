"use client";

import {
  Badge,
  Button,
  Card,
  CardHeader,
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
  mergeClasses,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Option,
  Radio,
  RadioGroup,
  Subtitle2,
  Switch,
  Tab,
  TabList,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { DUPLICATE_CATEGORY_LABELS, formatDate, formatDecimalMoney, REJECT_REASONS } from "./format";
import type { DuplicateCategory, VendorSubmissionOut } from "./types";
import { SubmissionStatusBadge } from "./ui";
import { useReviewQueue, useVendorMutations, useVendorSubmission } from "./use-vendors";

const useStyles = makeStyles({
  split: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 360px) 1fr",
    gap: tokens.spacingHorizontalL,
    "@media (max-width: 760px)": { gridTemplateColumns: "1fr" },
  },
  list: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  item: {
    textAlign: "start",
    minHeight: "44px",
    justifyContent: "flex-start",
    padding: tokens.spacingHorizontalM,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  active: { backgroundColor: tokens.colorNeutralBackground1Selected },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, marginTop: tokens.spacingVerticalM },
});

const FILTERS: { value: string; label: string }[] = [
  { value: "open", label: "To review" },
  { value: "duplicate", label: "Duplicates" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
];

/** `/vendors/review`: vendor submission review queue (list + detail card). */
export function ReviewView() {
  const styles = useStyles();
  const canReview = usePermission("vendor_submission:review");
  const [filter, setFilter] = useState("open");
  const [selected, setSelected] = useState<string | null>(null);
  const queue = useReviewQueue(filter === "open" ? null : filter);
  if (!canReview) return <NoAccess what="vendor submissions" />;
  const items = (queue.data ?? []).filter((s) => (filter === "open" ? s.status === "submitted" || s.status === "under_review" : true));
  return (
    <>
      <PageHeader title="Vendor submissions" subtitle="Review candidates submitted by vendors: duplicates, rates and margin." />
      <TabList selectedValue={filter} onTabSelect={(_, d) => setFilter(String(d.value))} aria-label="Queue filter">
        {FILTERS.map((f) => (
          <Tab key={f.value} value={f.value}>
            {f.label}
          </Tab>
        ))}
      </TabList>
      <ErrorBar message={queue.error ? errorMessage(queue.error) : null} />
      <div className={styles.split}>
        <nav aria-label="Submissions" className={styles.list}>
          {queue.isLoading ? (
            <GridSkeleton rows={4} />
          ) : items.length === 0 ? (
            <Text>Nothing here.</Text>
          ) : (
            items.map((s) => (
              <Button
                key={s.id}
                appearance="subtle"
                className={mergeClasses(styles.item, selected === s.id && styles.active)}
                aria-current={selected === s.id}
                onClick={() => setSelected(s.id)}
              >
                <Text weight="semibold">{s.full_name ?? s.human_id}</Text>
                <Text size={200}>
                  {s.vendor_name} · {s.demand_title}
                </Text>
                <SubmissionStatusBadge status={s.status} />
              </Button>
            ))
          )}
        </nav>
        <section aria-label="Submission detail">{selected ? <ReviewCard id={selected} /> : <Text>Select a submission.</Text>}</section>
      </div>
    </>
  );
}

function ReviewCard({ id }: { id: string }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const sub = useVendorSubmission(id);
  const [dialog, setDialog] = useState<"accept" | "reject" | "duplicate" | "reopen" | null>(null);
  if (sub.isLoading) return <GridSkeleton rows={4} />;
  if (!sub.data) return <ErrorBar message={errorMessage(sub.error)} />;
  const s = sub.data;
  const open = s.status === "submitted" || s.status === "under_review";
  return (
    <Card>
      <CardHeader
        header={<Subtitle2 as="h2">{s.full_name ?? s.human_id}</Subtitle2>}
        description={
          <Text size={200}>
            {s.human_id} · {s.vendor_name} · <AppLink href={`/demands/${s.demand_id}`}>{s.demand_title ?? "Demand"}</AppLink>
          </Text>
        }
        action={<SubmissionStatusBadge status={s.status} />}
      />
      {s.duplicate_findings.length > 0 && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>Possible duplicate</MessageBarTitle>
            {s.duplicate_findings.map((f, i) => (
              <div key={i}>
                {DUPLICATE_CATEGORY_LABELS[f.category] ?? f.detail}
                {f.candidate_id && (
                  <>
                    {" · "}
                    <AppLink href={`/candidates/${f.candidate_id}`}>open candidate</AppLink>
                  </>
                )}
              </div>
            ))}
          </MessageBarBody>
        </MessageBar>
      )}
      <dl className={admin.detailList}>
        <dt>Email</dt>
        <dd>{s.email ?? "—"}</dd>
        <dt>Phone</dt>
        <dd>{s.phone_e164 ?? "—"}</dd>
        <dt>Location</dt>
        <dd>{s.current_location ?? "—"}</dd>
        <dt>Experience</dt>
        <dd>{s.total_experience_months != null ? `${Math.floor(s.total_experience_months / 12)} y ${s.total_experience_months % 12} m` : "—"}</dd>
        <dt>Notice / available</dt>
        <dd>
          {s.notice_period_days != null ? `${s.notice_period_days} days` : "—"} · {formatDate(s.availability_date)}
        </dd>
        <dt>Vendor rate</dt>
        <dd>
          {formatDecimalMoney(s.vendor_rate, s.currency)} / {s.rate_unit ?? "—"}
          {s.max_vendor_rate && ` (max ${formatDecimalMoney(s.max_vendor_rate, s.currency)})`}
        </dd>
        {s.margin && (
          <>
            <dt>Margin</dt>
            <dd>
              {s.margin.margin_pct !== null ? (
                <Badge appearance="tint" color={Number(s.margin.margin_pct) < 15 ? "warning" : "success"}>
                  {s.margin.margin_pct}% · {formatDecimalMoney(s.margin.margin_amount, s.margin.currency)}
                </Badge>
              ) : (
                "Not comparable"
              )}
            </dd>
          </>
        )}
        <dt>Resume</dt>
        <dd>{s.resume_file_id ? <a href={`/api/v1/files/${s.resume_file_id}/download`}>Download resume</a> : "—"}</dd>
        {s.reason_text_internal && (
          <>
            <dt>Internal note</dt>
            <dd>{s.reason_text_internal}</dd>
          </>
        )}
      </dl>
      <div className={styles.actions}>
        {open && (
          <>
            <Button appearance="primary" onClick={() => setDialog("accept")}>
              Accept
            </Button>
            <Button onClick={() => setDialog("reject")}>Reject</Button>
            <Button onClick={() => setDialog("duplicate")}>Mark duplicate</Button>
          </>
        )}
        {s.status === "duplicate" && <Button onClick={() => setDialog("reopen")}>Override duplicate</Button>}
      </div>
      <DecisionDialog sub={s} kind={dialog} onClose={() => setDialog(null)} />
    </Card>
  );
}

function DecisionDialog({
  sub,
  kind,
  onClose,
}: {
  sub: VendorSubmissionOut;
  kind: "accept" | "reject" | "duplicate" | "reopen" | null;
  onClose: () => void;
}) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const mut = useVendorMutations();
  const [mode, setMode] = useState<"create" | "link">("create");
  const [candidateId, setCandidateId] = useState("");
  const [reasonCode, setReasonCode] = useState(REJECT_REASONS[0].code);
  const [category, setCategory] = useState<DuplicateCategory>("other");
  const [note, setNote] = useState("");
  const [override, setOverride] = useState(sub.duplicate_findings.length > 0);
  const [error, setError] = useState<string | null>(null);
  const needsReason = kind === "reopen" || (kind === "accept" && override);
  const close = () => {
    setError(null);
    setNote("");
    onClose();
  };
  const submit = async () => {
    setError(null);
    try {
      if (kind === "accept") {
        await mut.accept.mutateAsync({
          id: sub.id,
          body: {
            create: mode === "create",
            link_candidate_id: mode === "link" ? candidateId.trim() : null,
            override_duplicate_rule: override,
            reason: note.trim() || null,
          },
        });
        toast.success("Accepted: the candidate is in the pipeline");
      } else if (kind === "reject") {
        await mut.reject.mutateAsync({ id: sub.id, body: { reason_code: reasonCode, note: note.trim() || null } });
      } else if (kind === "duplicate") {
        await mut.markDuplicate.mutateAsync({ id: sub.id, body: { category, note: note.trim() || null } });
      } else if (kind === "reopen") {
        await mut.reopen.mutateAsync({ id: sub.id, reason: note.trim() });
      }
      close();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const titles = { accept: "Accept submission", reject: "Reject submission", duplicate: "Mark as duplicate", reopen: "Override duplicate" };
  return (
    <Dialog open={kind !== null} onOpenChange={(_, d) => !d.open && close()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{kind ? titles[kind] : ""}</DialogTitle>
          <DialogContent className={admin.form}>
            <ErrorBar message={error} />
            {kind === "accept" && (
              <>
                <RadioGroup value={mode} onChange={(_, d) => setMode(d.value as "create" | "link")}>
                  <Radio value="create" label="Create a new candidate" />
                  <Radio value="link" label="Link an existing candidate" />
                </RadioGroup>
                {mode === "link" && (
                  <Field label="Candidate id" required>
                    <Input value={candidateId} onChange={(_, d) => setCandidateId(d.value)} />
                  </Field>
                )}
                {sub.duplicate_findings.length > 0 && (
                  <Switch checked={override} onChange={(_, d) => setOverride(d.checked)} label="Override the duplicate findings" />
                )}
              </>
            )}
            {kind === "reject" && (
              <Field label="Reason">
                <Dropdown
                  value={REJECT_REASONS.find((r) => r.code === reasonCode)?.label}
                  selectedOptions={[reasonCode]}
                  onOptionSelect={(_, d) => setReasonCode(String(d.optionValue))}
                >
                  {REJECT_REASONS.map((r) => (
                    <Option key={r.code} value={r.code}>
                      {r.label}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
            )}
            {kind === "duplicate" && (
              <Field label="Category">
                <Dropdown
                  value={DUPLICATE_CATEGORY_LABELS[category]}
                  selectedOptions={[category]}
                  onOptionSelect={(_, d) => setCategory(d.optionValue as DuplicateCategory)}
                >
                  {Object.entries(DUPLICATE_CATEGORY_LABELS).map(([k, label]) => (
                    <Option key={k} value={k}>
                      {label}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
            )}
            <Field label={needsReason ? "Reason" : "Internal note"} required={needsReason} hint="Never shown to the vendor.">
              <Textarea value={note} onChange={(_, d) => setNote(d.value)} maxLength={2000} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={close}>Cancel</Button>
            <Button
              appearance="primary"
              disabled={(needsReason && !note.trim()) || (kind === "accept" && mode === "link" && !candidateId.trim())}
              onClick={submit}
            >
              Confirm
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
