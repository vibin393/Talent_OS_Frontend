"use client";

import { makeStyles, Subtitle2, tokens } from "@fluentui/react-components";
import { ErrorCircle20Filled } from "@fluentui/react-icons";
import { useEffect, useRef } from "react";

const useStyles = makeStyles({
  root: {
    border: `${tokens.strokeWidthThick} solid ${tokens.colorPaletteRedBorder2}`,
    backgroundColor: tokens.colorPaletteRedBackground1,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalL,
    ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}`, outlineOffset: "2px" },
  },
  title: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, color: tokens.colorNeutralForeground1 },
  icon: { color: tokens.colorPaletteRedForeground1, flexShrink: 0 },
  list: { margin: `${tokens.spacingVerticalS} 0 0`, paddingLeft: tokens.spacingHorizontalXL },
  link: {
    color: tokens.colorNeutralForeground1,
    textDecorationLine: "underline",
    display: "inline-block",
    minHeight: "32px",
    paddingBlock: tokens.spacingVerticalXXS,
  },
});

/** Focus the control behind `id` (or its first focusable descendant, e.g. inside a RadioGroup). */
export function focusField(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  const focusable = el.matches("input, select, textarea, button, [tabindex]")
    ? el
    : el.querySelector<HTMLElement>("input:not([disabled]), select, textarea, button, [tabindex]");
  (focusable ?? el).focus();
  (focusable ?? el).scrollIntoView?.({ block: "center" });
}

export type SummaryError = { id: string; message: string };

/**
 * Error summary (GOV.UK pattern): shown above a form after a failed submit, takes focus, and links each
 * message to its field. Nothing is conveyed by colour alone (icon + heading + text).
 */
export function ErrorSummary({ errors, focusKey }: { errors: readonly SummaryError[]; focusKey: number }) {
  const styles = useStyles();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (errors.length) ref.current?.focus();
    // focusKey changes on every failed submit so repeated failures re-focus the summary
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);
  if (!errors.length) return null;
  return (
    <div ref={ref} tabIndex={-1} role="alert" aria-labelledby="error-summary-title" className={styles.root}>
      <Subtitle2 as="h2" id="error-summary-title" className={styles.title}>
        <ErrorCircle20Filled aria-hidden className={styles.icon} />
        There {errors.length === 1 ? "is a problem" : `are ${errors.length} problems`}
      </Subtitle2>
      <ul className={styles.list}>
        {errors.map((e) => (
          <li key={`${e.id}:${e.message}`}>
            <a
              href={`#${e.id}`}
              className={styles.link}
              onClick={(ev) => {
                ev.preventDefault();
                focusField(e.id);
              }}
            >
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
