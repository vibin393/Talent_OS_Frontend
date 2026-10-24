"use client";

import {
  Badge,
  Button,
  Field,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  SpinButton,
  Subtitle2,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Tag,
  TagPicker,
  TagPickerControl,
  TagPickerGroup,
  TagPickerInput,
  TagPickerList,
  TagPickerOption,
  Text,
} from "@fluentui/react-components";
import { ArrowSync20Regular, Save20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, formatDateTime, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { hasAnyPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import { useRcvStyles } from "@/features/receivables/components";
import { errorMessage } from "@/lib/api/errors";
import { fxFeedApi, fxFeedKeys } from "./api";
import {
  formFromSettings,
  MAX_STALE_MAX,
  MAX_STALE_MIN,
  normalizePair,
  PAIR_OPTIONS,
  PRECEDENCE_OPTIONS,
  rateOrigin,
  serializeFeedForm,
  validateFeedForm,
  type FeedForm,
} from "./logic";
import type { FxFeedSettings, FxPrecedence, FxRate } from "./types";

const RUN_COLOR = { ok: "success", partial: "warning", failed: "danger" } as const;

/** `/settings/fx-feed`: daily FX feed settings, fetch runs and the rate list with origin (Epic 51). */
export function FxFeedView() {
  const s = useRcvStyles();
  const perms = usePermissions();
  const canRead = hasAnyPermission(perms, ["fx_feed:configure", "legal_entity:read"]);
  const settings = useQuery({ queryKey: fxFeedKeys.settings, queryFn: ({ signal }) => fxFeedApi.settings(signal), enabled: canRead });
  if (!canRead) return <NoAccess what="FX feed settings" />;
  return (
    <div className={s.page}>
      <PageHeader title="FX feed" subtitle="Daily reference exchange rates for foreign-currency invoices" />
      <ErrorBar message={settings.error ? errorMessage(settings.error) : null} />
      {settings.data ? <SettingsCard settings={settings.data} /> : !settings.error && <GridSkeleton rows={4} />}
      <RunsTable />
      <FxRatesTable />
    </div>
  );
}

function SettingsCard({ settings }: { settings: FxFeedSettings }) {
  const s = useRcvStyles();
  const admin = useAdminStyles();
  const qc = useQueryClient();
  const perms = usePermissions();
  const canEdit = hasAnyPermission(perms, ["fx_feed:configure"]);
  const [f, setF] = useState<FeedForm>(() => formFromSettings(settings));
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState(false);
  const errors = validateFeedForm(f);
  const valid = Object.keys(errors).length === 0;
  const set = <K extends keyof FeedForm>(k: K, v: FeedForm[K]) => {
    setSaved(false);
    setF((cur) => ({ ...cur, [k]: v }));
  };
  const save = useMutation({
    mutationFn: () => fxFeedApi.saveSettings(serializeFeedForm(f)),
    onSuccess: (out) => {
      qc.setQueryData(fxFeedKeys.settings, out);
      setF(formFromSettings(out));
      setSaved(true);
    },
  });
  const fetchNow = useMutation({
    mutationFn: () => fxFeedApi.fetchNow(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: fxFeedKeys.all }),
  });
  const typed = normalizePair(query);
  const options = PAIR_OPTIONS.filter((p) => !f.pairs.includes(p) && p.includes(query.trim().toUpperCase()));
  const canAddTyped = !!typed && !f.pairs.includes(typed) && !options.includes(typed as (typeof PAIR_OPTIONS)[number]);
  const addPair = (p: string) => {
    if (!f.pairs.includes(p)) set("pairs", [...f.pairs, p]);
    setQuery("");
  };
  const last = settings.last_run;
  return (
    <div className={s.card}>
      <div className={admin.form}>
        <div className={s.row}>
          <Subtitle2 as="h2">Feed settings</Subtitle2>
          <Badge appearance="outline">Provider: {settings.provider_key}</Badge>
          {settings.consecutive_failures > 0 && (
            <Badge appearance="tint" color="danger">
              {settings.consecutive_failures} failed fetch{settings.consecutive_failures === 1 ? "" : "es"} in a row
            </Badge>
          )}
          {last && (
            <Text size={200} className={s.muted}>
              Last run {last.on_date}: {last.status} ({last.inserted} inserted)
            </Text>
          )}
        </div>
        <Switch
          label="Fetch daily reference rates"
          checked={f.enabled}
          disabled={!canEdit}
          onChange={(_, d) => set("enabled", d.checked)}
        />
        <Field
          label="Currency pairs"
          validationState={errors.pairs ? "error" : "none"}
          validationMessage={errors.pairs}
          hint="Type a pair such as USD/INR and press Enter to add one that is not listed."
        >
          <TagPicker
            disabled={!canEdit}
            selectedOptions={f.pairs}
            onOptionSelect={(_, d) => {
              if (!d.value) return;
              if (f.pairs.includes(d.value)) set("pairs", f.pairs.filter((p) => p !== d.value));
              else addPair(d.value);
            }}
          >
            <TagPickerControl>
              <TagPickerGroup aria-label="Selected currency pairs">
                {f.pairs.map((p) => (
                  <Tag key={p} value={p} shape="rounded">
                    {p}
                  </Tag>
                ))}
              </TagPickerGroup>
              <TagPickerInput
                aria-label="Currency pairs"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && typed && canAddTyped) {
                    e.preventDefault();
                    addPair(typed);
                  }
                }}
              />
            </TagPickerControl>
            <TagPickerList>
              {canAddTyped && typed && (
                <TagPickerOption value={typed} text={typed}>
                  {`Add "${typed}"`}
                </TagPickerOption>
              )}
              {options.map((p) => (
                <TagPickerOption key={p} value={p} text={p}>
                  {p}
                </TagPickerOption>
              ))}
            </TagPickerList>
          </TagPicker>
        </Field>
        <Field label="When a manual and a feed rate exist for the same date">
          <RadioGroup value={f.precedence} disabled={!canEdit} onChange={(_, d) => set("precedence", d.value as FxPrecedence)}>
            {PRECEDENCE_OPTIONS.map((o) => (
              <Radio key={o.value} value={o.value} label={`${o.label} — ${o.hint}`} />
            ))}
          </RadioGroup>
        </Field>
        <div className={s.row}>
          <Field
            label="Max stale days"
            hint="Older feed rates are not used; documents then need a manual rate."
            validationState={errors.max_stale_days ? "error" : "none"}
            validationMessage={errors.max_stale_days}
          >
            <SpinButton
              disabled={!canEdit}
              min={MAX_STALE_MIN}
              max={MAX_STALE_MAX}
              value={f.max_stale_days}
              onChange={(_, d) => {
                const v = d.value ?? (d.displayValue !== undefined ? Number.parseInt(d.displayValue, 10) : Number.NaN);
                if (!Number.isNaN(v)) set("max_stale_days", v);
              }}
            />
          </Field>
          <Field
            label="Fetch hour (IST)"
            validationState={errors.fetch_hour_ist ? "error" : "none"}
            validationMessage={errors.fetch_hour_ist}
          >
            <SpinButton
              disabled={!canEdit}
              min={0}
              max={23}
              value={f.fetch_hour_ist}
              onChange={(_, d) => {
                const v = d.value ?? (d.displayValue !== undefined ? Number.parseInt(d.displayValue, 10) : Number.NaN);
                if (!Number.isNaN(v)) set("fetch_hour_ist", v);
              }}
            />
          </Field>
        </div>
        <ErrorBar message={save.error ? errorMessage(save.error) : fetchNow.error ? errorMessage(fetchNow.error) : null} />
        {saved && (
          <MessageBar intent="success">
            <MessageBarBody>FX feed settings saved.</MessageBarBody>
          </MessageBar>
        )}
        {fetchNow.data && (
          <MessageBar intent={fetchNow.data.status === "ok" ? "success" : fetchNow.data.status === "partial" ? "warning" : "error"}>
            <MessageBarBody>
              Fetch {fetchNow.data.status}: {fetchNow.data.fetched} fetched, {fetchNow.data.inserted} inserted,{" "}
              {fetchNow.data.skipped_manual} kept manual{fetchNow.data.error ? ` — ${fetchNow.data.error}` : ""}.
            </MessageBarBody>
          </MessageBar>
        )}
        {canEdit && (
          <div className={s.row}>
            <Button appearance="primary" icon={<Save20Regular />} disabled={!valid || save.isPending} onClick={() => save.mutate()}>
              Save
            </Button>
            <Button icon={<ArrowSync20Regular />} disabled={!settings.enabled || fetchNow.isPending} onClick={() => fetchNow.mutate()}>
              Fetch now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function RunsTable() {
  const s = useRcvStyles();
  const admin = useAdminStyles();
  const q = useQuery({ queryKey: fxFeedKeys.runs, queryFn: ({ signal }) => fxFeedApi.runs(signal) });
  return (
    <div className={s.stack}>
      <Subtitle2 as="h2">Fetch runs</Subtitle2>
      <ErrorBar message={q.error ? errorMessage(q.error) : null} />
      <div className={admin.surface}>
        {!q.data ? (
          !q.error && <GridSkeleton rows={3} />
        ) : q.data.length === 0 ? (
          <div className={admin.empty}>No fetches yet.</div>
        ) : (
          <Table aria-label="FX feed runs" className={admin.grid} size="small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Provider</TableHeaderCell>
                <TableHeaderCell>Fetched</TableHeaderCell>
                <TableHeaderCell>Inserted</TableHeaderCell>
                <TableHeaderCell>Kept manual</TableHeaderCell>
                <TableHeaderCell>Started</TableHeaderCell>
                <TableHeaderCell>Error</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.on_date}</TableCell>
                  <TableCell>
                    <Badge appearance="tint" color={RUN_COLOR[r.status] ?? "informative"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.provider_key}</TableCell>
                  <TableCell>{r.fetched}</TableCell>
                  <TableCell>{r.inserted}</TableCell>
                  <TableCell>{r.skipped_manual}</TableCell>
                  <TableCell>{formatDateTime(r.started_at)}</TableCell>
                  <TableCell>
                    <span className={admin.truncate} title={r.error ?? undefined}>
                      {r.error ?? "—"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

/** FX rate list (P2 `/fx-rates`) with the Epic 51 Origin badge. */
export function FxRatesTable() {
  const s = useRcvStyles();
  const admin = useAdminStyles();
  const q = useQuery({ queryKey: fxFeedKeys.rates, queryFn: ({ signal }) => fxFeedApi.rates(signal) });
  const rows: FxRate[] = [...(q.data ?? [])].sort((a, b) => b.rate_date.localeCompare(a.rate_date)).slice(0, 100);
  return (
    <div className={s.stack}>
      <Subtitle2 as="h2">FX rates</Subtitle2>
      <ErrorBar message={q.error ? errorMessage(q.error) : null} />
      <div className={admin.surface}>
        {!q.data ? (
          !q.error && <GridSkeleton rows={3} />
        ) : rows.length === 0 ? (
          <div className={admin.empty}>No FX rates recorded.</div>
        ) : (
          <Table aria-label="FX rates" className={admin.grid} size="small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Pair</TableHeaderCell>
                <TableHeaderCell>Rate</TableHeaderCell>
                <TableHeaderCell>Source</TableHeaderCell>
                <TableHeaderCell>Origin</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const origin = rateOrigin(r);
                return (
                  <TableRow key={r.id}>
                    <TableCell>{r.rate_date}</TableCell>
                    <TableCell>
                      {r.from_currency}/{r.to_currency}
                    </TableCell>
                    <TableCell className={s.amount}>{r.rate}</TableCell>
                    <TableCell>{r.source}</TableCell>
                    <TableCell>
                      <Badge appearance="tint" color={origin === "feed" ? "brand" : "informative"}>
                        {origin === "feed" ? "Feed" : "Manual"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
