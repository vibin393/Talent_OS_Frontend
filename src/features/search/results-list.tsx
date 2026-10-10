"use client";

import {
  Avatar,
  Badge,
  Body1,
  Caption1,
  Card,
  CardHeader,
  makeStyles,
  Skeleton,
  SkeletonItem,
  Subtitle2,
  Tag,
  Text,
  tokens,
} from "@fluentui/react-components";
import { PersonSearch24Regular } from "@fluentui/react-icons";
import { AppLink } from "@/components/app-link";
import type { CandidateHit, SnippetSegment } from "@/lib/api/types";
import { normalizeSnippet } from "./snippet";

const useStyles = makeStyles({
  list: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, listStyleType: "none", margin: 0, padding: 0 },
  card: { display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", columnGap: tokens.spacingHorizontalM, alignItems: "start" },
  main: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, minWidth: 0 },
  titleRow: { display: "flex", alignItems: "baseline", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  name: { fontWeight: tokens.fontWeightSemibold, fontSize: tokens.fontSizeBase400 },
  muted: { color: tokens.colorNeutralForeground3 },
  meta: { color: tokens.colorNeutralForeground2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  chips: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS, marginTop: tokens.spacingVerticalXXS },
  snippet: { color: tokens.colorNeutralForeground2, marginTop: tokens.spacingVerticalXXS, overflowWrap: "anywhere" },
  hl: {
    backgroundColor: tokens.colorPaletteYellowBackground2,
    color: tokens.colorNeutralForeground1,
    fontWeight: tokens.fontWeightSemibold,
    borderRadius: tokens.borderRadiusSmall,
    paddingInline: "1px",
  },
});

/** Highlighted snippet from API segments, rendered as React text (never as HTML). */
export function Snippet({ segments }: { segments: readonly SnippetSegment[] | null | undefined }) {
  const styles = useStyles();
  const parts = normalizeSnippet(segments);
  if (parts.length === 0) return null;
  return (
    <Caption1 className={styles.snippet}>
      {parts.map((p, i) =>
        p.hl ? (
          <mark key={i} className={styles.hl}>
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </Caption1>
  );
}

function experienceText(years: number | null | undefined): string | null {
  if (years === null || years === undefined) return null;
  return `${Number.isInteger(years) ? years : years.toFixed(1)} yrs`;
}

function noticeText(days: number | null | undefined): string | null {
  if (days === null || days === undefined) return null;
  return days === 0 ? "Immediate" : `${days}d notice`;
}

function ResultRow({ hit }: { hit: CandidateHit }) {
  const styles = useStyles();
  const meta = [hit.current_title, hit.current_employer, hit.city].filter(Boolean).join(" · ");
  const exp = experienceText(hit.experience_years);
  const notice = noticeText(hit.notice_days);
  const skills = (hit.skills ?? []).slice(0, 6);
  return (
    <li>
      <Card size="small" className={styles.card}>
        <Avatar name={hit.display_name} color="colorful" size={40} aria-hidden />
        <div className={styles.main}>
          <div className={styles.titleRow}>
            <AppLink href={`/candidates/${hit.id}`} className={styles.name}>
              {hit.display_name}
            </AppLink>
            <Caption1 className={styles.muted}>{hit.human_id}</Caption1>
          </div>
          {meta && <Body1 className={styles.meta}>{meta}</Body1>}
          {(exp || notice || skills.length > 0) && (
            <div className={styles.chips}>
              {exp && (
                <Badge appearance="tint" color="informative">
                  {exp}
                </Badge>
              )}
              {notice && (
                <Badge appearance="tint" color={hit.notice_days === 0 ? "success" : "subtle"}>
                  {notice}
                </Badge>
              )}
              {skills.map((s) => (
                <Tag
                  key={s.id}
                  size="extra-small"
                  appearance={s.matched ? "brand" : "outline"}
                  aria-label={s.matched ? `${s.name} (matched)` : s.name}
                >
                  {s.name}
                </Tag>
              ))}
            </div>
          )}
          <Snippet segments={hit.snippet} />
        </div>
      </Card>
    </li>
  );
}

export function ResultsList({ items }: { items: readonly CandidateHit[] }) {
  const styles = useStyles();
  return (
    <ul className={styles.list} aria-label="Search results">
      {items.map((hit) => (
        <ResultRow key={hit.id} hit={hit} />
      ))}
    </ul>
  );
}

export function ResultsSkeleton({ rows = 5 }: { rows?: number }) {
  const styles = useStyles();
  return (
    <div className={styles.list} aria-busy="true" aria-label="Loading results">
      {Array.from({ length: rows }, (_, i) => (
        <Card key={i} size="small">
          <Skeleton aria-hidden style={{ display: "grid", gridTemplateColumns: "40px 1fr", gap: 12 }}>
            <SkeletonItem shape="circle" size={40} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <SkeletonItem size={16} style={{ width: "40%" }} />
              <SkeletonItem size={12} style={{ width: "70%" }} />
              <SkeletonItem size={12} style={{ width: "55%" }} />
            </div>
          </Skeleton>
        </Card>
      ))}
    </div>
  );
}

export function EmptyResults({ title, description }: { title: string; description: string }) {
  return (
    <Card style={{ maxWidth: 560 }}>
      <CardHeader
        image={<PersonSearch24Regular aria-hidden />}
        header={<Subtitle2 as="h2">{title}</Subtitle2>}
        description={<Text>{description}</Text>}
      />
    </Card>
  );
}
