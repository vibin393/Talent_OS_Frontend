"use client";

import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Checkbox,
  Dropdown,
  makeStyles,
  Option,
  Spinner,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Pin16Regular, PinOff16Regular, PeopleAdd20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { poolKeys, poolsApi } from "./api";
import { matchingPoolsText, pipelineResultText } from "./logic";
import { PoolKindBadge } from "./pools-view";
import type { RediscoveryPool } from "./types";
import { usePools } from "./use-pools";

const useStyles = makeStyles({
  card: { marginBottom: tokens.spacingVerticalL },
  head: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  grow: { flex: 1 },
  pins: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, margin: 0, padding: 0, listStyleType: "none" },
  pin: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  pinPicker: { minWidth: "240px" },
  poolHead: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  panel: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, paddingBottom: tokens.spacingVerticalM },
  muted: { color: tokens.colorNeutralForeground3 },
  num: { fontVariantNumeric: "tabular-nums" },
});

function useRediscovery(demandId: string, enabled = true) {
  return useQuery({
    queryKey: poolKeys.rediscovery(demandId),
    queryFn: ({ signal }) => poolsApi.rediscovery(demandId, signal),
    enabled,
    staleTime: 60_000,
  });
}

/** "N matching Pools" badge for the rediscovery card (renders nothing when none or not permitted). */
export function MatchingPoolsBadge({ demandId }: { demandId: string }) {
  const canRead = usePermission("pool:read");
  const q = useRediscovery(demandId, canRead);
  const text = matchingPoolsText(q.data?.sections.pools?.matching_pools);
  if (!canRead || !text) return null;
  return (
    <Badge appearance="tint" color="brand" title="See the Pools tab">
      {text}
    </Badge>
  );
}

