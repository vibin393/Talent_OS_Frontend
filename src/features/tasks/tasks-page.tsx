"use client";

import {
  Button,
  CounterBadge,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  InlineDrawer,
  Input,
  makeStyles,
  OverlayDrawer,
  SearchBox,
  Spinner,
  Tab,
  TabList,
  Text,
  Title2,
  tokens,
} from "@fluentui/react-components";
import {
  Add20Regular,
  CalendarClock20Regular,
  CalendarDate20Regular,
  CheckmarkCircle20Regular,
  Dismiss24Regular,
  PersonArrowRight20Regular,
  Warning20Regular,
  WeatherSunny20Regular,
} from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { useDebounced } from "@/lib/use-debounced";
import { useMediaQuery } from "@/lib/use-media-query";
import { TaskDetail } from "./task-detail";
import { quickAddDue, SMART_LISTS, type SmartList } from "./task-model";
import { TaskRow } from "./task-row";
import { useSmartListCounts, useTaskList, useTaskMutations, useTaskSummary, useTaskTimeZone } from "./use-tasks";

const useStyles = makeStyles({
  root: {
    display: "flex",
    gap: tokens.spacingHorizontalL,
    alignItems: "flex-start",
    minHeight: "calc(100svh - 160px)",
    "@media (max-width: 767px)": { flexDirection: "column" },
  },
  rail: {
    width: "220px",
    flexShrink: 0,
    "@media (max-width: 767px)": { width: "100%", overflowX: "auto" },
  },
  railTab: { justifyContent: "flex-start", width: "100%" },
  count: { marginInlineStart: "auto", color: tokens.colorNeutralForeground3, paddingInlineStart: tokens.spacingHorizontalS },
  main: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  head: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalM, flexWrap: "wrap" },
  headTitle: { flex: 1, minWidth: "160px" },
  date: { color: tokens.colorNeutralForeground3 },
  add: {
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow2,
    borderRadius: tokens.borderRadiusMedium,
  },
  list: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  empty: {
    padding: tokens.spacingHorizontalXXL,
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
  },
  pane: {
    width: "360px",
    flexShrink: 0,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
    alignSelf: "stretch",
  },
});

const LIST_ICONS: Record<SmartList, React.ReactElement> = {
  my_day: <WeatherSunny20Regular />,
  overdue: <Warning20Regular />,
  upcoming: <CalendarDate20Regular />,
  no_date: <CalendarClock20Regular />,
  assigned_by_me: <PersonArrowRight20Regular />,
  completed: <CheckmarkCircle20Regular />,
};

