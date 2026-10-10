"use client";

import { Badge, makeStyles, MessageBar, MessageBarBody, MessageBarTitle, tokens, Tooltip } from "@fluentui/react-components";
import { PageHeader } from "@/components/app-shell/page-header";
import { PortalPageHeader, usePortalStyles } from "@/features/portal/ui";
import { type EmployeeMobilityApi, meMobilityApi, workMobilityApi } from "../api";
import { eligibilityReasonLines, eligibilityTitle, fitBadgeText, statusColor, statusLabel } from "../logic";

/** Where an Employee surface lives: the internal app (`/internal-jobs`) or the Worker portal. */
export type Surface = {
  variant: "app" | "portal";
  client: EmployeeMobilityApi;
  /** Board route; the detail route is `${base}/${demandId}`. */
  base: string;
  applicationsHref: string;
};

export const APP_SURFACE: Surface = {
  variant: "app",
  client: meMobilityApi,
  base: "/internal-jobs",
  applicationsHref: "/internal-jobs/my-applications",
};

export const WORK_SURFACE: Surface = {
  variant: "portal",
  client: workMobilityApi,
  base: "/portal/work/opportunities",
  applicationsHref: "/portal/work/opportunities/applications",
};

export const useMobilityStyles = makeStyles({
  page: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, minWidth: 0 },
  headerRow: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: tokens.spacingHorizontalM },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  badges: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS, alignItems: "center" },
  muted: { color: tokens.colorNeutralForeground3 },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  tall: { minHeight: "44px", minWidth: "44px" },
  list: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  reasons: { margin: 0, paddingInlineStart: tokens.spacingHorizontalL },
});

export function SurfaceHeader({ surface, title, subtitle }: { surface: Surface; title: string; subtitle?: React.ReactNode }) {
  return surface.variant === "app" ? <PageHeader title={title} subtitle={subtitle} /> : <PortalPageHeader title={title} subtitle={subtitle} />;
}

/** The page container class for a surface. */
export function usePageClass(surface: Surface): string {
  const styles = useMobilityStyles();
  const portal = usePortalStyles();
  return surface.variant === "portal" ? portal.page : styles.page;
}

export function FitBadge({ fitPct, reasons }: { fitPct: number | null; reasons?: string[] }) {
  const text = fitBadgeText(fitPct);
  const badge = (
    <Badge appearance="tint" color={fitPct == null ? "subtle" : fitPct >= 70 ? "success" : fitPct >= 40 ? "warning" : "informative"} tabIndex={reasons?.length ? 0 : undefined}>
      {text}
    </Badge>
  );
  if (!reasons?.length) return badge;
  return (
    <Tooltip relationship="description" content={reasons.join(" · ")}>
      {badge}
    </Tooltip>
  );
}

export function MobilityStatusBadge({ status, prefix }: { status: string; prefix?: string }) {
  return (
    <Badge appearance="tint" color={statusColor(status)}>
      {prefix ? `${prefix}: ${statusLabel(status)}` : statusLabel(status)}
    </Badge>
  );
}

/** Eligibility `MessageBar` listing the reasons; renders nothing when eligible. */
export function EligibilityBar({ eligible, reasons }: { eligible: boolean; reasons: string[] }) {
  const styles = useMobilityStyles();
  const lines = eligibilityReasonLines(eligible, reasons);
  if (lines.length === 0) return null;
  return (
    <MessageBar intent="warning" layout="multiline">
      <MessageBarBody>
        <MessageBarTitle>{eligibilityTitle(false)}</MessageBarTitle>
        <ul className={styles.reasons}>
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </MessageBarBody>
    </MessageBar>
  );
}
