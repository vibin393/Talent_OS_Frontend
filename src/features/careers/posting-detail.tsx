"use client";

import { Button, Card, Link as FluentLink, makeStyles, Subtitle2, Tag, TagGroup, Text, Title1, tokens } from "@fluentui/react-components";
import { ArrowLeft20Regular } from "@fluentui/react-icons";
import type { PublicPosting } from "@/lib/api/types";
import { applyPath, careersPath } from "./format";
import { postingMeta } from "./postings-view";
import { PublicNoticeBlock } from "@/features/fairness/public-notice-block";
import { useAttributedHref } from "@/features/campaigns/use-attribution";

const useStyles = makeStyles({
  back: { display: "inline-flex", alignItems: "center", gap: tokens.spacingHorizontalXS, minHeight: "44px" },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 280px",
    gap: tokens.spacingHorizontalXXL,
    alignItems: "start",
    "@media (max-width: 800px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
  header: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, marginBottom: tokens.spacingVerticalL },
  meta: {
    display: "flex",
    flexWrap: "wrap",
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalXS,
    margin: 0,
    padding: 0,
    listStyleType: "none",
    color: tokens.colorNeutralForeground2,
  },
  description: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
    padding: tokens.spacingHorizontalXL,
    lineHeight: tokens.lineHeightBase400,
    fontSize: tokens.fontSizeBase400,
    overflowWrap: "anywhere",
    "& a": { color: tokens.colorBrandForegroundLink },
    "& h1, & h2, & h3": { fontSize: tokens.fontSizeBase500, lineHeight: tokens.lineHeightBase500 },
    "@media (max-width: 480px)": { padding: tokens.spacingHorizontalL },
  },
  aside: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    position: "sticky",
    top: tokens.spacingVerticalL,
    "@media (max-width: 800px)": { position: "static" },
  },
  facts: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  dl: { margin: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, "& dt": { color: tokens.colorNeutralForeground3 }, "& dd": { margin: 0 } },
  applyDesktop: { minHeight: "44px", width: "100%", "@media (max-width: 800px)": { display: "none" } },
  applyBar: {
    display: "none",
    "@media (max-width: 800px)": {
      display: "block",
      position: "sticky",
      bottom: 0,
      zIndex: 10,
      marginTop: tokens.spacingVerticalL,
      marginLeft: `calc(-1 * ${tokens.spacingHorizontalL})`,
      marginRight: `calc(-1 * ${tokens.spacingHorizontalL})`,
      padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
      backgroundColor: tokens.colorNeutralBackground1,
      boxShadow: tokens.shadow8,
    },
  },
  applyMobile: { minHeight: "48px", width: "100%" },
});

function experienceText(min?: number | null, max?: number | null): string | null {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)} years`;
  if (min != null) return `${fmt(min)}+ years`;
  if (max != null) return `Up to ${fmt(max)} years`;
  return null;
}

function payText(p: PublicPosting["pay_range"]): string | null {
  if (!p || (!p.min && !p.max)) return null;
  const range = p.min && p.max ? `${p.min} – ${p.max}` : (p.min ?? `up to ${p.max}`);
  return [p.currency, range, p.unit ? `per ${p.unit}` : null].filter(Boolean).join(" ");
}

/** Job detail page body with a sticky "Apply" action (sidebar on wide screens, bottom bar on phones). */
export function PostingDetail({ slug, posting }: { slug: string; posting: PublicPosting }) {
  const styles = useStyles();
  const exp = experienceText(posting.experience.min, posting.experience.max);
  const pay = payText(posting.pay_range);
  // Epic 39: keep the campaign attribution token (`?tos_ct`) on the way to the apply page.
  const apply = useAttributedHref(applyPath(slug, posting.id));
  return (
    <article>
      <FluentLink as="a" href={careersPath(slug)} className={styles.back}>
        <ArrowLeft20Regular aria-hidden /> All jobs
      </FluentLink>
      <div className={styles.header}>
        <Title1 as="h1">{posting.title}</Title1>
        <ul className={styles.meta}>
          {postingMeta(posting).map((m) => (
            <li key={m}>
              <Text>{m}</Text>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.layout}>
        <div>
          {/* description_html is the published JD version, sanitized by the API. */}
          <div className={styles.description} dangerouslySetInnerHTML={{ __html: posting.description_html }} />
          <PublicNoticeBlock slug={slug} postingId={posting.id} />
          <div className={styles.applyBar}>
            <Button as="a" href={apply} appearance="primary" size="large" className={styles.applyMobile}>
              Apply for this job
            </Button>
          </div>
        </div>
        <aside className={styles.aside} aria-label="Job summary">
          <Button as="a" href={apply} appearance="primary" size="large" className={styles.applyDesktop}>
            Apply for this job
          </Button>
          {(exp || pay || posting.skills.length > 0) && (
            <Card className={styles.facts}>
              <dl className={styles.dl}>
                {exp && (
                  <>
                    <dt>Experience</dt>
                    <dd>{exp}</dd>
                  </>
                )}
                {pay && (
                  <>
                    <dt>Pay</dt>
                    <dd>{pay}</dd>
                  </>
                )}
              </dl>
              {posting.skills.length > 0 && (
                <>
                  <Subtitle2 as="h2">Skills</Subtitle2>
                  <TagGroup aria-label="Skills">
                    {posting.skills.map((s) => (
                      <Tag key={s} size="small" appearance="brand">
                        {s}
                      </Tag>
                    ))}
                  </TagGroup>
                </>
              )}
            </Card>
          )}
        </aside>
      </div>
    </article>
  );
}