function PoolAccordionPanel({ demandId, pool, canPipeline }: { demandId: string; pool: RediscoveryPool; canPipeline: boolean }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const add = useMutation({
    mutationFn: () => poolsApi.addToPipeline(demandId, pool.pool_id, { candidate_ids: [...selected] }),
    onSuccess: (r) => {
      toast.success(`${pool.name}: ${pipelineResultText(r.items)}.`);
      setSelected(new Set());
      void qc.invalidateQueries({ queryKey: ["pipeline"] });
      void qc.invalidateQueries({ queryKey: ["matching"] });
    },
    onError: (e) => toast.error(errorMessage(e, "Could not add to the pipeline.")),
  });
  if (pool.top.length === 0) return <Caption1 className={styles.muted}>No members of this pool match this demand yet.</Caption1>;
  const all = pool.top.every((t) => selected.has(t.candidate_id));
  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  return (
    <div className={styles.panel}>
      <Table size="small" aria-label={`Top matches in ${pool.name}`}>
        <TableHeader>
          <TableRow>
            {canPipeline && (
              <TableHeaderCell style={{ width: 40 }}>
                <Checkbox
                  aria-label="Select all"
                  checked={all ? true : selected.size > 0 ? "mixed" : false}
                  onChange={(_, d) => setSelected(d.checked ? new Set(pool.top.map((t) => t.candidate_id)) : new Set())}
                />
              </TableHeaderCell>
            )}
            <TableHeaderCell style={{ width: 64 }}>Rank</TableHeaderCell>
            <TableHeaderCell>Candidate</TableHeaderCell>
            <TableHeaderCell style={{ width: 96 }}>Score</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pool.top.map((t) => (
            <TableRow key={t.candidate_id}>
              {canPipeline && (
                <TableCell>
                  <Checkbox
                    aria-label={`Select ${t.full_name}`}
                    checked={selected.has(t.candidate_id)}
                    onChange={(_, d) => toggle(t.candidate_id, !!d.checked)}
                  />
                </TableCell>
              )}
              <TableCell className={styles.num}>#{t.rank}</TableCell>
              <TableCell>
                <AppLink href={`/candidates/${t.candidate_id}`}>{t.full_name}</AppLink>
              </TableCell>
              <TableCell className={styles.num}>{Math.round(Number(t.overall))}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {canPipeline && (
        <div className={styles.head}>
          <Button
            appearance="primary"
            icon={add.isPending ? <Spinner size="tiny" /> : <PeopleAdd20Regular />}
            disabled={selected.size === 0 || add.isPending}
            onClick={() => add.mutate()}
          >
            Add selected to pipeline{selected.size ? ` (${selected.size})` : ""}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Demand **Pools** tab (Epic 38): pinned pools, and the rediscovery Pools section with each top-20 list. */
export function DemandPoolsTab({ demandId }: { demandId: string }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const canWrite = usePermission("pool:write");
  const canPipeline = usePermission("application:create");
  const rediscovery = useRediscovery(demandId);
  const pins = useQuery({ queryKey: poolKeys.pins(demandId), queryFn: ({ signal }) => poolsApi.pins(demandId, signal) });
  const pools = usePools({}, canWrite);
  const [pinPick, setPinPick] = useState<string | null>(null);
  const refetch = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: poolKeys.pins(demandId) }),
      qc.invalidateQueries({ queryKey: poolKeys.rediscovery(demandId) }),
    ]);
  const pin = useMutation({
    mutationFn: (poolId: string) => poolsApi.pin(demandId, poolId),
    onSuccess: () => {
      toast.success("Pool pinned to this demand.");
      setPinPick(null);
    },
    onError: (e) => toast.error(errorMessage(e, "Could not pin the pool.")),
    onSettled: refetch,
  });
  const unpin = useMutation({
    mutationFn: (poolId: string) => poolsApi.unpin(demandId, poolId),
    onSuccess: () => toast.success("Pool unpinned."),
    onError: (e) => toast.error(errorMessage(e, "Could not unpin the pool.")),
    onSettled: refetch,
  });

  const pinned = pins.data ?? [];
  const pinnedIds = new Set(pinned.map((p) => p.pool_id));
  const pinnable = (pools.data ?? []).filter((p) => p.status === "active" && !pinnedIds.has(p.id));
  const section = rediscovery.data?.sections.pools ?? null;

  return (
    <>
      <Card className={styles.card}>
        <div className={styles.head}>
          <Subtitle2 as="h2">Pinned pools</Subtitle2>
          <span className={styles.grow} />
          {canWrite && (
            <>
              <Dropdown
                className={styles.pinPicker}
                aria-label="Pool to pin"
                placeholder="Choose a pool to pin"
                value={pinnable.find((p) => p.id === pinPick)?.name ?? ""}
                selectedOptions={pinPick ? [pinPick] : []}
                onOptionSelect={(_, d) => setPinPick(d.optionValue ?? null)}
              >
                {pinnable.map((p) => (
                  <Option key={p.id} value={p.id} text={p.name}>
                    {`${p.name} (${p.member_count})`}
                  </Option>
                ))}
              </Dropdown>
              <Button icon={<Pin16Regular />} disabled={!pinPick || pin.isPending} onClick={() => pinPick && pin.mutate(pinPick)}>
                Pin
              </Button>
            </>
          )}
        </div>
        {pins.isPending ? (
          <Spinner size="tiny" />
        ) : pins.isError ? (
          <ErrorBar title="Could not load pinned pools." message={errorMessage(pins.error)} />
        ) : pinned.length === 0 ? (
          <Body1 className={styles.muted}>No pools are pinned to this demand. Pinned pools always appear first below.</Body1>
        ) : (
          <ul className={styles.pins}>
            {pinned.map((p) => (
              <li key={p.pool_id} className={styles.pin}>
                <AppLink href={`/talent-pools/${p.pool_id}`}>{p.name}</AppLink>
                <PoolKindBadge kind={p.kind} />
                <Caption1 className={styles.muted}>{p.member_count.toLocaleString()} members</Caption1>
                {canWrite && (
                  <Button
                    size="small"
                    appearance="subtle"
                    icon={<PinOff16Regular />}
                    disabled={unpin.isPending}
                    onClick={() => unpin.mutate(p.pool_id)}
                  >
                    Unpin
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className={styles.card}>
        <div className={styles.head}>
          <Subtitle2 as="h2">Matching pools</Subtitle2>
          {section && section.matching_pools > 0 && (
            <Badge appearance="tint" color="brand">
              {matchingPoolsText(section.matching_pools)}
            </Badge>
          )}
          {rediscovery.isFetching && <Spinner size="extra-tiny" aria-label="Loading" />}
        </div>
        {section?.summary && <Caption1 className={styles.muted}>{section.summary}</Caption1>}
        {rediscovery.isPending ? (
          <GridSkeleton rows={3} />
        ) : rediscovery.isError ? (
          <ErrorBar title="Could not load matching pools." message={errorMessage(rediscovery.error)} />
        ) : !section || section.pools.length === 0 ? (
          <Body1 className={styles.muted}>None of your pools have members among this demand&apos;s matches yet.</Body1>
        ) : (
          <Accordion multiple collapsible>
            {section.pools.map((p) => (
              <AccordionItem key={p.pool_id} value={p.pool_id}>
                <AccordionHeader>
                  <span className={styles.poolHead}>
                    <Text weight="semibold">
                      {p.name} ({p.matching_count})
                    </Text>
                    <PoolKindBadge kind={p.kind} />
                    {p.pinned && (
                      <Badge appearance="outline" color="brand" icon={<Pin16Regular />}>
                        Pinned
                      </Badge>
                    )}
                  </span>
                </AccordionHeader>
                <AccordionPanel>
                  <PoolAccordionPanel demandId={demandId} pool={p} canPipeline={canPipeline} />
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </Card>
    </>
  );
}
