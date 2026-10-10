/** Epic 35 B5: record audit timeline (`GET /api/v1/audit/timeline`). Hand-written API types. */

export type TimelineActorType =
  | "user"
  | "system"
  | "ai"
  | "workflow"
  | "client_user"
  | "vendor_user"
  | "candidate"
  | "api_key"
  | "support";

export type TimelineChange = { field: string; old: unknown; new: unknown; masked: boolean };

export type TimelineItem = {
  id: string;
  at: string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_type: TimelineActorType | string;
  actor_id: string | null;
  actor_display: string | null;
  summary: string;
  changes: TimelineChange[];
};

export type TimelinePage = { items: TimelineItem[]; next_cursor: string | null };
