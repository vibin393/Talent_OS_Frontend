"use client";

import {
  Badge,
  Body1,
  Button,
  Card,
  CardHeader,
  createTableColumn,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  Link,
  makeStyles,
  Option,
  Subtitle2,
  Tab,
  TabList,
  type TableColumnDefinition,
  Textarea,
  Title2,
  tokens,
} from "@fluentui/react-components";
import { ArrowLeft20Regular, ArrowUpload20Regular, Checkmark20Regular, Delete20Regular, Dismiss20Regular, Send20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { ErrorBar, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { approvalsApi } from "@/features/approvals/api";
import { ApprovalHistory } from "@/features/approvals/approval-history";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { commercialsApi, commercialsKeys } from "../api";
import { CONTRACT_TYPE_LABELS, contractActions, formatDate, formatMoney } from "../format";
import type { ContractDocumentKind, ContractDocumentOut, ContractOut, MilestoneOut } from "../types";
import { ContractStatusBadge } from "./contracts-view";
import { PRICING_MODEL_LABELS, type SowTermField, sowTermsError, valueCapLabel } from "../sow";
import { CreateProjectFromSowButton, SowTermsBar } from "./sow-terms";

const useStyles = makeStyles({
  back: { marginBottom: tokens.spacingVerticalS },
  header: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalM },
  grow: { flex: 1 },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  tabs: { marginBottom: tokens.spacingVerticalL, borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}` },
  card: { padding: tokens.spacingHorizontalL, marginBottom: tokens.spacingVerticalL },
  tree: { listStyle: "none", paddingLeft: tokens.spacingHorizontalL, margin: 0 },
});

type TabKey = "overview" | "documents" | "milestones" | "approval" | "history";

/** `/contracts/[id]`: header with status + actions and the Overview / Documents / Milestones / Approval /
 * History tabs. */
export function ContractDetail({ contractId }: { contractId: string }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canRead = usePermission("contract:read");
  const canWrite = usePermission("contract:write");
  const [tab, setTab] = useState<TabKey>("overview");
  const [terminating, setTerminating] = useState(false);
  const [signing, setSigning] = useState(false);
  // Epic 45: fields named by a `422 sow_terms_required` on submit / activate.
  const [sowRequired, setSowRequired] = useState<SowTermField[] | null>(null);
  const query = useQuery({
    queryKey: commercialsKeys.contract(contractId),
    queryFn: ({ signal }) => commercialsApi.contract(contractId, signal),
    enabled: canRead,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: commercialsKeys.all });
  const act = useMutation({
    mutationFn: (action: "submit" | "activate") =>
      action === "submit" ? commercialsApi.submitContract(contractId) : commercialsApi.activateContract(contractId),
    onSuccess: async (c) => {
      setSowRequired(null);
      toast.success(`${c.human_id} is ${c.status.replace("_", " ")}`);
      await refresh();
    },
    onError: (e) => {
      const sow = sowTermsError(e);
      if (sow) setSowRequired(sow);
      else toast.error(errorMessage(e));
    },
  });

  if (!canRead) return <NoAccess what="contracts" />;
  const back = (
    <div className={styles.back}>
      <AppLink href="/contracts">
        <ArrowLeft20Regular style={{ verticalAlign: "middle" }} aria-hidden /> Contracts
      </AppLink>
    </div>
  );
  if (query.isPending) return <>{back}<GridSkeleton rows={6} /></>;
  if (query.isError) {
    return (
      <>
        {back}
        {isApiError(query.error) && query.error.status === 404 ? (
          <Card style={{ maxWidth: 560 }}>
            <CardHeader header={<Subtitle2 as="h1">Contract not found</Subtitle2>} description={<Body1>This contract does not exist or you do not have access to it.</Body1>} />
          </Card>
        ) : (
          <ErrorBar title="Could not load this contract." message={errorMessage(query.error)} />
        )}
      </>
    );
  }
  const c = query.data;
  const actions = canWrite ? contractActions(c) : [];

  return (
    <>
      {back}
      <div className={styles.header}>
        <Title2 as="h1">
          {c.human_id} · {c.title ?? CONTRACT_TYPE_LABELS[c.contract_type]}
        </Title2>
        <Badge appearance="outline">{CONTRACT_TYPE_LABELS[c.contract_type]}</Badge>
        <ContractStatusBadge status={c.status} />
        <span className={styles.grow} />
        <div className={styles.actions}>
          <CreateProjectFromSowButton contract={c} />
          {actions.includes("submit") && (
            <Button disabled={act.isPending} onClick={() => act.mutate("submit")}>
              Submit for approval
            </Button>
          )}
          {actions.includes("activate") && (
            <Button appearance="primary" icon={<Checkmark20Regular />} disabled={act.isPending} onClick={() => act.mutate("activate")}>
              Activate
            </Button>
          )}
          {actions.includes("signature") && (
            <Button icon={<Send20Regular />} onClick={() => setSigning(true)}>
              Send for signature
            </Button>
          )}
          {actions.includes("terminate") && (
            <Button icon={<Dismiss20Regular />} onClick={() => setTerminating(true)}>
              Terminate
            </Button>
          )}
        </div>
      </div>
      <SowTermsBar
        contract={c}
        canWrite={canWrite}
        required={sowRequired}
        onSaved={async () => {
          setSowRequired(null);
          await refresh();
        }}
      />
      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as TabKey)} aria-label="Contract sections">
        <Tab value="overview">Overview</Tab>
        <Tab value="documents">Documents</Tab>
        {c.contract_type === "sow" && <Tab value="milestones">Milestones</Tab>}
        <Tab value="approval">Approval</Tab>
        <Tab value="history">History</Tab>
      </TabList>
      {tab === "overview" && <Overview contract={c} />}
      {tab === "documents" && <Documents contract={c} canWrite={canWrite} onChanged={refresh} />}
      {tab === "milestones" && <Milestones contract={c} canWrite={canWrite} />}
      {tab === "approval" && <Approval contract={c} />}
      {tab === "history" && <History contractId={c.id} />}
      {terminating && <TerminateDialog contract={c} onClose={() => setTerminating(false)} onDone={refresh} />}
      {signing && <SignatureDialog contract={c} onClose={() => setSigning(false)} onDone={refresh} />}
    </>
  );
}

function Overview({ contract: c }: { contract: ContractOut }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  return (
    <>
      <Card className={styles.card}>
        <dl className={admin.detailList}>
          <dt>Counterparty</dt>
          <dd>{c.client_id ? <AppLink href={`/clients/${c.client_id}`}>Client</AppLink> : "Vendor"}</dd>
          <dt>Start</dt>
          <dd>{formatDate(c.start_date)}</dd>
          <dt>End</dt>
          <dd>{formatDate(c.end_date)}</dd>
          {c.amends_end_date && (
            <>
              <dt>Extends parent to</dt>
              <dd>{formatDate(c.amends_end_date)}</dd>
            </>
          )}
          {c.contract_type === "sow" && (
            <>
              <dt>Pricing model</dt>
              <dd>{c.pricing_model ? PRICING_MODEL_LABELS[c.pricing_model] : "—"}</dd>
            </>
          )}
          <dt>{valueCapLabel(c.contract_type)}</dt>
          <dd>{formatMoney(c.value_cap, c.currency)}</dd>
          <dt>Placement fee</dt>
          <dd>{c.placement_fee_pct ? `${c.placement_fee_pct} %` : "—"}</dd>
          <dt>Notice period</dt>
          <dd>{c.notice_period_days != null ? `${c.notice_period_days} days` : "—"}</dd>
          <dt>Reverse charge</dt>
          <dd>{c.reverse_charge ? "Yes" : "No"}</dd>
          <dt>Signed document</dt>
          <dd>{c.signed_file_id ? "Attached" : "Missing"}</dd>
          {c.termination_reason && (
            <>
              <dt>Terminated</dt>
              <dd>
                {formatDate(c.termination_date)} — {c.termination_reason}
              </dd>
            </>
          )}
        </dl>
      </Card>
      {(c.parent_contract_id || c.children.length > 0) && (
        <Card className={styles.card}>
          <CardHeader header={<Subtitle2 as="h2">Related contracts</Subtitle2>} />
          {c.parent_contract_id && (
            <Body1>
              Parent: <AppLink href={`/contracts/${c.parent_contract_id}`}>open parent contract</AppLink>
            </Body1>
          )}
          <ul className={styles.tree}>
            {c.children.map((ch) => (
              <li key={ch.id}>
                <AppLink href={`/contracts/${ch.id}`}>{ch.human_id}</AppLink> · {CONTRACT_TYPE_LABELS[ch.contract_type]} · {ch.title ?? ""} ·{" "}
                <ContractStatusBadge status={ch.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function Documents({ contract, canWrite, onChanged }: { contract: ContractOut; canWrite: boolean; onChanged: () => Promise<unknown> }) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<ContractDocumentKind>("signed");
  const docs = useQuery({
    queryKey: commercialsKeys.contractDocs(contract.id),
    queryFn: ({ signal }) => commercialsApi.contractDocuments(contract.id, signal),
  });
  const done = async () => {
    await docs.refetch();
    await onChanged();
  };
  const uploadDoc = useMutation({
    mutationFn: (file: File) => commercialsApi.uploadContractDocument(contract.id, file, kind),
    onSuccess: done,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const markSigned = useMutation({ mutationFn: (d: ContractDocumentOut) => commercialsApi.markDocumentSigned(d.id), onSuccess: done, onError: (e) => toast.error(errorMessage(e)) });
  const remove = useMutation({ mutationFn: (d: ContractDocumentOut) => commercialsApi.deleteContractDocument(d.id), onSuccess: done, onError: (e) => toast.error(errorMessage(e)) });
  const columns: TableColumnDefinition<ContractDocumentOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "File",
      renderCell: (d) => (
        <Link href={`/api/v1/files/${d.file_id}/download`} target="_blank" rel="noopener noreferrer">
          {d.file_name ?? "Document"}
        </Link>
      ),
    }),
    createTableColumn({
      columnId: "kind",
      renderHeaderCell: () => "Kind",
      renderCell: (d) => (
        <Badge appearance="tint" color={d.kind === "signed" ? "success" : "informative"}>
          {d.kind}
        </Badge>
      ),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (d) =>
        canWrite ? (
          <RowActions
            label={d.file_name ?? "document"}
            actions={[
              ...(d.kind !== "signed" ? [{ label: "Mark as signed", icon: <Checkmark20Regular />, onClick: () => markSigned.mutate(d) }] : []),
              { label: "Remove", icon: <Delete20Regular />, onClick: () => remove.mutate(d) },
            ]}
          />
        ) : null,
    }),
  ];
  return (
    <>
      {canWrite && (
        <div className={admin.toolbar}>
          <Field label="Upload as">
            <Dropdown value={kind} selectedOptions={[kind]} onOptionSelect={(_, d) => setKind(d.optionValue as ContractDocumentKind)}>
              {(["signed", "draft", "annex", "other"] as const).map((k) => (
                <Option key={k} value={k}>
                  {k}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <Button icon={<ArrowUpload20Regular />} disabled={uploadDoc.isPending} onClick={() => fileRef.current?.click()}>
            Upload document
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadDoc.mutate(f);
              e.target.value = "";
            }}
          />
        </div>
      )}
      <AdminGrid items={docs.data} columns={columns} getRowId={(d) => d.id} loading={docs.isPending} error={docs.error} emptyText="No documents yet." label="Contract documents" />
    </>
  );
}

function Milestones({ contract, canWrite }: { contract: ContractOut; canWrite: boolean }) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const list = useQuery({ queryKey: commercialsKeys.milestones(contract.id), queryFn: ({ signal }) => commercialsApi.milestones(contract.id, signal) });
  const add = useMutation({
    mutationFn: () => commercialsApi.addMilestone(contract.id, { name, amount, due_date: due || null }),
    onSuccess: async () => {
      setName("");
      setAmount("");
      setDue("");
      await list.refetch();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const decide = useMutation({
    mutationFn: (v: { m: MilestoneOut; accept: boolean }) => (v.accept ? commercialsApi.acceptMilestone(v.m.id) : commercialsApi.cancelMilestone(v.m.id)),
    onSuccess: () => list.refetch(),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const columns: TableColumnDefinition<MilestoneOut>[] = [
    createTableColumn({ columnId: "name", renderHeaderCell: () => "Milestone", renderCell: (m) => m.name }),
    createTableColumn({ columnId: "amount", renderHeaderCell: () => "Amount", renderCell: (m) => formatMoney(m.amount.amount, m.amount.currency) }),
    createTableColumn({ columnId: "due", renderHeaderCell: () => "Due", renderCell: (m) => formatDate(m.due_date) }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (m) => (
        <span className={admin.badges}>
          <Badge appearance="tint" color={m.status === "accepted" ? "success" : m.status === "cancelled" ? "subtle" : "informative"}>
            {m.status}
          </Badge>
          {m.billed && <Badge appearance="filled" color="brand">Billed</Badge>}
        </span>
      ),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (m) =>
        canWrite && m.status === "planned" ? (
          <RowActions
            label={m.name}
            actions={[
              { label: "Accept", onClick: () => decide.mutate({ m, accept: true }), disabled: contract.status !== "active" },
              { label: "Cancel", onClick: () => decide.mutate({ m, accept: false }) },
            ]}
          />
        ) : null,
    }),
  ];
  return (
    <>
      {canWrite && (
        <div className={admin.toolbar}>
          <Field label="Name">
            <Input value={name} onChange={(_, d) => setName(d.value)} />
          </Field>
          <Field label="Amount">
            <Input value={amount} inputMode="decimal" contentAfter={contract.currency} onChange={(_, d) => setAmount(d.value)} />
          </Field>
          <Field label="Due date">
            <Input type="date" value={due} onChange={(_, d) => setDue(d.value)} />
          </Field>
          <Button disabled={!name.trim() || !amount || add.isPending} onClick={() => add.mutate()}>
            Add milestone
          </Button>
        </div>
      )}
      <AdminGrid items={list.data} columns={columns} getRowId={(m) => m.id} loading={list.isPending} error={list.error} emptyText="No milestones yet." label="Milestones" />
    </>
  );
}

function Approval({ contract }: { contract: ContractOut }) {
  const admin = useAdminStyles();
  const request = useQuery({
    queryKey: ["approvals", "request", contract.approval_request_id],
    queryFn: ({ signal }) => approvalsApi.get(contract.approval_request_id!, signal),
    enabled: !!contract.approval_request_id,
  });
  if (!contract.approval_request_id) {
    return <Body1 className={admin.muted}>{contract.approval_chain_configured ? "Not submitted for approval yet." : "No contract approval chain is configured."}</Body1>;
  }
  if (request.isPending) return <GridSkeleton rows={3} />;
  if (request.isError) return <ErrorBar message={errorMessage(request.error)} />;
  return <ApprovalHistory requests={[request.data]} />;
}

function History({ contractId }: { contractId: string }) {
  const admin = useAdminStyles();
  const list = useQuery({ queryKey: commercialsKeys.contractHistory(contractId), queryFn: ({ signal }) => commercialsApi.contractHistory(contractId, signal) });
  if (list.isPending) return <GridSkeleton rows={4} />;
  if (list.isError) return <ErrorBar message={errorMessage(list.error)} />;
  return (
    <Card>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {list.data.map((h) => (
          <li key={h.id}>
            <span className={admin.muted}>{new Date(h.occurred_at).toLocaleString()}</span> — {h.body}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TerminateDialog({ contract, onClose, onDone }: { contract: ContractOut; onClose: () => void; onDone: () => Promise<unknown> }) {
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const terminate = useMutation({
    mutationFn: () => commercialsApi.terminateContract(contract.id, reason, date),
    onSuccess: async () => {
      await onDone();
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Terminate {contract.human_id}?</DialogTitle>
          <DialogContent>
            <ErrorBar message={terminate.error ? errorMessage(terminate.error) : null} />
            <Field label="Termination date" required>
              <Input type="date" value={date} onChange={(_, d) => setDate(d.value)} />
            </Field>
            <Field label="Reason" required>
              <Textarea value={reason} onChange={(_, d) => setReason(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={!date || reason.trim().length < 3 || terminate.isPending} onClick={() => terminate.mutate()}>
              Terminate
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function SignatureDialog({ contract, onClose, onDone }: { contract: ContractOut; onClose: () => void; onDone: () => Promise<unknown> }) {
  const [email, setEmail] = useState("");
  const [signerName, setSignerName] = useState("");
  const docs = useQuery({ queryKey: commercialsKeys.contractDocs(contract.id), queryFn: ({ signal }) => commercialsApi.contractDocuments(contract.id, signal) });
  const [fileId, setFileId] = useState<string>("");
  const send = useMutation({
    mutationFn: () => commercialsApi.requestSignature(contract.id, fileId, [{ email, name: signerName || undefined, order: 1 }]),
    onSuccess: async () => {
      await onDone();
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Send for signature</DialogTitle>
          <DialogContent>
            <ErrorBar message={send.error ? errorMessage(send.error) : null} />
            <Field label="Document" required>
              <Dropdown
                value={docs.data?.find((d) => d.file_id === fileId)?.file_name ?? ""}
                selectedOptions={[fileId]}
                onOptionSelect={(_, d) => setFileId(d.optionValue ?? "")}
              >
                {(docs.data ?? []).map((d) => (
                  <Option key={d.id} value={d.file_id}>
                    {d.file_name ?? d.file_id}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="Signer email" required>
              <Input type="email" value={email} onChange={(_, d) => setEmail(d.value)} />
            </Field>
            <Field label="Signer name">
              <Input value={signerName} onChange={(_, d) => setSignerName(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={!fileId || !email.includes("@") || send.isPending} onClick={() => send.mutate()}>
              Send
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
