"use client";

import {
  Button,
  Caption1,
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
  MessageBar,
  MessageBarBody,
  Option,
  Subtitle2,
  Tab,
  TabList,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { errorMessage } from "@/lib/api/errors";
import { type AppOut, devApi, type RunOut, type VersionOut } from "./api";
import { canFinish } from "./logic";
import { Markdown } from "./markdown";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, maxWidth: "820px" },
  row: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  preview: { border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium, padding: tokens.spacingHorizontalM, minHeight: "120px" },
});

/** The App "Listing" tab (74.5): edit the listing draft, then submit a version with a passed conformance report. */
export function ListingForm({ app }: { app: AppOut }) {
  const s = useStyles();
  const toast = useAppToast();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState(app.name);
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [screenshots, setScreenshots] = useState("");
  const [privacyUrl, setPrivacyUrl] = useState("");
  const [india, setIndia] = useState("");
  const [changelog, setChangelog] = useState("");
  const [descTab, setDescTab] = useState<"edit" | "preview">("edit");
  const [listingId, setListingId] = useState<string | null>(app.listing_id ?? null);
  const [version, setVersion] = useState<VersionOut | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runs = useQuery<RunOut[]>({ queryKey: ["dev", "runs", app.id], queryFn: () => devApi.runHistory(app.id) });
  const passedRuns = (runs.data ?? []).filter((r) => r.status === "passed" && r.report_available);

  const saveDraft = async () => {
    setError(null);
    try {
      let lid = listingId;
      if (!lid) {
        const listing = await devApi.listingDraft(app.id, { slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60), name, tagline, category: "other" });
        lid = listing.id;
        setListingId(lid);
      }
      const v = await devApi.saveVersion(lid, {
        description_md: description,
        screenshots: screenshots.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 5),
        privacy_url: privacyUrl || null,
        india_transfer_statement: india || null,
        changelog: changelog || null,
      });
      setVersion(v);
      toast.success("Listing draft saved.");
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className={s.root}>
      {error ? (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      ) : null}
      <div className={s.row}>
        <Field label="URL name (slug)">
          <Input value={slug} placeholder={name.toLowerCase().replace(/[^a-z0-9]+/g, "-")} onChange={(_, d) => setSlug(d.value)} disabled={!!listingId} />
        </Field>
        <Field label="Name">
          <Input value={name} onChange={(_, d) => setName(d.value)} />
        </Field>
      </div>
      <Field label="Tagline">
        <Input value={tagline} maxLength={200} onChange={(_, d) => setTagline(d.value)} />
      </Field>
      <Field label="Description (Markdown)">
        <TabList selectedValue={descTab} onTabSelect={(_, d) => setDescTab(d.value as "edit" | "preview")}>
          <Tab value="edit">Write</Tab>
          <Tab value="preview">Preview</Tab>
        </TabList>
        {descTab === "edit" ? (
          <Textarea value={description} rows={8} onChange={(_, d) => setDescription(d.value)} />
        ) : (
          <div className={s.preview}>
            <Markdown source={description || "_Nothing to preview yet._"} />
          </div>
        )}
      </Field>
      <Field label="Screenshots (one URL per line, up to 5)">
        <Textarea value={screenshots} rows={3} onChange={(_, d) => setScreenshots(d.value)} />
      </Field>
      <Field label="Privacy policy URL">
        <Input value={privacyUrl} onChange={(_, d) => setPrivacyUrl(d.value)} />
      </Field>
      <Field label="India data transfer statement">
        <Textarea value={india} rows={3} onChange={(_, d) => setIndia(d.value)} />
      </Field>
      <Field label="Changelog">
        <Textarea value={changelog} rows={2} onChange={(_, d) => setChangelog(d.value)} />
      </Field>
      <div className={s.row}>
        <Button onClick={() => void saveDraft()}>Save draft</Button>
        <Button appearance="primary" disabled={!version} onClick={() => setSubmitOpen(true)}>
          Submit for review
        </Button>
        {version && (version.status === "submitted" || version.status === "in_review" || version.status === "automated_checks") ? (
          <Button
            onClick={() =>
              void devApi.withdrawVersion(version.id).then((v) => {
                setVersion(v);
                toast.success("Withdrawn.");
              })
            }
          >
            Withdraw
          </Button>
        ) : null}
      </div>
      {submitOpen && version ? (
        <SubmitDialog
          version={version}
          passedRuns={passedRuns}
          onClose={() => setSubmitOpen(false)}
          onDone={(v) => {
            setVersion(v);
            setSubmitOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function SubmitDialog({ version, passedRuns, onClose, onDone }: { version: VersionOut; passedRuns: RunOut[]; onClose: () => void; onDone: (v: VersionOut) => void }) {
  const toast = useAppToast();
  const [run, setRun] = useState<string>(passedRuns[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setError(null);
    try {
      const v = await devApi.submitVersion(version.id, run);
      toast.success("Submitted for review.");
      onDone(v);
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  return (
    <Dialog open onOpenChange={(_, d) => (!d.open ? onClose() : undefined)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Submit version {version.version_no} for review?</DialogTitle>
          <DialogContent>
            <Subtitle2 as="h3">Conformance report</Subtitle2>
            {passedRuns.length ? (
              <Dropdown
                value={passedRuns.find((r) => r.id === run)?.manifest_sha256.slice(0, 10) ?? ""}
                selectedOptions={run ? [run] : []}
                onOptionSelect={(_, d) => d.optionValue && setRun(d.optionValue)}
              >
                {passedRuns.map((r) => {
                  const label = `${new Date(r.created_at).toLocaleString()} — manifest ${r.manifest_sha256.slice(0, 10)} (${canFinish(r.created_at) ? "ready" : "recent"})`;
                  return (
                    <Option key={r.id} value={r.id} text={label}>
                      {label}
                    </Option>
                  );
                })}
              </Dropdown>
            ) : (
              <MessageBar intent="warning">
                <MessageBarBody>No passed conformance run in the last 30 days. Run one from the Conformance tab first.</MessageBarBody>
              </MessageBar>
            )}
            <Caption1>Automated checks run first. A reviewer usually responds within 5 business days.</Caption1>
            {error ? (
              <MessageBar intent="error">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={!run} onClick={() => void submit()}>
              Submit
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
