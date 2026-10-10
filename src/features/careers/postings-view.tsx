"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  Field,
  Input,
  makeStyles,
  Select,
  Subtitle1,
  Text,
  Title1,
  tokens,
} from "@fluentui/react-components";
import { Search20Regular } from "@fluentui/react-icons";
import Image from "next/image";
import NextLink from "next/link";
import type { PublicBranding, PublicPostingPage } from "@/lib/api/types";
import {
  careersPath,
  EMPLOYMENT_TYPE_LABELS,
  employmentTypeLabel,
  formatPostedDate,
  jobPath,
  searchHref,
  WORK_MODE_LABELS,
  workModeLabel,
} from "./format";

const useStyles = makeStyles({
  hero: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalXL,
  },
  heroImage: {
    width: "100%",
    height: "auto",
    maxHeight: "280px",
    objectFit: "cover",
    borderRadius: tokens.borderRadiusLarge,
  },
  about: {
    maxWidth: "72ch",
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase400,
    fontSize: tokens.fontSizeBase400,
    overflowWrap: "anywhere",
    "& a": { color: tokens.colorBrandForegroundLink },
  },
  search: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: tokens.spacingHorizontalM,
    alignItems: "end",
    padding: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalL,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
  },
  control: { minHeight: "44px" },
  submit: { minHeight: "44px" },
  list: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  card: { padding: tokens.spacingHorizontalL },
  titleLink: {
    color: tokens.colorBrandForegroundLink,
    textDecorationLine: "none",
    overflowWrap: "anywhere",
    ":hover": { textDecorationLine: "underline" },
    ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}`, outlineOffset: "2px" },
  },
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
  summary: { marginBottom: tokens.spacingVerticalM, color: tokens.colorNeutralForeground2 },
  empty: {
    padding: tokens.spacingHorizontalXXL,
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    alignItems: "center",
  },
  pager: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalL,
    flexWrap: "wrap",
  },
  pagerLink: { minHeight: "44px" },
});

export type SearchFilters = { q: string; location: string; work_mode: string; employment_type: string; page: number };

export function postingMeta(p: {
  location?: string | null;
  country?: string | null;
  work_mode?: string | null;
  employment_type?: string | null;
  client_name?: string | null;
  published_at?: string | null;
}): string[] {
  const place = [p.location, p.country].filter(Boolean).join(", ");
  const posted = formatPostedDate(p.published_at);
  return [
    p.client_name ? `Client: ${p.client_name}` : null,
    place || null,
    workModeLabel(p.work_mode),
    employmentTypeLabel(p.employment_type),
    posted ? `Posted ${posted}` : null,
  ].filter((x): x is string => !!x);
}

/** Career site home: hero, GET search form (works without JS), result cards and link pagination. */
export function PostingsView({
  branding,
  page,
  filters,
}: {
  branding: PublicBranding;
  page: PublicPostingPage;
  filters: SearchFilters;
}) {
  const styles = useStyles();
  const slug = branding.slug;
  const pageCount = Math.max(1, Math.ceil(page.total / page.page_size));
  const filtered = !!(filters.q || filters.location || filters.work_mode || filters.employment_type);
  const hrefFor = (n: number) => searchHref(slug, { ...filters, page: n });

  return (
    <>
      <section className={styles.hero} aria-labelledby="careers-title">
        {branding.header_url && (
          <Image
            src={branding.header_url}
            alt=""
            width={1080}
            height={280}
            sizes="(max-width: 1080px) 100vw, 1080px"
            className={styles.heroImage}
            unoptimized
            priority
          />
        )}
        <Title1 as="h1" id="careers-title">
          Careers at {branding.display_name}
        </Title1>
        {branding.about_html && (
          // about_html is rendered from Markdown and sanitized (nh3) by the API.
          <div className={styles.about} dangerouslySetInnerHTML={{ __html: branding.about_html }} />
        )}
      </section>

      <form method="get" action={careersPath(slug)} role="search" aria-label="Search jobs" className={styles.search}>
        <Field label="Keyword">
          <Input name="q" defaultValue={filters.q} type="search" className={styles.control} contentBefore={<Search20Regular aria-hidden />} maxLength={200} />
        </Field>
        <Field label="Location">
          <Input name="location" defaultValue={filters.location} className={styles.control} maxLength={100} />
        </Field>
        <Field label="Work mode">
          <Select name="work_mode" defaultValue={filters.work_mode} className={styles.control}>
            <option value="">Any</option>
            {Object.entries(WORK_MODE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Employment type">
          <Select name="employment_type" defaultValue={filters.employment_type} className={styles.control}>
            <option value="">Any</option>
            {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" appearance="primary" className={styles.submit}>
          Search jobs
        </Button>
      </form>

      <section aria-labelledby="results-title">
        <Subtitle1 as="h2" id="results-title" block>
          Open positions
        </Subtitle1>
        <Text as="p" className={styles.summary} aria-live="polite">
          {page.total === 0 ? "No open positions" : `${page.total} open position${page.total === 1 ? "" : "s"}`}
          {filtered ? " matching your search" : ""}
        </Text>
        {page.items.length === 0 ? (
          <Card className={styles.empty}>
            <Subtitle1 as="p">{filtered ? "No jobs match your search" : "There are no open positions right now"}</Subtitle1>
            <Body1>{filtered ? "Try different keywords or clear the filters." : "Please check back soon."}</Body1>
            {filtered && (
              <Button as="a" href={careersPath(slug)} className={styles.pagerLink}>
                Clear search
              </Button>
            )}
          </Card>
        ) : (
          <ul className={styles.list}>
            {page.items.map((p) => (
              <li key={p.id}>
                <Card className={styles.card}>
                  <Subtitle1 as="h3">
                    <NextLink href={jobPath(slug, p.id, p.slug)} className={styles.titleLink}>
                      {p.title}
                    </NextLink>
                  </Subtitle1>
                  <ul className={styles.meta}>
                    {postingMeta(p).map((m) => (
                      <li key={m}>
                        <Caption1>{m}</Caption1>
                      </li>
                    ))}
                  </ul>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {pageCount > 1 && (
          <nav aria-label="Pagination" className={styles.pager}>
            {page.page > 1 ? (
              <Button as="a" href={hrefFor(page.page - 1)} className={styles.pagerLink} rel="prev">
                Previous
              </Button>
            ) : (
              <span />
            )}
            <Text>
              Page {page.page} of {pageCount}
            </Text>
            {page.page < pageCount ? (
              <Button as="a" href={hrefFor(page.page + 1)} className={styles.pagerLink} rel="next">
                Next
              </Button>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </>
  );
}
