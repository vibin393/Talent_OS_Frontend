"use client";

import {
  Badge,
  Body1,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Radio,
  RadioGroup,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
} from "@fluentui/react-components";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { errorMessage } from "@/lib/api/errors";
import { campusApi } from "../api";
import type { ConfirmOut, DriveOut, ProposalOut } from "../types";
import { HumanOnly, useCampusStyles } from "../ui";
import { useCampusPermissions, useInvalidateDrive } from "../use-campus";

/** Shortlist: propose (top N or minimum score) -> review with tie flags -> ★ confirm into a Demand's pipeline. */
export function ShortlistTab({ drive }: { drive: DriveOut }) {
  const c = useCampusStyles();
  const { canManage } = useCampusPermissions();
  const [mode, setMode] = useState<"top_n" | "min_score">("top_n");
  const [value, setValue] = useState("100");
  const [proposal, setProposal] = useState<ProposalOut | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (!canManage) return <Body1>You need campus management permission to shortlist.</Body1>;

  const propose = async () => {
    const n = Number(value);
    if (!value.trim() || Number.isNaN(n) || n < 0 || (mode === "top_n" && !Number.isInteger(n))) {
      setError(mode === "top_n" ? "Enter a whole number of students." : "Enter a minimum score.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const out = await campusApi.propose(drive.id, { mode, value: value.trim() });
      setProposal(out);
      setSelected(new Set(out.items.map((i) => i.registration_id)));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const all = proposal ? proposal.items.length > 0 && selected.size === proposal.items.length : false;

  return (
    <div className={c.stack}>
      <Body1>A proposal changes nothing. Students are shortlisted only when a person confirms it.</Body1>
      <div className={c.row}>
        <Field label="Propose by">
          <RadioGroup layout="horizontal" value={mode} onChange={(_, d) => setMode(d.value as "top_n" | "min_score")}>
            <Radio value="top_n" label="Top N by score" />
            <Radio value="min_score" label="Minimum score" />
          </RadioGroup>
        </Field>
        <Field label={mode === "top_n" ? "Number of students" : "Minimum score"}>
          <Input type="number" min={0} value={value} onChange={(_, d) => setValue(d.value)} />
        </Field>
        <Button appearance="primary" disabled={busy} icon={busy ? <Spinner size="tiny" /> : undefined} onClick={() => void propose()}>
          Propose
        </Button>
      </div>
      {error && (
        <MessageBar intent="error" role="alert">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      {proposal && (
        <section className={c.stack} aria-label="Shortlist proposal">
          <Text aria-live="polite">
            {proposal.count} proposed{proposal.cutoff ? `, cut-off score ${proposal.cutoff}` : ""}.
            {proposal.ties > 0 ? ` ${proposal.ties} tied at the cut-off: review them before confirming.` : ""}
          </Text>
          <div className={c.tableWrap}>
            <Table aria-label="Proposed students" size="small" style={{ minWidth: 520 }}>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>
                    <Checkbox
                      aria-label="Select all"
                      checked={all ? true : selected.size ? "mixed" : false}
                      onChange={(_, d) => setSelected(d.checked ? new Set(proposal.items.map((i) => i.registration_id)) : new Set())}
                    />
                  </TableHeaderCell>
                  <TableHeaderCell>Student</TableHeaderCell>
                  <TableHeaderCell>Institution</TableHeaderCell>
                  <TableHeaderCell>Score</TableHeaderCell>
                  <TableHeaderCell>Tie</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposal.items.map((i) => (
                  <TableRow key={i.registration_id}>
                    <TableCell>
                      <Checkbox
                        aria-label={`Select ${i.candidate_name ?? "student"}`}
                        checked={selected.has(i.registration_id)}
                        onChange={(_, d) => toggle(i.registration_id, Boolean(d.checked))}
                      />
                    </TableCell>
                    <TableCell>{i.candidate_name ?? "—"}</TableCell>
                    <TableCell>{i.institution_name ?? "—"}</TableCell>
                    <TableCell className={c.num}>{i.score ?? "—"}</TableCell>
                    <TableCell>
                      {i.tie && (
                        <Badge appearance="tint" color="warning">
                          Tied at cut-off
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <Button appearance="primary" disabled={selected.size === 0} onClick={() => setConfirming(true)}>
              Confirm shortlist ({selected.size}) ★
            </Button>
          </div>
        </section>
      )}
      {confirming && proposal && (
        <ConfirmShortlistDialog
          drive={drive}
          ids={[...selected]}
          onClose={() => setConfirming(false)}
          onDone={() => {
            setProposal(null);
            setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}

function ConfirmShortlistDialog({ drive, ids, onClose, onDone }: { drive: DriveOut; ids: string[]; onClose: () => void; onDone: () => void }) {
  const c = useCampusStyles();
  const toast = useAppToast();
  const invalidate = useInvalidateDrive(drive.id);
  const [demandId, setDemandId] = useState<string>(drive.demands[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConfirmOut | null>(null);
  const failed = result?.results.filter((r) => r.error) ?? [];

  const submit = async () => {
    if (!demandId) {
      setError("Choose the Demand whose pipeline they join.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const out = await campusApi.confirm(drive.id, { registration_ids: ids, demand_id: demandId });
      setResult(out);
      await invalidate();
      onDone();
      toast.success(`${out.shortlisted} students shortlisted`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open modalType="alert" onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>
            Confirm shortlist <HumanOnly />
          </DialogTitle>
          <DialogContent className={c.stack}>
            {result ? (
              <div role="status" className={c.stack}>
                <Body1>{result.shortlisted} shortlisted and added to the pipeline.</Body1>
                {failed.length > 0 && (
                  <Text className={c.danger}>
                    {failed.length} not shortlisted: {failed.slice(0, 5).map((f) => f.error).join("; ")}
                  </Text>
                )}
              </div>
            ) : (
              <>
                <Body1>
                  Shortlist {ids.length} student{ids.length === 1 ? "" : "s"} and create their applications. This is a human-only
                  decision recorded in the audit log.
                </Body1>
                {drive.demands.length === 0 ? (
                  <MessageBar intent="warning">
                    <MessageBarBody>Link a Demand to the drive first.</MessageBarBody>
                  </MessageBar>
                ) : (
                  <Field label="Demand" required>
                    <Dropdown
                      value={drive.demands.find((d) => d.id === demandId)?.title ?? ""}
                      selectedOptions={[demandId]}
                      onOptionSelect={(_, d) => setDemandId(d.optionValue ?? "")}
                    >
                      {drive.demands.map((d) => (
                        <Option key={d.id} value={d.id}>
                          {d.title}
                        </Option>
                      ))}
                    </Dropdown>
                  </Field>
                )}
                {error && (
                  <MessageBar intent="error" role="alert">
                    <MessageBarBody>{error}</MessageBarBody>
                  </MessageBar>
                )}
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={onClose}>
              {result ? "Close" : "Cancel"}
            </Button>
            {!result && (
              <Button
                appearance="primary"
                disabled={busy || !demandId}
                icon={busy ? <Spinner size="tiny" /> : undefined}
                onClick={() => void submit()}
              >
                Confirm ★
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
