"use client";

import {
  Button,
  Card,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Radio,
  RadioGroup,
  SpinButton,
  Subtitle2,
  Switch,
  Tab,
  TabList,
  Text,
  Title2,
  tokens,
} from "@fluentui/react-components";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAppToast } from "@/components/toast";
import { errorMessage } from "@/lib/api/errors";
import { jobBoardsApi } from "./api";
import { BOARD_LABELS, boardLabel, REGENERATE_CONFIRM } from "./logic";
import type { BoardSetOut, JobBoardSettings, MappingOut } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, padding: tokens.spacingHorizontalXL },
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  row: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "flex-end", flexWrap: "wrap" },
});

const EMPLOYMENT_ROWS: { label: string; value: string | null }[] = [
  { label: "Contract", value: "contract" },
  { label: "Contract-to-hire", value: "contract_to_hire" },
  { label: "Permanent", value: "permanent" },
  { label: "Freelance", value: "freelance" },
  { label: "Any type", value: null },
];
const BOARD_KEYS = ["naukri", "linkedin", "indeed", "job_feed"];
const KINDS: { label: string; value: string }[] = [
  { label: "Function", value: "function" },
  { label: "Industry", value: "industry" },
  { label: "Location", value: "location" },
  { label: "Experience", value: "experience_band" },
  { label: "Salary", value: "salary_band" },
  { label: "Employment type", value: "employment_type" },
  { label: "Education", value: "education" },
  { label: "Defaults", value: "default" },
];

