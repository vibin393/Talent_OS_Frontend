/**
 * Proposal renderer registry (Epic 53, spec Part B). Each tool key may register a renderer that turns a Proposal's
 * plain-text preview into display rows; the default renders `preview.fields`. Owner epics add one entry per tool key
 * (additive, build plan §4). Renderers return plain text only -- previews are never rendered as HTML.
 */
import type { ProposalOut } from "@/lib/api/agentic-types";

export interface ProposalRow {
  label: string;
  value: string;
}

export interface RenderedProposal {
  title: string;
  summary: string;
  rows: ProposalRow[];
}

export type ProposalRenderer = (proposal: Pick<ProposalOut, "title" | "preview" | "tool_key">) => RenderedProposal;

const MAX_SUMMARY = 4000;

/** Strip control characters and cap the length; the UI renders the result as text. */
export function plainText(value: unknown, max = MAX_SUMMARY): string {
  const text = typeof value === "string" ? value : value == null ? "" : String(value);
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, max);
}

export const defaultRenderer: ProposalRenderer = (proposal) => ({
  title: plainText(proposal.preview?.title || proposal.title, 200),
  summary: plainText(proposal.preview?.summary),
  rows: (proposal.preview?.fields ?? [])
    .filter((pair): pair is [string, string] => Array.isArray(pair) && pair.length === 2)
    .map(([label, value]) => ({ label: plainText(label, 80), value: plainText(value, 500) })),
});

const renderers: Record<string, ProposalRenderer> = {};

/** Register the renderer of a tool key (one owner per key; a second registration throws). */
export function registerProposalRenderer(toolKey: string, renderer: ProposalRenderer): void {
  if (renderers[toolKey]) throw new Error(`duplicate proposal renderer for ${toolKey}`);
  renderers[toolKey] = renderer;
}

export function rendererFor(toolKey: string, rendererKey?: string | null): ProposalRenderer {
  return (rendererKey && renderers[rendererKey]) || renderers[toolKey] || defaultRenderer;
}

export function renderProposal(proposal: Pick<ProposalOut, "title" | "preview" | "tool_key">): RenderedProposal {
  return rendererFor(proposal.tool_key, proposal.preview?.renderer)(proposal);
}

// ---------------------------------------------------------------- Epic 57: Screening Agent (one entry per tool key)
/** Default rows with a plain-language title when the preview has none. */
const titled =
  (fallback: string): ProposalRenderer =>
  (proposal) => {
    const base = defaultRenderer(proposal);
    return { ...base, title: base.title || fallback };
  };

const SCREENING_PROPOSAL_TITLES: Record<string, string> = {
  "screening.invite": "Send the screening invitation",
  "screening.ask": "Ask screening questions",
  "screening.clarify": "Ask a clarifying question",
  "screening.reply_grounded": "Answer the candidate's question about the job",
  "screening.extract_answers": "Record the candidate's answers",
  "screening.save_summary": "Save the screening summary",
  "screening.reminder": "Send a screening reminder",
  "screening.handoff": "Hand the conversation to you",
  "screening.propose_candidate_updates": "Update the candidate profile from screening answers",
};
for (const [toolKey, title] of Object.entries(SCREENING_PROPOSAL_TITLES)) registerProposalRenderer(toolKey, titled(title));

// Epic 54 (Copilot Draft Actions): plain-text rows for the Copilot's drafts.
function relabel(base: RenderedProposal, labels: Record<string, string>): ProposalRow[] {
  return base.rows.map((r) => ({ label: labels[r.label] ?? r.label, value: r.value }));
}

registerProposalRenderer("messaging.send", (proposal) => {
  const base = defaultRenderer(proposal);
  const subject = /^Send [a-z]+: (.*)$/i.exec(base.title)?.[1] ?? "";
  const rows = relabel(base, { Recipient: "To" });
  if (subject && subject !== "message") rows.push({ label: "Subject", value: plainText(subject, 200) });
  rows.push({ label: "Body", value: base.summary });
  return { title: base.title, summary: "", rows };
});
registerProposalRenderer("tasks.create", (proposal) => {
  const base = defaultRenderer(proposal);
  const title = base.title.replace(/^Create task:\s*/i, "");
  const rows: ProposalRow[] = [{ label: "Title", value: title }];
  for (const r of base.rows) {
    if (r.label === "Due in (hours)") rows.push({ label: "Due", value: `In ${r.value} hours` });
    if (r.label === "Entity") rows.push({ label: "Linked record", value: r.value });
  }
  rows.push({ label: "Assignee", value: "You" });
  return { title: base.title, summary: base.summary, rows };
});
registerProposalRenderer("copilot.propose_slots", titled("Propose interview slots"));
registerProposalRenderer("copilot.prepare_pack", titled("Prepare a submission pack"));

