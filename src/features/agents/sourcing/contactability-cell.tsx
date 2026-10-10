"use client";

import { makeStyles, tokens, Tooltip } from "@fluentui/react-components";
import { Chat16Regular, Mail16Regular, Phone16Regular } from "@fluentui/react-icons";
import type { ReactElement } from "react";
import { CHANNELS, contactTooltip } from "./logic";
import type { Channel, EntryOut } from "./types";

const useStyles = makeStyles({
  row: { display: "flex", gap: tokens.spacingHorizontalXS, alignItems: "center" },
  ok: { color: tokens.colorPaletteGreenForeground1 },
  no: { color: tokens.colorNeutralForegroundDisabled },
  best: { outline: `1px solid ${tokens.colorBrandStroke1}`, borderRadius: tokens.borderRadiusSmall },
});

const ICONS: Record<Channel, ReactElement> = {
  email: <Mail16Regular />,
  whatsapp: <Chat16Regular />,
  sms: <Phone16Regular />,
};

/** Per-channel contactability (Mail / Chat / Phone icons with a reason tooltip, e.g. "Suppressed: weekly limit reached"). */
export function ContactabilityCell({ entry }: { entry: Pick<EntryOut, "contactability" | "best_channel"> }) {
  const styles = useStyles();
  return (
    <span className={styles.row}>
      {CHANNELS.map((ch) => {
        const state = entry.contactability[ch];
        const label = contactTooltip(ch, state);
        const cls = `${state?.ok ? styles.ok : styles.no} ${entry.best_channel === ch ? styles.best : ""}`;
        return (
          <Tooltip key={ch} content={label} relationship="label">
            <span className={cls} role="img" aria-label={label} tabIndex={0}>
              {ICONS[ch]}
            </span>
          </Tooltip>
        );
      })}
    </span>
  );
}
