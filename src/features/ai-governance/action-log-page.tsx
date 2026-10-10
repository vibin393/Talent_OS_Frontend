"use client";

import { AiLog } from "@/features/ai-admin/ai-log";
import { ConsoleShell } from "./console-shell";

/** `/admin/ai/log` inside the AI governance console (the P1 action log, extended with agent steps). */
export function ActionLogPage({ initialSearch = "" }: { initialSearch?: string }) {
  return (
    <ConsoleShell permission="ai_log:read" anyOf={["ai:govern"]}>
      <AiLog embedded initialSearch={initialSearch} />
    </ConsoleShell>
  );
}
