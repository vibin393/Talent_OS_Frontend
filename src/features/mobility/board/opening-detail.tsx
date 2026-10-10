"use client";

import {
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
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  Subtitle2,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { ArrowLeft20Regular } from "@fluentui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { ErrorBlock, LoadingBlock } from "@/features/portal/ui";
import { EMPLOYMENT_TYPE_LABELS, labelOf, WORK_MODE_LABELS } from "@/features/referrals/logic";
import { isApiError } from "@/lib/api/errors";
import { type ApplyForm, applyFormErrors, canSubmitApply, COVER_NOTE_MAX, errorReasons, formatDay, mobilityErrorMessage } from "../logic";
import type { OpeningDetailOut } from "../types";
import { employeeKeys, useOpening, useProfilePreview } from "../use-mobility";
import { APP_SURFACE, EligibilityBar, FitBadge, MobilityStatusBadge, type Surface, SurfaceHeader, useMobilityStyles, usePageClass, WORK_SURFACE } from "./shared";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, minWidth: 0 },
  skills: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  skill: {
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  jd: { overflowWrap: "anywhere", "& p": { marginBlock: tokens.spacingVerticalXS } },
  disclosure: {
    whiteSpace: "pre-wrap",
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  dl: {
    margin: 0,
    display: "grid",
    gridTemplateColumns: "max-content minmax(0, 1fr)",
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalXS,
    "& dt": { color: tokens.colorNeutralForeground3 },
    "& dd": { margin: 0, overflowWrap: "anywhere" },
  },
});

export function InternalJobDetail({ demandId }: { demandId: string }) {
  return <OpeningDetail surface={APP_SURFACE} demandId={demandId} />;
}

export function WorkOpportunityDetail({ demandId }: { demandId: string }) {
  return <OpeningDetail surface={WORK_SURFACE} demandId={demandId} />;
}

