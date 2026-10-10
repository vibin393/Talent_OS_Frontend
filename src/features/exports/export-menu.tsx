"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Link,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Spinner,
  Toast,
  ToastBody,
  ToastTitle,
  useToastController,
} from "@fluentui/react-components";
import { ArrowDownload20Regular, DocumentTable20Regular, TableSimple20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { APP_TOASTER_ID } from "@/components/toast";
import { type ExportKind, type ExportNotice, tooLargeMessage, useCanExport, useExport } from "./use-export";

function useExportToasts() {
  const { dispatchToast } = useToastController(APP_TOASTER_ID);
  const router = useRouter();
  return useCallback(
    (notice: ExportNotice) => {
      if (notice.kind === "queued") {
        dispatchToast(
          <Toast>
            <ToastTitle>{notice.text}</ToastTitle>
            <ToastBody>
              <Link
                href="/exports"
                onClick={(e) => {
                  e.preventDefault();
                  router.push("/exports");
                }}
              >
                View my exports
              </Link>
            </ToastBody>
          </Toast>,
          { intent: "info", timeout: 8000 },
        );
        return;
      }
      dispatchToast(
        <Toast>
          <ToastTitle>{notice.text}</ToastTitle>
        </Toast>,
        { intent: notice.kind, politeness: notice.kind === "error" ? "assertive" : "polite" },
      );
    },
    [dispatchToast, router],
  );
}

/**
 * "Export" menu for list views: Excel (.xlsx) or CSV of the current filters and visible columns.
 * Shown only with `report:export` and the kind's read permission.
 */
export function ExportMenu({
  kind,
  filters,
  columns,
  disabled,
}: {
  kind: ExportKind;
  /** The list's current filters, in the backend filter model's names. */
  filters: Record<string, unknown>;
  /** Visible column keys (omit for the kind's default export columns). */
  columns?: string[];
  disabled?: boolean;
}) {
  const allowed = useCanExport(kind);
  const notify = useExportToasts();
  const { run, pending, tooLarge, dismissTooLarge } = useExport(notify);
  if (!allowed) return null;
  return (
    <>
      <Menu>
        <MenuTrigger disableButtonEnhancement>
          <MenuButton
            icon={pending ? <Spinner size="extra-tiny" /> : <ArrowDownload20Regular />}
            disabled={disabled || pending}
            appearance="subtle"
          >
            Export
          </MenuButton>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            <MenuItem icon={<DocumentTable20Regular />} onClick={() => run(kind, "xlsx", filters, columns)}>
              Export to Excel (.xlsx)
            </MenuItem>
            <MenuItem icon={<TableSimple20Regular />} onClick={() => run(kind, "csv", filters, columns)}>
              Export to CSV
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>
      <Dialog open={!!tooLarge} onOpenChange={(_, d) => !d.open && dismissTooLarge()}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Too many rows to export</DialogTitle>
            <DialogContent>{tooLarge ? tooLargeMessage(tooLarge.rowCount, tooLarge.max) : null}</DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={dismissTooLarge}>
                OK
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
