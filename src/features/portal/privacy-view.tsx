"use client";

import {
  Badge,
  Body1,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  MessageBarTitle,
  Radio,
  RadioGroup,
  Spinner,
  Subtitle1,
  Text,
  Textarea,
} from "@fluentui/react-components";
import { ArrowDownload20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { apiRequest } from "@/lib/api/client";
import { portalRequest } from "@/lib/api/portal-client";
import { downloadApiFile } from "@/lib/api/download";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { portalApi, portalKeys } from "@/lib/api/portal-client";
import type { PortalConsent, PortalMe, PublicApplyForm, PublicNotice, PublicPostingPage } from "@/lib/api/types";
import {
  CONSENT_PURPOSE_LABELS,
  READ_ONLY_PURPOSES,
  CONSENT_STATUS_LABELS,
  CORRECTION_FIELDS,
  DSR_KIND_LABELS,
  DSR_STATUS,
  EXPORT_STATUS,
  formatDate,
  formatDateTime,
  REGRANTABLE,
} from "./format";
import { type PrivacyRequestDraft, validatePrivacyRequest } from "./forms";
import { ErrorBlock, InlineError, LoadingBlock, PortalPageHeader, usePortalStyles } from "./ui";
import { PortalMessagesSection } from "@/features/messaging/portal-messages";
import { PortalSelfIdSection } from "@/features/fairness/portal-self-id-section";

/**
 * The tenant's active AI / marketing notices, read from the public apply form of a live posting (the
 * portal API has no notice endpoint). Null when the career site has no live posting.
 */
function useActiveNotices(slug: string | undefined) {
  return useQuery({
    queryKey: ["portal", "active-notices", slug],
    enabled: !!slug,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async ({ signal }): Promise<PublicNotice[] | null> => {
      const base = `/api/v1/public/careers/${encodeURIComponent(slug as string)}`;
      const page = await apiRequest<PublicPostingPage>(`${base}/postings?page=1&page_size=1`, { signal, skipAuthHandler: true });
      const first = page.items[0];
      if (!first) return null;
      const form = await apiRequest<PublicApplyForm>(`${base}/postings/${encodeURIComponent(first.id)}/apply-form`, { signal, skipAuthHandler: true });
      return form.notices;
    },
  });
}

function WithdrawConsentDialog({ consent, onClose, onWithdrawn }: { consent: PortalConsent; onClose: () => void; onWithdrawn: (suggestErasure: boolean) => void }) {
  const styles = usePortalStyles();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({ mutationFn: () => portalApi.withdrawConsent(consent.id) });
  const label = CONSENT_PURPOSE_LABELS[consent.purpose] ?? consent.purpose;
  const submit = async () => {
    setError(null);
    try {
      const out = await m.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: portalKeys.consents });
      onWithdrawn(out.details.suggest_erasure);
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !m.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Withdraw consent?</DialogTitle>
          <DialogContent className={styles.form}>
            <InlineError message={error} />
            <Body1>
              You are withdrawing your consent to: <strong>{label}</strong>
              {consent.client_name ? ` (${consent.client_name})` : ""}. This takes effect immediately.
            </Body1>
            {consent.purpose === "data_processing" && (
              <Body1>Without this consent we can no longer consider you for jobs. You can also ask us to erase your data.</Body1>
            )}
          </DialogContent>
          <DialogActions>
            <Button className={styles.button} onClick={onClose} disabled={m.isPending}>
              Cancel
            </Button>
            <Button appearance="primary" className={styles.button} onClick={submit} disabled={m.isPending} icon={m.isPending ? <Spinner size="tiny" /> : undefined}>
              Withdraw consent
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function GrantConsentDialog({ notice, onClose }: { notice: PublicNotice; onClose: () => void }) {
  const styles = usePortalStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({ mutationFn: () => portalApi.grantConsent({ purpose: notice.purpose as "ai_processing" | "marketing", notice_id: notice.id }) });
  const submit = async () => {
    setError(null);
    try {
      await m.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: portalKeys.consents });
      toast.success("Thank you — your consent was recorded");
      onClose();
    } catch (e) {
      if (isApiError(e) && e.code === "notice_outdated") {
        void queryClient.invalidateQueries({ queryKey: ["portal", "active-notices"] });
        setError("The notice was just updated. Close this dialog and review it again.");
      } else setError(errorMessage(e));
    }
  };
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !m.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{notice.title}</DialogTitle>
          <DialogContent className={styles.form}>
            <InlineError message={error} />
            <div role="region" aria-label={notice.title} tabIndex={0} style={{ maxHeight: 260, overflowY: "auto" }} dangerouslySetInnerHTML={{ __html: notice.body_html || notice.body }} />
          </DialogContent>
          <DialogActions>
            <Button className={styles.button} onClick={onClose} disabled={m.isPending}>
              Cancel
            </Button>
            <Button appearance="primary" className={styles.button} onClick={submit} disabled={m.isPending} icon={m.isPending ? <Spinner size="tiny" /> : undefined}>
              I agree
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function RequestDialog({ initialKind, onClose }: { initialKind: PrivacyRequestDraft["kind"]; onClose: () => void }) {
  const styles = usePortalStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [d, setD] = useState<PrivacyRequestDraft>({ kind: initialKind, details: "", fields: [] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () =>
      portalApi.createPrivacyRequest({
        kind: d.kind as "correction" | "erasure",
        details: d.details.trim(),
        fields: d.kind === "correction" && d.fields.length ? d.fields : null,
      }),
  });
  const submit = async () => {
    setError(null);
    const e = validatePrivacyRequest(d);
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      await m.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: portalKeys.privacyRequests });
      toast.success("Your request was sent. We'll respond within 30 days.");
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <Dialog open onOpenChange={(_, x) => !x.open && !m.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Request a correction or erasure</DialogTitle>
          <DialogContent className={styles.form}>
            <InlineError message={error} />
            <Field label="What would you like us to do?" required validationState={errors.kind ? "error" : "none"} validationMessage={errors.kind}>
              <RadioGroup value={d.kind} onChange={(_, x) => setD((v) => ({ ...v, kind: x.value as PrivacyRequestDraft["kind"] }))}>
                <Radio value="correction" label="Correct information about me" />
                <Radio value="erasure" label="Erase my personal data" />
              </RadioGroup>
            </Field>
            {d.kind === "correction" && (
              <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
                <legend>
                  <Text weight="semibold">Which information? (optional)</Text>
                </legend>
                {CORRECTION_FIELDS.map((f) => (
                  <Checkbox
                    key={f.value}
                    label={f.label}
                    checked={d.fields.includes(f.value)}
                    onChange={(_, x) => setD((v) => ({ ...v, fields: x.checked ? [...v.fields, f.value] : v.fields.filter((y) => y !== f.value) }))}
                  />
                ))}
              </fieldset>
            )}
            {d.kind === "erasure" && (
              <MessageBar intent="warning" layout="multiline">
                <MessageBarBody>Once your data is erased we can no longer consider you for jobs. Some records may be kept where the law requires it.</MessageBarBody>
              </MessageBar>
            )}
            <Field label="Details" required validationState={errors.details ? "error" : "none"} validationMessage={errors.details}>
              <Textarea value={d.details} maxLength={4000} resize="vertical" onChange={(_, x) => setD((v) => ({ ...v, details: x.value }))} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button className={styles.button} onClick={onClose} disabled={m.isPending}>
              Cancel
            </Button>
            <Button appearance="primary" className={styles.button} onClick={submit} disabled={m.isPending} icon={m.isPending ? <Spinner size="tiny" /> : undefined}>
              Send request
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function Consents({ onSuggestErasure }: { onSuggestErasure: () => void }) {
  const styles = usePortalStyles();
  const me = useQuery<PortalMe>({ queryKey: portalKeys.me, enabled: false });
  const q = useQuery({ queryKey: portalKeys.consents, queryFn: ({ signal }) => portalApi.consents(signal) });
  const notices = useActiveNotices(me.data?.tenant.slug);
  const [withdrawing, setWithdrawing] = useState<PortalConsent | null>(null);
  const [granting, setGranting] = useState<PublicNotice | null>(null);
  const [suggest, setSuggest] = useState(false);

  const activePurposes = new Set((q.data ?? []).filter((c) => c.status === "granted").map((c) => c.purpose));
  const regrantable = REGRANTABLE.filter((p) => !activePurposes.has(p))
    .map((p) => notices.data?.find((n) => n.purpose === p))
    .filter((n): n is PublicNotice => !!n);

  return (
    <Card className={styles.card} role="region" aria-labelledby="consents-title">
      <Subtitle1 as="h2" id="consents-title">
        Your consents
      </Subtitle1>
      <Body1 className={styles.muted}>What you have allowed us to do with your data. You can withdraw a consent at any time.</Body1>
      {suggest && (
        <MessageBar intent="info" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>Consent withdrawn</MessageBarTitle>
            You can also ask us to erase your personal data.
          </MessageBarBody>
          <MessageBarActions>
            <Button onClick={onSuggestErasure}>Request erasure</Button>
          </MessageBarActions>
        </MessageBar>
      )}
      {q.isPending ? (
        <LoadingBlock label="Loading consents" />
      ) : q.isError ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <Body1 className={styles.empty}>No consents recorded.</Body1>
      ) : (
        <ul className={styles.list}>
          {q.data.map((c) => (
            <li key={c.id} className={styles.row}>
              <div className={styles.rowMain}>
                <Text weight="semibold">
                  {CONSENT_PURPOSE_LABELS[c.purpose] ?? c.purpose}
                  {c.client_name ? ` — ${c.client_name}` : ""}
                </Text>
                <Text size={200} className={styles.muted}>
                  {c.status === "withdrawn" ? `Withdrawn ${formatDate(c.withdrawn_at)}` : `Given ${formatDate(c.granted_at)}`}
                  {c.notice_version ? ` · notice version ${c.notice_version}` : ""}
                </Text>
              </div>
              <div className={styles.actions}>
                <Badge appearance="outline" color={c.status === "granted" ? "success" : "subtle"}>
                  {CONSENT_STATUS_LABELS[c.status] ?? c.status}
                </Badge>
                {c.status === "granted" && READ_ONLY_PURPOSES.includes(c.purpose) && (
                  <Text size={200} className={styles.muted}>
                    Required while you are on assignment
                  </Text>
                )}
                {c.status === "granted" && !READ_ONLY_PURPOSES.includes(c.purpose) && (
                  <Button className={styles.button} onClick={() => setWithdrawing(c)} aria-label={`Withdraw consent: ${CONSENT_PURPOSE_LABELS[c.purpose] ?? c.purpose}`}>
                    Withdraw
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {regrantable.length > 0 && (
        <div className={styles.actions}>
          {regrantable.map((n) => (
            <Button key={n.id} className={styles.button} onClick={() => setGranting(n)}>
              Allow {CONSENT_PURPOSE_LABELS[n.purpose]?.toLowerCase() ?? n.purpose}
            </Button>
          ))}
        </div>
      )}
      {withdrawing && (
        <WithdrawConsentDialog
          consent={withdrawing}
          onClose={() => setWithdrawing(null)}
          onWithdrawn={(s) => {
            setWithdrawing(null);
            setSuggest(s);
          }}
        />
      )}
      {granting && <GrantConsentDialog notice={granting} onClose={() => setGranting(null)} />}
    </Card>
  );
}

function DataExport() {
  const styles = usePortalStyles();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({
    queryKey: portalKeys.exports,
    queryFn: ({ signal }) => portalApi.exports(signal),
    refetchInterval: (query) => ((query.state.data ?? []).some((j) => j.status === "queued" || j.status === "running") ? 5000 : false),
  });
  const request = useMutation({ mutationFn: portalApi.requestExport, onSuccess: () => queryClient.invalidateQueries({ queryKey: portalKeys.exports }) });
  const busy = (q.data ?? []).some((j) => j.status === "queued" || j.status === "running");

  const onRequest = async () => {
    setError(null);
    try {
      await request.mutateAsync();
    } catch (e) {
      if (isApiError(e) && e.code === "export_in_progress") setError("Your data is already being prepared. We'll email you when it is ready.");
      else if (isApiError(e) && e.status === 429) setError("You can request up to 3 copies a day. Please try again tomorrow.");
      else setError(errorMessage(e));
    }
  };

  return (
    <Card className={styles.card} role="region" aria-labelledby="export-title">
      <Subtitle1 as="h2" id="export-title">
        Download my data
      </Subtitle1>
      <Body1 className={styles.muted}>Get a copy of the personal data we hold about you. We&apos;ll email you when it is ready, usually within minutes.</Body1>
      <InlineError message={error} />
      <div>
        <Button appearance="primary" className={styles.button} onClick={onRequest} disabled={request.isPending || busy} icon={request.isPending ? <Spinner size="tiny" /> : undefined}>
          Download my data
        </Button>
      </div>
      {q.isPending ? (
        <LoadingBlock label="Loading exports" rows={1} />
      ) : q.isError ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} />
      ) : (
        q.data.length > 0 && (
          <ul className={styles.list} aria-live="polite">
            {q.data.map((j) => {
              const s = EXPORT_STATUS[j.status] ?? { label: j.status, color: "subtle" as const };
              return (
                <li key={j.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <Text>Requested {formatDateTime(j.requested_at)}</Text>
                    {j.expires_at && j.status === "ready" && (
                      <Text size={200} className={styles.muted}>
                        Available until {formatDateTime(j.expires_at)}
                      </Text>
                    )}
                  </div>
                  <div className={styles.actions}>
                    <Badge appearance="tint" color={s.color}>
                      {s.label}
                    </Badge>
                    {j.status === "ready" && j.download_url && (
                      <Button
                        icon={<ArrowDownload20Regular />}
                        className={styles.button}
                        onClick={() => downloadApiFile(j.download_url as string, "my-data.zip").catch((e) => setError(errorMessage(e)))}
                      >
                        Download
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}
    </Card>
  );
}

function Requests({ onNew }: { onNew: () => void }) {
  const styles = usePortalStyles();
  const q = useQuery({ queryKey: portalKeys.privacyRequests, queryFn: ({ signal }) => portalApi.privacyRequests(signal) });
  return (
    <Card className={styles.card} role="region" aria-labelledby="requests-title" id="requests">
      <Subtitle1 as="h2" id="requests-title">
        Correction and erasure requests
      </Subtitle1>
      <Body1 className={styles.muted}>Ask us to correct information about you (including your email address) or to erase your data. We respond within 30 days.</Body1>
      <div>
        <Button appearance="primary" className={styles.button} onClick={onNew}>
          Request correction / erasure
        </Button>
      </div>
      {q.isPending ? (
        <LoadingBlock label="Loading requests" rows={1} />
      ) : q.isError ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} />
      ) : (
        q.data.length > 0 && (
          <ul className={styles.list}>
            {q.data.map((r) => {
              const s = DSR_STATUS[r.status] ?? { label: r.status, color: "subtle" as const };
              return (
                <li key={r.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <Text weight="semibold">{DSR_KIND_LABELS[r.kind] ?? r.kind}</Text>
                    <Text size={200} className={styles.muted}>
                      Received {formatDate(r.received_at)}
                      {r.completed_at ? ` · completed ${formatDate(r.completed_at)}` : ` · due by ${formatDate(r.due_at)}`}
                    </Text>
                  </div>
                  <Badge appearance="tint" color={s.color}>
                    {s.label}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )
      )}
    </Card>
  );
}

/** Row of the "Where your data went" panel (Epic 79 story 79.5, FR-408; `/api/v1/portal/privacy/data-recipients`). */
type DataRecipient = {
  installation: string;
  publisher: string | null;
  purposes: string[];
  destination_country: string | null;
  first_at: string | null;
  last_at: string | null;
};

/** "Where your data went": the connected systems this person's data was shared with (own exposures only). */
function DataRecipients() {
  const styles = usePortalStyles();
  const q = useQuery({
    queryKey: ["portal", "data-recipients"],
    queryFn: ({ signal }) => portalRequest<DataRecipient[]>("/api/v1/portal/privacy/data-recipients", { signal }),
  });
  return (
    <Card className={styles.card} role="region" aria-labelledby="recipients-title">
      <Subtitle1 as="h2" id="recipients-title">
        Where your data went
      </Subtitle1>
      <Body1 className={styles.muted}>The connected systems your data has been shared with, and why.</Body1>
      {q.isPending ? (
        <LoadingBlock label="Loading connected systems" rows={1} />
      ) : q.isError ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <Body1 className={styles.empty}>We haven&apos;t shared your data with connected systems.</Body1>
      ) : (
        <ul className={styles.list}>
          {q.data.map((r, i) => (
            <li key={`${r.installation}:${i}`} className={styles.row}>
              <div className={styles.rowMain}>
                <Text weight="semibold">
                  {r.installation}
                  {r.purposes.length ? ` — ${r.purposes.join(", ")}` : ""}
                </Text>
                <Text size={200} className={styles.muted}>
                  {r.destination_country ? `${r.destination_country} · ` : ""}
                  First shared {formatDate(r.first_at)}
                  {r.last_at ? ` · last shared ${formatDate(r.last_at)}` : ""}
                </Text>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Privacy self-service: consents (withdraw / re-grant), data export, correction and erasure requests. */
export function PrivacyView() {
  const styles = usePortalStyles();
  const [requestKind, setRequestKind] = useState<PrivacyRequestDraft["kind"] | null>(null);
  return (
    <div className={styles.page}>
      <PortalPageHeader title="Privacy" subtitle="Control how your personal data is used." />
      <Consents onSuggestErasure={() => setRequestKind("erasure")} />
      <DataRecipients />
      <PortalMessagesSection />
      <PortalSelfIdSection />
      <DataExport />
      <Requests onNew={() => setRequestKind("")} />
      {requestKind !== null && <RequestDialog initialKind={requestKind} onClose={() => setRequestKind(null)} />}
    </div>
  );
}
