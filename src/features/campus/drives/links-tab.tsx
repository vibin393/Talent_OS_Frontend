"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Input,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Switch,
  Text,
} from "@fluentui/react-components";
import { ArrowDownload20Regular, Copy20Regular } from "@fluentui/react-icons";
import { useAppToast } from "@/components/toast";
import { errorMessage } from "@/lib/api/errors";
import { campusApi } from "../api";
import { formatDate } from "../logic";
import type { DriveInstitutionOut, DriveOut } from "../types";
import { useCampusStyles } from "../ui";
import { useCampusPermissions, useDriveMutation } from "../use-campus";

/** Links & QR: one registration link and QR poster per Institution. */
export function LinksTab({ drive }: { drive: DriveOut }) {
  const c = useCampusStyles();
  if (drive.institutions.length === 0) return <Body1>Add Institutions to the drive to get their links.</Body1>;
  return (
    <div className={c.stack}>
      <Body1>Share each Institution&apos;s link with its placement officer, or print the QR poster for the notice board.</Body1>
      {drive.institutions.map((i) => (
        <LinkCard key={i.id} drive={drive} di={i} />
      ))}
    </div>
  );
}

function LinkCard({ drive, di }: { drive: DriveOut; di: DriveInstitutionOut }) {
  const c = useCampusStyles();
  const toast = useAppToast();
  const { canManage } = useCampusPermissions();
  const toggle = useDriveMutation((status: "active" | "paused") => campusApi.updateDriveInstitution(drive.id, di.id, { status }));
  const copy = async () => {
    if (!di.registration_url) return;
    try {
      await navigator.clipboard.writeText(di.registration_url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy. Select the link and copy it manually.");
    }
  };
  const download = async (format: "png" | "svg" | "pdf") => {
    try {
      await campusApi.downloadQr(drive.id, di.id, format);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <section className={c.card} aria-label={di.institution_name}>
      <div className={c.row}>
        <Text weight="semibold" className={c.grow}>
          {di.institution_name}
        </Text>
        <Badge appearance="tint" color={di.link_active && di.status === "active" ? "success" : "subtle"}>
          {di.link_active ? (di.status === "active" ? "Link active" : "Paused") : "Not active"}
        </Badge>
        <Text className={c.num}>{di.registration_count.toLocaleString()} registered</Text>
      </div>
      {di.registration_url ? (
        <div className={c.row}>
          <Input readOnly value={di.registration_url} aria-label={`Registration link for ${di.institution_name}`} className={c.grow} style={{ minWidth: 200 }} />
          <Button icon={<Copy20Regular />} onClick={() => void copy()}>
            Copy
          </Button>
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button icon={<ArrowDownload20Regular />} disabled={!di.has_qr}>
                QR poster
              </Button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem onClick={() => void download("png")}>PNG image</MenuItem>
                <MenuItem onClick={() => void download("svg")}>SVG image</MenuItem>
                <MenuItem onClick={() => void download("pdf")}>PDF poster</MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        </div>
      ) : (
        <Caption1 className={c.muted}>The link is created when registration opens.</Caption1>
      )}
      <div className={c.row}>
        <Caption1 className={c.muted}>
          {di.link_expires_at ? `Expires ${formatDate(di.link_expires_at)}` : ""}
          {di.registration_cap ? ` · Cap ${di.registration_cap.toLocaleString()}` : ""}
        </Caption1>
        <span className={c.grow} />
        {canManage && (
          <Switch
            label="Accept registrations"
            checked={di.status === "active"}
            disabled={toggle.isPending}
            onChange={(_, d) => toggle.mutate(d.checked ? "active" : "paused", { onError: (e) => toast.error(errorMessage(e)) })}
          />
        )}
      </div>
    </section>
  );
}
