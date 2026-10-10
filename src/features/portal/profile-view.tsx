"use client";

import {
  Body1,
  Button,
  Card,
  Field,
  Input,
  Link as FluentLink,
  Radio,
  RadioGroup,
  Select,
  Spinner,
  Subtitle1,
  Text,
  Textarea,
} from "@fluentui/react-components";
import { ArrowDownload20Regular, ArrowUpload20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorSummary, type SummaryError } from "@/features/careers/error-summary";
import { fileError, formatBytes } from "@/features/careers/apply/model";
import { downloadApiFile } from "@/lib/api/download";
import { errorMessage, fieldErrors, isApiError } from "@/lib/api/errors";
import { portalApi, portalKeys } from "@/lib/api/portal-client";
import type { PortalProfile } from "@/lib/api/types";
import { formatDate } from "./format";
import { COMP_UNITS, profileDraft, type ProfileDraft, profileUpdate, validateProfile } from "./profile-form";
import { ErrorBlock, InlineError, LoadingBlock, PortalPageHeader, usePortalStyles } from "./ui";

const MAX_RESUME_MB = 10;
const RESUME_EXTENSIONS = [".pdf", ".docx"];

const LABELS: Record<string, string> = {
  full_name: "Full name",
  phones: "Phone numbers",
  links: "Links",
  notice_period_days: "Notice period",
  comp_amount: "Expected pay",
  comp_currency: "Currency",
};

