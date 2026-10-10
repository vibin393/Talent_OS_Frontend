/** Epic 62 Knowledge Sources / Onboarding Q&A DTOs (hand-written mirror of `app/schemas/knowledge.py`). */

export type SourceKind = "article" | "file" | "onboarding_template" | "policy_document";
export type Audience = "worker" | "candidate" | "both" | "internal";
export type SourceStatus = "draft" | "published" | "unpublished" | "archived";
export type Topic = "pay" | "tax" | "legal" | "immigration" | "documents" | "policy" | "it" | "other";

export interface SourceOut {
  id: string;
  title: string;
  kind: SourceKind;
  audience: Audience;
  status: SourceStatus;
  current_version_no: number;
  published_version_no: number | null;
  ref_kind: string | null;
  ref_id: string | null;
  legal_entity_id: string | null;
  client_id: string | null;
  owner_id: string | null;
  tags: string[];
  last_reviewed_on: string | null;
  created_at: string;
  updated_at: string;
}

export interface VersionOut {
  id: string;
  version_no: number;
  body_md: string | null;
  file_id: string | null;
  extract_status: "pending" | "ok" | "failed" | "unsupported";
  extracted_chars: number;
  chunk_count: number;
  published: boolean;
  created_by: string | null;
  created_at: string;
}

export interface SourceDetailOut extends SourceOut {
  current_body_md: string | null;
  versions: VersionOut[];
}

export interface SourceCreate {
  title: string;
  kind?: "article" | "policy_document";
  audience: Audience;
  body_md?: string | null;
}

export interface SearchHitOut {
  source_id: string;
  source_version: number;
  title: string;
  excerpt: string;
  citation: string;
  score: number;
}

export interface GapRow {
  question: string;
  topic: Topic | null;
  times_asked: number;
  outcome: "handed_off" | "ungrounded" | "incorrect";
  last_asked: string;
  thread_ids: string[];
}

export interface QaCitation {
  citation: string;
  title: string;
  kind: "knowledge" | "task" | "case";
}

export interface QaMessageOut {
  id: string;
  seq: number;
  role: "asker" | "assistant" | "coordinator" | "system";
  text: string;
  citations: QaCitation[];
  outcome: string | null;
  topic: Topic | null;
  feedback: string | null;
  agent_run_id: string | null;
  author_user_id: string | null;
  created_at: string;
}

export interface QaThreadOut {
  id: string;
  candidate_id: string;
  candidate_name: string;
  audience: "worker" | "candidate";
  status: "open" | "answered" | "handed_off" | "closed";
  coordinator_user_id: string | null;
  coordinator_name: string | null;
  placement_id: string | null;
  task_id: string | null;
  last_message_at: string | null;
  created_at: string;
  last_question: string | null;
  messages: QaMessageOut[];
}
