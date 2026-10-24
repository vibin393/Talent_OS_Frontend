/** Pure helpers for Epic 40 (Assessments): labels, item/builder forms, timer sync, autosave queue, signal batching. */
import { hasPermission, type PermissionMap } from "@/features/auth/permissions";
import type {
  AnswerKey,
  AssessmentDetailOut,
  AssessmentSettingsIn,
  AssessmentStatus,
  ClientSignalKind,
  CodeLine,
  Choice,
  Delivery,
  DraftSection,
  InvitationOut,
  InvitationStatus,
  ItemCreate,
  ItemKind,
  ItemOut,
  KeywordWeight,
  RubricCriterion,
  SignalIn,
} from "./types";

type BadgeColor = "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning";

// ---------------------------------------------------------------- labels

export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  single: "Single choice",
  multi: "Multiple choice",
  true_false: "True / false",
  numeric: "Numeric",
  short_text: "Short text",
  code_output: "Code: predict output",
  code_fill: "Code: fill the blanks",
  code_order: "Code: order the lines",
  code_find_bug: "Code: find the bug",
  code_freeform: "Code: free-form",
  essay: "Essay",
};
export const ITEM_KINDS = Object.keys(ITEM_KIND_LABELS) as ItemKind[];

export const ASSESSMENT_STATUS_LABELS: Record<AssessmentStatus, string> = { draft: "Draft", published: "Published", archived: "Archived" };
export const ASSESSMENT_STATUS_COLORS: Record<AssessmentStatus, BadgeColor> = { draft: "warning", published: "success", archived: "subtle" };
export const DELIVERY_LABELS: Record<Delivery, string> = { builtin: "Built-in", provider: "Provider" };

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  invited: "Invited",
  started: "In progress",
  expired: "Expired",
  completed: "Completed",
  reviewed: "Reviewed",
  passed: "Passed",
  failed: "Failed",
  cancelled: "Cancelled",
};
export const INVITATION_STATUS_COLORS: Record<InvitationStatus, BadgeColor> = {
  invited: "informative",
  started: "brand",
  expired: "subtle",
  completed: "warning",
  reviewed: "important",
  passed: "success",
  failed: "danger",
  cancelled: "subtle",
};

export const SIGNAL_LABELS: Record<string, string> = {
  tab_switch: "Tab switches",
  focus_loss: "Window focus lost",
  copy: "Copy",
  paste: "Paste",
  fullscreen_exit: "Left full screen",
  concurrent_session: "Opened in another window",
  ip_change: "Network address changed",
};

export function signalLabel(kind: string): string {
  return SIGNAL_LABELS[kind] ?? kind.replace(/_/g, " ");
}

export const CODE_KINDS: ReadonlySet<ItemKind> = new Set(["code_output", "code_fill", "code_order", "code_find_bug", "code_freeform"]);
export const isCodeKind = (k: ItemKind) => CODE_KINDS.has(k);
export const CHOICE_KINDS: ReadonlySet<ItemKind> = new Set(["single", "multi", "true_false"]);
export const RUBRIC_KINDS: ReadonlySet<ItemKind> = new Set(["code_freeform", "essay"]);

// ---------------------------------------------------------------- numbers and dates

const DECIMAL = /^-?\d+(\.\d+)?$/;
export const isDecimal = (s: string) => DECIMAL.test(s.trim());

/** "72.50" -> "72.5%"; null -> "—". */
export function pctLabel(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? `${Math.round(n * 10) / 10}%` : "—";
}

/** A percentage string as a 0..1 ProgressBar value. */
export function pctValue(v: string | number | null | undefined): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n / 100));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

/** A picked calendar date as the end of that local day, in ISO (deadline semantics). */
export function endOfDayIso(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 0, 0);
  return x.toISOString();
}

/** Clamp and format an accommodation factor (1.00–3.00, step 0.25) as a decimal string. */
export function accommodationString(n: number): string {
  const clamped = Math.min(3, Math.max(1, Math.round(n * 4) / 4));
  return clamped.toFixed(2);
}

export function sumDecimals(values: readonly (string | null | undefined)[]): number {
  return values.reduce<number>((a, v) => a + (v && isDecimal(v) ? Number(v) : 0), 0);
}

