"use client";

import { Button, Menu, MenuItem, MenuList, MenuPopover, MenuTrigger } from "@fluentui/react-components";
import { MoreHorizontal20Regular, PeopleAdd20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { usePermission } from "@/features/auth/use-permission";
import { AddToPoolDialog } from "./pool-dialogs";

/** Candidate 360 overflow `Menu` with "Add to Pool" (Epic 38). Renders nothing without `pool:write`. */
export function CandidatePoolMenu({ candidateId, disabled }: { candidateId: string; disabled?: boolean }) {
  const canWrite = usePermission("pool:write");
  const [open, setOpen] = useState(false);
  if (!canWrite) return null;
  return (
    <>
      <Menu positioning={{ position: "below", align: "end" }}>
        <MenuTrigger disableButtonEnhancement>
          <Button icon={<MoreHorizontal20Regular />} aria-label="More actions" disabled={disabled} />
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            <MenuItem icon={<PeopleAdd20Regular />} onClick={() => setOpen(true)}>
              Add to Pool
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>
      {open && <AddToPoolDialog candidateIds={[candidateId]} onClose={() => setOpen(false)} />}
    </>
  );
}
