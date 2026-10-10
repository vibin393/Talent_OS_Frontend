"use client";

/** Header toggle of the Copilot panel (Epic 54 B2): "Copilot", tooltip "Open Copilot (Alt+C)". Hidden without `copilot:use`. */
import { ToggleButton, Tooltip } from "@fluentui/react-components";
import { Sparkle20Regular } from "@fluentui/react-icons";
import { hasPermission } from "@/features/auth/permissions";
import { useMe } from "@/features/auth/use-me";
import { toggleCopilot, useCopilotState } from "./copilot-context";
import { COPILOT_TOGGLE_ID, COPY } from "./copy";

export function CopilotToggle({ buttonClassName, iconClassName }: { buttonClassName?: string; iconClassName?: string }) {
  const me = useMe();
  const { open } = useCopilotState();
  if (!hasPermission(me.data?.permissions, "copilot:use")) return null;
  return (
    <Tooltip content={COPY.toggleTooltip} relationship="description">
      <ToggleButton
        id={COPILOT_TOGGLE_ID}
        appearance="subtle"
        className={buttonClassName}
        icon={<Sparkle20Regular className={iconClassName} />}
        checked={open}
        aria-pressed={open}
        aria-keyshortcuts="Alt+C"
        onClick={() => toggleCopilot()}
      >
        {COPY.toggleLabel}
      </ToggleButton>
    </Tooltip>
  );
}
