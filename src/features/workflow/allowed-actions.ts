/**
 * Epic 48: a trigger may restrict the actions a rule can use (`allowed_actions` on the registry trigger,
 * e.g. `analytics.prediction_band_changed` -> ["notify", "create_task"]). `null` / absent means no
 * restriction. The server enforces it too (422 `action_not_allowed_for_trigger`).
 */

/** The trigger's `allowed_actions`, or null when it does not restrict actions. */
export function triggerAllowedActions(trigger: object | null | undefined): readonly string[] | null {
  if (!trigger || !("allowed_actions" in trigger)) return null;
  const allowed = (trigger as { allowed_actions?: unknown }).allowed_actions;
  return Array.isArray(allowed) ? allowed.filter((a): a is string => typeof a === "string") : null;
}

/** Action types the palette may offer for `trigger`. */
export function actionsForTrigger<T extends { type: string }>(types: readonly T[], trigger: object | null | undefined): T[] {
  const allowed = triggerAllowedActions(trigger);
  return allowed === null ? [...types] : types.filter((t) => allowed.includes(t.type));
}
