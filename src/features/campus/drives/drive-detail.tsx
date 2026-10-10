"use client";

import { Button, makeStyles, MessageBar, MessageBarBody, Tab, TabList, Text, tokens } from "@fluentui/react-components";
import { ArrowLeft20Regular, PeopleCommunity20Regular, Settings20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog, ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { campusApi } from "../api";
import { driveActions, formatDate, REGISTRATION_STATUS_LABELS, REGISTRATION_STATUSES } from "../logic";
import type { DriveOut } from "../types";
import { DriveStatusBadge, ReasonDialog, useCampusStyles } from "../ui";
import { useCampusPermissions, useDrive, useDriveMutation } from "../use-campus";
import { AssessmentsTab } from "./assessments-tab";
import { BatchesTab } from "./batches-tab";
import { FunnelTab } from "./funnel-tab";
import { ImportTab } from "./import-tab";
import { LinksTab } from "./links-tab";
import { OffersTab } from "./offers-tab";
import { RegistrationsTab } from "./registrations-tab";
import { ShortlistTab } from "./shortlist-tab";

const TABS = [
  ["overview", "Overview"],
  ["registrations", "Registrations"],
  ["import", "Import"],
  ["assessments", "Assessments"],
  ["shortlist", "Shortlist"],
  ["batches", "Batches"],
  ["offers", "Offers"],
  ["funnel", "Funnel"],
  ["links", "Links & QR"],
] as const;
type TabKey = (typeof TABS)[number][0];

const useStyles = makeStyles({
  tabs: { marginBottom: tokens.spacingVerticalL, overflowX: "auto" },
  tiles: { display: "grid", gap: tokens.spacingHorizontalM, gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" },
  tile: {
    display: "flex",
    flexDirection: "column",
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow2,
  },
  value: { fontSize: tokens.fontSizeHero700, lineHeight: tokens.lineHeightHero700, fontWeight: tokens.fontWeightSemibold, fontVariantNumeric: "tabular-nums" },
});

/** `/campus/drives/[id]`: one drive with its lifecycle tabs. */
export function DriveDetail({ driveId }: { driveId: string }) {
  const styles = useStyles();
  const { canRead } = useCampusPermissions();
  const drive = useDrive(driveId);
  const [tab, setTab] = useState<TabKey>("overview");
  if (!canRead) return <NoAccess what="campus drives" />;
  if (drive.isPending) return <GridSkeleton rows={8} />;
  if (drive.isError)
    return (
      <ErrorBar
        title={isApiError(drive.error) && drive.error.status === 404 ? "Drive not found." : "Could not load the drive."}
        message={errorMessage(drive.error)}
      />
    );
  const d = drive.data;
  return (
    <>
      <AppLink href="/campus/drives">
        <ArrowLeft20Regular aria-hidden style={{ verticalAlign: "middle" }} /> Campus drives
      </AppLink>
      <PageHeader
        title={d.name}
        subtitle={
          <>
            Batch {d.batch_year} · <DriveStatusBadge status={d.status} /> · {d.institutions.length} Institutions ·{" "}
            {Object.values(d.status_counts).reduce((n, v) => n + (v ?? 0), 0).toLocaleString()} registrations
          </>
        }
      />
      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, v) => setTab(v.value as TabKey)} aria-label="Drive sections">
        {TABS.map(([k, label]) => (
          <Tab key={k} value={k}>
            {label}
          </Tab>
        ))}
      </TabList>
      <div role="tabpanel" aria-label={TABS.find(([k]) => k === tab)?.[1]}>
        {tab === "overview" && <Overview drive={d} />}
        {tab === "registrations" && <RegistrationsTab drive={d} />}
        {tab === "import" && <ImportTab drive={d} />}
        {tab === "assessments" && <AssessmentsTab drive={d} />}
        {tab === "shortlist" && <ShortlistTab drive={d} />}
        {tab === "batches" && <BatchesTab drive={d} />}
        {tab === "offers" && <OffersTab drive={d} />}
        {tab === "funnel" && <FunnelTab drive={d} />}
        {tab === "links" && <LinksTab drive={d} />}
      </div>
    </>
  );
}

