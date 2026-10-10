"use client";

import { Badge, Button, createTableColumn, makeStyles, type TableColumnDefinition, Text, tokens } from "@fluentui/react-components";
import { ArrowDownload20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { downloadApiFile } from "@/lib/api/download";
import { errorMessage } from "@/lib/api/errors";
import { consoleApi, consoleKeys, type DataFlowRow } from "./api";
import { directionLabel, publisherLabel, RESTRICTED_TRANSFER_BADGE } from "./logic";

const useStyles = makeStyles({
  bar: { display: "flex", justifyContent: "flex-end", marginBottom: tokens.spacingVerticalM },
  fields: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
});

/** "Data flows" tab: the data-flow register with a masked CSV export (streamed from the console, §A4 deviation). */
export function DataFlowsTab() {
  const styles = useStyles();
  const toast = useAppToast();
  const [downloading, setDownloading] = useState(false);
  const rows = useQuery({ queryKey: consoleKeys.dataFlows, queryFn: ({ signal }) => consoleApi.dataFlows(signal) });

  const onDownload = async () => {
    setDownloading(true);
    try {
      await downloadApiFile(consoleApi.dataFlowsCsvUrl(), "data-flows.csv");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDownloading(false);
    }
  };

  const columns: TableColumnDefinition<DataFlowRow>[] = [
    createTableColumn({
      columnId: "system",
      renderHeaderCell: () => "System",
      renderCell: (r) => (
        <div>
          <Text weight="semibold">{r.installation}</Text>
          <br />
          <Text size={200}>{publisherLabel(r.publisher)}</Text>
        </div>
      ),
    }),
    createTableColumn({ columnId: "direction", renderHeaderCell: () => "Direction", renderCell: (r) => directionLabel(r.direction) }),
    createTableColumn({
      columnId: "data",
      renderHeaderCell: () => "Data",
      renderCell: (r) => (
        <div>
          <Text>{r.entity}</Text>
          <span className={styles.fields}>
            {r.fields.map((f) => (
              <Badge key={f} appearance="outline" size="small" color={r.personal_data ? "warning" : "subtle"}>
                {f}
              </Badge>
            ))}
          </span>
        </div>
      ),
    }),
    createTableColumn({ columnId: "purpose", renderHeaderCell: () => "Purpose", renderCell: (r) => r.purpose ?? "—" }),
    createTableColumn({
      columnId: "country",
      renderHeaderCell: () => "Country",
      renderCell: (r) => (
        <div>
          <Text>{r.destination_country ?? "—"}</Text>
          {r.restricted_transfer ? (
            <>
              {" "}
              <Badge appearance="tint" color="danger" size="small">
                {RESTRICTED_TRANSFER_BADGE}
              </Badge>
            </>
          ) : null}
        </div>
      ),
    }),
    createTableColumn({ columnId: "since", renderHeaderCell: () => "Since", renderCell: (r) => r.since ?? "—" }),
    createTableColumn({ columnId: "people", renderHeaderCell: () => "People (90 days)", renderCell: (r) => r.subjects_exposed_90d.toLocaleString() }),
  ];

  return (
    <>
      <div className={styles.bar}>
        <Button icon={<ArrowDownload20Regular />} disabled={downloading || !rows.data?.length} onClick={onDownload}>
          Download CSV
        </Button>
      </div>
      <AdminGrid
        items={rows.data}
        columns={columns}
        getRowId={(r) => `${r.installation}:${r.direction}:${r.entity}:${r.purpose ?? ""}:${r.destination_country ?? ""}`}
        loading={rows.isPending}
        error={rows.error}
        emptyText="No data is shared with connected systems yet."
        label="Data flows"
      />
    </>
  );
}
