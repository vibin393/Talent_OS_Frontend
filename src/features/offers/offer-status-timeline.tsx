"use client";

import { Body1, Caption1, Link, makeStyles, Text, tokens } from "@fluentui/react-components";
import {
  CheckmarkCircle20Filled,
  Clock20Regular,
  DismissCircle20Filled,
  DocumentEdit20Regular,
  Eye20Regular,
  Send20Regular,
  ShieldCheckmark20Regular,
  Prohibited20Regular,
  ArrowUndo20Regular,
  Hourglass20Regular,
} from "@fluentui/react-icons";
import { useAppToast } from "@/components/toast";
import { formatDateTime } from "@/features/admin/ui";
import { useUserNames } from "@/features/approvals/use-user-names";
import { downloadApiFile } from "@/lib/api/download";
import { errorMessage } from "@/lib/api/errors";
import { offersApi } from "./api";
import { actorText, buildTimeline, type TimelineEntry } from "./timeline";
import type { OfferDetailOut } from "./types";

const useStyles = makeStyles({
  list: { listStyle: "none", margin: 0, padding: 0, borderLeft: `${tokens.strokeWidthThick} solid ${tokens.colorNeutralStroke2}`, marginLeft: tokens.spacingHorizontalS },
  item: { display: "grid", gridTemplateColumns: "28px 1fr", gap: tokens.spacingHorizontalS, padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}` },
  muted: { color: tokens.colorNeutralForeground3 },
});

function icon(e: TimelineEntry): React.ReactElement {
  if (e.kind === "response") return e.status === "accepted" ? <ShieldCheckmark20Regular color={tokens.colorPaletteGreenForeground1} /> : <DismissCircle20Filled color={tokens.colorPaletteRedForeground1} />;
  switch (e.status) {
    case "pending_approval":
      return <Hourglass20Regular />;
    case "approved":
      return <CheckmarkCircle20Filled color={tokens.colorBrandForeground1} />;
    case "released":
      return <Send20Regular />;
    case "viewed":
      return <Eye20Regular />;
    case "accepted":
      return <CheckmarkCircle20Filled color={tokens.colorPaletteGreenForeground1} />;
    case "declined":
      return <DismissCircle20Filled color={tokens.colorPaletteRedForeground1} />;
    case "expired":
      return <Clock20Regular />;
    case "withdrawn":
      return <Prohibited20Regular />;
    case "draft":
      return e.label.startsWith("Returned") ? <ArrowUndo20Regular /> : <DocumentEdit20Regular />;
    default:
      return <DocumentEdit20Regular />;
  }
}

/** Timeline tab: status history and candidate responses, newest first (icon, label, actor, local time, version). */
export function OfferStatusTimeline({ offer }: { offer: OfferDetailOut }) {
  const styles = useStyles();
  const toast = useAppToast();
  const nameOf = useUserNames();
  const entries = buildTimeline(offer.history, offer.responses);
  if (!entries.length) return <Body1 className={styles.muted}>No activity yet.</Body1>;
  return (
    <ol className={styles.list} aria-label={`Timeline of ${offer.human_id}`}>
      {entries.map((e) => (
        <li key={e.key} className={styles.item}>
          <span aria-hidden>{icon(e)}</span>
          <div>
            <Text weight="semibold">{e.label}</Text>
            <Caption1 as="p" className={styles.muted} style={{ margin: 0 }}>
              {formatDateTime(e.at)} · {actorText(e.actorKind, nameOf(e.actorId))}
              {e.versionNo ? ` · version ${e.versionNo}` : ""}
            </Caption1>
            {e.detail && (
              <Caption1 as="p" style={{ margin: 0 }}>
                {e.detail}
              </Caption1>
            )}
            {e.kind === "response" && e.status === "accepted" && offer.accepted_letter_url && (
              <Link
                as="button"
                onClick={() => downloadApiFile(offersApi.acceptedLetterUrl(offer.id), `${offer.human_id}-accepted.pdf`).catch((err) => toast.error(errorMessage(err)))}
              >
                Download the accepted PDF
              </Link>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