// ---------------------------------------------------------------- permissions / visibility

/** ★ Pass/Fail (human-only): shown only to holders of `assessment:review` once the attempt is `reviewed`. */
export function canDecide(inv: Pick<InvitationOut, "status">, permissions: PermissionMap): boolean {
  return hasPermission(permissions, "assessment:review") && inv.status === "reviewed";
}

export function canExtend(inv: Pick<InvitationOut, "status">): boolean {
  return inv.status === "invited" || inv.status === "started" || inv.status === "expired";
}

export function canCancel(inv: Pick<InvitationOut, "status">): boolean {
  return inv.status === "invited" || inv.status === "started";
}

/** "Record result" applies to provider / manual deliveries that have no imported score yet. */
export function canRecordManual(inv: Pick<InvitationOut, "delivery" | "status" | "score">): boolean {
  return inv.delivery === "provider" && ["invited", "started", "expired", "completed"].includes(inv.status) && inv.score === null;
}

// ---------------------------------------------------------------- item editor form

export type ItemForm = {
  kind: ItemKind;
  stem: string;
  skillKeys: string[];
  tags: string[];
  difficulty: number;
  points: string;
  language: string;
  code: string;
  choices: Choice[];
  correct: string[];
  numericValue: string;
  tolAbs: string;
  tolPct: string;
  accepted: string[];
  normCase: boolean;
  normWhitespace: boolean;
  normPunctuation: boolean;
  keywords: KeywordWeight[];
  minKeywordScore: string;
  outTrailingWs: boolean;
  outBlankLines: boolean;
  outCase: boolean;
  regex: string;
  blanks: Record<string, { accepted: string[]; tokenWs: boolean }>;
  lines: CodeLine[];
  partial: "lcs" | "none";
  bugLines: number[];
  penaliseWrong: boolean;
  criteria: RubricCriterion[];
};

let seq = 0;
export function shortId(prefix = ""): string {
  seq += 1;
  return `${prefix}${Date.now().toString(36).slice(-4)}${seq.toString(36)}`;
}

/** Next unused single-letter choice id ("a", "b", ...; then "a1"...). */
export function nextChoiceId(existing: readonly { id: string }[]): string {
  const used = new Set(existing.map((c) => c.id));
  for (let round = 0; ; round++) {
    for (let i = 0; i < 26; i++) {
      const id = String.fromCodePoint(97 + i) + (round ? String(round) : "");
      if (!used.has(id)) return id;
    }
  }
}

export function emptyItemForm(kind: ItemKind = "single"): ItemForm {
  const choices: Choice[] =
    kind === "true_false"
      ? [
          { id: "a", text: "True" },
          { id: "b", text: "False" },
        ]
      : CHOICE_KINDS.has(kind)
        ? [
            { id: "a", text: "" },
            { id: "b", text: "" },
          ]
        : [];
  return {
    kind,
    stem: "",
    skillKeys: [],
    tags: [],
    difficulty: 3,
    points: "1",
    language: "",
    code: "",
    choices,
    correct: [],
    numericValue: "",
    tolAbs: "",
    tolPct: "",
    accepted: [""],
    normCase: true,
    normWhitespace: true,
    normPunctuation: false,
    keywords: [],
    minKeywordScore: "",
    outTrailingWs: true,
    outBlankLines: true,
    outCase: false,
    regex: "",
    blanks: {},
    lines: [],
    partial: "lcs",
    bugLines: [],
    penaliseWrong: false,
    criteria: RUBRIC_KINDS.has(kind) ? [{ key: "c1", label: "", max_points: "5", guidance: "" }] : [],
  };
}

