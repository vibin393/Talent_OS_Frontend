"use client";

import {
  Badge,
  Body1,
  Button,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Tab,
  TabList,
  type TableColumnDefinition,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, formatDateTime, GridSkeleton, NoAccess, PagingBar } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { demandAgentApi, demandAgentKeys } from "./api";
import { IntakeMessageDrawer } from "./intake-message-drawer";
import { INTAKE_STATUS_COLORS, INTAKE_STATUS_LABELS, INTAKE_TABS, senderLabel } from "./logic";
import type { IntakeMessageSummary, IntakeTab } from "./types";

const useStyles = makeStyles({
  tabs: { marginBottom: tokens.spacingVerticalM },
  empty: { padding: tokens.spacingVerticalXXL, color: tokens.colorNeutralForeground3 },
  drafts: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
});

/** `/demands/intake` -- the "Intake inbox" (`demand:create`). */
export function IntakeInbox({ initialMessageId }: { initialMessageId?: string | null }) {
  const canCreate = usePermission("demand:create");
  const canManage = usePermission("settings:manage");
  const styles = useStyles();
  const [tab, setTab] = useState<IntakeTab>("needs_attention");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(initialMessageId ?? null);
  const list = useQuery({
    queryKey: demandAgentKeys.messages(tab, page),
    queryFn: ({ signal }) => demandAgentApi.messages(tab, page, signal),
    enabled: canCreate,
    placeholderData: (prev) => prev,
  });
  const settings = useQuery({
    queryKey: demandAgentKeys.intakeSettings,
    queryFn: ({ signal }) => demandAgentApi.intakeSettings(signal),
    enabled: canManage,
    retry: false,
  });

  const columns: TableColumnDefinition<IntakeMessageSummary>[] = [
    createTableColumn({ columnId: "received", renderHeaderCell: () => "Received", renderCell: (m) => formatDateTime(m.received_at) }),
    createTableColumn({ columnId: "from", renderHeaderCell: () => "From", renderCell: (m) => senderLabel(m.from_name, m.from_address) }),
    createTableColumn({
      columnId: "subject",
      renderHeaderCell: () => "Subject",
      renderCell: (m) => (
        <Button appearance="transparent" onClick={() => setOpenId(m.id)}>
          {m.subject || "(no subject)"}
        </Button>
      ),
    }),
    createTableColumn({ columnId: "client", renderHeaderCell: () => "Client", renderCell: (m) => m.client_name ?? "—" }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (m) => (
        <Badge appearance="tint" color={INTAKE_STATUS_COLORS[m.status]}>
          {INTAKE_STATUS_LABELS[m.status]}
        </Badge>
      ),
    }),
    createTableColumn({
      columnId: "drafts",
      renderHeaderCell: () => "Drafts",
      renderCell: (m) =>
        m.draft_demand_ids.length === 0 ? (
          "—"
        ) : (
          <span className={styles.drafts}>
            {m.draft_demand_ids.length}
            {m.draft_demand_ids.map((id, i) => (
              <AppLink key={id} href={`/demands/${id}`}>
                {`#${i + 1}`}
              </AppLink>
            ))}
          </span>
        ),
    }),
  ];

  const intakeOff = settings.data?.intake_mode === "off";
  const items = list.data?.items ?? [];
  return (
    <>
      <PageHeader
        title="Intake inbox"
        subtitle="Client requirements received by email or upload. The Demand Agent drafts demands for you to review."
      />
      {!canCreate ? (
        <NoAccess what="the intake inbox" />
      ) : (
        <>
          <TabList
            className={styles.tabs}
            selectedValue={tab}
            onTabSelect={(_, d) => {
              setTab(d.value as IntakeTab);
              setPage(1);
            }}
          >
            {INTAKE_TABS.map((t) => (
              <Tab key={t.key} value={t.key}>
                {t.label}
              </Tab>
            ))}
          </TabList>
          {list.isPending ? (
            <GridSkeleton rows={6} />
          ) : list.isError ? (
            <ErrorBar title="Could not load the inbox." message={errorMessage(list.error)} />
          ) : items.length === 0 ? (
            tab === "all" && intakeOff ? (
              <MessageBar intent="info">
                <MessageBarBody>
                  Intake isn&apos;t set up yet. Ask an administrator to set up the intake mailbox.{" "}
                  {canManage && <AppLink href="/settings/demands/intake">Demand intake settings</AppLink>}
                </MessageBarBody>
              </MessageBar>
            ) : (
              <Body1 className={styles.empty}>{tab === "needs_attention" ? "Nothing needs your attention." : "No messages."}</Body1>
            )
          ) : (
            <>
              <DataGrid items={items} columns={columns} getRowId={(m) => m.id} aria-label="Intake messages">
                <DataGridHeader>
                  <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
                </DataGridHeader>
                <DataGridBody<IntakeMessageSummary>>
                  {({ item, rowId }) => (
                    <DataGridRow<IntakeMessageSummary> key={rowId}>
                      {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                    </DataGridRow>
                  )}
                </DataGridBody>
              </DataGrid>
              <PagingBar
                page={page}
                pageSize={list.data?.page_size ?? 25}
                total={list.data?.total ?? 0}
                onPageChange={setPage}
                busy={list.isFetching}
              />
            </>
          )}
          {openId && <IntakeMessageDrawer messageId={openId} onClose={() => setOpenId(null)} />}
        </>
      )}
    </>
  );
}
