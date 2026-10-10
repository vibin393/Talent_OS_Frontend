/** Pure helpers for the sequence step editor (Epic 39). Step positions are 1-based. */
import type { BadgeProps } from "@fluentui/react-components";
import { CHANNEL_LABELS } from "@/features/campaigns/logic";
import type { BranchOn, SequenceStatus, StepDraft, StepIn, StepKind, StepOut } from "./types";

export const MAX_STEPS = 20;
export const WAIT_MIN_DAYS = 1;
export const WAIT_MAX_DAYS = 90;

export const STEP_KIND_LABELS: Record<StepKind, string> = {
  send: "Send",
  wait: "Wait",
  branch: "Branch",
  task: "Task",
  add_to_pool: "Add to pool",
};

export const BRANCH_ON_LABELS: Record<BranchOn, string> = {
  opened: "Opened",
  clicked: "Clicked",
  replied: "Replied",
  applied: "Applied",
};

export const SEQUENCE_STATUS_LABELS: Record<SequenceStatus, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};
export const SEQUENCE_STATUS_COLORS: Record<SequenceStatus, NonNullable<BadgeProps["color"]>> = {
  draft: "subtle",
  active: "success",
  paused: "warning",
  archived: "informative",
};

export const ENROLLMENT_STATUS_COLORS: Record<string, NonNullable<BadgeProps["color"]>> = {
  active: "brand",
  paused: "warning",
  completed: "success",
  exited: "subtle",
};

export const EXIT_REASON_LABELS: Record<string, string> = {
  replied: "Replied",
  applied: "Applied",
  hired: "Hired",
  unsubscribed: "Unsubscribed",
  manual: "Removed by a user",
  consent_withdrawn: "Consent withdrawn",
  erased: "Erased",
  completed: "Completed",
};

export const REFUSAL_LABELS: Record<string, string> = {
  already_enrolled: "Already enrolled",
  re_enrol_gap: "Enrolled too recently",
  no_marketing_consent: "No marketing consent",
  not_found: "Not found",
};

export function labelFor(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "—";
  return map[key] ?? key.replace(/_/g, " ");
}

