"use client";

import {
  Body1,
  Button,
  Card,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Option,
  Radio,
  RadioGroup,
  SpinButton,
  Subtitle2,
  Switch,
  Tab,
  TabList,
  Text,
  tokens,
} from "@fluentui/react-components";
import { ArrowLeft20Regular } from "@fluentui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { NoAccess, useAdminStyles } from "@/features/admin/ui";
import { audiencesApi } from "@/features/audiences/api";
import { useAudiences } from "@/features/audiences/audiences-view";
import { suppressedTotal } from "@/features/audiences/logic";
import { ReachPreviewCard } from "@/features/audiences/reach-preview";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { campaignsApi, marketingKeys } from "./api";
import { EmailContentEditor } from "./email-content-editor";
import {
  AB_SAMPLE_MAX,
  AB_SAMPLE_MIN,
  abSampleError,
  approvalRequired,
  campaignErrorMessage,
  CHANNEL_LABELS,
  validateWizard,
  WIZARD_STEPS,
  type WizardDraft,
  type WizardStep,
  wizardToCreate,
} from "./logic";
import { OptionCombobox } from "./option-combobox";
import type { Channel } from "./types";
import { useMarketingOptions, useMarketingSettings } from "./use-marketing";

const useStyles = makeStyles({
  back: { marginBottom: tokens.spacingVerticalS },
  tabs: { marginBottom: tokens.spacingVerticalL, borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}` },
  card: { maxWidth: "820px", padding: tokens.spacingHorizontalXL, "@media (max-width: 480px)": { padding: tokens.spacingHorizontalM } },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  row: { display: "flex", gap: tokens.spacingHorizontalL, flexWrap: "wrap", alignItems: "flex-end" },
  nav: { display: "flex", gap: tokens.spacingHorizontalS, marginTop: tokens.spacingVerticalL, flexWrap: "wrap" },
  grow: { flex: 1 },
  review: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  muted: { color: tokens.colorNeutralForeground3 },
  ab: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
});

const EMPTY: WizardDraft = {
  name: "",
  audience_id: null,
  channel: "email",
  email_subject: "",
  email_body_html: "",
  channel_template_id: null,
  job_links: [],
  ab_enabled: false,
  ab_subject_b: "",
  ab_sample_pct: 10,
  ab_metric: "open",
  ab_window_hours: 4,
  schedule: "now",
  scheduled_at: "",
};

/** `/marketing/campaigns/new`: Audience → Channel & content → Schedule → Review. */
export function CampaignWizard() {
  const styles = useStyles();
  const admin = useAdminStyles();
  const router = useRouter();
  const toast = useAppToast();
  const qc = useQueryClient();
  const canWrite = usePermission("campaign:write");
  const audiences = useAudiences(canWrite);
  const options = useMarketingOptions(canWrite);
  const settings = useMarketingSettings(canWrite);
  const [step, setStep] = useState<WizardStep>("audience");
  const [d, setD] = useState<WizardDraft>(EMPTY);
  const [showErrors, setShowErrors] = useState<Partial<Record<WizardStep, boolean>>>({});
  const errors = useMemo(() => validateWizard(d), [d]);
  const set = (patch: Partial<WizardDraft>) => setD((prev) => ({ ...prev, ...patch }));

  const preview = useMutation({ mutationFn: (v: { id: string; channel: Channel }) => audiencesApi.preview(v.id, v.channel) });
  const { mutate: runPreview, reset: resetPreview } = preview;
  useEffect(() => {
    if (step === "review" && d.audience_id) runPreview({ id: d.audience_id, channel: d.channel });
  }, [step, d.audience_id, d.channel, runPreview]);

  const save = useMutation({
    mutationFn: async (submit: boolean) => {
      const created = await campaignsApi.create(wizardToCreate(d));
      if (!submit) return { campaign: created, submitError: null as unknown };
      try {
        const scheduled = d.schedule === "later" ? new Date(d.scheduled_at).toISOString() : null;
        return { campaign: await campaignsApi.submit(created.id, scheduled), submitError: null as unknown };
      } catch (e) {
        return { campaign: created, submitError: e };
      }
    },
    onSuccess: ({ campaign, submitError }, submit) => {
      qc.invalidateQueries({ queryKey: marketingKeys.campaigns });
      if (submitError) toast.error(campaignErrorMessage(submitError) ?? errorMessage(submitError, "Saved as a draft, but it could not be submitted."));
      else if (!submit) toast.success("Draft saved.");
      else if (campaign.status === "pending_approval") toast.info("Submitted for approval.");
      else toast.success("Campaign scheduled.");
      router.push(`/marketing/campaigns/${campaign.id}`);
    },
    onError: (e) => toast.error(campaignErrorMessage(e) ?? errorMessage(e, "Could not save the campaign.")),
  });

  if (!canWrite) return <NoAccess what="campaigns" />;

  const audienceOptions = (audiences.data ?? [])
    .filter((a) => a.status !== "archived")
    .map((a) => ({ id: a.id, name: a.name, detail: a.status === "draft" ? "Draft" : null }));
  const audienceName = audienceOptions.find((a) => a.id === d.audience_id)?.name ?? "—";
  const templates = d.channel === "sms" ? (options.data?.sms_templates ?? []) : (options.data?.whatsapp_templates ?? []);
  const stepIndex = WIZARD_STEPS.findIndex((s) => s.value === step);
  const err = (s: WizardStep) => (showErrors[s] ? errors[s] : undefined);
  const recipients = preview.data ? (preview.data.reachable[d.channel] ?? 0) : null;
  const suppressed = preview.data ? suppressedTotal(preview.data, d.channel) : null;
  const needsApproval = approvalRequired(recipients, settings.data?.approval_threshold);
  const allErrors = Object.values(errors).flat();

  const next = () => {
    if (errors[step]) {
      setShowErrors((s) => ({ ...s, [step]: true }));
      return;
    }
    setStep(WIZARD_STEPS[Math.min(stepIndex + 1, WIZARD_STEPS.length - 1)].value);
  };

  const stepErrors = (s: WizardStep) =>
    err(s) ? (
      <MessageBar intent="error" layout="multiline" role="alert">
        <MessageBarBody>
          {err(s)!.map((m) => (
            <div key={m}>{m}</div>
          ))}
        </MessageBarBody>
      </MessageBar>
    ) : null;

  return (
    <>
      <div className={styles.back}>
        <AppLink href="/marketing/campaigns">
          <ArrowLeft20Regular style={{ verticalAlign: "middle" }} aria-hidden /> Campaigns
        </AppLink>
      </div>
      <PageHeader title="New campaign" />
      <TabList className={styles.tabs} selectedValue={step} onTabSelect={(_, t) => setStep(t.value as WizardStep)} aria-label="Campaign steps">
        {WIZARD_STEPS.map((s, i) => (
          <Tab key={s.value} value={s.value}>
            {i + 1}. {s.label}
          </Tab>
        ))}
      </TabList>
      <Card className={styles.card}>
        {step === "audience" && (
          <div className={styles.form}>
            <Field label="Campaign name" required>
              <Input value={d.name} maxLength={200} onChange={(_, v) => set({ name: v.value })} />
            </Field>
            <OptionCombobox
              label="Audience"
              required
              placeholder="Search audiences"
              options={audienceOptions}
              value={d.audience_id}
              onChange={(o) => {
                set({ audience_id: o?.id ?? null });
                resetPreview();
              }}
              hint="Consent and opt-outs are checked at send time, not here."
            />
            {stepErrors("audience")}
          </div>
        )}
        {step === "content" && (
          <div className={styles.form}>
            <Field label="Channel">
              <RadioGroup layout="horizontal" value={d.channel} onChange={(_, v) => set({ channel: v.value as Channel, channel_template_id: null })}>
                {(Object.keys(CHANNEL_LABELS) as Channel[]).map((c) => (
                  <Radio key={c} value={c} label={CHANNEL_LABELS[c]} />
                ))}
              </RadioGroup>
            </Field>
            {d.channel === "email" ? (
              <>
                <EmailContentEditor
                  value={{ subject: d.email_subject, body_html: d.email_body_html, job_links: d.job_links }}
                  onChange={(v) => set({ email_subject: v.subject, email_body_html: v.body_html, job_links: v.job_links })}
                  postings={options.data?.postings ?? []}
                  subjectLabel={d.ab_enabled ? "Subject (variant A)" : "Subject"}
                />
                <div className={styles.ab}>
                  <Switch label="A/B test the subject line" checked={d.ab_enabled} onChange={(_, v) => set({ ab_enabled: v.checked })} />
                  {d.ab_enabled && (
                    <>
                      <Field label="Subject (variant B)" required>
                        <Input value={d.ab_subject_b} maxLength={500} onChange={(_, v) => set({ ab_subject_b: v.value })} />
                      </Field>
                      <div className={styles.row}>
                        <Field
                          label="Test sample (%)"
                          hint={`Each variant goes to half of the sample. Max ${AB_SAMPLE_MAX}%.`}
                          validationState={abSampleError(d.ab_sample_pct) ? "error" : "none"}
                          validationMessage={abSampleError(d.ab_sample_pct) ?? undefined}
                        >
                          <SpinButton
                            min={AB_SAMPLE_MIN}
                            max={AB_SAMPLE_MAX}
                            value={d.ab_sample_pct}
                            onChange={(_, v) => {
                              const n = v.value ?? Number(v.displayValue);
                              if (n !== null && !Number.isNaN(n)) set({ ab_sample_pct: Math.min(AB_SAMPLE_MAX, Math.max(AB_SAMPLE_MIN, Math.round(n))) });
                            }}
                          />
                        </Field>
                        <Field label="Winner by">
                          <Dropdown
                            value={d.ab_metric === "open" ? "Opens" : "Clicks"}
                            selectedOptions={[d.ab_metric]}
                            onOptionSelect={(_, v) => set({ ab_metric: v.optionValue as "open" | "click" })}
                          >
                            <Option value="open">Opens</Option>
                            <Option value="click">Clicks</Option>
                          </Dropdown>
                        </Field>
                        <Field label="Decide after (hours)">
                          <SpinButton
                            min={1}
                            max={72}
                            value={d.ab_window_hours}
                            onChange={(_, v) => {
                              const n = v.value ?? Number(v.displayValue);
                              if (n !== null && !Number.isNaN(n)) set({ ab_window_hours: Math.min(72, Math.max(1, Math.round(n))) });
                            }}
                          />
                        </Field>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <OptionCombobox
                label={`${CHANNEL_LABELS[d.channel]} template`}
                required
                placeholder="Search registered templates"
                options={templates}
                value={d.channel_template_id}
                onChange={(o) => set({ channel_template_id: o?.id ?? null })}
                hint={
                  d.channel === "sms"
                    ? "Only DLT-registered marketing templates can be used."
                    : "Only approved WhatsApp marketing templates can be used."
                }
              />
            )}
            {stepErrors("content")}
          </div>
        )}
        {step === "schedule" && (
          <div className={styles.form}>
            <Field label="When to send">
              <RadioGroup value={d.schedule} onChange={(_, v) => set({ schedule: v.value as "now" | "later" })}>
                <Radio value="now" label="As soon as possible (within send hours)" />
                <Radio value="later" label="At a set time" />
              </RadioGroup>
            </Field>
            {d.schedule === "later" && (
              <Field label="Date and time" required>
                <Input type="datetime-local" value={d.scheduled_at} onChange={(_, v) => set({ scheduled_at: v.value })} />
              </Field>
            )}
            <Text className={styles.muted}>Messages outside the allowed send hours wait for the next window.</Text>
            {stepErrors("schedule")}
          </div>
        )}
        {step === "review" && (
          <div className={styles.review}>
            <Subtitle2 as="h2">Review</Subtitle2>
            <dl className={admin.detailList}>
              <dt>Name</dt>
              <dd>{d.name || "—"}</dd>
              <dt>Audience</dt>
              <dd>{audienceName}</dd>
              <dt>Channel</dt>
              <dd>{CHANNEL_LABELS[d.channel]}</dd>
              {d.channel === "email" && (
                <>
                  <dt>Subject</dt>
                  <dd>{d.email_subject || "—"}</dd>
                  {d.ab_enabled && (
                    <>
                      <dt>A/B test</dt>
                      <dd>
                        {d.ab_sample_pct}% sample, winner by {d.ab_metric === "open" ? "opens" : "clicks"} after {d.ab_window_hours} h
                      </dd>
                    </>
                  )}
                </>
              )}
              <dt>Recipients</dt>
              <dd>{recipients === null ? "—" : recipients.toLocaleString()}</dd>
              <dt>Suppressed</dt>
              <dd>{suppressed === null ? "—" : suppressed.toLocaleString()}</dd>
              <dt>Send</dt>
              <dd>{d.schedule === "now" ? "As soon as possible" : d.scheduled_at ? new Date(d.scheduled_at).toLocaleString() : "—"}</dd>
            </dl>
            {needsApproval && (
              <MessageBar intent="warning" layout="multiline">
                <MessageBarBody>
                  <MessageBarTitle>Approval required</MessageBarTitle>
                  This campaign reaches {recipients?.toLocaleString()} people, at or above your approval threshold of{" "}
                  {settings.data?.approval_threshold.toLocaleString()}. It sends only after it is approved.
                </MessageBarBody>
              </MessageBar>
            )}
            {settings.data?.paused_at && (
              <MessageBar intent="error" layout="multiline">
                <MessageBarBody>Marketing is paused for your organization. Nothing will send until it is resumed.</MessageBarBody>
              </MessageBar>
            )}
            {allErrors.length > 0 && (
              <MessageBar intent="error" layout="multiline" role="alert">
                <MessageBarBody>
                  <MessageBarTitle>Fix these before submitting</MessageBarTitle>
                  {allErrors.map((m) => (
                    <div key={m}>{m}</div>
                  ))}
                </MessageBarBody>
              </MessageBar>
            )}
            <ReachPreviewCard
              preview={preview.data}
              loading={preview.isPending}
              error={preview.error}
              disabled={!d.audience_id}
              onRun={() => d.audience_id && runPreview({ id: d.audience_id, channel: d.channel })}
            />
          </div>
        )}
        <div className={styles.nav}>
          {stepIndex > 0 && <Button onClick={() => setStep(WIZARD_STEPS[stepIndex - 1].value)}>Back</Button>}
          <span className={styles.grow} />
          {step !== "review" ? (
            <Button appearance="primary" onClick={next}>
              Next
            </Button>
          ) : (
            <>
              <Button disabled={save.isPending || !!errors.audience} onClick={() => save.mutate(false)}>
                Save draft
              </Button>
              <Button appearance="primary" disabled={save.isPending || allErrors.length > 0} onClick={() => save.mutate(true)}>
                {needsApproval ? "Submit for approval" : d.schedule === "later" ? "Schedule" : "Send"}
              </Button>
            </>
          )}
        </div>
        {step === "review" && <Body1 className={styles.muted}>You can send yourself a test from the campaign page.</Body1>}
      </Card>
    </>
  );
}
