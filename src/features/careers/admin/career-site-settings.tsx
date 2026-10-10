"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Field,
  FluentProvider,
  Input,
  Link as FluentLink,
  makeStyles,
  Spinner,
  Subtitle1,
  Subtitle2,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { ArrowUpload20Regular, Open16Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { MarkdownView } from "@/features/privacy/markdown-view";
import { errorMessage, fieldErrors, isApiError } from "@/lib/api/errors";
import type { CareerSiteOut } from "@/lib/api/types";
import { brandHasContrast, careerThemes, contrastRatio, HEX_COLOR, MIN_CONTRAST, suggestAccessibleColor } from "../theme";
import { careerSiteApi, careerSiteKeys } from "./api";
import { CustomDomainCard } from "@/features/messaging/custom-domain-card";
import { siteDraft, type SiteDraft, siteUpdate, STAGE_NAMES, stageKeys, validateSite } from "./site-form";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

const useStyles = makeStyles({
  root: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: tokens.spacingHorizontalXL, alignItems: "start", maxWidth: "1180px", "@media (max-width: 1100px)": { gridTemplateColumns: "minmax(0, 1fr)" } },
  column: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, minWidth: 0 },
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, alignItems: "flex-end" },
  colorRow: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "center" },
  swatch: { width: "40px", height: "32px", padding: 0, border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusMedium, cursor: "pointer", backgroundColor: "transparent" },
  pass: { color: tokens.colorPaletteGreenForeground1 },
  fail: { color: tokens.colorPaletteRedForeground1 },
  images: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: tokens.spacingHorizontalL },
  imageBox: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, alignItems: "flex-start" },
  thumb: { maxWidth: "100%", maxHeight: "80px", objectFit: "contain", border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium, backgroundColor: tokens.colorNeutralBackground2 },
  preview: { border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium, padding: tokens.spacingHorizontalM, maxHeight: "260px", overflowY: "auto", backgroundColor: tokens.colorNeutralBackground2 },
  sticky: { position: "sticky", top: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, "@media (max-width: 1100px)": { position: "static" } },
  previewShell: { borderRadius: tokens.borderRadiusLarge, overflow: "hidden", boxShadow: tokens.shadow8 },
  previewHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: tokens.spacingHorizontalS, padding: tokens.spacingHorizontalM, backgroundColor: tokens.colorNeutralBackground1, borderBottom: `${tokens.strokeWidthThick} solid ${tokens.colorBrandBackground}` },
  previewBody: { padding: tokens.spacingHorizontalM, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, backgroundColor: tokens.colorNeutralBackground2 },
  previewLogo: { maxHeight: "28px", maxWidth: "120px", objectFit: "contain" },
  previewJob: { padding: tokens.spacingHorizontalM },
  previewLink: { color: tokens.colorBrandForegroundLink, fontWeight: tokens.fontWeightSemibold },
  footer: { display: "flex", justifyContent: "flex-end", gap: tokens.spacingHorizontalS, position: "sticky", bottom: 0, padding: `${tokens.spacingVerticalS} 0`, backgroundColor: tokens.colorNeutralBackground3 },
  muted: { color: tokens.colorNeutralForeground3 },
  tableWrap: { overflowX: "auto" },
});

function BrandPreview({ draft, site }: { draft: SiteDraft; site: CareerSiteOut }) {
  const styles = useStyles();
  const themes = careerThemes(HEX_COLOR.test(draft.brand_color) ? draft.brand_color : null);
  const name = draft.display_name.trim() || "Your company";
  return (
    <Card className={styles.card}>
      <CardHeader header={<Subtitle2 as="h2">Preview</Subtitle2>} description={themes.branded ? "Themed with your brand colour" : "Default theme (set an accessible brand colour)"} />
      <FluentProvider theme={themes.light} className={styles.previewShell}>
        <div className={styles.previewHeader}>
          {/* eslint-disable-next-line @next/next/no-img-element -- authenticated admin preview of an API asset */}
          {site.logo_url ? <img src={site.logo_url} alt={`${name} logo`} className={styles.previewLogo} /> : <Text weight="semibold">Careers at {name}</Text>}
          <Button appearance="primary" size="small" tabIndex={-1}>
            Sign in
          </Button>
        </div>
        <div className={styles.previewBody}>
          <Subtitle1 as="p">Careers at {name}</Subtitle1>
          <Card className={styles.previewJob}>
            <Text className={styles.previewLink}>Senior Java Developer</Text>
            <Caption1>Bengaluru · Hybrid · Full-time</Caption1>
          </Card>
          <Button appearance="primary" tabIndex={-1}>
            Apply for this job
          </Button>
        </div>
      </FluentProvider>
      {site.public_url && (
        <FluentLink href={site.public_url} target="_blank" rel="noopener noreferrer" aria-label="View career site (opens in a new tab)">
          View career site <Open16Regular aria-hidden />
        </FluentLink>
      )}
      {!site.enabled && <Caption1 className={styles.muted}>The site is off: visitors get “not found” until you turn it on.</Caption1>}
    </Card>
  );
}