export function defaultStep(kind: StepKind): StepDraft {
  switch (kind) {
    case "send":
      return { kind, config: { channel: "email", subject: "", body_html: "", channel_template_id: null, job_links: [] } };
    case "wait":
      return { kind, config: { days: 3 } };
    case "branch":
      return { kind, config: { on: "opened", within_days: 3, then_position: null, else_position: null } };
    case "task":
      return { kind, config: { title: "", assignee: "owner", due_days: 2 } };
    case "add_to_pool":
      return { kind, config: { talent_pool_id: null } };
  }
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function optNum(v: unknown): number | null {
  return v === null || v === undefined || v === "" ? null : num(v, 0);
}

/** Server steps (any order) to editor drafts, ordered by position. */
export function stepsFromServer(steps: StepOut[]): StepDraft[] {
  return [...steps]
    .sort((a, b) => a.position - b.position)
    .map((s): StepDraft => {
      const c = s.config ?? {};
      switch (s.kind) {
        case "send":
          return {
            kind: "send",
            config: {
              channel: (["email", "sms", "whatsapp"].includes(str(c.channel)) ? c.channel : "email") as "email",
              subject: str(c.subject),
              body_html: str(c.body_html),
              channel_template_id: (c.channel_template_id as string | null | undefined) ?? null,
              job_links: Array.isArray(c.job_links) ? (c.job_links as { posting_id: string; label?: string | null }[]) : [],
            },
          };
        case "wait":
          return { kind: "wait", config: { days: num(c.days, 1) } };
        case "branch":
          return {
            kind: "branch",
            config: {
              on: (str(c.on, "opened") as BranchOn) || "opened",
              within_days: num(c.within_days, 3),
              then_position: optNum(c.then_position),
              else_position: optNum(c.else_position),
            },
          };
        case "task":
          return { kind: "task", config: { title: str(c.title), assignee: str(c.assignee, "owner") || "owner", due_days: num(c.due_days, 1) } };
        case "add_to_pool":
        default:
          return { kind: "add_to_pool", config: { talent_pool_id: (c.talent_pool_id as string | null | undefined) ?? null } };
      }
    });
}

export function stepsToPayload(steps: StepDraft[]): StepIn[] {
  return steps.map((s) => {
    if (s.kind === "send") {
      const c = s.config;
      return {
        kind: "send",
        config:
          c.channel === "email"
            ? { channel: "email", subject: (c.subject ?? "").trim(), body_html: c.body_html ?? "", job_links: c.job_links ?? [] }
            : { channel: c.channel, channel_template_id: c.channel_template_id ?? null },
      };
    }
    if (s.kind === "task") return { kind: "task", config: { ...s.config, title: s.config.title.trim() } };
    return { kind: s.kind, config: { ...s.config } as Record<string, unknown> };
  });
}

/** Re-point branch targets after a reorder; `map[oldPos] = newPos` (1-based). Unknown targets become null. */
function remapTargets(steps: StepDraft[], map: Map<number, number>): StepDraft[] {
  return steps.map((s) => {
    if (s.kind !== "branch") return s;
    const t = s.config.then_position;
    const e = s.config.else_position;
    return {
      ...s,
      config: {
        ...s.config,
        then_position: t === null ? null : (map.get(t) ?? null),
        else_position: e === null ? null : (map.get(e) ?? null),
      },
    };
  });
}

/** Move the step at `from` (0-based index) to `to` (0-based), keeping branch targets on the same steps. */
export function moveStep(steps: StepDraft[], from: number, to: number): StepDraft[] {
  if (from === to || from < 0 || to < 0 || from >= steps.length || to >= steps.length) return steps;
  const order = steps.map((_, i) => i);
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  const map = new Map<number, number>();
  order.forEach((oldIndex, newIndex) => map.set(oldIndex + 1, newIndex + 1));
  return remapTargets(
    order.map((i) => steps[i]),
    map,
  );
}

/** Remove the step at `index` (0-based); branch targets pointing at it are cleared, later ones shift up. */
export function removeStep(steps: StepDraft[], index: number): StepDraft[] {
  if (index < 0 || index >= steps.length) return steps;
  const map = new Map<number, number>();
  steps.forEach((_, i) => {
    if (i < index) map.set(i + 1, i + 1);
    else if (i > index) map.set(i + 1, i);
  });
  return remapTargets(
    steps.filter((_, i) => i !== index),
    map,
  );
}

/** Append a step unless the sequence is full. */
export function addStep(steps: StepDraft[], kind: StepKind): StepDraft[] {
  return steps.length >= MAX_STEPS ? steps : [...steps, defaultStep(kind)];
}

/**
 * Validate a step list. Returns `{ form, steps }`: form-level errors and errors per 0-based step index.
 * Rules: at most 20 steps, wait days 1..90, branch targets must exist and be after the branch (no backward
 * or self branches), sends need content, tasks a title, add-to-pool a pool.
 */
export function validateSteps(steps: StepDraft[]): { form: string[]; steps: Record<number, string[]> } {
  const form: string[] = [];
  const out: Record<number, string[]> = {};
  const add = (i: number, msg: string) => (out[i] ??= []).push(msg);
  if (steps.length > MAX_STEPS) form.push(`A sequence can have at most ${MAX_STEPS} steps.`);
  const n = steps.length;
  steps.forEach((s, i) => {
    const pos = i + 1;
    switch (s.kind) {
      case "wait": {
        const d = s.config.days;
        if (!Number.isInteger(d) || d < WAIT_MIN_DAYS || d > WAIT_MAX_DAYS) add(i, `Wait ${WAIT_MIN_DAYS} to ${WAIT_MAX_DAYS} days.`);
        break;
      }
      case "branch": {
        const { then_position: t, else_position: e, within_days: w } = s.config;
        if (!Number.isInteger(w) || w < 1 || w > WAIT_MAX_DAYS) add(i, `Check within 1 to ${WAIT_MAX_DAYS} days.`);
        for (const [label, target] of [
          ["Then", t],
          ["Else", e],
        ] as const) {
          if (target === null) add(i, `Choose the "${label}" step.`);
          else if (target <= pos) add(i, `"${label}" must go to a later step.`);
          else if (target > n) add(i, `"${label}" points to a step that does not exist.`);
        }
        break;
      }
      case "send": {
        const c = s.config;
        if (c.channel === "email") {
          if (!(c.subject ?? "").trim()) add(i, "Enter a subject.");
          if (!(c.body_html ?? "").trim()) add(i, "Enter the email body.");
        } else if (!c.channel_template_id) add(i, "Choose a registered template.");
        break;
      }
      case "task":
        if (!s.config.title.trim()) add(i, "Enter a task title.");
        if (!Number.isInteger(s.config.due_days) || s.config.due_days < 0 || s.config.due_days > WAIT_MAX_DAYS) {
          add(i, `Due in 0 to ${WAIT_MAX_DAYS} days.`);
        }
        break;
      case "add_to_pool":
        if (!s.config.talent_pool_id) add(i, "Choose a talent pool.");
        break;
    }
  });
  return { form, steps: out };
}

export function hasErrors(v: ReturnType<typeof validateSteps>): boolean {
  return v.form.length > 0 || Object.keys(v.steps).length > 0;
}

/** One-line summary of a step for lists and analytics. */
export function stepSummary(s: StepDraft): string {
  switch (s.kind) {
    case "send":
      return s.config.channel === "email"
        ? `Send email${s.config.subject ? `: ${s.config.subject}` : ""}`
        : `Send ${CHANNEL_LABELS[s.config.channel]} template`;
    case "wait":
      return `Wait ${s.config.days} day${s.config.days === 1 ? "" : "s"}`;
    case "branch":
      return `If ${BRANCH_ON_LABELS[s.config.on].toLowerCase()} within ${s.config.within_days} days, go to step ${s.config.then_position ?? "?"}, else step ${s.config.else_position ?? "?"}`;
    case "task":
      return `Task: ${s.config.title || "Untitled"}`;
    case "add_to_pool":
      return "Add to talent pool";
  }
}

/** Positions a branch at `pos` may target (strictly after it). */
export function branchTargets(pos: number, count: number): number[] {
  const out: number[] = [];
  for (let p = pos + 1; p <= count; p++) out.push(p);
  return out;
}