/** Switch the kind, keeping the shared fields (stem, skills, tags, difficulty, points, code). */
export function changeKind(form: ItemForm, kind: ItemKind): ItemForm {
  const base = emptyItemForm(kind);
  return { ...base, stem: form.stem, skillKeys: form.skillKeys, tags: form.tags, difficulty: form.difficulty, points: form.points, code: form.code, language: form.language };
}

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export function itemFormFromItem(item: ItemOut): ItemForm {
  const v = item.version;
  const f = emptyItemForm(item.kind);
  const key = rec(v.answer_key);
  const norm = rec(key.normalise);
  const out: ItemForm = {
    ...f,
    stem: v.stem,
    skillKeys: [...item.skill_keys],
    tags: [...item.tags],
    difficulty: item.difficulty,
    points: v.points,
    language: v.language ?? "",
    code: v.code ?? "",
    choices: v.options?.choices ? v.options.choices.map((c) => ({ ...c })) : f.choices,
    lines: v.options?.lines ? v.options.lines.map((l) => ({ ...l })) : [],
    criteria: v.rubric?.criteria ? v.rubric.criteria.map((c) => ({ ...c })) : f.criteria,
  };
  switch (item.kind) {
    case "single":
    case "true_false":
      out.correct = typeof key.correct === "string" ? [key.correct] : [];
      break;
    case "multi":
      out.correct = strs(key.correct);
      break;
    case "numeric":
      out.numericValue = key.value != null ? String(key.value) : "";
      out.tolAbs = key.tolerance_abs != null ? String(key.tolerance_abs) : "";
      out.tolPct = key.tolerance_pct != null ? String(key.tolerance_pct) : "";
      break;
    case "short_text":
      out.accepted = strs(key.accepted).length ? strs(key.accepted) : [""];
      out.normCase = Boolean(norm.case);
      out.normWhitespace = Boolean(norm.whitespace);
      out.normPunctuation = Boolean(norm.punctuation);
      out.keywords = Array.isArray(key.keywords) ? (key.keywords as KeywordWeight[]).map((k) => ({ term: k.term, weight: String(k.weight) })) : [];
      out.minKeywordScore = key.min_keyword_score != null ? String(key.min_keyword_score) : "";
      break;
    case "code_output":
      out.accepted = strs(key.accepted).length ? strs(key.accepted) : [""];
      out.outTrailingWs = Boolean(norm.trailing_ws);
      out.outBlankLines = Boolean(norm.blank_lines);
      out.outCase = Boolean(norm.case);
      out.regex = typeof key.regex === "string" ? key.regex : "";
      break;
    case "code_fill": {
      const blanks = rec(key.blanks);
      out.blanks = Object.fromEntries(
        Object.entries(blanks).map(([n, b]) => [n, { accepted: strs(rec(b).accepted), tokenWs: Boolean(rec(rec(b).normalise).token_ws) }]),
      );
      break;
    }
    case "code_order": {
      const order = strs(key.order);
      if (order.length) {
        const byId = new Map(out.lines.map((l) => [l.id, l]));
        const ordered = order.map((id) => byId.get(id)).filter((l): l is CodeLine => Boolean(l));
        out.lines = [...ordered, ...out.lines.filter((l) => !order.includes(l.id))];
      }
      out.partial = key.partial === "none" ? "none" : "lcs";
      break;
    }
    case "code_find_bug":
      out.bugLines = Array.isArray(key.bug_lines) ? (key.bug_lines as unknown[]).map(Number).filter(Number.isFinite) : [];
      out.penaliseWrong = Boolean(key.penalise_wrong);
      break;
    default:
      break;
  }
  return out;
}

/** `{{blank:n}}` markers in code, unique and sorted. */
export function parseBlankMarkers(code: string): number[] {
  const found = new Set<number>();
  for (const m of code.matchAll(/\{\{\s*blank\s*:\s*(\d+)\s*\}\}/g)) found.add(Number(m[1]));
  return [...found].sort((a, b) => a - b);
}

/** Split code at blank markers: text segments interleaved with blank numbers. */
export function splitBlanks(code: string): (string | number)[] {
  const parts: (string | number)[] = [];
  let last = 0;
  for (const m of code.matchAll(/\{\{\s*blank\s*:\s*(\d+)\s*\}\}/g)) {
    parts.push(code.slice(last, m.index));
    parts.push(Number(m[1]));
    last = (m.index ?? 0) + m[0].length;
  }
  parts.push(code.slice(last));
  return parts;
}

export function codeLines(code: string | null | undefined): string[] {
  if (!code) return [];
  return code.replace(/\r\n/g, "\n").split("\n");
}

