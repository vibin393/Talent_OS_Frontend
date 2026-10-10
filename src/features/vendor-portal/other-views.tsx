"use client";

import {
  Button,
  Card,
  CardHeader,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Subtitle2,
  Text,
} from "@fluentui/react-components";
import { ArrowDownload20Regular, ArrowUpload20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { formatDate, formatDateTime, formatDecimalMoney, pct } from "@/features/vendors/format";
import { DocStatusBadge } from "@/features/vendors/ui";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { vendorPortalApi } from "./client";
import { FilePickButton, LabelBadge, Loading, PortalError, PortalPage, usePortalStyles } from "./portal-ui";
import { submitErrorCopy } from "./submit-logic";
import {
  useVendorDashboard,
  useVendorDocuments,
  useVendorPlacements,
  useVendorPortalMutations,
  useVendorScorecard,
  useVendorStatements,
} from "./use-vendor-portal";

/** `/vendor`: open releases, submissions by label, upcoming interviews, active placements. */
export function VendorDashboard() {
  const styles = usePortalStyles();
  const q = useVendorDashboard();
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <PortalError error={q.error} />;
  const d = q.data;
  return (
    <PortalPage title={d.vendor_name}>
      {!d.can_operate && (
        <MessageBar intent="warning">
          <MessageBarBody>Your organisation is {d.vendor_status}; you can view releases but not submit yet.</MessageBarBody>
        </MessageBar>
      )}
      <div className={styles.cards}>
        <Card className={styles.card}>
          <Text>Open releases</Text>
          <AppLink href="/vendor/releases">
            <span className={styles.kpi}>{d.open_releases}</span>
          </AppLink>
        </Card>
        <Card className={styles.card}>
          <Text>Active placements</Text>
          <span className={styles.kpi}>{d.active_placements}</span>
        </Card>
      </div>
      <Subtitle2 as="h2">Submissions</Subtitle2>
      <div className={styles.row}>
        {d.submissions_by_label.length === 0 && <Text>No submissions yet.</Text>}
        {d.submissions_by_label.map((c) => (
          <span key={c.label}>
            <LabelBadge label={c.label} /> {c.count}
          </span>
        ))}
      </div>
      <Subtitle2 as="h2">Upcoming interviews</Subtitle2>
      {d.upcoming_interviews.length === 0 ? (
        <Text>None scheduled.</Text>
      ) : (
        <ul>
          {d.upcoming_interviews.map((i) => (
            <li key={i.submission_id}>
              <AppLink href={`/vendor/submissions/${i.submission_id}`}>{i.full_name ?? "Candidate"}</AppLink> ·{" "}
              {formatDateTime(i.at)}
            </li>
          ))}
        </ul>
      )}
    </PortalPage>
  );
}

/** `/vendor/placements`: worker, role, dates, status (never bill rate, margin or client contacts). */
export function VendorPlacementsView() {
  const styles = usePortalStyles();
  const q = useVendorPlacements();
  return (
    <PortalPage title="Placements">
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <PortalError error={q.error} />
      ) : !q.data?.length ? (
        <Text>No placements yet.</Text>
      ) : (
        <div className={styles.cards}>
          {q.data.map((p) => (
            <Card key={p.id} className={styles.card}>
              <CardHeader
                header={<Subtitle2>{p.worker_name ?? p.human_id}</Subtitle2>}
                description={<Text size={200}>{p.role_title ?? "—"}</Text>}
                action={<Text>{p.status}</Text>}
              />
              <Text size={200}>
                {formatDate(p.start_date)} – {formatDate(p.end_date)}
              </Text>
            </Card>
          ))}
        </div>
      )}
    </PortalPage>
  );
}

const CATEGORIES = ["agreement", "registration", "insurance", "other"] as const;