function OpeningDetail({ surface, demandId }: { surface: Surface; demandId: string }) {
  const styles = useStyles();
  const m = useMobilityStyles();
  const pageClass = usePageClass(surface);
  const q = useOpening(surface.client, demandId);
  const [applying, setApplying] = useState(false);

  const back = (
    <AppLink href={surface.base}>
      <ArrowLeft20Regular aria-hidden style={{ verticalAlign: "middle" }} /> All openings
    </AppLink>
  );
  if (q.isPending) return <LoadingBlock label="Loading opening" />;
  if (q.isError) {
    return (
      <div className={pageClass}>
        {back}
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} />
      </div>
    );
  }
  const o = q.data;
  return (
    <div className={pageClass}>
      {back}
      <SurfaceHeader
        surface={surface}
        title={o.title}
        subtitle={[o.location_text, labelOf(WORK_MODE_LABELS, o.work_mode), o.employment_type ? labelOf(EMPLOYMENT_TYPE_LABELS, o.employment_type) : null]
          .filter((x) => x && x !== "—")
          .join(" · ")}
      />
      <div className={m.badges}>
        <FitBadge fitPct={o.fit_pct} reasons={o.fit_reasons} />
        {o.application_status && <MobilityStatusBadge status={o.application_status} prefix="Applied" />}
        {o.closes_at && <Text size={200} className={m.muted}>{`Closes ${formatDay(o.closes_at)}`}</Text>}
      </div>
      {o.fit_pct != null && o.fit_reasons.length > 0 && (
        <Text size={200} className={m.muted}>
          {o.fit_reasons.join(" · ")}
        </Text>
      )}
      <EligibilityBar eligible={o.eligible} reasons={o.reasons} />

      <div className={m.headerRow}>
        {o.application_status ? (
          <AppLink href={surface.applicationsHref}>View my application</AppLink>
        ) : (
          <Button appearance="primary" className={m.tall} disabled={!o.can_apply} onClick={() => setApplying(true)}>
            Apply
          </Button>
        )}
      </div>

      <Card className={styles.card}>
        <Subtitle2 as="h2">Skills</Subtitle2>
        {o.skills.length === 0 ? (
          <Body1 className={m.muted}>No specific skills listed.</Body1>
        ) : (
          <ul className={styles.skills} aria-label="Skills">
            {o.skills.map((s) => (
              <li key={s.name} className={styles.skill}>
                <Text size={200}>
                  {s.name}
                  {s.min_proficiency != null ? ` · level ${s.min_proficiency}+` : ""}
                </Text>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className={styles.card}>
        <Subtitle2 as="h2">About the role</Subtitle2>
        {o.summary_html ? (
          // Sanitised server-side (nh3).
          <div className={styles.jd} dangerouslySetInnerHTML={{ __html: o.summary_html }} />
        ) : (
          <Body1 className={m.muted}>No description yet.</Body1>
        )}
      </Card>

      {applying && <ApplyDialog surface={surface} opening={o} onClose={() => setApplying(false)} />}
    </div>
  );
}

function ApplyDialog({ surface, opening, onClose }: { surface: Surface; opening: OpeningDetailOut; onClose: () => void }) {
  const styles = useStyles();
  const m = useMobilityStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const keys = employeeKeys(surface.client.scope);
  const profile = useProfilePreview(surface.client, surface.variant === "app");
  const [form, setForm] = useState<ApplyForm>({ disclosureAck: false, coverNote: "" });
  const [touched, setTouched] = useState(false);
  const errors = applyFormErrors(form);

  const apply = useMutation({
    mutationFn: () => surface.client.apply(opening.demand_id, { disclosure_ack: form.disclosureAck, cover_note: form.coverNote.trim() || null }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.root });
      toast.success("Application sent. We'll let you know when your manager responds.");
      onClose();
    },
  });
  const err = isApiError(apply.error) ? apply.error : null;
  const reasons = errorReasons(err ?? undefined);

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !apply.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{`Apply for ${opening.title}`}</DialogTitle>
          <DialogContent>
            <form
              id="mobility-apply"
              className={m.form}
              onSubmit={(e) => {
                e.preventDefault();
                setTouched(true);
                if (canSubmitApply(form)) apply.mutate();
              }}
            >
              {apply.isError && (
                <MessageBar intent="error" layout="multiline" role="alert">
                  <MessageBarBody>
                    <MessageBarTitle>{mobilityErrorMessage(err)}</MessageBarTitle>
                    {reasons.length > 0 && (
                      <ul className={m.reasons}>
                        {reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    )}
                  </MessageBarBody>
                </MessageBar>
              )}

              {surface.variant === "app" && (
                <section aria-label="Your candidate profile">
                  <Subtitle2 as="h3">Your profile</Subtitle2>
                  {profile.isPending ? (
                    <Spinner size="tiny" label="Loading your profile" />
                  ) : profile.isError ? (
                    <Body1 className={m.muted}>We could not load your profile preview.</Body1>
                  ) : (
                    <>
                      {profile.data.will_create && (
                        <MessageBar intent="info" layout="multiline">
                          <MessageBarBody>We will create a candidate profile from your account.</MessageBarBody>
                        </MessageBar>
                      )}
                      <dl className={styles.dl}>
                        <dt>Name</dt>
                        <dd>{profile.data.full_name}</dd>
                        <dt>Email</dt>
                        <dd>{profile.data.email}</dd>
                        <dt>Current title</dt>
                        <dd>{profile.data.current_title || "—"}</dd>
                        <dt>Skills</dt>
                        <dd>{profile.data.skills.length ? profile.data.skills.join(", ") : "—"}</dd>
                      </dl>
                    </>
                  )}
                </section>
              )}

              <section aria-labelledby="mobility-disclosure">
                <Subtitle2 as="h3" id="mobility-disclosure">
                  Before you apply
                </Subtitle2>
                <div className={styles.disclosure}>
                  <Body1>{opening.disclosure_text}</Body1>
                </div>
              </section>
              <Field
                required
                validationState={touched && errors.disclosureAck ? "error" : "none"}
                validationMessage={touched ? errors.disclosureAck : undefined}
              >
                <Checkbox
                  required
                  checked={form.disclosureAck}
                  label="I understand"
                  onChange={(_, d) => setForm((f) => ({ ...f, disclosureAck: d.checked === true }))}
                />
              </Field>
              <Field
                label="Cover note (optional)"
                validationState={errors.coverNote ? "error" : "none"}
                validationMessage={errors.coverNote}
                hint="Tell the hiring team why you are interested."
              >
                <Textarea
                  value={form.coverNote}
                  maxLength={COVER_NOTE_MAX}
                  resize="vertical"
                  onChange={(_, d) => setForm((f) => ({ ...f, coverNote: d.value }))}
                />
              </Field>
            </form>
          </DialogContent>
          <DialogActions>
            <Button className={m.tall} disabled={apply.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="mobility-apply"
              appearance="primary"
              className={m.tall}
              disabled={!canSubmitApply(form) || apply.isPending}
              icon={apply.isPending ? <Spinner size="tiny" /> : undefined}
            >
              Submit application
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