/** `/tasks`: Microsoft To Do style tasks with smart lists, quick add and a details pane. */
export function TasksPage({ initialList }: { initialList: SmartList }) {
  const styles = useStyles();
  const router = useRouter();
  const canRead = usePermission("task:read");
  const canCreate = usePermission("task:create");
  const canUpdate = usePermission("task:update");
  const tz = useTaskTimeZone();
  const wide = useMediaQuery("(min-width: 1024px)", true);
  const narrow = useMediaQuery("(max-width: 767px)");
  const [list, setList] = useState<SmartList>(initialList);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 300);
  const [quick, setQuick] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // `now` ticks every minute so due labels and overdue styling stay current.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const tasks = useTaskList(list, debouncedQ);
  const summary = useTaskSummary();
  const counts = useSmartListCounts();
  const { setDone, update, remove, create } = useTaskMutations();

  if (!canRead) return <NoAccess what="tasks" />;

  const selectList = (next: SmartList) => {
    setList(next);
    setSelectedId(null);
    router.replace(next === "my_day" ? "/tasks" : `/tasks?list=${next}`, { scroll: false });
  };

  const countFor = (l: SmartList): number | null => {
    if (l === "my_day") return summary.data?.due_today ?? null;
    if (l === "overdue") return summary.data?.overdue ?? null;
    if (l === "completed") return null;
    return counts.data?.[l] ?? null;
  };

  const items = tasks.data?.items ?? [];
  const selected = items.find((t) => t.id === selectedId) ?? null;
  const current = SMART_LISTS.find((l) => l.id === list);

  const addTask = () => {
    const title = quick.trim();
    if (!title) return;
    setQuick("");
    create.mutate({ title, priority: "normal", ...quickAddDue(list, new Date(), tz) });
  };

  const detail = selected && (
    <TaskDetail
      key={selected.id}
      task={selected}
      timeZone={tz}
      onSave={(body) => update.mutate({ id: selected.id, body })}
      onToggle={(done) => setDone.mutate({ task: selected, done })}
      onDelete={async () => {
        await remove.mutateAsync(selected);
        setSelectedId(null);
      }}
    />
  );
  const detailTitle = (
    <DrawerHeader>
      <DrawerHeaderTitle
        action={
          <Button appearance="subtle" aria-label="Close details" icon={<Dismiss24Regular />} onClick={() => setSelectedId(null)} />
        }
      >
        Task details
      </DrawerHeaderTitle>
    </DrawerHeader>
  );

  return (
    <div className={styles.root}>
      <nav className={styles.rail} aria-label="Task lists">
        <TabList
          vertical={!narrow}
          selectedValue={list}
          onTabSelect={(_, d) => selectList(d.value as SmartList)}
          appearance="subtle"
        >
          {SMART_LISTS.map((l) => {
            const n = countFor(l.id);
            return (
              <Tab key={l.id} value={l.id} icon={LIST_ICONS[l.id]} className={styles.railTab}>
                {l.label}
                {l.id === "overdue"
                  ? !!n && (
                      <CounterBadge
                        count={n}
                        color="danger"
                        size="small"
                        aria-label={`${n} overdue`}
                        style={{ marginInlineStart: tokens.spacingHorizontalS }}
                      />
                    )
                  : n !== null && n > 0 && <span className={styles.count}>{n}</span>}
              </Tab>
            );
          })}
        </TabList>
      </nav>

      <section className={styles.main} aria-labelledby="tasks-title">
        <div className={styles.head}>
          <div className={styles.headTitle}>
            <Title2 as="h1" id="tasks-title" style={{ display: "block" }}>
              {current?.label ?? "Tasks"}
            </Title2>
            {list === "my_day" && (
              <Text as="p" className={styles.date} style={{ margin: 0 }}>
                {new Intl.DateTimeFormat(undefined, { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(now)}
              </Text>
            )}
          </div>
          <SearchBox placeholder="Search tasks" aria-label="Search tasks" value={q} onChange={(_, d) => setQ(d.value)} />
        </div>

        {canCreate && list !== "completed" && (
          <Input
            className={styles.add}
            size="large"
            appearance="filled-lighter"
            contentBefore={create.isPending ? <Spinner size="extra-tiny" /> : <Add20Regular />}
            placeholder="Add a task"
            aria-label="Add a task"
            value={quick}
            maxLength={200}
            onChange={(_, d) => setQuick(d.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTask();
              }
            }}
          />
        )}

        {tasks.isError && !tasks.data ? (
          <ErrorBar title="Could not load tasks." message={errorMessage(tasks.error)} />
        ) : tasks.isPending ? (
          <GridSkeleton rows={4} />
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            {debouncedQ
              ? "No tasks match your search."
              : list === "my_day"
                ? "Nothing due today. Add a task to focus on it today."
                : list === "overdue"
                  ? "Nothing overdue. Nice work."
                  : "No tasks here."}
          </div>
        ) : (
          <div role="list" aria-label={`${current?.label ?? ""} tasks`} className={styles.list}>
            {items.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                now={now}
                timeZone={tz}
                selected={t.id === selectedId}
                canComplete={canUpdate}
                onToggle={(done) => setDone.mutate({ task: t, done })}
                onOpen={() => setSelectedId(t.id)}
              />
            ))}
          </div>
        )}
      </section>

      {wide ? (
        <InlineDrawer open={!!selected} position="end" separator className={styles.pane}>
          {detailTitle}
          <DrawerBody>{detail}</DrawerBody>
        </InlineDrawer>
      ) : (
        <OverlayDrawer open={!!selected} position="end" onOpenChange={(_, d) => !d.open && setSelectedId(null)}>
          {detailTitle}
          <DrawerBody>{detail}</DrawerBody>
        </OverlayDrawer>
      )}
    </div>
  );
}