/** `/vendor/documents`: vendor documents with expiry status; renewals are uploaded for the Vendor Manager's review. */
export function VendorDocumentsView() {
  const styles = usePortalStyles();
  const q = useVendorDocuments();
  const { uploadDocument } = useVendorPortalMutations();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("insurance");
  const [expires, setExpires] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ intent: "success" | "error"; text: string } | null>(null);
  const upload = async () => {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    form.set("category", category);
    if (expires) form.set("expires_on", expires);
    try {
      await uploadDocument.mutateAsync(form);
      setMessage({ intent: "success", text: "Uploaded. Your account manager will review it." });
      setFile(null);
    } catch (e) {
      setMessage({ intent: "error", text: submitErrorCopy(isApiError(e) ? e.code : undefined, errorMessage(e)) });
    }
  };
  return (
    <PortalPage title="Documents">
      <div aria-live="polite">
        {message && (
          <MessageBar intent={message.intent}>
            <MessageBarBody>{message.text}</MessageBarBody>
          </MessageBar>
        )}
      </div>
      <div className={styles.row}>
        <Field label="Category">
          <Dropdown value={category} selectedOptions={[category]} onOptionSelect={(_, d) => setCategory(d.optionValue as (typeof CATEGORIES)[number])}>
            {CATEGORIES.map((c) => (
              <Option key={c} value={c}>
                {c}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Expires on">
          <Input type="date" value={expires} onChange={(_, d) => setExpires(d.value)} />
        </Field>
        <FilePickButton
          label={file ? file.name : "Choose file"}
          accept=".pdf,.docx,.png,.jpg,.jpeg"
          icon={<ArrowUpload20Regular />}
          className={styles.target}
          onFile={setFile}
        />
        <Button appearance="primary" className={styles.target} disabled={!file || uploadDocument.isPending} onClick={upload}>
          Upload
        </Button>
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <PortalError error={q.error} />
      ) : (
        <div className={styles.cards}>
          {(q.data ?? []).map((d) => (
            <Card key={d.id} className={styles.card}>
              <CardHeader header={<Subtitle2>{d.title}</Subtitle2>} description={<Text size={200}>{d.category}</Text>} action={<DocStatusBadge status={d.status} />} />
              <Text size={200}>
                Expires {formatDate(d.expires_on)}
                {d.pending_review && " · pending review"}
              </Text>
              {d.file_id && <a href={vendorPortalApi.fileUrl(d.file_id)}>Download</a>}
            </Card>
          ))}
        </div>
      )}
    </PortalPage>
  );
}

/** `/vendor/statements`: finalized payable statements (PDF / CSV). */
export function VendorStatementsView() {
  const styles = usePortalStyles();
  const q = useVendorStatements();
  return (
    <PortalPage title="Statements">
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <PortalError error={q.error} />
      ) : !q.data?.length ? (
        <Text>No statements yet.</Text>
      ) : (
        <div className={styles.cards}>
          {q.data.map((s) => (
            <Card key={s.id} className={styles.card}>
              <CardHeader
                header={<Subtitle2>{s.human_id}</Subtitle2>}
                description={<Text size={200}>{`${formatDate(s.period_start)} – ${formatDate(s.period_end)}`}</Text>}
              />
              <Text weight="semibold">{formatDecimalMoney(s.total_amount, s.currency)}</Text>
              <div className={styles.row}>
                <Button as="a" href={vendorPortalApi.statementUrl(s.id, "pdf")} icon={<ArrowDownload20Regular />} className={styles.target}>
                  PDF
                </Button>
                <Button as="a" href={vendorPortalApi.statementUrl(s.id, "csv")} icon={<ArrowDownload20Regular />} className={styles.target}>
                  CSV
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PortalPage>
  );
}

/** `/vendor/scorecard`: shown only when the tenant shares scorecards with vendors (404 otherwise). */
export function VendorScorecardView() {
  const styles = usePortalStyles();
  const q = useVendorScorecard();
  if (q.isLoading) return <Loading />;
  if (isApiError(q.error) && q.error.status === 404) {
    return (
      <PortalPage title="Scorecard">
        <Text>Your scorecard is not shared yet.</Text>
      </PortalPage>
    );
  }
  if (q.error || !q.data) return <PortalError error={q.error} />;
  const s = q.data;
  const tiles: [string, string][] = [
    ["Releases received", String(s.releases_received)],
    ["Submissions", String(s.submissions)],
    ["Acceptance", pct(s.acceptance_pct)],
    ["Duplicates", pct(s.duplicate_pct)],
    ["Submission → interview", pct(s.submission_to_interview_pct)],
    ["Interview → offer", pct(s.interview_to_offer_pct)],
    ["Placements", String(s.placements)],
    ["Median hours to first submission", s.median_hours_to_first_submission ?? "—"],
  ];
  return (
    <PortalPage title="Scorecard">
      <Text>
        {formatDate(s.period_from)} – {formatDate(s.period_to)}
      </Text>
      <div className={styles.cards}>
        {tiles.map(([label, value]) => (
          <Card key={label} className={styles.card}>
            <Text>{label}</Text>
            <span className={styles.kpi}>{value}</span>
          </Card>
        ))}
      </div>
    </PortalPage>
  );
}
