/**
 * Epic 56 Proposal renderers (plain text only): `outreach.send` (recipient, channel, subject, body; a banner line
 * "Not sent: {reason}" for a `suppressed:*` failure), `pipeline.add_candidate` and `sequences.enrol`.
 */
import type { ProposalOut } from "@/lib/api/agentic-types";
import { defaultRenderer, plainText, type ProposalRenderer, type RenderedProposal } from "@/features/agent-proposals/proposal-renderers";
import { reasonLabel } from "./logic";

type Renderable = Pick<ProposalOut, "title" | "preview" | "tool_key"> & Partial<Pick<ProposalOut, "status" | "error_code">>;

function field(proposal: Renderable, label: string): string {
  const pair = (proposal.preview?.fields ?? []).find((f) => Array.isArray(f) && f[0] === label);
  return pair ? plainText(pair[1], 500) : "";
}

/** Hide the internal ids (`demand_id`, `entry_id`) used for bulk grouping. */
function visibleRows(rendered: RenderedProposal): RenderedProposal {
  return { ...rendered, rows: rendered.rows.filter((r) => r.label !== "demand_id" && r.label !== "entry_id") };
}

export const outreachSendRenderer: ProposalRenderer = (proposal) => {
  const p = proposal as Renderable;
  const out = visibleRows(defaultRenderer(proposal));
  const rows = [
    { label: "Recipient", value: field(p, "Recipient") },
    { label: "Channel", value: field(p, "Channel") },
    { label: "Subject", value: field(p, "Subject") },
  ].filter((r) => r.value);
  const banner = p.error_code?.startsWith("suppressed:") ? `Not sent: ${reasonLabel(p.error_code)}\n\n` : "";
  return { title: out.title, summary: `${banner}${out.summary}`, rows };
};

export const pipelineAddRenderer: ProposalRenderer = (proposal) => visibleRows(defaultRenderer(proposal));
export const sequenceEnrolRenderer: ProposalRenderer = (proposal) => visibleRows(defaultRenderer(proposal));
