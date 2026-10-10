"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Option,
} from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBar } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { placementsApi } from "@/features/placements/api";
import { CandidatePicker, candidateLabel } from "@/features/privacy/candidate-picker";
import { errorMessage } from "@/lib/api/errors";
import { bgvApi, bgvKeys } from "./api";

const NONE = "__none__";

/** "New BGV case" button + dialog (``bgv:manage``): pick a package and, unless fixed by the caller, a candidate and
 * an optional placement of theirs. Hidden without ``bgv:manage``. */
export function NewBgvCaseButton({ candidateId, placementId }: { candidateId?: string; placementId?: string }) {
  const canManage = usePermission("bgv:manage");
  const [open, setOpen] = useState(false);
  if (!canManage) return null;
  return (
    <>
      <Button icon={<Add20Regular />} onClick={() => setOpen(true)}>
        New BGV case
      </Button>
      {open && <NewBgvCaseDialog candidateId={candidateId} placementId={placementId} onClose={() => setOpen(false)} />}
    </>
  );
}

function NewBgvCaseDialog({
  candidateId: fixedCandidate,
  placementId: fixedPlacement,
  onClose,
}: {
  candidateId?: string;
  placementId?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [candidate, setCandidate] = useState<{ id: string; label: string; name: string } | null>(null);
  const [packageId, setPackageId] = useState("");
  const [placementId, setPlacementId] = useState("");
  const candidateId = fixedCandidate ?? candidate?.id ?? null;
  const packages = useQuery({ queryKey: bgvKeys.packages, queryFn: ({ signal }) => bgvApi.packages(false, signal) });
  // Placements of the picked candidate (only when the caller did not fix the placement).
  const placements = useQuery({
    queryKey: ["placements", "list", { q: candidate?.name, bgvPicker: candidate?.id }],
    queryFn: ({ signal }) => placementsApi.list({ q: candidate?.name, page_size: 50 }, signal),
    enabled: !fixedPlacement && !fixedCandidate && !!candidate,
    select: (page) => page.items.filter((p) => p.candidate_id === candidate?.id),
  });
  const create = useMutation({
    mutationFn: () =>
      bgvApi.createCase(candidateId as string, {
        package_id: packageId,
        placement_id: fixedPlacement ?? (placementId || null),
      }),
    onSuccess: async (out) => {
      await queryClient.invalidateQueries({ queryKey: ["bgv"] });
      onClose();
      router.push(`/bgv/${out.id}`);
    },
  });
  const pkgs = (packages.data ?? []).filter((p) => !p.archived_at);
  const pkgName = pkgs.find((p) => p.id === packageId)?.name ?? "";
  const placementLabel = (id: string) => {
    const p = placements.data?.find((x) => x.id === id);
    return p ? `${p.human_id}${p.client_name ? ` · ${p.client_name}` : ""}` : "";
  };
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !create.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>New BGV case</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {create.error ? <ErrorBar message={errorMessage(create.error)} /> : null}
            {packages.error ? <ErrorBar message={errorMessage(packages.error)} /> : null}
            {!fixedCandidate && (
              <CandidatePicker
                label="Candidate"
                required
                value={candidate?.id ?? null}
                valueLabel={candidate?.label}
                onChange={(id, c) => {
                  setCandidate(id && c ? { id, label: candidateLabel(c), name: c.full_name } : null);
                  setPlacementId("");
                }}
              />
            )}
            <Field label="Package" required hint={packages.isSuccess && pkgs.length === 0 ? "No BGV packages yet: create one in Admin > BGV." : undefined}>
              <Dropdown
                placeholder="Choose a package"
                value={pkgName}
                selectedOptions={packageId ? [packageId] : []}
                onOptionSelect={(_, d) => setPackageId(String(d.optionValue ?? ""))}
              >
                {pkgs.map((p) => (
                  <Option key={p.id} value={p.id}>
                    {p.name}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            {!fixedPlacement && !fixedCandidate && (
              <Field label="Placement" hint="Optional: tie the case to one of the candidate's placements">
                <Dropdown
                  disabled={!candidate}
                  placeholder="None (ad hoc)"
                  value={placementId ? placementLabel(placementId) : ""}
                  selectedOptions={[placementId || NONE]}
                  onOptionSelect={(_, d) => setPlacementId(d.optionValue === NONE ? "" : String(d.optionValue ?? ""))}
                >
                  <Option value={NONE}>None (ad hoc)</Option>
                  {(placements.data ?? []).map((p) => (
                    <Option key={p.id} value={p.id} text={placementLabel(p.id)}>
                      {placementLabel(p.id)}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={!candidateId || !packageId || create.isPending} onClick={() => create.mutate()}>
              Create case
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