export function toggleIn<T>(list: readonly T[], v: T, on?: boolean): T[] {
  const has = list.includes(v);
  const want = on ?? !has;
  if (want && !has) return [...list, v];
  if (!want && has) return list.filter((x) => x !== v);
  return [...list];
}

export function moveInList<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return [...list];
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

export function itemFormErrors(f: ItemForm): string[] {
  const e: string[] = [];
  if (!f.stem.trim()) e.push("Write the question stem.");
  if (!isDecimal(f.points) || Number(f.points) <= 0) e.push("Points must be a positive number.");
  if (f.difficulty < 1 || f.difficulty > 5) e.push("Difficulty must be 1–5.");
  if (CHOICE_KINDS.has(f.kind)) {
    if (f.choices.length < 2) e.push("Add at least two options.");
    if (f.choices.some((c) => !c.text.trim())) e.push("Every option needs text.");
    if (f.kind === "multi" ? f.correct.length === 0 : f.correct.length !== 1) e.push("Mark the correct answer.");
  }
  if (f.kind === "numeric") {
    if (!isDecimal(f.numericValue)) e.push("Enter the correct numeric value.");
    if (f.tolAbs && !isDecimal(f.tolAbs)) e.push("Absolute tolerance must be a number.");
    if (f.tolPct && !isDecimal(f.tolPct)) e.push("Percentage tolerance must be a number.");
  }
  if (f.kind === "short_text" || f.kind === "code_output") {
    if (!f.accepted.some((a) => a.trim()) && !(f.kind === "code_output" && f.regex.trim()) && !(f.kind === "short_text" && f.keywords.length))
      e.push("Add at least one accepted answer.");
    if (f.kind === "short_text") {
      if (f.keywords.some((k) => !k.term.trim() || !isDecimal(k.weight))) e.push("Each keyword needs a term and a numeric weight.");
      if (f.minKeywordScore && !isDecimal(f.minKeywordScore)) e.push("Minimum keyword score must be a number.");
    }
  }
  if (["code_output", "code_fill", "code_find_bug"].includes(f.kind) && !f.code.trim()) e.push("Add the code snippet.");
  if (f.kind === "code_fill") {
    const markers = parseBlankMarkers(f.code);
    if (markers.length === 0) e.push("Mark at least one blank with {{blank:1}}.");
    for (const n of markers) if (!(f.blanks[String(n)]?.accepted ?? []).some((a) => a.trim())) e.push(`Blank ${n} needs an accepted answer.`);
  }
  if (f.kind === "code_order") {
    if (f.lines.length < 2) e.push("Add at least two lines.");
    if (f.lines.some((l) => !l.text.trim())) e.push("Every line needs text.");
  }
  if (f.kind === "code_find_bug" && f.bugLines.length === 0) e.push("Pick at least one bug line.");
  if (RUBRIC_KINDS.has(f.kind)) {
    if (f.criteria.length === 0) e.push("Add at least one rubric criterion.");
    if (f.criteria.some((c) => !c.key.trim() || !c.label.trim() || !isDecimal(c.max_points))) e.push("Each criterion needs a key, a label and max points.");
    if (new Set(f.criteria.map((c) => c.key.trim())).size !== f.criteria.length) e.push("Criterion keys must be unique.");
  }
  return e;
}

const clean = (list: readonly string[]) => list.map((s) => s.trim()).filter(Boolean);

