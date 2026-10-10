"use client";

import { Badge, Body1, Button, Caption1, Card, CardHeader, makeStyles, Spinner, Text, tokens } from "@fluentui/react-components";
import { DocumentAdd20Regular, Open20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatDate, formatMoney, OFFER_STATUS, offerErrorMessage, TERMINAL_STATUSES } from "./format";
import { OfferDrawer } from "./offer-drawer";
import type { OfferOut } from "./types";
import { useCreateOffer } from "./use-offer-mutations";
import { useApplicationOffers } from "./use-offers";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  card: { cursor: "pointer" },
  meta: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalL, paddingInline: tokens.spacingHorizontalM, paddingBottom: tokens.spacingVerticalM },
  muted: { color: tokens.colorNeutralForeground3 },
});

/**
 * "Create offer" for a Selected application (pipeline card or application drawer). Opens the new offer's drawer;
 * a 409 `offer_exists` opens the existing open offer instead.
 */
export function CreateOfferButton({
  applicationId,
  size = "medium",
  appearance = "primary",
  onOpen,
}: {
  applicationId: string;
  size?: "small" | "medium";
  appearance?: "primary" | "secondary" | "subtle";
  /** Called with the offer id to open (the button renders its own drawer when omitted). */
  onOpen?: (offerId: string) => void;
}) {
  const toast = useAppToast();
  const canWrite = usePermission("offer:write");
  const create = useCreateOffer(applicationId);
  const [openId, setOpenId] = useState<string | null>(null);
  if (!canWrite) return null;
  const open = (id: string) => (onOpen ? onOpen(id) : setOpenId(id));
  return (
    <>
      <Button
        size={size}
        appearance={appearance}
        icon={create.isPending ? <Spinner size="tiny" /> : <DocumentAdd20Regular />}
        disabled={create.isPending}
        onClick={(e) => {
          e.stopPropagation();
          create.mutate(
            {},
            {
              onSuccess: (o) => {
                toast.success(`Created ${o.human_id} (draft). Review the terms and submit it for approval.`);
                open(o.id);
              },
              onError: (err) => {
                if (isApiError(err) && err.code === "offer_exists" && typeof err.details.offer_id === "string") {
                  toast.info("This application already has an open offer.");
                  open(err.details.offer_id);
                } else toast.error(isApiError(err) ? offerErrorMessage(err.code, errorMessage(err)) : errorMessage(err));
              },
            },
          );
        }}
      >
        Create offer
      </Button>
      {openId && <OfferDrawer offerId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

/** The application drawer's "Offer" tab: the application's offers (newest first) and "Create offer" when Selected. */
export function ApplicationOffer({ applicationId, stageKey }: { applicationId: string; stageKey?: string | null }) {
  const styles = useStyles();
  const canRead = usePermission("offer:read");
  const q = useApplicationOffers(applicationId);
  const [openId, setOpenId] = useState<string | null>(null);
  if (!canRead) return <Body1 className={styles.muted}>You do not have access to offers.</Body1>;
  if (q.isPending) return <GridSkeleton rows={3} />;
  if (q.isError) return <ErrorBar title="Could not load offers." message={errorMessage(q.error)} />;
  const offers = [...q.data].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const hasOpen = offers.some((o) => !TERMINAL_STATUSES.includes(o.status));
  const selected = stageKey === "selected";

  return (
    <div className={styles.root}>
      {selected && !hasOpen && (
        <div>
          <CreateOfferButton applicationId={applicationId} onOpen={setOpenId} />
        </div>
      )}
      {!selected && offers.length === 0 && <Body1 className={styles.muted}>Offers can be created once the application reaches Selected.</Body1>}
      {offers.map((o) => (
        <OfferCard key={o.id} offer={o} onOpen={() => setOpenId(o.id)} />
      ))}
      {openId && <OfferDrawer offerId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function OfferCard({ offer, onOpen }: { offer: OfferOut; onOpen: () => void }) {
  const styles = useStyles();
  const v = offer.current_version;
  return (
    <Card className={styles.card} appearance="outline" onClick={onOpen}>
      <CardHeader
        header={
          <Text weight="semibold">
            {offer.human_id} · {v.title}
          </Text>
        }
        description={<Caption1 className={styles.muted}>Version {v.version_no}</Caption1>}
        action={
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge appearance="tint" color={OFFER_STATUS[offer.status].color}>
              {OFFER_STATUS[offer.status].label}
            </Badge>
            <Button appearance="subtle" icon={<Open20Regular />} aria-label={`Open ${offer.human_id}`} onClick={onOpen} />
          </span>
        }
      />
      <div className={styles.meta}>
        <Caption1>Pay {formatMoney(v.pay_rate, v.pay_rate_unit)}</Caption1>
        <Caption1>Start {formatDate(v.start_date)}</Caption1>
        <Caption1>Expires {formatDate(v.expiry_date)}</Caption1>
      </div>
    </Card>
  );
}
