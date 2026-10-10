"use client";

import {
  Button,
  Dropdown,
  Field,
  Input,
  Option,
  SearchBox,
  Spinner,
  Tab,
  TabList,
  Toolbar,
} from "@fluentui/react-components";
import { Add20Regular, Board20Regular, TextBulletListLtr20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { PersonPicker } from "@/features/activity/person-picker";
import { DetailsDrawer, ErrorBar, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { ClientPicker } from "@/features/demands/client-picker";
import { errorMessage } from "@/lib/api/errors";
import { EMPTY_OPPORTUNITY_FILTERS, type OpportunityFilters } from "../api";
import { SERVICE_LABELS, SERVICES, STAGE_LABELS, STAGES } from "../format";
import type { OpportunityStage, Service } from "../types";
import { useOpportunityMutations } from "../use-opportunity-board";
import { OpportunityBoard } from "./board";
import { OpportunityList } from "./opportunity-list";

const ALL = "__all__";

function NewOpportunityDrawer({ onClose }: { onClose: () => void }) {
  const admin = useAdminStyles();
  const router = useRouter();
  const toast = useAppToast();
  const { create } = useOpportunityMutations();
  const [name, setName] = useState("");
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [service, setService] = useState<Service>("contract_staffing");
  const [revenue, setRevenue] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [close, setClose] = useState("");
  const [error, setError] = useState<string | null>(null);
  const valid = name.trim() && client && (!revenue.trim() || /^\d+(\.\d{1,2})?$/.test(revenue.trim()));

  async function save() {
    if (!valid || !client) return;
    setError(null);
    try {
      const o = await create.mutateAsync({
        name: name.trim(),
        client_id: client.id,
        service,
        estimated_revenue: revenue.trim() || "0",
        currency: currency || null,
        expected_close_date: close || null,
      });
      toast.success(`Created ${o.human_id}`);
      onClose();
      router.push(`/opportunities/${o.id}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <DetailsDrawer
      open
      title="New opportunity"
      onClose={onClose}
      footer={
        <div className={admin.footer}>
          <Button appearance="primary" disabled={!valid || create.isPending} icon={create.isPending ? <Spinner size="tiny" /> : undefined} onClick={save}>
            Create opportunity
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      }
    >
      <div className={admin.form}>
        {error && <ErrorBar message={error} />}
        <Field label="Name" required>
          <Input value={name} maxLength={300} onChange={(_, d) => setName(d.value)} />
        </Field>
        <ClientPicker value={client?.id ?? null} valueLabel={client?.name} required onChange={setClient} />
        <Field label="Service">
          <Dropdown value={SERVICE_LABELS[service]} selectedOptions={[service]} onOptionSelect={(_, d) => d.optionValue && setService(d.optionValue as Service)}>
            {SERVICES.map((s) => (
              <Option key={s} value={s}>
                {SERVICE_LABELS[s]}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Estimated revenue">
          <Input inputMode="decimal" value={revenue} onChange={(_, d) => setRevenue(d.value)} />
        </Field>
        <Field label="Currency">
          <Input value={currency} maxLength={3} onChange={(_, d) => setCurrency(d.value.toUpperCase())} />
        </Field>
        <Field label="Expected close date">
          <Input type="date" value={close} onChange={(_, d) => setClose(d.value)} />
        </Field>
      </div>
    </DetailsDrawer>
  );
}

/** `/opportunities`: Board / List toggle with shared filters. */
export function OpportunitiesView({ initialFilters, initialView }: { initialFilters?: OpportunityFilters; initialView?: "board" | "list" }) {
  const styles = useAdminStyles();
  const canRead = usePermission("opportunity:read");
  const canWrite = usePermission("opportunity:write");
  const [view, setView] = useState<"board" | "list">(initialView ?? "board");
  const [filters, setFilters] = useState<OpportunityFilters>(initialFilters ?? EMPTY_OPPORTUNITY_FILTERS);
  const [ownerLabel, setOwnerLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const deferred = useDeferredValue(filters);
  if (!canRead) return <NoAccess what="opportunities" />;
  const update = (p: Partial<OpportunityFilters>) => setFilters((f) => ({ ...f, ...p }));
  const filtered = JSON.stringify(filters) !== JSON.stringify(EMPTY_OPPORTUNITY_FILTERS);

  return (
    <>
      <PageHeader title="Opportunities" subtitle="Your sales pipeline by stage, with estimated and weighted revenue." />
      <Toolbar aria-label="Opportunity filters" className={styles.toolbar}>
        {canWrite && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
            New opportunity
          </Button>
        )}
        <TabList selectedValue={view} onTabSelect={(_, d) => setView(d.value as "board" | "list")} aria-label="View">
          <Tab value="board" icon={<Board20Regular />}>
            Board
          </Tab>
          <Tab value="list" icon={<TextBulletListLtr20Regular />}>
            List
          </Tab>
        </TabList>
        <SearchBox className={styles.search} placeholder="Search opportunities" aria-label="Search opportunities" value={filters.q} onChange={(_, d) => update({ q: d.value })} />
        {view === "list" && (
          <Field label="Stage" className={styles.filter}>
            <Dropdown
              value={filters.stage ? STAGE_LABELS[filters.stage] : "All"}
              selectedOptions={[filters.stage ?? ALL]}
              onOptionSelect={(_, d) => update({ stage: d.optionValue === ALL ? null : (d.optionValue as OpportunityStage) })}
            >
              <Option value={ALL}>All</Option>
              {STAGES.map((s) => (
                <Option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </Option>
              ))}
            </Dropdown>
          </Field>
        )}
        <Field label="Service" className={styles.filter}>
          <Dropdown
            value={filters.service ? SERVICE_LABELS[filters.service] : "All"}
            selectedOptions={[filters.service ?? ALL]}
            onOptionSelect={(_, d) => update({ service: d.optionValue === ALL ? null : (d.optionValue as Service) })}
          >
            <Option value={ALL}>All</Option>
            {SERVICES.map((s) => (
              <Option key={s} value={s}>
                {SERVICE_LABELS[s]}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <PersonPicker
          className={styles.filter}
          label="Owner"
          value={filters.ownerId}
          valueLabel={filters.ownerId ? ownerLabel : ""}
          placeholder="Anyone"
          clearLabel="Anyone"
          unavailableHint=""
          onChange={(p) => {
            setOwnerLabel(p?.name ?? "");
            update({ ownerId: p?.id ?? null });
          }}
        />
        <Field label="Close from" className={styles.filter}>
          <Input type="date" value={filters.closeFrom ?? ""} onChange={(_, d) => update({ closeFrom: d.value || null })} />
        </Field>
        <Field label="Close to" className={styles.filter}>
          <Input type="date" value={filters.closeTo ?? ""} onChange={(_, d) => update({ closeTo: d.value || null })} />
        </Field>
        {filtered && (
          <Button
            appearance="subtle"
            onClick={() => {
              setOwnerLabel("");
              setFilters(EMPTY_OPPORTUNITY_FILTERS);
            }}
          >
            Clear filters
          </Button>
        )}
      </Toolbar>
      {view === "board" ? <OpportunityBoard filters={deferred} /> : <OpportunityList filters={deferred} />}
      {creating && <NewOpportunityDrawer onClose={() => setCreating(false)} />}
    </>
  );
}