function ImageUpload({ which, label, url, hint }: { which: "logo" | "header"; label: string; url: string | null | undefined; hint: string }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const m = useMutation({
    mutationFn: (file: File) => (which === "logo" ? careerSiteApi.uploadLogo(file) : careerSiteApi.uploadHeader(file)),
    onSuccess: (data) => queryClient.setQueryData(careerSiteKeys.site, data),
  });
  const onFile = async (file: File) => {
    setError(null);
    if (!IMAGE_TYPES.includes(file.type)) return setError("Use a PNG, JPG or WebP image (SVG is not allowed)");
    if (file.size > MAX_IMAGE_BYTES) return setError("The image must be 2 MB or smaller");
    try {
      await m.mutateAsync(file);
      setVersion((v) => v + 1);
      toast.success(`${label} uploaded`);
    } catch (e) {
      setError(isApiError(e) && e.code === "file_infected" ? "The file failed the security scan." : errorMessage(e));
    } finally {
      if (ref.current) ref.current.value = "";
    }
  };
  return (
    <div className={styles.imageBox}>
      <Field label={label} hint={hint} validationState={error ? "error" : "none"} validationMessage={error ?? undefined}>
        <div>
          <input ref={ref} type="file" hidden accept={IMAGE_TYPES.join(",")} onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])} />
          <Button icon={m.isPending ? <Spinner size="tiny" /> : <ArrowUpload20Regular />} disabled={m.isPending} onClick={() => ref.current?.click()}>
            {url ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
          </Button>
        </div>
      </Field>
      {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of an API asset */}
      {url && <img src={`${url}?v=${version}`} alt={`Current ${label.toLowerCase()}`} className={styles.thumb} />}
    </div>
  );
}

