"use client";

import {
  Button,
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
  MessageBar,
  MessageBarBody,
  Option,
  Radio,
  RadioGroup,
  SpinButton,
  Switch,
  type TableColumnDefinition,
  Tag,
  TagPicker,
  TagPickerControl,
  TagPickerGroup,
  TagPickerInput,
  TagPickerList,
  TagPickerOption,
  Textarea,
  Toolbar,
} from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import { useMemo, useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { EMPTY_VENDOR_FILTERS } from "./api";
import { formatDateTime, formatDecimalMoney } from "./format";
import type { ReleaseOut, VendorTier } from "./types";
import { SimpleGrid } from "./ui";
import { useDemandReleases, useVendorMutations, useVendors } from "./use-vendors";

const TIERS: VendorTier[] = ["gold", "silver", "bronze", "custom"];

/** Demand page "Vendor releases" tab: releases table (pause / resume / withdraw) and the release dialog. */
export function DemandVendorReleases({ demandId, demandStatus }: { demandId: string; demandStatus: string }) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const canRelease = usePermission("vendor:release");
  const list = useDemandReleases(demandId);
  const { releaseAction } = useVendorMutations();
  const [open, setOpen] = useState(false);

  const act = async (r: ReleaseOut, action: "pause" | "resume" | "withdraw") => {
    try {
      await releaseAction.mutateAsync({ id: r.id, action });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const columns: TableColumnDefinition<ReleaseOut>[] = [
    createTableColumn({ columnId: "vendor", renderHeaderCell: () => "Vendor", renderCell: (r) => r.vendor_name ?? r.vendor_id }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (r) => r.status + (r.paused_by_system ? " (system)" : "") }),
    createTableColumn({
      columnId: "max",
      renderHeaderCell: () => "Max rate",
      renderCell: (r) => (r.max_vendor_rate ? `${formatDecimalMoney(r.max_vendor_rate, r.currency)} / ${r.rate_unit ?? ""}` : "—"),
    }),
    createTableColumn({
      columnId: "used",
      renderHeaderCell: () => "Submissions",
      renderCell: (r) => `${r.submissions_count}${r.submission_limit ? ` / ${r.submission_limit}` : ""}`,
    }),
    createTableColumn({ columnId: "deadline", renderHeaderCell: () => "Deadline", renderCell: (r) => formatDateTime(r.deadline_at) }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (r) =>
        canRelease && (r.status === "active" || r.status === "paused") ? (
          <span className={admin.badges}>
            {r.status === "active" ? (
              <Button size="small" onClick={() => act(r, "pause")}>
                Pause
              </Button>
            ) : (
              <Button size="small" onClick={() => act(r, "resume")}>
                Resume
              </Button>
            )}
            <Button size="small" onClick={() => act(r, "withdraw")}>
              Withdraw
            </Button>
          </span>
        ) : null,
    }),
  ];

  return (
    <>
      {canRelease && (
        <Toolbar className={admin.toolbar}>
          <Button appearance="primary" icon={<Add20Regular />} disabled={demandStatus !== "open"} onClick={() => setOpen(true)}>
            Release to vendors
          </Button>
        </Toolbar>
      )}
      {demandStatus !== "open" && (
        <MessageBar intent="info">
          <MessageBarBody>Only an open demand can be released to vendors.</MessageBarBody>
        </MessageBar>
      )}
      <ErrorBar message={list.error ? errorMessage(list.error) : null} />
      <div className={admin.surface}>
        {list.isLoading ? (
          <GridSkeleton rows={3} />
        ) : !list.data?.length ? (
          <div className={admin.empty}>Not released to any vendor yet.</div>
        ) : (
          <SimpleGrid items={list.data} columns={columns} />
        )}
      </div>
      {open && <ReleaseDialog demandId={demandId} onClose={() => setOpen(false)} />}
    </>
  );
}

