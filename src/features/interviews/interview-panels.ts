/**
 * Interview drawer panel registry (Phase 4). Phase 4 domains add panels to the Interview drawer here instead of
 * editing `interview-drawer.tsx`: the Scheduling Agent (Epic 59) registers "Scheduling history"; the Interview
 * Assistant (Epic 60) may register its capture panel. Registered panels render under the participants.
 */
import type { ComponentType } from "react";

export type InterviewPanelProps = { interviewId: string; applicationId: string; status: string };

export type InterviewPanel = {
  key: string;
  /** Shown only when the user holds this permission (any of them, for an array). */
  permission?: string | readonly string[];
  /** Sort position (lower first). */
  order?: number;
  component: ComponentType<InterviewPanelProps>;
};

const registry = new Map<string, InterviewPanel>();

/** Register (or replace) an Interview panel. Call from a module imported by `interview-drawer.tsx`. */
export function registerInterviewPanel(panel: InterviewPanel): void {
  registry.set(panel.key, panel);
}

/** Registered panels the user may see, in `order`. */
export function interviewPanels(has: (permission: string) => boolean): InterviewPanel[] {
  return [...registry.values()]
    .filter((p) => {
      if (!p.permission) return true;
      const perms = typeof p.permission === "string" ? [p.permission] : p.permission;
      return perms.some(has);
    })
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}