export function toAnswerKey(f: ItemForm): AnswerKey | null {
  switch (f.kind) {
    case "single":
    case "true_false":
      return { correct: f.correct[0] ?? "" };
    case "multi":
      return { correct: f.choices.map((c) => c.id).filter((id) => f.correct.includes(id)) };
    case "numeric":
      return {
        value: f.numericValue.trim(),
        ...(f.tolAbs.trim() ? { tolerance_abs: f.tolAbs.trim() } : {}),
        ...(f.tolPct.trim() ? { tolerance_pct: f.tolPct.trim() } : {}),
      };
    case "short_text":
      return {
        accepted: clean(f.accepted),
        normalise: { case: f.normCase, whitespace: f.normWhitespace, punctuation: f.normPunctuation },
        ...(f.keywords.length ? { keywords: f.keywords.map((k) => ({ term: k.term.trim(), weight: k.weight.trim() })) } : {}),
        ...(f.minKeywordScore.trim() ? { min_keyword_score: f.minKeywordScore.trim() } : {}),
      };
    case "code_output":
      return {
        accepted: f.accepted.filter((a) => a.length > 0),
        normalise: { trailing_ws: f.outTrailingWs, blank_lines: f.outBlankLines, case: f.outCase },
        regex: f.regex.trim() || null,
      };
    case "code_fill":
      return {
        blanks: Object.fromEntries(
          parseBlankMarkers(f.code).map((n) => {
            const b = f.blanks[String(n)] ?? { accepted: [], tokenWs: true };
            return [String(n), { accepted: clean(b.accepted), normalise: { token_ws: b.tokenWs } }];
          }),
        ),
      };
    case "code_order":
      return { order: f.lines.map((l) => l.id), partial: f.partial };
    case "code_find_bug":
      return { bug_lines: [...f.bugLines].sort((a, b) => a - b), penalise_wrong: f.penaliseWrong };
    default:
      return null;
  }
}

/** The create body (PUT omits `kind`). Lines are sent in their correct order; the server shuffles on delivery. */
export function toItemBody(f: ItemForm): ItemCreate {
  const usesCode = isCodeKind(f.kind);
  return {
    kind: f.kind,
    skill_keys: f.skillKeys,
    tags: f.tags,
    difficulty: f.difficulty,
    stem: f.stem.trim(),
    language: usesCode ? f.language.trim() || null : null,
    code: usesCode && f.kind !== "code_order" ? f.code || null : null,
    options: CHOICE_KINDS.has(f.kind)
      ? { choices: f.choices.map((c) => ({ id: c.id, text: c.text.trim() })) }
      : f.kind === "code_order"
        ? { lines: f.lines.map((l) => ({ id: l.id, text: l.text })) }
        : {},
    points: f.points.trim(),
    answer_key: toAnswerKey(f),
    rubric: RUBRIC_KINDS.has(f.kind)
      ? { criteria: f.criteria.map((c) => ({ key: c.key.trim(), label: c.label.trim(), max_points: c.max_points.trim(), guidance: c.guidance.trim() })) }
      : null,
  };
}

export function parseList(s: string): string[] {
  return [...new Set(s.split(",").map((x) => x.trim()).filter(Boolean))];
}

// ---------------------------------------------------------------- builder

export type SectionForm = {
  uid: string;
  key: string;
  title: string;
  timeLimit: number | null;
  mode: "fixed" | "draw";
  items: { item_id: string; points: string }[];
  drawSkills: string[];
  drawTags: string[];
  difficulty: [number, number];
  count: number;
};

export function newSection(index: number): SectionForm {
  return { uid: shortId("s"), key: `s${index + 1}`, title: `Section ${index + 1}`, timeLimit: null, mode: "fixed", items: [], drawSkills: [], drawTags: [], difficulty: [1, 5], count: 5 };
}

export function sectionsFromDraft(draft: readonly DraftSection[] | null | undefined): SectionForm[] {
  return (draft ?? []).map((s) => ({
    uid: shortId("s"),
    key: s.key,
    title: s.title,
    timeLimit: s.time_limit_minutes ?? null,
    mode: s.draw ? "draw" : "fixed",
    items: (s.items ?? []).map((i) => ({ item_id: i.item_id, points: i.points ?? "" })),
    drawSkills: s.draw?.skill_keys ?? [],
    drawTags: s.draw?.tags ?? [],
    difficulty: s.draw?.difficulty ?? [1, 5],
    count: s.draw?.count ?? 5,
  }));
}

export function toDraft(sections: readonly SectionForm[]): DraftSection[] {
  return sections.map((s) => {
    const base = { key: s.key.trim(), title: s.title.trim(), time_limit_minutes: s.timeLimit };
    if (s.mode === "draw") {
      const lo = Math.min(s.difficulty[0], s.difficulty[1]);
      const hi = Math.max(s.difficulty[0], s.difficulty[1]);
      return { ...base, draw: { skill_keys: s.drawSkills, tags: s.drawTags, difficulty: [lo, hi] as [number, number], count: s.count } };
    }
    return { ...base, items: s.items.map((i) => ({ item_id: i.item_id, points: i.points.trim() || null })) };
  });
}

