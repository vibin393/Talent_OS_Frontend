"use client";

import { makeStyles, Subtitle2, tokens } from "@fluentui/react-components";
import { matchSectionsOf, sectionHeader } from "./logic";

const useStyles = makeStyles({
  sections: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, marginBottom: tokens.spacingVerticalL },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
});

/**
 * Matching "sections" (Epic 41: e.g. "Internal (3)") rendered above the regular ranked list, ordered by `order`.
 * Renders nothing when the response carries no sections.
 */
export function MatchSections<T extends { id: string }>({
  data,
  renderItem,
}: {
  /** The match list response; its optional `sections` are read defensively. */
  data: unknown;
  renderItem: (item: T, index: number) => React.ReactNode;
}) {
  const styles = useStyles();
  const sections = matchSectionsOf<T>(data);
  if (sections.length === 0) return null;
  return (
    <div className={styles.sections}>
      {sections.map((s) => (
        <section key={s.key} className={styles.section} aria-labelledby={`match-section-${s.key}`}>
          <Subtitle2 as="h2" id={`match-section-${s.key}`}>
            {sectionHeader(s)}
          </Subtitle2>
          {s.items.map((m, i) => (
            <div key={m.id}>{renderItem(m, i)}</div>
          ))}
        </section>
      ))}
    </div>
  );
}