function SettingsForm({ site }: { site: CareerSiteOut }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [initial, setInitial] = useState(() => siteDraft(site));
  const [d, setD] = useState<SiteDraft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [serverSuggestion, setServerSuggestion] = useState<string | null>(null);
  const save = useMutation({ mutationFn: careerSiteApi.update });

  const validHex = HEX_COLOR.test(d.brand_color);
  const ratio = validHex ? contrastRatio(d.brand_color, "#FFFFFF") : null;
  const passes = validHex && brandHasContrast(d.brand_color);
  const suggestion = validHex && !passes ? (serverSuggestion ?? suggestAccessibleColor(d.brand_color)) : null;
  const dirty = Object.keys(siteUpdate(initial, d)).length > 0;
  const f = (k: string) => ({ validationState: errors[k] ? ("error" as const) : ("none" as const), validationMessage: errors[k] || undefined });

  const onSave = async () => {
    setFormError(null);
    const e = validateSite(d);
    if (validHex && !passes) e.brand_color = `Contrast against white is ${ratio?.toFixed(2)}:1; it must be at least ${MIN_CONTRAST}:1`;
    setErrors(e);
    if (Object.keys(e).length) {
      setFormError("Fix the highlighted fields and save again.");
      return;
    }
    try {
      const saved = await save.mutateAsync(siteUpdate(initial, d));
      queryClient.setQueryData(careerSiteKeys.site, saved);
      const next = siteDraft(saved);
      setInitial(next);
      setD(next);
      toast.success("Career site saved. Changes show on the public site within a few minutes.");
    } catch (err) {
      if (isApiError(err) && err.code === "brand_color_low_contrast") {
        const s = typeof err.details.suggested === "string" ? err.details.suggested : null;
        setServerSuggestion(s);
        setErrors({ brand_color: err.message });
        return;
      }
      const fields = fieldErrors(err);
      if (Object.keys(fields).length) setErrors(fields);
      setFormError(errorMessage(err));
    }
  };

  const keys = stageKeys(site);
  return (
    <div className={styles.root}>
      <div className={styles.column}>
        <ErrorBar message={formError} />
        <Card className={styles.card}>
          <CardHeader header={<Subtitle2 as="h2">Site</Subtitle2>} description="Turn the public career site on or off and name it." />
          <Switch
            checked={d.enabled}
            onChange={(_, x) => setD((v) => ({ ...v, enabled: x.checked }))}
            label={d.enabled ? "Career site is on" : "Career site is off"}
          />
          <Field label="Display name" required={d.enabled} hint="Shown as “Careers at …” and in job listings" {...f("display_name")}>
            <Input value={d.display_name} maxLength={200} onChange={(_, x) => setD((v) => ({ ...v, display_name: x.value }))} />
          </Field>
          <Field label="Privacy contact email" required={d.enabled} hint="Shown in the footer; candidates' correction and erasure requests are emailed here" {...f("privacy_contact_email")}>
            <Input type="email" value={d.privacy_contact_email} onChange={(_, x) => setD((v) => ({ ...v, privacy_contact_email: x.value }))} />
          </Field>
          <Switch
            checked={d.apply_requires_phone}
            onChange={(_, x) => setD((v) => ({ ...v, apply_requires_phone: x.checked }))}
            label="Require a phone number when applying"
          />
        </Card>

        <Card className={styles.card}>
          <CardHeader header={<Subtitle2 as="h2">Branding</Subtitle2>} description="Colour and images used on the career site, the apply flow and the candidate portal." />
          <Field label="Brand colour" hint="Must reach 4.5:1 contrast against white (WCAG AA) so buttons stay readable" {...f("brand_color")}>
            <div className={styles.colorRow}>
              <input
                type="color"
                aria-label="Pick brand colour"
                className={styles.swatch}
                value={validHex ? d.brand_color : "#0F6CBD"}
                onChange={(e) => {
                  setServerSuggestion(null);
                  setD((v) => ({ ...v, brand_color: e.target.value.toUpperCase() }));
                }}
              />
              <Input
                aria-label="Brand colour hex"
                value={d.brand_color}
                placeholder="#0F6CBD"
                maxLength={7}
                onChange={(_, x) => {
                  setServerSuggestion(null);
                  setD((v) => ({ ...v, brand_color: x.value.trim() }));
                }}
              />
            </div>
          </Field>
          {ratio !== null && (
            <Text role="status" className={passes ? styles.pass : styles.fail}>
              {passes ? "✓ Passes" : "✗ Fails"}: contrast {ratio.toFixed(2)}:1 against white (needs {MIN_CONTRAST}:1).
            </Text>
          )}
          {suggestion && (
            <div className={styles.row}>
              <Text>
                Suggested accessible shade: <strong>{suggestion}</strong>
              </Text>
              <Button size="small" onClick={() => setD((v) => ({ ...v, brand_color: suggestion }))}>
                Use {suggestion}
              </Button>
            </div>
          )}
          <div className={styles.images}>
            <ImageUpload which="logo" label="Logo" url={site.logo_url} hint="PNG, JPG or WebP, up to 2 MB" />
            <ImageUpload which="header" label="Header image" url={site.header_url} hint="Wide image, PNG, JPG or WebP, up to 2 MB" />
          </div>
        </Card>

        <Card className={styles.card}>
          <CardHeader header={<Subtitle2 as="h2">About</Subtitle2>} description="Introduce your company on the career site home page. Markdown is supported." />
          <Field label="About (Markdown)" {...f("about_md")} hint={`${d.about_md.length.toLocaleString()} / 10,000 characters`}>
            <Textarea value={d.about_md} rows={8} resize="vertical" onChange={(_, x) => setD((v) => ({ ...v, about_md: x.value }))} />
          </Field>
          <div>
            <Text weight="semibold" block>
              Preview
            </Text>
            <div className={styles.preview}>{d.about_md.trim() ? <MarkdownView source={d.about_md} /> : <Body1 className={styles.muted}>Nothing to preview yet.</Body1>}</div>
          </div>
        </Card>

        <Card className={styles.card}>
          <CardHeader
            header={<Subtitle2 as="h2">Candidate stage labels</Subtitle2>}
            description="What candidates see in the portal for each pipeline stage. Leave blank to use the default. Internal stage names are never shown."
          />
          <div className={styles.tableWrap}>
            <Table aria-label="Candidate stage labels" style={{ minWidth: 520 }}>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Pipeline stage</TableHeaderCell>
                  <TableHeaderCell>Default label</TableHeaderCell>
                  <TableHeaderCell>Label shown to candidates</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k}>
                    <TableCell>{STAGE_NAMES[k] ?? k}</TableCell>
                    <TableCell>{site.default_stage_labels[k]}</TableCell>
                    <TableCell>
                      <Field {...f(`label.${k}`)}>
                        <Input
                          aria-label={`Label for ${STAGE_NAMES[k] ?? k}`}
                          size="small"
                          placeholder={site.default_stage_labels[k]}
                          value={d.labels[k] ?? ""}
                          maxLength={60}
                          onChange={(_, x) => setD((v) => ({ ...v, labels: { ...v.labels, [k]: x.value } }))}
                        />
                      </Field>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        <div className={styles.footer}>
          <Button disabled={!dirty || save.isPending} onClick={() => { setD(initial); setErrors({}); setFormError(null); }}>
            Discard changes
          </Button>
          <Button appearance="primary" disabled={!dirty || save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined} onClick={onSave}>
            Save
          </Button>
        </div>
      </div>
      <div className={styles.sticky}>
        <BrandPreview draft={d} site={site} />
      </div>
    </div>
  );
}

/** Admin → Career site (Epic 9, B5): enable, branding, about, privacy contact and candidate stage labels. */
export function CareerSiteSettings() {
  const allowed = usePermission("career_site:configure");
  const q = useQuery({ queryKey: careerSiteKeys.site, queryFn: ({ signal }) => careerSiteApi.get(signal), enabled: allowed });
  if (!allowed) return <NoAccess what="the career site settings" />;
  return (
    <>
      <PageHeader title="Career site" subtitle="Your public, branded jobs site and the candidate portal." />
      {q.isPending ? <GridSkeleton rows={8} /> : q.isError ? <ErrorBar message={errorMessage(q.error)} /> : <SettingsForm site={q.data} />}
      <CustomDomainCard />
    </>
  );
}
