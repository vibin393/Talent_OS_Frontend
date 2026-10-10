"use client";

import {
  Button,
  Card,
  CardHeader,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  MessageBarTitle,
  SpinButton,
  Subtitle2,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Save20Regular } from "@fluentui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorBar, formatDateTime, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { marketingApi, marketingKeys } from "./api";
import {
  CHANNEL_LABELS,
  clampFrequencyCap,
  DEFAULT_SEND_WINDOWS,
  FREQUENCY_CAP_MAX,
  FREQUENCY_CAP_MIN,
  formToUpdate,
  type SettingsForm,
  settingsToForm,
  validateSettings,
} from "./logic";
import type { Channel, MarketingSettingsOut } from "./types";
import { useMarketingSettings } from "./use-marketing";

const CHANNELS: Channel[] = ["email", "sms", "whatsapp"];

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "860px" },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  grid: {
    display: "grid",
    gridTemplateColumns: "120px repeat(2, minmax(0, 1fr))",
    gap: tokens.spacingHorizontalM,
    alignItems: "start",
    "@media (max-width: 600px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
  channel: { paddingTop: tokens.spacingVerticalS, fontWeight: tokens.fontWeightSemibold },
  row: { display: "flex", gap: tokens.spacingHorizontalL, flexWrap: "wrap", alignItems: "flex-start" },
  footer: { display: "flex", justifyContent: "flex-end", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** `/marketing/settings` (marketing:configure). */
export function MarketingSettingsView() {
  const canConfigure = usePermission("marketing:configure");
  const settings = useMarketingSettings(canConfigure);
  if (!canConfigure) return <NoAccess what="marketing settings" />;
  if (settings.isPending) return <GridSkeleton rows={8} />;
  if (settings.isError) return <ErrorBar title="Could not load marketing settings." message={errorMessage(settings.error)} />;
  return <SettingsEditor key={JSON.stringify(settings.data)} settings={settings.data} />;
}

function numberFrom(v: { value?: number | null; displayValue?: string }): number | null {
  const n = v.value ?? (v.displayValue !== undefined ? Number(v.displayValue) : null);
  return n === null || Number.isNaN(n) ? null : n;
}

function SettingsEditor({ settings }: { settings: MarketingSettingsOut }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<SettingsForm>(() => settingsToForm(settings));
  const [pauseDialog, setPauseDialog] = useState<"pause" | "resume" | null>(null);
  const errors = useMemo(() => validateSettings(form, settings), [form, settings]);
  const valid = Object.keys(errors).length === 0;
  const onSaved = (s: MarketingSettingsOut) => qc.setQueryData(marketingKeys.settings, s);

  const save = useMutation({
    mutationFn: () => marketingApi.updateSettings(formToUpdate(form)),
    onSuccess: (s) => {
      toast.success("Marketing settings saved.");
      onSaved(s);
    },
    onError: (e) => toast.error(errorMessage(e, "Could not save the settings.")),
  });

  const setChannel = <K extends "send_windows" | "rate_per_minute" | "daily_cap">(key: K, c: Channel, v: SettingsForm[K][Channel]) =>
    setForm((f) => ({ ...f, [key]: { ...f[key], [c]: v } }));

  return (
    <div className={styles.root}>
      {settings.paused_at ? (
        <MessageBar intent="error" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>Marketing is paused</MessageBarTitle>
            Since {formatDateTime(settings.paused_at)}
            {settings.paused_reason ? `: ${settings.paused_reason}` : ""}. No marketing messages are sent.
          </MessageBarBody>
          <MessageBarActions>
            <Button onClick={() => setPauseDialog("resume")}>Resume</Button>
          </MessageBarActions>
        </MessageBar>
      ) : (
        <div className={styles.footer}>
          <Button onClick={() => setPauseDialog("pause")}>Pause all marketing</Button>
        </div>
      )}

      <Card>
        <CardHeader header={<Subtitle2 as="h2">Frequency and approval</Subtitle2>} />
        <div className={styles.row}>
          <Field
            label={`Messages per person per ${settings.frequency_cap_days} days`}
            hint={`${FREQUENCY_CAP_MIN} to ${FREQUENCY_CAP_MAX}, across all channels.`}
            validationState={errors.frequency_cap_count ? "error" : "none"}
            validationMessage={errors.frequency_cap_count}
          >
            <SpinButton
              min={FREQUENCY_CAP_MIN}
              max={FREQUENCY_CAP_MAX}
              value={form.frequency_cap_count}
              onChange={(_, v) => {
                const n = numberFrom(v);
                setForm((f) => ({ ...f, frequency_cap_count: clampFrequencyCap(n) }));
              }}
            />
          </Field>
          <Field
            label="Approval needed at (recipients)"
            validationState={errors.approval_threshold ? "error" : "none"}
            validationMessage={errors.approval_threshold}
          >
            <SpinButton
              min={1}
              value={form.approval_threshold}
              onChange={(_, v) => {
                const n = numberFrom(v);
                if (n !== null) setForm((f) => ({ ...f, approval_threshold: Math.max(1, Math.round(n)) }));
              }}
            />
          </Field>
          <Field
            label="A/B test window (hours)"
            validationState={errors.ab_window_hours ? "error" : "none"}
            validationMessage={errors.ab_window_hours}
          >
            <SpinButton
              min={1}
              max={72}
              value={form.ab_window_hours}
              onChange={(_, v) => {
                const n = numberFrom(v);
                if (n !== null) setForm((f) => ({ ...f, ab_window_hours: Math.min(72, Math.max(1, Math.round(n))) }));
              }}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          header={<Subtitle2 as="h2">Send hours</Subtitle2>}
          description={<Text className={styles.muted}>In the recipient&apos;s time zone. You can narrow the defaults, not widen them.</Text>}
        />
        <div className={styles.form}>
          {CHANNELS.map((c) => {
            const def = DEFAULT_SEND_WINDOWS[c];
            const err = errors[`send_windows.${c}`];
            return (
              <div key={c} className={styles.grid} role="group" aria-label={`${CHANNEL_LABELS[c]} send hours`}>
                <Text className={styles.channel}>{CHANNEL_LABELS[c]}</Text>
                <Field label="From" validationState={err ? "error" : "none"} validationMessage={err}>
                  <Input
                    type="time"
                    min={def.start}
                    max={def.end}
                    value={form.send_windows[c].start}
                    onChange={(_, d) => setChannel("send_windows", c, { ...form.send_windows[c], start: d.value })}
                  />
                </Field>
                <Field label="To" hint={`Default ${def.start}–${def.end}`}>
                  <Input
                    type="time"
                    min={def.start}
                    max={def.end}
                    value={form.send_windows[c].end}
                    onChange={(_, d) => setChannel("send_windows", c, { ...form.send_windows[c], end: d.value })}
                  />
                </Field>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader header={<Subtitle2 as="h2">Sending limits</Subtitle2>} />
        <div className={styles.form}>
          {CHANNELS.map((c) => (
            <div key={c} className={styles.grid} role="group" aria-label={`${CHANNEL_LABELS[c]} limits`}>
              <Text className={styles.channel}>{CHANNEL_LABELS[c]}</Text>
              <Field
                label="Per minute"
                hint={settings.platform_max_rate[c] ? `Max ${settings.platform_max_rate[c].toLocaleString()}` : undefined}
                validationState={errors[`rate_per_minute.${c}`] ? "error" : "none"}
                validationMessage={errors[`rate_per_minute.${c}`]}
              >
                <SpinButton
                  min={1}
                  max={settings.platform_max_rate[c] || undefined}
                  value={form.rate_per_minute[c]}
                  onChange={(_, v) => {
                    const n = numberFrom(v);
                    if (n !== null) setChannel("rate_per_minute", c, Math.round(n));
                  }}
                />
              </Field>
              <Field
                label="Per day"
                hint={settings.platform_max_daily[c] ? `Max ${settings.platform_max_daily[c].toLocaleString()}` : undefined}
                validationState={errors[`daily_cap.${c}`] ? "error" : "none"}
                validationMessage={errors[`daily_cap.${c}`]}
              >
                <SpinButton
                  min={1}
                  max={settings.platform_max_daily[c] || undefined}
                  value={form.daily_cap[c]}
                  onChange={(_, v) => {
                    const n = numberFrom(v);
                    if (n !== null) setChannel("daily_cap", c, Math.round(n));
                  }}
                />
              </Field>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader header={<Subtitle2 as="h2">Email footer</Subtitle2>} />
        <Field
          label="Contact line"
          hint="Shown at the bottom of every marketing email, e.g. your postal address."
          validationState={errors.footer_contact ? "error" : "none"}
          validationMessage={errors.footer_contact}
        >
          <Textarea value={form.footer_contact} maxLength={500} onChange={(_, d) => setForm((f) => ({ ...f, footer_contact: d.value }))} />
        </Field>
      </Card>

      <div className={styles.footer}>
        <Button onClick={() => setForm(settingsToForm(settings))} disabled={save.isPending}>
          Reset
        </Button>
        <Button appearance="primary" icon={<Save20Regular />} disabled={!valid || save.isPending} onClick={() => save.mutate()}>
          Save
        </Button>
      </div>

      {pauseDialog && <PauseDialog mode={pauseDialog} onClose={() => setPauseDialog(null)} onDone={onSaved} />}
    </div>
  );
}

function PauseDialog({ mode, onClose, onDone }: { mode: "pause" | "resume"; onClose: () => void; onDone: (s: MarketingSettingsOut) => void }) {
  const toast = useAppToast();
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const run = useMutation({
    mutationFn: () => (mode === "pause" ? marketingApi.pause(reason.trim()) : marketingApi.resume(reason.trim())),
    onSuccess: (s) => {
      toast.success(mode === "pause" ? "Marketing paused." : "Marketing resumed.");
      onDone(s);
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e, "That did not work.")),
  });
  const err = touched && !reason.trim() ? "Enter a reason." : undefined;
  return (
    <Dialog open modalType="alert" onOpenChange={(_, d) => !d.open && !run.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{mode === "pause" ? "Pause all marketing?" : "Resume marketing?"}</DialogTitle>
          <DialogContent>
            <Field
              label="Reason"
              required
              validationState={err ? "error" : "none"}
              validationMessage={err}
              hint={mode === "pause" ? "All campaigns and sequences stop sending." : "Paused campaigns stay paused until you resume each one."}
            >
              <Textarea value={reason} maxLength={500} onChange={(_, d) => setReason(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={run.isPending}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={run.isPending}
              onClick={() => {
                setTouched(true);
                if (reason.trim()) run.mutate();
              }}
            >
              {mode === "pause" ? "Pause" : "Resume"}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
