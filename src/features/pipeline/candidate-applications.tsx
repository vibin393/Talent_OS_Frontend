"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Dropdown,
  Field,
  makeStyles,
  Option,
  Spinner,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import { MailArrowUp20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog, ErrorBar, formatDateTime, GridSkeleton } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { CONSENT_PURPOSE_LABELS, ENGAGEMENT_NOTE, isWithdrawableConsent } from "@/features/privacy/format";
import { errorMessage } from "@/lib/api/errors";
import type { CandidateConsentOut, PipelineConsentRequestIn } from "@/lib/api/types";
import { pipelineApi, pipelineKeys } from "./api";
import { FeedbackBadge } from "./badges";
import { pipelineError } from "./use-actions";

const useStyles = makeStyles({
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: tokens.spacingHorizontalL, alignItems: "start" },
  card: { padding: tokens.spacingHorizontalM, gap: tokens.spacingVerticalS },
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" },
  item: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    flexWrap: "wrap",
    padding: `${tokens.spacingVerticalS} 0`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    ":last-child": { borderBottom: "none" },
  },
  text: { display: "flex", flexDirection: "column", minWidth: 0, flex: 1 },
  muted: { color: tokens.colorNeutralForeground3 },
  row: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "flex-end", flexWrap: "wrap" },
});

// Epic 35: the full purpose list (BGV, reference checks, vendor collection, WhatsApp, engagement).
const PURPOSE_LABELS: Record<string, string> = CONSENT_PURPOSE_LABELS;
const SOURCE_LABELS: Record<string, string> = {
  candidate_link: "Candidate (link)",
  candidate_portal: "Candidate portal",
  application: "Application",
  recruiter_attestation: "Recruiter attestation",
  import: "Import",
};
const REQUESTABLE: PipelineConsentRequestIn["purpose"][] = ["data_processing", "ai_processing", "marketing"];

/** Candidate 360 "Applications" tab: the candidate's applications and consents. */
export function CandidateApplications({ candidateId }: { candidateId: string }) {
  const styles = useStyles();
  const canReadApps = usePermission("application:read");
  const canReadConsents = usePermission("consent:read");
  return (
    <div className={styles.grid}>
      {canReadApps ? <ApplicationsCard candidateId={candidateId} /> : <Body1>You do not have access to applications.</Body1>}
      {canReadConsents && <ConsentsCard candidateId={candidateId} />}
    </div>
  );
}

function ApplicationsCard({ candidateId }: { candidateId: string }) {
  const styles = useStyles();
  const apps = useQuery({
    queryKey: pipelineKeys.candidate(candidateId),
    queryFn: ({ signal }) => pipelineApi.candidateApplications(candidateId, signal),
  });
  return (
    <Card className={styles.card}>
      <CardHeader header={<Subtitle2 as="h2">Applications</Subtitle2>} description={apps.data ? `${apps.data.length} demand${apps.data.length === 1 ? "" : "s"}` : undefined} />
      {apps.isPending ? (
        <GridSkeleton rows={3} />
      ) : apps.isError ? (
        <ErrorBar title="Could not load applications." message={errorMessage(apps.error)} />
      ) : apps.data.length === 0 ? (
        <Body1 className={styles.muted}>Not in any demand pipeline yet. Add the candidate from a demand&apos;s Pipeline tab.</Body1>
      ) : (
        <ul className={styles.list}>
          {[...apps.data]
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .map((a) => (
              <li key={a.id} className={styles.item}>
                <span className={styles.text}>
                  <AppLink href={`/demands/${a.demand_id}?tab=pipeline`}>{a.demand_title ?? a.human_id}</AppLink>
                  <Caption1 className={styles.muted}>
                    {a.human_id} · in stage since {formatDateTime(a.stage_entered_at)}
                  </Caption1>
                </span>
                <Badge appearance="tint" color={["rejected", "withdrawn"].includes(a.stage.key) ? "subtle" : a.stage.key === "hired" ? "success" : "brand"}>
                  {a.stage.label}
                </Badge>
                <FeedbackBadge status={a.last_client_feedback} />
              </li>
            ))}
        </ul>
      )}
    </Card>
  );
}

