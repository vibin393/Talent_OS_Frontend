"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
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
  Option,
  type TableColumnDefinition,
  Text,
  Title2,
  tokens,
} from "@fluentui/react-components";
import { useState } from "react";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import type { CopyCalendarOut, HolidayOut, HolidayType, ScopeKind } from "@/features/leave/types";
import { errorMessage } from "@/lib/api/errors";
import { useHolidayCalendar, useHolidayCalendars } from "./use-holiday-calendars";

const useStyles = makeStyles({
  page: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "1040px" },
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, alignItems: "flex-end" },
  list: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
});

const SCOPES: ScopeKind[] = ["country", "state", "client", "legal_entity"];
const TYPES: HolidayType[] = ["national", "state", "optional", "client"];

/** `/admin/holiday-calendars`: calendars by scope and year, holiday editor and copy-to-year. */
export function HolidayCalendarsAdmin() {
  const styles = useStyles();
  const [year, setYear] = useState(new Date().getFullYear());
  const { list, create, remove, copy } = useHolidayCalendars(year);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<ScopeKind>("country");
  const [ref, setRef] = useState("");
  const [copyResult, setCopyResult] = useState<CopyCalendarOut | null>(null);

  const createCalendar = () =>
    create.mutate({
      name,
      year,
      scope_kind: scope,
      state_code: scope === "state" ? ref : null,
      client_id: scope === "client" ? ref : null,
      legal_entity_id: scope === "legal_entity" ? ref : null,
    });

  return (
    <div className={styles.page}>
      <Title2>Holiday calendars</Title2>
      <Card className={styles.card}>
        <div className={styles.row}>
          <Field label="Year">
            <Input type="number" value={String(year)} onChange={(_, d) => d.value && setYear(Number(d.value))} />
          </Field>
          <Field label="Name" required>
            <Input value={name} onChange={(_, d) => setName(d.value)} />
          </Field>
          <Field label="Scope">
            <Dropdown value={scope} selectedOptions={[scope]} onOptionSelect={(_, d) => setScope(d.optionValue as ScopeKind)}>
              {SCOPES.map((s) => (
                <Option key={s} value={s}>
                  {s}
                </Option>
              ))}
            </Dropdown>
          </Field>
          {scope !== "country" && (
            <Field label={scope === "state" ? "State code (GST, e.g. 29)" : `${scope} id`} required>
              <Input value={ref} onChange={(_, d) => setRef(d.value.trim())} />
            </Field>
          )}
          <Button appearance="primary" disabled={!name || (scope !== "country" && !ref) || create.isPending} onClick={createCalendar}>
            Create calendar
          </Button>
        </div>
        {create.isError && <ErrorBar message={errorMessage(create.error)} />}
      </Card>
      {list.isPending ? (
        <GridSkeleton />
      ) : list.isError ? (
        <ErrorBar message={errorMessage(list.error)} />
      ) : list.data.length === 0 ? (
        <Body1>No calendars for {year}.</Body1>
      ) : (
        <Card className={styles.card}>
          {list.data.map((c) => (
            <div key={c.id} className={styles.row}>
              <Button appearance={selected === c.id ? "primary" : "subtle"} onClick={() => setSelected(c.id)}>
                {c.name}
              </Button>
              <Badge appearance="outline">{c.scope_kind}</Badge>
              <Caption1>{c.holiday_count} holidays</Caption1>
              <Button
                size="small"
                disabled={copy.isPending}
                onClick={() => copy.mutate({ id: c.id, year: c.year + 1 }, { onSuccess: (r) => setCopyResult(r) })}
              >
                Copy to {c.year + 1}
              </Button>
              <Button size="small" onClick={() => remove.mutate(c.id)}>
                Delete or archive
              </Button>
            </div>
          ))}
          {copy.isError && <ErrorBar message={errorMessage(copy.error)} />}
        </Card>
      )}
      {selected && <CalendarEditor id={selected} />}
      <Dialog open={copyResult !== null} onOpenChange={(_, d) => !d.open && setCopyResult(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Copied to {copyResult?.calendar.year}</DialogTitle>
            <DialogContent className={styles.list}>
              <Text>{copyResult?.copied.length ?? 0} holidays copied.</Text>
              {(copyResult?.skipped ?? []).map((s) => (
                <Caption1 key={`${s.holiday_date}-${s.name}`}>
                  Skipped {s.name} ({s.holiday_date}): no 29 February in the target year.
                </Caption1>
              ))}
              {(copyResult?.copied ?? [])
                .filter((c) => c.needs_review)
                .map((c) => (
                  <Caption1 key={c.id}>Check the date of {c.name} ({c.holiday_date}): it may move each year.</Caption1>
                ))}
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={() => setCopyResult(null)}>
                Done
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

function CalendarEditor({ id }: { id: string }) {
  const styles = useStyles();
  const { detail, addHoliday, removeHoliday } = useHolidayCalendar(id);
  const [date, setDate] = useState("");
  const [hname, setHname] = useState("");
  const [type, setType] = useState<HolidayType>("national");
  const columns: TableColumnDefinition<HolidayOut>[] = [
    createTableColumn({ columnId: "date", renderHeaderCell: () => "Date", renderCell: (h) => h.holiday_date }),
    createTableColumn({ columnId: "name", renderHeaderCell: () => "Name", renderCell: (h) => h.name }),
    createTableColumn({ columnId: "type", renderHeaderCell: () => "Type", renderCell: (h) => h.type }),
    createTableColumn({
      columnId: "remove",
      renderHeaderCell: () => "",
      renderCell: (h) => (
        <Button size="small" appearance="subtle" onClick={() => removeHoliday.mutate(h.id)}>
          Remove
        </Button>
      ),
    }),
  ];
  if (detail.isPending) return <GridSkeleton />;
  if (detail.isError) return <ErrorBar message={errorMessage(detail.error)} />;
  return (
    <Card className={styles.card}>
      <Text weight="semibold">
        {detail.data.name} · {detail.data.year}
      </Text>
      <DataGrid items={detail.data.holidays} columns={columns} getRowId={(h) => h.id} aria-label="Holidays">
        <DataGridHeader>
          <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
        </DataGridHeader>
        <DataGridBody<HolidayOut>>
          {({ item, rowId }) => <DataGridRow<HolidayOut> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>}
        </DataGridBody>
      </DataGrid>
      <div className={styles.row}>
        <Field label="Date">
          <Input type="date" value={date} onChange={(_, d) => setDate(d.value)} />
        </Field>
        <Field label="Name">
          <Input value={hname} onChange={(_, d) => setHname(d.value)} />
        </Field>
        <Field label="Type">
          <Dropdown value={type} selectedOptions={[type]} onOptionSelect={(_, d) => setType(d.optionValue as HolidayType)}>
            {TYPES.map((t) => (
              <Option key={t} value={t}>
                {t}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Button
          disabled={!date || !hname || addHoliday.isPending}
          onClick={() => addHoliday.mutate({ holiday_date: date, name: hname, type }, { onSuccess: () => setHname("") })}
        >
          Add holiday
        </Button>
      </div>
      {addHoliday.isError && <ErrorBar message={errorMessage(addHoliday.error)} />}
    </Card>
  );
}