function ProfileForm({ profile }: { profile: PortalProfile }) {
  const styles = usePortalStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [initial, setInitial] = useState(() => profileDraft(profile));
  const [d, setD] = useState<ProfileDraft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<SummaryError[]>([]);
  const [focusKey, setFocusKey] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const save = useMutation({ mutationFn: portalApi.updateProfile });

  const set = (k: keyof ProfileDraft) => (_: unknown, data: { value: string }) => setD((x) => ({ ...x, [k]: data.value }));
  const field = (k: string) => ({ validationState: errors[k] ? ("error" as const) : ("none" as const), validationMessage: errors[k] || undefined });

  const onSave = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setServerError(null);
    const e = validateProfile(d);
    setErrors(e);
    setSummary(Object.entries(e).map(([k, m]) => ({ id: `profile-${k}`, message: `${LABELS[k] ?? k}: ${m}` })));
    if (Object.keys(e).length) {
      setFocusKey((n) => n + 1);
      return;
    }
    const body = profileUpdate(initial, d);
    if (!Object.keys(body).length) {
      toast.info("Nothing to save");
      return;
    }
    try {
      const updated = await save.mutateAsync(body);
      queryClient.setQueryData(portalKeys.profile, updated);
      const next = profileDraft(updated);
      setInitial(next);
      setD(next);
      toast.success("Your profile was saved");
    } catch (err) {
      const fields = fieldErrors(err);
      if (Object.keys(fields).length) {
        setErrors(fields);
        setSummary(Object.entries(fields).map(([k, m]) => ({ id: `profile-${k}`, message: m })));
        setFocusKey((n) => n + 1);
      } else setServerError(errorMessage(err));
    }
  };

  return (
    <Card className={styles.card}>
      <Subtitle1 as="h2">Your details</Subtitle1>
      <form className={styles.form} onSubmit={onSave} noValidate>
        <ErrorSummary errors={summary} focusKey={focusKey} />
        <InlineError message={serverError} />
        <Field label="Full name" required {...field("full_name")}>
          <Input id="profile-full_name" className={styles.input} autoComplete="name" value={d.full_name} maxLength={200} onChange={set("full_name")} />
        </Field>
        <Field label="Email" hint="To change your email address, send a correction request from the Privacy page.">
          <Text id="profile-emails">{profile.emails.join(", ") || "—"}</Text>
        </Field>
        <FluentLink href="/portal/privacy#requests" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>
          Request an email change
        </FluentLink>
        <Field label="Phone numbers" hint="One per line, with country code" {...field("phones")}>
          <Textarea id="profile-phones" value={d.phones} onChange={set("phones")} resize="vertical" />
        </Field>
        <div className={styles.grid2}>
          <Field label="City">
            <Input className={styles.input} autoComplete="address-level2" value={d.city} maxLength={200} onChange={set("city")} />
          </Field>
          <Field label="State / region">
            <Input className={styles.input} autoComplete="address-level1" value={d.state} maxLength={200} onChange={set("state")} />
          </Field>
          <Field label="Country">
            <Input className={styles.input} autoComplete="country-name" value={d.country} maxLength={200} onChange={set("country")} />
          </Field>
        </div>
        <Field label="Headline" hint="e.g. Senior Java developer">
          <Input className={styles.input} value={d.headline} maxLength={200} onChange={set("headline")} />
        </Field>
        <Field label="Links" hint="LinkedIn, portfolio or GitHub — one per line" {...field("links")}>
          <Textarea id="profile-links" value={d.links} onChange={set("links")} resize="vertical" />
        </Field>
        <Field label="Notice period (days)" {...field("notice_period_days")}>
          <Input id="profile-notice_period_days" className={styles.input} inputMode="numeric" value={d.notice_period_days} onChange={set("notice_period_days")} />
        </Field>
        <div className={styles.grid2}>
          <Field label="Expected pay" {...field("comp_amount")}>
            <Input id="profile-comp_amount" className={styles.input} inputMode="decimal" value={d.comp_amount} onChange={set("comp_amount")} />
          </Field>
          <Field label="Currency" hint="e.g. INR" {...field("comp_currency")}>
            <Input id="profile-comp_currency" className={styles.input} maxLength={3} value={d.comp_currency} onChange={set("comp_currency")} />
          </Field>
          <Field label="Per">
            <Select value={d.comp_unit} onChange={set("comp_unit")} className={styles.input}>
              <option value="">—</option>
              {COMP_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Willing to relocate">
          <RadioGroup value={d.willing_to_relocate} onChange={(_, data) => setD((x) => ({ ...x, willing_to_relocate: data.value as ProfileDraft["willing_to_relocate"] }))} layout="horizontal">
            <Radio value="yes" label="Yes" />
            <Radio value="no" label="No" />
          </RadioGroup>
        </Field>
        <Field label="Work authorization" hint="e.g. Indian citizen, H-1B">
          <Input className={styles.input} value={d.work_authorization} maxLength={200} onChange={set("work_authorization")} />
        </Field>
        <div className={styles.actions}>
          <Button type="submit" appearance="primary" className={styles.button} disabled={save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined}>
            Save profile
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Resumes() {
  const styles = usePortalStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: portalKeys.resumes, queryFn: ({ signal }) => portalApi.resumes(signal) });
  const upload = useMutation({
    mutationFn: portalApi.uploadResume,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalKeys.resumes }),
  });

  const onFile = async (file: File) => {
    setError(null);
    const err = fileError(file, MAX_RESUME_MB, RESUME_EXTENSIONS);
    if (err) return setError(err);
    try {
      await upload.mutateAsync(file);
      toast.success("Your resume was uploaded. The hiring team will review any changes.");
    } catch (e) {
      setError(isApiError(e) && e.code === "file_infected" ? "This file failed our security scan. Please upload a different file." : errorMessage(e));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Card className={styles.card} role="region" aria-labelledby="resumes-title">
      <Subtitle1 as="h2" id="resumes-title">
        Resumes
      </Subtitle1>
      <Body1 className={styles.muted}>Uploading a new resume adds a new version. Your profile is not changed automatically — the hiring team reviews it.</Body1>
      <InlineError message={error} />
      <input
        ref={fileRef}
        type="file"
        hidden
        accept={RESUME_EXTENSIONS.join(",")}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />
      <div>
        <Button
          icon={upload.isPending ? <Spinner size="tiny" /> : <ArrowUpload20Regular />}
          className={styles.button}
          disabled={upload.isPending}
          onClick={() => fileRef.current?.click()}
        >
          Upload a new resume
        </Button>
        <Text size={200} className={styles.muted} block>
          PDF or DOCX · max {MAX_RESUME_MB} MB
        </Text>
      </div>
      {q.isPending ? (
        <LoadingBlock label="Loading resumes" rows={2} />
      ) : q.isError ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <Body1 className={styles.empty}>No resumes yet.</Body1>
      ) : (
        <ul className={styles.list}>
          {q.data.map((r) => (
            <li key={r.id} className={styles.row}>
              <div className={styles.rowMain}>
                <Text weight="semibold">{r.file_name}</Text>
                <Text size={200} className={styles.muted}>
                  {r.version ? `Version ${r.version} · ` : ""}
                  {formatBytes(r.size_bytes)} · uploaded {formatDate(r.uploaded_at)}
                </Text>
              </div>
              <Button
                appearance="subtle"
                icon={<ArrowDownload20Regular />}
                className={styles.button}
                aria-label={`Download ${r.file_name}`}
                onClick={() => downloadApiFile(r.download_url, r.file_name).catch((e) => setError(errorMessage(e)))}
              >
                Download
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Profile: editable details (emails change through a correction request) plus resume upload/list. */
export function ProfileView() {
  const styles = usePortalStyles();
  const q = useQuery({ queryKey: portalKeys.profile, queryFn: ({ signal }) => portalApi.profile(signal) });
  return (
    <div className={styles.page}>
      <PortalPageHeader title="Profile" subtitle="Keep your details up to date. Changes are shared with the hiring team." />
      {q.isPending ? <LoadingBlock label="Loading profile" rows={6} /> : q.isError ? <ErrorBlock error={q.error} onRetry={() => q.refetch()} /> : <ProfileForm profile={q.data} />}
      <Resumes />
    </div>
  );
}