function ReleaseDialog({ demandId, onClose }: { demandId: string; onClose: () => void }) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const vendors = useVendors({ ...EMPTY_VENDOR_FILTERS, status: "active" });
  const { release } = useVendorMutations();
  const [by, setBy] = useState<"vendors" | "tier">("vendors");
  const [selected, setSelected] = useState<string[]>([]);
  const [tier, setTier] = useState<VendorTier>("gold");
  const [reveal, setReveal] = useState(false);
  const [maxRate, setMaxRate] = useState("");
  const [limit, setLimit] = useState<number | null>(3);
  const [deadline, setDeadline] = useState("");
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const names = useMemo(() => new Map((vendors.data ?? []).map((v) => [v.id, v.legal_name])), [vendors.data]);
  const rateInvalid = maxRate !== "" && !/^\d{1,10}(\.\d{1,4})?$/.test(maxRate);

  const submit = async () => {
    setError(null);
    try {
      const out = await release.mutateAsync({
        demandId,
        body: {
          vendor_ids: by === "vendors" ? selected : [],
          tier: by === "tier" ? tier : null,
          reveal_client: reveal,
          max_vendor_rate: maxRate || null,
          submission_limit: limit,
          deadline_at: deadline ? new Date(`${deadline}T23:59:59`).toISOString() : null,
          instructions: instructions.trim() || null,
        },
      });
      const released = out.items.filter((i) => i.status === "released").length;
      const skipped = out.items.length - released;
      toast.success(`Released to ${released} vendor(s)${skipped ? `, ${skipped} skipped` : ""}`);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Release to vendors</DialogTitle>
          <DialogContent className={admin.form}>
            <ErrorBar message={error} />
            <RadioGroup layout="horizontal" value={by} onChange={(_, d) => setBy(d.value as "vendors" | "tier")}>
              <Radio value="vendors" label="Choose vendors" />
              <Radio value="tier" label="Whole tier" />
            </RadioGroup>
            {by === "vendors" ? (
              <Field label="Vendors (active only)" required>
                <TagPicker selectedOptions={selected} onOptionSelect={(_, d) => setSelected(d.selectedOptions)}>
                  <TagPickerControl>
                    <TagPickerGroup aria-label="Selected vendors">
                      {selected.map((id) => (
                        <Tag key={id} value={id} shape="rounded">
                          {names.get(id) ?? id}
                        </Tag>
                      ))}
                    </TagPickerGroup>
                    <TagPickerInput aria-label="Choose vendors" />
                  </TagPickerControl>
                  <TagPickerList>
                    {(vendors.data ?? [])
                      .filter((v) => !selected.includes(v.id))
                      .map((v) => (
                        <TagPickerOption key={v.id} value={v.id}>
                          {v.legal_name}
                        </TagPickerOption>
                      ))}
                  </TagPickerList>
                </TagPicker>
              </Field>
            ) : (
              <Field label="Tier">
                <Dropdown value={tier} selectedOptions={[tier]} onOptionSelect={(_, d) => setTier(d.optionValue as VendorTier)}>
                  {TIERS.map((t) => (
                    <Option key={t} value={t}>
                      {t}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
            )}
            <Switch checked={reveal} onChange={(_, d) => setReveal(d.checked)} label="Reveal the client name to vendors" />
            <Field label="Maximum vendor rate" validationMessage={rateInvalid ? "Enter an amount like 1350 or 1350.50" : undefined}>
              <Input value={maxRate} onChange={(_, d) => setMaxRate(d.value)} inputMode="decimal" />
            </Field>
            <Field label="Submission limit per vendor">
              <SpinButton value={limit} min={1} max={1000} onChange={(_, d) => setLimit(d.value ?? (d.displayValue ? Number(d.displayValue) : null))} />
            </Field>
            <Field label="Deadline">
              <Input type="date" value={deadline} onChange={(_, d) => setDeadline(d.value)} />
            </Field>
            <Field label="Instructions for vendors">
              <Textarea value={instructions} onChange={(_, d) => setInstructions(d.value)} maxLength={5000} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              appearance="primary"
              disabled={rateInvalid || release.isPending || (by === "vendors" && selected.length === 0)}
              onClick={submit}
            >
              Release
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