function GeneralCard() {
  const styles = useStyles();
  const toast = useAppToast();
  const q = useQuery({ queryKey: ["job-boards", "settings"], queryFn: jobBoardsApi.settings });
  const [form, setForm] = useState<JobBoardSettings | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: seed local state from fetched/client-only data
  useEffect(() => setForm(q.data ?? null), [q.data]);
  if (!form) return null;
  return (
    <Card className={styles.card}>
      <Subtitle2>Job boards</Subtitle2>
      <Field label="Remind me before a posting expires (days)">
        <SpinButton
          min={1}
          max={14}
          value={form.expiry_warning_days}
          onChange={(_, d) => setForm({ ...form, expiry_warning_days: Number(d.value ?? form.expiry_warning_days) })}
        />
      </Field>
      <Switch
        label="Daily applicant digest"
        checked={form.applicant_digest}
        onChange={(_, d) => setForm({ ...form, applicant_digest: d.checked })}
      />
      <Switch
        label="Close board postings when the job is closed, filled or on hold"
        checked={form.auto_close_on_demand_change}
        onChange={(_, d) => setForm({ ...form, auto_close_on_demand_change: d.checked })}
      />
      <div>
        <Button
          appearance="primary"
          onClick={async () => {
            try {
              await jobBoardsApi.saveSettings(form);
              toast.success("Saved");
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
        >
          Save
        </Button>
      </div>
    </Card>
  );
}

function DefaultBoardsCard() {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["job-boards", "sets"], queryFn: jobBoardsApi.boardSets });
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  useEffect(() => {
    const d: Record<string, string[]> = {};
    for (const s of q.data ?? []) if (s.is_default) d[s.employment_type ?? "any"] = s.board_keys;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: seed local state from fetched/client-only data
    setDraft(d);
  }, [q.data]);
  async function save() {
    try {
      const sets = q.data ?? [];
      for (const r of EMPLOYMENT_ROWS) {
        const key = r.value ?? "any";
        const keys = draft[key] ?? [];
        const existing: BoardSetOut | undefined = sets.find((s) => s.is_default && s.employment_type === r.value);
        if (existing) await jobBoardsApi.updateBoardSet(existing.id, { board_keys: keys });
        else if (keys.length)
          await jobBoardsApi.createBoardSet({ name: r.label, employment_type: r.value, board_keys: keys, is_default: true });
      }
      await qc.invalidateQueries({ queryKey: ["job-boards", "sets"] });
      toast.success("Saved");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return (
    <Card className={styles.card}>
      <Subtitle2>Default boards</Subtitle2>
      {EMPLOYMENT_ROWS.map((r) => {
        const key = r.value ?? "any";
        const value = draft[key] ?? [];
        return (
          <Field key={key} label={r.label}>
            <Dropdown
              multiselect
              value={value.map(boardLabel).join(", ")}
              selectedOptions={value}
              onOptionSelect={(_, d) => setDraft({ ...draft, [key]: d.selectedOptions })}
            >
              {BOARD_KEYS.map((k) => (
                <Option key={k} value={k}>
                  {BOARD_LABELS[k] ?? k}
                </Option>
              ))}
            </Dropdown>
          </Field>
        );
      })}
      <div>
        <Button appearance="primary" onClick={save}>
          Save
        </Button>
      </div>
    </Card>
  );
}

function MappingsCard() {
  const styles = useStyles();
  const toast = useAppToast();
  const [board, setBoard] = useState("naukri");
  const [kind, setKind] = useState("function");
  const q = useQuery({ queryKey: ["job-boards", "mappings", board], queryFn: () => jobBoardsApi.mappings(board) });
  const [items, setItems] = useState<MappingOut[]>([]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: seed local state from fetched/client-only data
  useEffect(() => setItems(q.data ?? []), [q.data]);
  const visible = items.map((m, i) => ({ m, i })).filter(({ m }) => m.kind === kind);
  return (
    <Card className={styles.card}>
      <Subtitle2>Field mappings</Subtitle2>
      <Field label="Board">
        <Dropdown value={boardLabel(board)} selectedOptions={[board]} onOptionSelect={(_, d) => setBoard(d.optionValue ?? "naukri")}>
          {BOARD_KEYS.filter((k) => k !== "job_feed").map((k) => (
            <Option key={k} value={k}>
              {boardLabel(k)}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <TabList selectedValue={kind} onTabSelect={(_, d) => setKind(String(d.value))}>
        {KINDS.map((k) => (
          <Tab key={k.value} value={k.value}>
            {k.label}
          </Tab>
        ))}
      </TabList>
      {visible.map(({ m, i }) => (
        <div key={i} className={styles.row}>
          <Field label="Talent OS value">
            <Input
              value={m.local_value}
              onChange={(_, d) => setItems(items.map((x, j) => (j === i ? { ...x, local_value: d.value } : x)))}
            />
          </Field>
          <Field label="Board value">
            <Input
              value={m.board_value}
              onChange={(_, d) => setItems(items.map((x, j) => (j === i ? { ...x, board_value: d.value } : x)))}
            />
          </Field>
          <Button onClick={() => setItems(items.filter((_, j) => j !== i))}>Remove</Button>
        </div>
      ))}
      <div className={styles.row}>
        <Button onClick={() => setItems([...items, { kind, local_value: "", board_value: "" }])}>Add mapping</Button>
        <Button
          appearance="primary"
          onClick={async () => {
            try {
              setItems(await jobBoardsApi.saveMappings(board, items.filter((x) => x.local_value && x.board_value)));
              toast.success("Saved");
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
        >
          Save
        </Button>
      </div>
    </Card>
  );
}

function FeedCard() {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["job-boards", "feed"], queryFn: jobBoardsApi.feed });
  const feed = q.data;
  const save = async (body: Parameters<typeof jobBoardsApi.saveFeed>[0]) => {
    try {
      qc.setQueryData(["job-boards", "feed"], await jobBoardsApi.saveFeed(body));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  if (!feed) return null;
  return (
    <Card className={styles.card}>
      <Subtitle2>XML feed</Subtitle2>
      <Switch label="Publish an XML job feed" checked={feed.enabled} onChange={(_, d) => save({ enabled: d.checked })} />
      <div className={styles.row}>
        <Field label="Feed URL">
          <Input readOnly value={feed.feed_url} />
        </Field>
        <Button onClick={() => void navigator.clipboard?.writeText(feed.feed_url)}>Copy</Button>
        <Button
          onClick={async () => {
            if (!window.confirm(REGENERATE_CONFIRM)) return;
            qc.setQueryData(["job-boards", "feed"], await jobBoardsApi.regenerateFeed());
          }}
        >
          Regenerate URL
        </Button>
      </div>
      <Switch
        label="Include salary when the job shows it"
        checked={feed.include_salary}
        onChange={(_, d) => save({ include_salary: d.checked })}
      />
      <Field label="Company name">
        <RadioGroup
          value={feed.company_name_mode}
          onChange={(_, d) => save({ company_name_mode: d.value as "tenant" | "client" })}
        >
          <Radio value="tenant" label="Your organisation" />
          <Radio value="client" label="The client, when the job shows it" />
        </RadioGroup>
      </Field>
    </Card>
  );
}

/** `/settings/job-boards` (Epic 70): reminders, digest, auto-close, default boards, field mappings and the XML feed. */
export function JobBoardsSettingsPage() {
  const styles = useStyles();
  return (
    <div className={styles.root}>
      <Title2>Job boards</Title2>
      <Text>Default boards, field mappings, expiry reminders and the XML feed.</Text>
      <MessageBar intent="info">
        <MessageBarBody>Connect Naukri, LinkedIn and Indeed from Integrations; each board uses your own account.</MessageBarBody>
      </MessageBar>
      <GeneralCard />
      <DefaultBoardsCard />
      <MappingsCard />
      <FeedCard />
    </div>
  );
}