function Overview({ drive }: { drive: DriveOut }) {
  const styles = useStyles();
  const c = useCampusStyles();
  const router = useRouter();
  const toast = useAppToast();
  const { canManage, canPools } = useCampusPermissions();
  const [confirm, setConfirm] = useState<"open" | "close_registration" | "close" | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [poolBusy, setPoolBusy] = useState(false);
  const transition = useDriveMutation((a: "open" | "close_registration" | "close") =>
    a === "open" ? campusApi.openRegistration(drive.id) : a === "close_registration" ? campusApi.closeRegistration(drive.id) : campusApi.closeDrive(drive.id),
  );
  const cancel = useDriveMutation((reason: string) => campusApi.cancelDrive(drive.id, reason));
  const actions = canManage ? driveActions(drive.status) : [];
  const COPY = {
    open: { label: "Open registration", title: "Open registration?", body: "Every Institution's link starts accepting registrations." },
    close_registration: { label: "Close registration", title: "Close registration?", body: "Links stop accepting new registrations. You can continue with assessments and interviews." },
    close: { label: "Close drive", title: "Close this drive?", body: "The drive becomes read-only. Offers already made are not affected." },
  } as const;

  const enablePool = async () => {
    setPoolBusy(true);
    try {
      const pool = await campusApi.enableCampusPool(drive.batch_year);
      toast.success(`Talent pool “${pool.name}” is enabled`);
      router.push(`/talent-pools/${pool.id}`);
    } catch (e) {
      toast.error(isApiError(e) && e.status === 409 ? "The Campus pool for this batch is already enabled." : errorMessage(e));
    } finally {
      setPoolBusy(false);
    }
  };

  return (
    <div className={c.stack}>
      {drive.status === "cancelled" && (
        <MessageBar intent="warning">
          <MessageBarBody>This drive was cancelled{drive.cancel_reason ? `: ${drive.cancel_reason}` : "."}</MessageBarBody>
        </MessageBar>
      )}
      <div className={c.row}>
        {actions
          .filter((a) => a !== "cancel")
          .map((a) => (
            <Button key={a} appearance={a === "open" ? "primary" : "secondary"} onClick={() => setConfirm(a as "open" | "close_registration" | "close")}>
              {COPY[a as keyof typeof COPY].label}
            </Button>
          ))}
        {canManage && drive.status !== "closed" && drive.status !== "cancelled" && (
          <Button icon={<Settings20Regular />} onClick={() => router.push(`/campus/drives/${drive.id}/setup`)}>
            Edit set-up
          </Button>
        )}
        {canPools && (
          <Button icon={<PeopleCommunity20Regular />} disabled={poolBusy} onClick={() => void enablePool()}>
            Enable Campus {drive.batch_year} Pool
          </Button>
        )}
        {actions.includes("cancel") && <Button onClick={() => setCancelling(true)}>Cancel drive</Button>}
      </div>
      <dl className={c.grid2} style={{ margin: 0 }}>
        {[
          ["Owner", drive.owner_name ?? "—"],
          ["Registration opens", formatDate(drive.registration_opens_at)],
          ["Registration closes", formatDate(drive.registration_closes_at)],
          ["Demands", drive.demands.map((x) => x.title).join(", ") || "None linked"],
          ["Eligibility rules", drive.eligibility_definition?.filters ? `Set (revision ${drive.eligibility_revision})` : "None: everybody is eligible"],
          ["Assessment", drive.assessment_name ?? (drive.assessment_id ? "Chosen" : "None")],
        ].map(([k, v]) => (
          <div key={k}>
            <dt>
              <Text size={200} className={c.muted}>
                {k}
              </Text>
            </dt>
            <dd style={{ margin: 0 }}>{v}</dd>
          </div>
        ))}
      </dl>
      <section aria-label="Registrations by status" className={styles.tiles}>
        {REGISTRATION_STATUSES.map((s) => (
          <div key={s} className={styles.tile}>
            <Text size={200} className={c.muted}>
              {REGISTRATION_STATUS_LABELS[s]}
            </Text>
            <span className={styles.value}>{(drive.status_counts[s] ?? 0).toLocaleString()}</span>
          </div>
        ))}
      </section>
      {confirm && (
        <ConfirmDialog
          open
          title={COPY[confirm].title}
          confirmLabel={COPY[confirm].label}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            try {
              await transition.mutateAsync(confirm);
              toast.success("Drive updated");
            } catch (e) {
              toast.error(errorMessage(e));
              throw e;
            }
          }}
        >
          {COPY[confirm].body}
        </ConfirmDialog>
      )}
      {cancelling && (
        <ReasonDialog
          title="Cancel this drive?"
          intro={<Text>Links stop working and pending invitations are withdrawn. Tell students and Institutions why.</Text>}
          confirmLabel="Cancel drive"
          onClose={() => setCancelling(false)}
          onSubmit={async (reason) => {
            await cancel.mutateAsync(reason);
            toast.success("Drive cancelled");
          }}
        />
      )}
    </div>
  );
}