// ---------------------------------------------------------------- Epic 59: Scheduling Agent (one entry per tool key)
const SCHEDULING_LABELS: Record<string, string> = {
  request_id: "Scheduling request",
  offer_id: "Offer",
  candidate_id: "Candidate",
  channel: "Channel",
  pick_id: "Candidate pick",
  window: "Suggested time",
  accept_conflicts: "Book despite conflicts",
  interview_id: "Interview",
  reason: "Reason",
  add_user_ids: "Add interviewers",
  remove_user_ids: "Remove interviewers",
  note_to_recruiter: "Note",
};
const scheduling =
  (fallback: string, extra?: (base: RenderedProposal) => ProposalRow[]): ProposalRenderer =>
  (proposal) => {
    const base = defaultRenderer(proposal);
    const rows = relabel(base, SCHEDULING_LABELS).map((r) =>
      r.label === "Book despite conflicts" ? { label: r.label, value: r.value === "true" ? "Yes - conflicts were found at re-check" : "No" } : r,
    );
    return { title: base.title || fallback, summary: base.summary, rows: [...rows, ...(extra ? extra(base) : [])] };
  };
registerProposalRenderer("scheduling.propose", scheduling("Compute interview slots"));
registerProposalRenderer("scheduling.offer_slots", scheduling("Offer interview times"));
registerProposalRenderer("scheduling.offer_partial", scheduling("Offer partial interview options"));
registerProposalRenderer("interviews.book", scheduling("Book the interview"));
registerProposalRenderer("interviews.reschedule", scheduling("Reschedule the interview"));
registerProposalRenderer("interviews.cancel", scheduling("Cancel the interview"));
registerProposalRenderer("interviews.change_participants", scheduling("Change the interviewers"));
registerProposalRenderer("reminders.send", scheduling("Send an interview reminder"));

// ---------------------------------------------------------------- Epic 61: Submission Agent (one entry per tool key)
registerProposalRenderer("submissions.prepare_pack", (proposal) => {
  const base = defaultRenderer(proposal);
  return { title: base.title || "Prepare a submission pack", summary: base.summary, rows: base.rows.filter((r) => r.label !== "application_id") };
});
registerProposalRenderer("submissions.save_write_up", (proposal) => {
  const base = defaultRenderer(proposal);
  // the write-up itself is the preview summary: show it as its own row (plain text)
  return { title: base.title || "Save the submission write-up", summary: "", rows: [...base.rows, { label: "Write-up", value: base.summary }] };
});
registerProposalRenderer("submissions.request_consent", (proposal) => {
  const base = defaultRenderer(proposal);
  return { title: base.title || "Send a consent request", summary: base.summary, rows: base.rows };
});

// ---------------------------------------------------------------- Epic 60: Interview Assistant (one entry per tool key)
registerProposalRenderer("interview_capture.save_summary", titled("Save the interview summary"));
registerProposalRenderer("interview_capture.transcribe", titled("Transcribe the interview recording"));
registerProposalRenderer("scorecards.create_draft", titled("Prepare a private draft scorecard"));
registerProposalRenderer("skills.suggest_evidence", titled("Suggest skills from the interview"));

// ---------------------------------------------------------------- Epic 62: Compliance, BGV & Onboarding Agents
registerProposalRenderer("compliance.send_chase_reminder", titled("Send a document reminder"));
registerProposalRenderer("compliance.escalate_chase", titled("Escalate to the onboarding coordinator"));
registerProposalRenderer("bgv.request_provider_status", titled("Request the BGV provider status"));
registerProposalRenderer("bgv.send_provider_follow_up", titled("Send a status request to the BGV provider"));
registerProposalRenderer("bgv.draft_provider_message", (proposal) => {
  const base = defaultRenderer(proposal);
  // the message body is the preview summary: show it as its own row (plain text, never HTML)
  return { title: base.title || "Email the BGV provider", summary: "", rows: [...base.rows, { label: "Message", value: base.summary }] };
});
registerProposalRenderer("bgv.request_candidate_documents", titled("Request documents from the candidate"));
registerProposalRenderer("bgv.post_case_summary", titled("Post a BGV pending summary"));
registerProposalRenderer("onboarding.reply_grounded", titled("Answer an onboarding question"));
registerProposalRenderer("onboarding.hand_off", titled("Hand the question to the coordinator"));

// ---------------------------------------------------------------- Epic 63: Timesheet, Billing & Collections Agents
registerProposalRenderer("billing.prepare_run_draft", (proposal) => {
  const base = defaultRenderer(proposal);
  // per-client totals and exceptions are the summary lines (plain text); the drafts note is the first line
  return { title: base.title || "Start draft run", summary: base.summary, rows: base.rows };
});
const collectionsMessage =
  (fallback: string): ProposalRenderer =>
  (proposal) => {
    const base = defaultRenderer(proposal);
    // the full text / invoices table is the preview summary: shown as its own row (plain text, never HTML)
    return { title: base.title || fallback, summary: "", rows: [...base.rows, { label: "Message", value: base.summary }] };
  };
registerProposalRenderer("receivables.send_pre_due_reminder", collectionsMessage("Send a courteous reminder"));
registerProposalRenderer("receivables.send_reminder", collectionsMessage("Send a payment reminder"));
registerProposalRenderer("receivables.send_dunning_message", collectionsMessage("Send a collections message"));
registerProposalRenderer("receivables.send_statement", titled("Send the statement of account"));
registerProposalRenderer("receivables.log_collection_note", titled("Log a collections note"));
registerProposalRenderer("time.send_timesheet_reminder", titled("Send timesheet reminders"));
registerProposalRenderer("time.save_flag_explanations", titled("Save flag explanations"));
registerProposalRenderer("time.escalate_approval", titled("Escalate a pending timesheet approval"));
registerProposalRenderer("billing.flag_exception", titled("Note a billing exception"));
