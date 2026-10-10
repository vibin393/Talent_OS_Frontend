"use client";

import {
  Badge,
  Button,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, Delete20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/features/admin/ui";
import { Empty, Failure, formatDate, Loading, PageTitle, useCpStyles } from "@/features/client-portal/ui";
import { clientPortalApi, clientPortalKeys } from "@/lib/api/client-portal-client";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { portalForecastKeys, portalForecastsApi } from "./api";
import {
  BLANK_FORECAST_LINE,
  FORECAST_STATUS_COLORS,
  FORECAST_STATUS_LABELS,
  formatMonth,
  PORTAL_PERM_FORECASTS,
  type ForecastForm,
  type ForecastFormLine,
  validateForecast,
} from "./logic";
import type { ForecastPortalDetail } from "./types";

const useStyles = makeStyles({
  grid2: { display: "grid", gap: tokens.spacingHorizontalM, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" },
  lineCard: {
    display: "grid",
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    alignItems: "start",
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  tableWrap: { overflowX: "auto" },
});

/** `me.portal_permissions` contains `forecasts:submit` (null while loading). */
function useCanForecast(): boolean | null {
  const me = useQuery({ queryKey: clientPortalKeys.me, queryFn: ({ signal }) => clientPortalApi.me(signal) });
  if (!me.data) return null;
  return (me.data.portal_permissions ?? []).includes(PORTAL_PERM_FORECASTS);
}

function NoForecastAccess() {
  return <Empty>You do not have permission to submit hiring forecasts. Ask your account manager for access.</Empty>;
}

/** `/client/forecasts`: the client's hiring forecasts with status. */
export function ClientForecasts() {
  const s = useCpStyles();
  const router = useRouter();
  const allowed = useCanForecast();
  const q = useQuery({ queryKey: portalForecastKeys.list, queryFn: ({ signal }) => portalForecastsApi.list(signal), enabled: allowed === true });
  if (allowed === null) return <Loading />;
  if (!allowed) return <NoForecastAccess />;
  return (
    <div className={s.page}>
      <PageTitle
        actions={
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => router.push("/client/forecasts/new")}>
            New forecast
          </Button>
        }
      >
        Hiring forecasts
      </PageTitle>
      <Text className={s.muted}>Tell us the roles you expect to hire so we can plan ahead.</Text>
      {q.error ? <Failure error={q.error} /> : null}
      {!q.data && !q.error ? <Loading /> : null}
      {q.data && q.data.length === 0 ? <Empty>No forecasts yet.</Empty> : null}
      <div className={s.list}>
        {q.data?.map((f) => (
          <div key={f.id} className={s.card}>
            <div className={s.row}>
              <div className={s.grow}>
                <Link className={s.link} href={`/client/forecasts/${f.id}`}>
                  <Text weight="semibold">{f.name}</Text>
                </Link>
                <br />
                <Text size={200} className={s.muted}>
                  {`${formatDate(f.period_start)} – ${formatDate(f.period_end)} · ${f.total_headcount} people across ${f.line_count} role${f.line_count === 1 ? "" : "s"}`}
                </Text>
              </div>
              <Badge appearance="tint" color={FORECAST_STATUS_COLORS[f.status]}>
                {FORECAST_STATUS_LABELS[f.status]}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function toForm(f: ForecastPortalDetail): ForecastForm {
  return {
    name: f.name,
    period_start: f.period_start,
    period_end: f.period_end,
    lines: f.lines.map((l) => ({
      role_title: l.role_title,
      skills: l.skills.join(", "),
      headcount: String(l.headcount),
      location_text: l.location_text ?? "",
      planned_start_month: l.planned_start_month,
      notes: l.comment ?? "",
    })),
  };
}

/** New / edit forecast form: name, period and a grid of roles (no money fields). */
function ForecastEditor({ initial, forecastId, onSaved, onCancel }: { initial: ForecastForm; forecastId?: string; onSaved: (id: string) => void; onCancel: () => void }) {
  const s = useCpStyles();
  const styles = useStyles();
  const qc = useQueryClient();
  const [form, setForm] = useState<ForecastForm>(initial);
  const [touched, setTouched] = useState(false);
  const { errors, body } = validateForecast(form);
  const err = (k: string) => (touched ? errors[k] : undefined);
  const save = useMutation({
    mutationFn: () => (forecastId ? portalForecastsApi.update(forecastId, body!) : portalForecastsApi.create(body!)),
    onSuccess: async (f) => {
      await qc.invalidateQueries({ queryKey: portalForecastKeys.list });
      qc.setQueryData(portalForecastKeys.detail(f.id), f);
      onSaved(f.id);
    },
  });
  const setLine = (i: number, k: keyof ForecastFormLine, v: string) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }));
  return (
    <form
      className={s.list}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (body) save.mutate();
      }}
    >
      {save.error ? (
        <MessageBar intent="error">
          <MessageBarBody>
            {isApiError(save.error) && save.error.code === "forecast_locked" ? "This forecast is already being reviewed and can no longer be changed." : errorMessage(save.error)}
          </MessageBarBody>
        </MessageBar>
      ) : null}
      <div className={s.card}>
        <Field label="Forecast name" required validationMessage={err("name")}>
          <Input value={form.name} onChange={(_, d) => setForm((f) => ({ ...f, name: d.value }))} placeholder="e.g. FY 27-28 hiring" />
        </Field>
        <div className={styles.grid2}>
          <Field label="Period start" required validationMessage={err("period_start")}>
            <Input type="date" value={form.period_start} onChange={(_, d) => setForm((f) => ({ ...f, period_start: d.value }))} />
          </Field>
          <Field label="Period end" required validationMessage={err("period_end")}>
            <Input type="date" value={form.period_end} onChange={(_, d) => setForm((f) => ({ ...f, period_end: d.value }))} />
          </Field>
        </div>
      </div>
      <Text as="h2" size={500} weight="semibold">
        Roles
      </Text>
      {touched && errors.lines ? (
        <MessageBar intent="error">
          <MessageBarBody>{errors.lines}</MessageBarBody>
        </MessageBar>
      ) : null}
      {form.lines.map((l, i) => (
        <fieldset key={i} className={styles.lineCard} aria-label={`Role ${i + 1}`}>
          <Field label="Role" required validationMessage={err(`lines.${i}.role_title`)}>
            <Input value={l.role_title} onChange={(_, d) => setLine(i, "role_title", d.value)} />
          </Field>
          <Field label="Skills" hint="Comma separated">
            <Input value={l.skills} onChange={(_, d) => setLine(i, "skills", d.value)} placeholder="Java, Spring" />
          </Field>
          <Field label="Headcount" required validationMessage={err(`lines.${i}.headcount`)}>
            <Input type="number" min={1} max={500} value={l.headcount} onChange={(_, d) => setLine(i, "headcount", d.value)} />
          </Field>
          <Field label="Planned start" required validationMessage={err(`lines.${i}.planned_start_month`)}>
            <Input type="month" value={l.planned_start_month} onChange={(_, d) => setLine(i, "planned_start_month", d.value)} placeholder="YYYY-MM" />
          </Field>
          <Field label="Location">
            <Input value={l.location_text} onChange={(_, d) => setLine(i, "location_text", d.value)} />
          </Field>
          <Field label="Comment">
            <Input value={l.notes} onChange={(_, d) => setLine(i, "notes", d.value)} />
          </Field>
          <div className={s.actions}>
            <Button
              appearance="subtle"
              icon={<Delete20Regular />}
              disabled={form.lines.length === 1}
              onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))}
            >
              Remove role
            </Button>
          </div>
        </fieldset>
      ))}
      <div className={s.actions}>
        <Button icon={<Add20Regular />} onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, { ...BLANK_FORECAST_LINE }] }))}>
          Add role
        </Button>
      </div>
      <div className={s.actions}>
        <Button appearance="primary" type="submit" disabled={save.isPending}>
          {forecastId ? "Save changes" : "Submit forecast"}
        </Button>
        <Button onClick={onCancel} disabled={save.isPending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** `/client/forecasts/new`. */
export function ClientForecastNew() {
  const s = useCpStyles();
  const router = useRouter();
  const allowed = useCanForecast();
  if (allowed === null) return <Loading />;
  if (!allowed) return <NoForecastAccess />;
  return (
    <div className={s.page}>
      <PageTitle>New hiring forecast</PageTitle>
      <ForecastEditor
        initial={{ name: "", period_start: "", period_end: "", lines: [{ ...BLANK_FORECAST_LINE }] }}
        onSaved={(id) => router.push(`/client/forecasts/${id}`)}
        onCancel={() => router.push("/client/forecasts")}
      />
    </div>
  );
}

/** `/client/forecasts/[id]`: status and roles; edit / withdraw while it has not been picked up. */
export function ClientForecastDetail({ id }: { id: string }) {
  const s = useCpStyles();
  const styles = useStyles();
  const router = useRouter();
  const qc = useQueryClient();
  const allowed = useCanForecast();
  const q = useQuery({ queryKey: portalForecastKeys.detail(id), queryFn: ({ signal }) => portalForecastsApi.get(id, signal), enabled: allowed === true });
  const [editing, setEditing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  if (allowed === null) return <Loading />;
  if (!allowed) return <NoForecastAccess />;
  if (q.error) return <Failure error={q.error} />;
  if (!q.data) return <Loading />;
  const f = q.data;
  if (editing) {
    return (
      <div className={s.page}>
        <PageTitle>{`Edit "${f.name}"`}</PageTitle>
        <ForecastEditor
          initial={toForm(f)}
          forecastId={f.id}
          onSaved={() => {
            setEditing(false);
            setNotice("Forecast updated.");
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }
  return (
    <div className={s.page}>
      <PageTitle
        actions={
          f.editable ? (
            <div className={s.actions}>
              <Button onClick={() => setEditing(true)}>Edit</Button>
              <Button icon={<Delete20Regular />} onClick={() => setWithdrawing(true)}>
                Withdraw
              </Button>
            </div>
          ) : undefined
        }
      >
        {f.name}
      </PageTitle>
      <div className={s.row}>
        <Badge appearance="tint" color={FORECAST_STATUS_COLORS[f.status]}>
          {FORECAST_STATUS_LABELS[f.status]}
        </Badge>
        <Text className={s.muted}>{`${formatDate(f.period_start)} – ${formatDate(f.period_end)} · submitted ${formatDate(f.created_at)}`}</Text>
      </div>
      {notice ? (
        <MessageBar intent="success" aria-live="polite">
          <MessageBarBody>{notice}</MessageBarBody>
        </MessageBar>
      ) : null}
      {!f.editable && f.status !== "approved" && f.status !== "declined" ? (
        <Text className={s.muted}>Your account team is reviewing this forecast; it can no longer be changed.</Text>
      ) : null}
      <div className={`${s.card} ${styles.tableWrap}`}>
        <Table aria-label="Forecast roles">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Role</TableHeaderCell>
              <TableHeaderCell>Skills</TableHeaderCell>
              <TableHeaderCell>Headcount</TableHeaderCell>
              <TableHeaderCell>Start</TableHeaderCell>
              <TableHeaderCell>Location</TableHeaderCell>
              <TableHeaderCell>Comment</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {f.lines.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.role_title}</TableCell>
                <TableCell>{l.skills.join(", ") || "—"}</TableCell>
                <TableCell className={s.num}>{l.headcount}</TableCell>
                <TableCell>{formatMonth(l.planned_start_month)}</TableCell>
                <TableCell>{l.location_text ?? "—"}</TableCell>
                <TableCell>{l.comment ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Link className={s.link} href="/client/forecasts">
        Back to forecasts
      </Link>
      <ConfirmDialog
        open={withdrawing}
        title="Withdraw this forecast?"
        confirmLabel="Withdraw"
        onClose={() => setWithdrawing(false)}
        onConfirm={async () => {
          try {
            await portalForecastsApi.remove(f.id);
            await qc.invalidateQueries({ queryKey: portalForecastKeys.list });
            router.push("/client/forecasts");
          } catch (e) {
            setNotice(null);
            setWithdrawing(false);
            await q.refetch();
            setNotice(isApiError(e) && e.code === "forecast_locked" ? "This forecast is already being reviewed and cannot be withdrawn." : errorMessage(e));
          }
        }}
      >
        {`"${f.name}" will be removed and your account team will no longer see it.`}
      </ConfirmDialog>
    </div>
  );
}