function ConsentsCard({ candidateId }: { candidateId: string }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canWrite = usePermission("consent:write");
  const [purpose, setPurpose] = useState<PipelineConsentRequestIn["purpose"]>("data_processing");
  const [withdrawing, setWithdrawing] = useState<CandidateConsentOut | null>(null);
  const consents = useQuery({
    queryKey: pipelineKeys.consents(candidateId),
    queryFn: ({ signal }) => pipelineApi.consents(candidateId, signal),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: pipelineKeys.consents(candidateId) });
  const send = useMutation({
    mutationFn: () => pipelineApi.requestConsent(candidateId, { purpose }),
    onSuccess: (r) => {
      const status = r.items[0]?.status ?? "sent";
      if (status === "sent") toast.success("Consent request emailed to the candidate.");
      else toast.info(`Consent request not sent: ${status.replace(/_/g, " ")}.`);
    },
    onError: (e) => toast.error(pipelineError(e)),
    onSettled: refresh,
  });
  const rows = [...(consents.data ?? [])].sort((a, b) => (b.granted_at ?? "").localeCompare(a.granted_at ?? ""));
  return (
    <Card className={styles.card}>
      <CardHeader header={<Subtitle2 as="h2">Consents</Subtitle2>} />
      {consents.isPending ? (
        <GridSkeleton rows={2} />
      ) : consents.isError ? (
        <ErrorBar title="Could not load consents." message={errorMessage(consents.error)} />
      ) : rows.length === 0 ? (
        <Body1 className={styles.muted}>No consents recorded.</Body1>
      ) : (
        <ul className={styles.list}>
          {rows.map((c) => (
            <li key={c.id} className={styles.item}>
              <span className={styles.text}>
                <Text weight="semibold">{PURPOSE_LABELS[c.purpose] ?? c.purpose}</Text>
                <Caption1 className={styles.muted}>
                  {SOURCE_LABELS[c.source] ?? c.source}
                  {c.granted_at ? ` · granted ${formatDateTime(c.granted_at)}` : ""}
                  {c.withdrawn_at ? ` · withdrawn ${formatDateTime(c.withdrawn_at)}` : ""}
                </Caption1>
              </span>
              <Badge appearance="tint" color={c.status === "granted" ? "success" : "subtle"}>
                {c.status === "granted" ? "Granted" : "Withdrawn"}
              </Badge>
              {!isWithdrawableConsent(c.purpose) && <Caption1 className={styles.muted}>{ENGAGEMENT_NOTE}</Caption1>}
              {canWrite && c.status === "granted" && isWithdrawableConsent(c.purpose) && (
                <Button size="small" appearance="subtle" onClick={() => setWithdrawing(c)}>
                  Withdraw
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canWrite && (
        <div className={styles.row}>
          <Field label="Request consent for">
            <Dropdown value={PURPOSE_LABELS[purpose]} selectedOptions={[purpose]} onOptionSelect={(_, d) => setPurpose((d.optionValue as typeof purpose) ?? purpose)}>
              {REQUESTABLE.map((p) => (
                <Option key={p} value={p}>
                  {PURPOSE_LABELS[p]}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <Button icon={send.isPending ? <Spinner size="tiny" /> : <MailArrowUp20Regular />} disabled={send.isPending} onClick={() => send.mutate()}>
            Send request
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={!!withdrawing}
        title="Withdraw this consent?"
        confirmLabel="Withdraw"
        onClose={() => setWithdrawing(null)}
        onConfirm={() =>
          pipelineApi
            .withdrawConsent(withdrawing!.id)
            .then(() => {
              toast.success("Consent withdrawn.");
              return refresh();
            })
            .catch((e) => {
              toast.error(pipelineError(e));
              throw e;
            })
        }
      >
        Withdrawing takes effect immediately. Record a withdrawal only when the candidate asked for it.
      </ConfirmDialog>
    </Card>
  );
}