export function sectionErrors(sections: readonly SectionForm[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const keys = new Map<string, number>();
  for (const s of sections) keys.set(s.key.trim(), (keys.get(s.key.trim()) ?? 0) + 1);
  for (const s of sections) {
    if (!/^[a-z0-9_-]{1,40}$/i.test(s.key.trim())) errors[s.uid] = "Key: 1–40 letters, digits, - or _.";
    else if ((keys.get(s.key.trim()) ?? 0) > 1) errors[s.uid] = "Section keys must be unique.";
    else if (!s.title.trim()) errors[s.uid] = "Give the section a title.";
    else if (s.timeLimit !== null && (!Number.isInteger(s.timeLimit) || s.timeLimit < 1)) errors[s.uid] = "Time limit must be a whole number of minutes.";
    else if (s.mode === "fixed" && s.items.length === 0) errors[s.uid] = "Pick at least one item.";
    else if (s.mode === "fixed" && s.items.some((i) => i.points.trim() && !isDecimal(i.points))) errors[s.uid] = "Item points must be numbers.";
    else if (s.mode === "draw" && (!Number.isInteger(s.count) || s.count < 1)) errors[s.uid] = "Draw at least one item.";
  }
  return errors;
}

export type SettingsForm = {
  name: string;
  description: string;
  instructions: string;
  timeLimit: number | null;
  passMark: string;
  shuffleItems: boolean;
  shuffleOptions: boolean;
  attemptsLimit: number;
  gatingDefault: boolean;
  autoPass: string;
  delivery: Delivery;
  skillKeys: string[];
  providerConfigId: string | null;
  providerTestRef: string | null;
};

export function emptySettings(name = ""): SettingsForm {
  return {
    name,
    description: "",
    instructions: "",
    timeLimit: 60,
    passMark: "60",
    shuffleItems: true,
    shuffleOptions: true,
    attemptsLimit: 1,
    gatingDefault: false,
    autoPass: "",
    delivery: "builtin",
    skillKeys: [],
    providerConfigId: null,
    providerTestRef: null,
  };
}

export function settingsFromDetail(a: AssessmentDetailOut): SettingsForm {
  return {
    name: a.name,
    description: a.description ?? "",
    instructions: a.instructions ?? "",
    timeLimit: a.time_limit_minutes,
    passMark: a.pass_mark_pct ?? "",
    shuffleItems: a.shuffle_items,
    shuffleOptions: a.shuffle_options,
    attemptsLimit: a.attempts_limit,
    gatingDefault: a.gating_default,
    autoPass: a.auto_pass_threshold_pct ?? "",
    delivery: a.delivery,
    skillKeys: [...a.skill_keys],
    providerConfigId: a.provider_config_id,
    providerTestRef: a.provider_test_ref,
  };
}

export function toSettingsBody(s: SettingsForm): AssessmentSettingsIn {
  return {
    name: s.name.trim(),
    description: s.description.trim() || null,
    instructions: s.instructions.trim() || null,
    delivery: s.delivery,
    time_limit_minutes: s.timeLimit,
    pass_mark_pct: s.passMark.trim() || null,
    shuffle_items: s.shuffleItems,
    shuffle_options: s.shuffleOptions,
    attempts_limit: s.attemptsLimit,
    gating_default: s.gatingDefault,
    auto_pass_threshold_pct: s.autoPass.trim() || null,
    skill_keys: s.skillKeys,
    provider_config_id: s.delivery === "provider" ? s.providerConfigId : null,
    provider_test_ref: s.delivery === "provider" ? s.providerTestRef : null,
  };
}

export function settingsErrors(s: SettingsForm): string[] {
  const e: string[] = [];
  if (!s.name.trim()) e.push("Name the assessment.");
  const pct = (v: string, label: string) => {
    if (v.trim() && (!isDecimal(v) || Number(v) < 0 || Number(v) > 100)) e.push(`${label} must be 0–100.`);
  };
  pct(s.passMark, "Pass mark");
  pct(s.autoPass, "Auto-pass threshold");
  if (s.timeLimit !== null && (!Number.isInteger(s.timeLimit) || s.timeLimit < 1)) e.push("Time limit must be a whole number of minutes.");
  if (!Number.isInteger(s.attemptsLimit) || s.attemptsLimit < 1) e.push("Attempts limit must be at least 1.");
  if (s.delivery === "provider" && !s.providerTestRef) e.push("Pick the provider test.");
  return e;
}

// ---------------------------------------------------------------- review

export function rubricTotal(marks: Record<string, string>): number {
  return Math.round(sumDecimals(Object.values(marks)) * 100) / 100;
}

/** Readable text of a candidate response, for the review queue. */
export function responseText(kind: ItemKind, response: unknown): string {
  const r = rec(response);
  if (typeof r.text === "string") return r.text;
  if (typeof r.choice === "string") return r.choice;
  if (Array.isArray(r.choices)) return r.choices.join(", ");
  if (typeof r.value === "string" || typeof r.value === "number") return String(r.value);
  if (r.blanks && typeof r.blanks === "object")
    return Object.entries(rec(r.blanks))
      .map(([n, v]) => `Blank ${n}: ${String(v)}`)
      .join("\n");
  if (Array.isArray(r.order)) return r.order.join(" → ");
  if (Array.isArray(r.lines)) return `Lines ${r.lines.join(", ")}`;
  return response == null ? "(no answer)" : `${ITEM_KIND_LABELS[kind] ?? kind}: ${JSON.stringify(response)}`;
}

// ---------------------------------------------------------------- server-synced timer

export type ClockSync = { offsetMs: number; deadlineMs: number };

/** Offset between the server clock and this client's clock, plus the deadline (both from the same response). */
export function syncClock(serverNowIso: string, deadlineIso: string, clientNowMs: number): ClockSync {
  const server = Date.parse(serverNowIso);
  const deadline = Date.parse(deadlineIso);
  return { offsetMs: Number.isFinite(server) ? server - clientNowMs : 0, deadlineMs: Number.isFinite(deadline) ? deadline : clientNowMs };
}

/** Whole seconds left, judged on the server's clock (client clock skew cancels out). */
export function remainingSeconds(sync: ClockSync, clientNowMs: number): number {
  return Math.max(0, Math.floor((sync.deadlineMs - (clientNowMs + sync.offsetMs)) / 1000));
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export const WARNING_THRESHOLDS = [300, 60] as const;

/**
 * The time warning to announce now (aria-live polite), or null. Each threshold (5 min, 1 min) is announced once;
 * crossing both at once (e.g. a late resync) announces only the tighter one. Mutates `announced`.
 */
export function dueWarning(remaining: number, announced: Set<number>): string | null {
  const crossed = WARNING_THRESHOLDS.filter((t) => remaining <= t && remaining > 0 && !announced.has(t));
  if (crossed.length === 0) return null;
  for (const t of WARNING_THRESHOLDS) if (remaining <= t) announced.add(t);
  const mins = Math.max(1, Math.ceil(remaining / 60));
  return `${mins} ${mins === 1 ? "minute" : "minutes"} remaining`;
}

// ---------------------------------------------------------------- autosave queue

export type AutosaveBatch = { client_seq: number; answers: { position: number; response: unknown }[] };

/**
 * Client-side autosave queue. Changes coalesce per position (latest wins); one batch is in flight at a time;
 * every batch gets a strictly increasing `client_seq`; an acknowledgement older than the newest acknowledged batch
 * is stale and ignored; a failed batch is re-queued unless the position changed again meanwhile.
 */
export class AutosaveQueue {
  private seq: number;
  private pending = new Map<number, unknown>();
  private inflight: AutosaveBatch | null = null;
  private lastAcked = 0;

  constructor(startSeq = 0) {
    this.seq = startSeq;
  }

  set(position: number, response: unknown): void {
    this.pending.set(position, response);
  }

  get hasPending(): boolean {
    return this.pending.size > 0;
  }

  get busy(): boolean {
    return this.inflight !== null;
  }

  get lastSeq(): number {
    return this.seq;
  }

  /** Move pending changes into a new in-flight batch; null when nothing is pending or a batch is in flight. */
  take(): AutosaveBatch | null {
    if (this.inflight || this.pending.size === 0) return null;
    this.seq += 1;
    const answers = [...this.pending.entries()].sort((a, b) => a[0] - b[0]).map(([position, response]) => ({ position, response }));
    this.pending.clear();
    this.inflight = { client_seq: this.seq, answers };
    return this.inflight;
  }

  /** Record a successful save. Returns false (and changes nothing) for a stale acknowledgement. */
  ack(clientSeq: number): boolean {
    if (clientSeq <= this.lastAcked) return false;
    this.lastAcked = clientSeq;
    if (this.inflight && this.inflight.client_seq <= clientSeq) this.inflight = null;
    return true;
  }

  /** A batch failed: put its answers back (newer pending edits win) to be retried with a new seq. */
  fail(clientSeq: number): void {
    if (!this.inflight || this.inflight.client_seq !== clientSeq) return;
    for (const a of this.inflight.answers) if (!this.pending.has(a.position)) this.pending.set(a.position, a.response);
    this.inflight = null;
  }
}

// ---------------------------------------------------------------- proctoring signal batching

/**
 * Collects passive proctoring signals and hands them out in batches (sent every 10 s). Repeats of the same kind
 * within `dedupeMs` collapse (a blur and its focus storm), and the buffer is capped so a noisy page cannot grow it.
 */
export class SignalBatcher {
  private buffer: SignalIn[] = [];
  private lastAt = new Map<ClientSignalKind, number>();

  constructor(
    private readonly maxBatch = 50,
    private readonly dedupeMs = 500,
    private readonly maxBuffer = 500,
  ) {}

  push(kind: ClientSignalKind, atMs: number, detail?: Record<string, unknown> | null): boolean {
    const last = this.lastAt.get(kind);
    if (last !== undefined && atMs - last < this.dedupeMs) return false;
    this.lastAt.set(kind, atMs);
    if (this.buffer.length >= this.maxBuffer) return false;
    this.buffer.push({ kind, client_ts: new Date(atMs).toISOString(), ...(detail ? { detail } : {}) });
    return true;
  }

  get size(): number {
    return this.buffer.length;
  }

  drain(): SignalIn[] {
    return this.buffer.splice(0, this.maxBatch);
  }

  /** Put an unsent batch back at the front (network failure). */
  requeue(batch: readonly SignalIn[]): void {
    this.buffer = [...batch, ...this.buffer].slice(0, this.maxBuffer);
  }
}

// ---------------------------------------------------------------- delivery safety

/** Fields that must never reach the candidate client. */
export const FORBIDDEN_DELIVERY_KEYS = ["answer_key", "rubric", "accepted", "regex", "keywords", "bug_lines", "order", "item_id", "item_version_id"] as const;
export type ForbiddenDeliveryKey = (typeof FORBIDDEN_DELIVERY_KEYS)[number];

/** Every key path in `value` named like a forbidden field (deep). */
export function findForbiddenKeys(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => findForbiddenKeys(v, `${path}[${i}]`));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([k, v]) => {
    const p = path ? `${path}.${k}` : k;
    return [...((FORBIDDEN_DELIVERY_KEYS as readonly string[]).includes(k) ? [p] : []), ...findForbiddenKeys(v, p)];
  });
}

// ---------------------------------------------------------------- taking helpers

export function isAnswered(response: unknown): boolean {
  const r = rec(response);
  if (typeof r.choice === "string") return r.choice !== "";
  if (Array.isArray(r.choices)) return r.choices.length > 0;
  if (typeof r.value === "string") return r.value.trim() !== "";
  if (typeof r.text === "string") return r.text.trim() !== "";
  if (r.blanks && typeof r.blanks === "object") return Object.values(rec(r.blanks)).some((v) => String(v).trim() !== "");
  if (Array.isArray(r.order)) return r.order.length > 0;
  if (Array.isArray(r.lines)) return r.lines.length > 0;
  return false;
}

/** Map the taking API's error codes to candidate-facing terminal states. */
export function takingErrorState(code: string | undefined): "time_up" | "replaced" | "submitted" | "section_closed" | null {
  if (code === "attempt_deadline_passed") return "time_up";
  if (code === "attempt_session_replaced") return "replaced";
  if (code === "attempt_already_submitted") return "submitted";
  if (code === "section_closed") return "section_closed";
  return null;
}
