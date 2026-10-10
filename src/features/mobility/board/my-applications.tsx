"use client";

import { Body1, Button, Caption1, Card, makeStyles, MessageBar, MessageBarBody, MessageBarTitle, Text, tokens } from "@fluentui/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog } from "@/features/admin/ui";
import { ErrorBlock, LoadingBlock } from "@/features/portal/ui";
import { isApiError } from "@/lib/api/errors";
import { formatDay, mobilityErrorMessage } from "../logic";
import type { MyApplicationOut } from "../types";
import { employeeKeys, useMyApplications } from "../use-mobility";
import { APP_SURFACE, MobilityStatusBadge, type Surface, SurfaceHeader, useMobilityStyles, usePageClass, WORK_SURFACE } from "./shared";

const useStyles = makeStyles({
  item: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalL,
    minWidth: 0,
  },
  top: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: tokens.spacingHorizontalM },
  title: { fontWeight: tokens.fontWeightSemibold, overflowWrap: "anywhere" },
});

export function MyInternalApplications() {
  return <MyApplications surface={APP_SURFACE} />;
}

export function WorkOpportunityApplications() {
  return <MyApplications surface={WORK_SURFACE} />;
}

function MyApplications({ surface }: { surface: Surface }) {
  const m = useMobilityStyles();
  const pageClass = usePageClass(surface);
  const q = useMyApplications(surface.client);
  const qc = useQueryClient();
  const toast = useAppToast();
  const [withdrawing, setWithdrawing] = useState<MyApplicationOut | null>(null);
  const withdraw = useMutation({
    mutationFn: (id: string) => surface.client.withdraw(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: employeeKeys(surface.client.scope).root });
      toast.success("Application withdrawn.");
    },
    onError: (e) => toast.error(mobilityErrorMessage(isApiError(e) ? e : null)),
  });

  return (
    <div className={pageClass}>
      <div className={m.headerRow}>
        <SurfaceHeader surface={surface} title="My internal applications" subtitle="Track the roles you have applied for inside the company." />
        <AppLink href={surface.base}>Browse openings</AppLink>
      </div>
      {q.isPending ? (
        <LoadingBlock label="Loading your applications" />
      ) : q.isError ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <Card style={{ padding: 16 }}>
          <Body1>You have not applied for any internal openings yet.</Body1>
        </Card>
      ) : (
        <ul className={m.list} aria-label="My internal applications">
          {q.data.map((a) => (
            <li key={a.id}>
              <ApplicationItem app={a} surface={surface} onWithdraw={() => setWithdrawing(a)} />
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!withdrawing}
        title="Withdraw this application?"
        confirmLabel="Withdraw"
        onClose={() => setWithdrawing(null)}
        onConfirm={() => (withdrawing ? withdraw.mutateAsync(withdrawing.id) : Promise.resolve())}
      >
        <Body1>{`Your application for ${withdrawing?.demand_title ?? "this opening"} will be withdrawn. You cannot undo this.`}</Body1>
      </ConfirmDialog>
    </div>
  );
}

function ApplicationItem({ app: a, surface, onWithdraw }: { app: MyApplicationOut; surface: Surface; onWithdraw: () => void }) {
  const styles = useStyles();
  const m = useMobilityStyles();
  return (
    <Card className={styles.item}>
      <div className={styles.top}>
        <AppLink href={`${surface.base}/${a.demand_id}`} className={styles.title}>
          {a.demand_title}
        </AppLink>
        <div className={m.badges}>
          <MobilityStatusBadge status={a.status} />
          {a.stage_name && <Text size={200}>{`Stage: ${a.stage_name}`}</Text>}
        </div>
      </div>
      <Caption1 className={m.muted}>
        {`Applied ${formatDay(a.submitted_at)}`}
        {a.decided_at ? ` · Decided ${formatDay(a.decided_at)}` : ""}
      </Caption1>
      {a.rejection_reason && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>Reason</MessageBarTitle>
            {a.rejection_reason}
          </MessageBarBody>
        </MessageBar>
      )}
      {a.can_withdraw && (
        <div>
          <Button className={m.tall} onClick={onWithdraw}>
            Withdraw
          </Button>
        </div>
      )}
    </Card>
  );
}
