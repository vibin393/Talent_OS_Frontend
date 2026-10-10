"use client";

import {
  Badge,
  Body1,
  Caption1,
  Card,
  CardHeader,
  Link,
  makeStyles,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Fragment } from "react";
import { AppLink } from "@/components/app-link";
import { formatDateTime, useAdminStyles } from "@/features/admin/ui";
import type { Candidate360Out } from "@/lib/api/types";
import {
  EMPTY,
  formatCompensation,
  formatDate,
  formatExperience,
  formatLocation,
  HIDDEN,
  SOURCE_LABELS,
} from "./format";

const useStyles = makeStyles({
  grid: {
    display: "grid",
    gap: tokens.spacingHorizontalL,
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    alignItems: "start",
  },
  wide: { gridColumn: "1 / -1" },
  entries: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  entry: {
    paddingBottom: tokens.spacingVerticalS,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
  },
  muted: { color: tokens.colorNeutralForeground3 },
  hidden: { color: tokens.colorNeutralForeground3, fontStyle: "italic" },
  description: { whiteSpace: "pre-wrap", marginTop: tokens.spacingVerticalXS },
});

function Details({ rows }: { rows: [string, React.ReactNode][] }) {
  const styles = useAdminStyles();
  return (
    <dl className={styles.detailList}>
      {rows.map(([k, v]) => (
        <Fragment key={k}>
          <dt>{k}</dt>
          <dd>{v === null || v === undefined || v === "" ? EMPTY : v}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

function linkHref(urlNorm: string): string {
  return /^https?:\/\//i.test(urlNorm) ? urlNorm : `https://${urlNorm}`;
}

/** Profile tab: details, contact, compensation (masked -> "Hidden"), employment/education/cert cards. */
export function ProfileTab({ c }: { c: Candidate360Out }) {
  const styles = useStyles();
  const comp = (kind: "current" | "expected") => {
    const text = formatCompensation(c, kind);
    return text === HIDDEN ? (
      <span className={styles.hidden} title="You do not have permission to view compensation">
        {HIDDEN}
      </span>
    ) : (
      text
    );
  };
  const yesNo = (v: boolean | null) => (v === null ? EMPTY : v ? "Yes" : "No");

  return (
    <div className={styles.grid}>
      <Card>
        <CardHeader header={<Subtitle2 as="h2">Details</Subtitle2>} />
        <Details
          rows={[
            ["Title", c.current_title],
            ["Employer", c.current_employer],
            ["Experience", formatExperience(c.total_experience_months)],
            ["Location", formatLocation(c.location)],
            ["Source", `${SOURCE_LABELS[c.source]}${c.source_detail ? ` (${c.source_detail})` : ""}`],
            ["Owner", c.owner_name],
            ["Created", formatDateTime(c.created_at)],
            ["Updated", formatDateTime(c.updated_at)],
          ]}
        />
      </Card>

      <Card>
        <CardHeader header={<Subtitle2 as="h2">Contact</Subtitle2>} />
        <Details
          rows={[
            [
              "Email",
              c.emails.length ? (
                <div className={styles.entries} style={{ gap: 2 }}>
                  {c.emails.map((e) => (
                    <span key={e.id}>
                      <Link href={`mailto:${e.email}`}>{e.email}</Link>
                      {e.is_primary && c.emails.length > 1 && (
                        <Badge size="small" appearance="tint" style={{ marginLeft: 6 }}>
                          primary
                        </Badge>
                      )}
                    </span>
                  ))}
                </div>
              ) : null,
            ],
            [
              "Phone",
              c.phones.length ? (
                <div className={styles.entries} style={{ gap: 2 }}>
                  {c.phones.map((p) => (
                    <span key={p.id}>
                      <Link href={`tel:${p.phone_e164}`}>{p.phone_e164}</Link>
                      {p.is_primary && c.phones.length > 1 && (
                        <Badge size="small" appearance="tint" style={{ marginLeft: 6 }}>
                          primary
                        </Badge>
                      )}
                    </span>
                  ))}
                </div>
              ) : null,
            ],
            [
              "Links",
              c.links.length ? (
                <div className={styles.entries} style={{ gap: 2 }}>
                  {c.links.map((l) => (
                    <span key={l.id}>
                      <Link href={linkHref(l.url_norm)} target="_blank" rel="noopener noreferrer">
                        {l.url_norm}
                      </Link>{" "}
                      <Caption1 className={styles.muted}>{l.kind}</Caption1>
                    </span>
                  ))}
                </div>
              ) : null,
            ],
          ]}
        />
      </Card>

      <Card>
        <CardHeader header={<Subtitle2 as="h2">Compensation and availability</Subtitle2>} />
        <Details
          rows={[
            ["Current", comp("current")],
            ["Expected", comp("expected")],
            ["Notice period", c.notice_period_days === null ? null : `${c.notice_period_days} days`],
            ["Available from", formatDate(c.availability_date)],
            ["Last working day", formatDate(c.last_working_date)],
            ["Work authorization", c.work_authorization],
            ["Willing to relocate", yesNo(c.willing_to_relocate)],
            [
              "Preferred locations",
              c.preferred_locations?.length ? c.preferred_locations.map((l) => formatLocation(l)).join("; ") : null,
            ],
            [
              "Saved lists",
              c.lists.length ? (
                <span>
                  {c.lists.map((l, i) => (
                    <Fragment key={l.id}>
                      {i > 0 && ", "}
                      <AppLink href={`/candidates/lists/${l.id}`}>{l.name}</AppLink>
                    </Fragment>
                  ))}
                </span>
              ) : null,
            ],
          ]}
        />
      </Card>

      <Card className={styles.wide}>
        <CardHeader header={<Subtitle2 as="h2">Employment</Subtitle2>} />
        {c.employment.length === 0 ? (
          <Body1 className={styles.muted}>No employment history.</Body1>
        ) : (
          <div className={styles.entries}>
            {c.employment.map((e) => (
              <div key={e.id} className={styles.entry}>
                <Text weight="semibold">
                  {e.title ?? "Role"}
                  {e.employer ? ` @ ${e.employer}` : ""}
                  {e.is_current && (
                    <Badge size="small" appearance="tint" color="success" style={{ marginLeft: 6 }}>
                      current
                    </Badge>
                  )}
                </Text>
                <Caption1 className={styles.muted}>
                  {[formatDate(e.start_date), e.is_current ? "present" : formatDate(e.end_date)].join(" – ")}
                  {e.location ? ` · ${e.location}` : ""}
                </Caption1>
                {e.description && <Body1 className={styles.description}>{e.description}</Body1>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader header={<Subtitle2 as="h2">Education</Subtitle2>} />
        {c.education.length === 0 ? (
          <Body1 className={styles.muted}>No education recorded.</Body1>
        ) : (
          <div className={styles.entries}>
            {c.education.map((e) => (
              <div key={e.id} className={styles.entry}>
                <Text weight="semibold">{[e.degree, e.field].filter(Boolean).join(", ") || "Education"}</Text>
                <Caption1 className={styles.muted}>
                  {[e.institution, [e.start_year, e.end_year].filter(Boolean).join(" – "), e.grade]
                    .filter(Boolean)
                    .join(" · ")}
                </Caption1>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader header={<Subtitle2 as="h2">Certifications</Subtitle2>} />
        {c.certifications.length === 0 ? (
          <Body1 className={styles.muted}>No certifications recorded.</Body1>
        ) : (
          <div className={styles.entries}>
            {c.certifications.map((cert) => (
              <div key={cert.id} className={styles.entry}>
                <Text weight="semibold">{cert.name}</Text>
                <Caption1 className={styles.muted}>
                  {[
                    cert.issuer,
                    cert.issued_on ? `issued ${formatDate(cert.issued_on)}` : null,
                    cert.expires_on ? `expires ${formatDate(cert.expires_on)}` : null,
                    cert.credential_id,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Caption1>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
