"use client";

import {
  makeStyles,
  MenuGroup,
  MenuGroupHeader,
  MenuItem,
  MenuList,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  SearchBox,
  Spinner,
  Text,
  ToolbarButton,
  tokens,
} from "@fluentui/react-components";
import { ChevronDown16Regular } from "@fluentui/react-icons";
import { useState } from "react";

const useStyles = makeStyles({
  surface: { padding: tokens.spacingVerticalS, width: "320px", maxWidth: "calc(100vw - 32px)" },
  list: { maxHeight: "320px", overflowY: "auto", marginTop: tokens.spacingVerticalS },
  empty: { padding: tokens.spacingHorizontalM, color: tokens.colorNeutralForeground3 },
  secondary: { color: tokens.colorNeutralForeground3 },
});

export type PickerItem = { value: string; label: string; secondary?: string };
export type PickerGroup = { key: string; label: string; items: PickerItem[] };

/** Command-bar button opening a searchable, grouped list (Insert template / Insert field). */
export function SearchablePicker({
  label,
  icon,
  groups,
  loading,
  onPick,
  searchPlaceholder,
  emptyText,
  disabled,
}: {
  label: string;
  icon: React.ReactElement;
  groups: PickerGroup[];
  loading?: boolean;
  onPick: (value: string) => void;
  searchPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const filtered = groups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i) => !needle || i.label.toLowerCase().includes(needle) || (i.secondary ?? "").toLowerCase().includes(needle),
      ),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <Popover
      open={open}
      onOpenChange={(_, d) => {
        setOpen(d.open);
        if (!d.open) setQ("");
      }}
      positioning="below-start"
      trapFocus
    >
      <PopoverTrigger disableButtonEnhancement>
        <ToolbarButton icon={icon} disabled={disabled}>
          {label} <ChevronDown16Regular aria-hidden style={{ marginInlineStart: 4 }} />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverSurface className={styles.surface} aria-label={label}>
        <SearchBox
          size="small"
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          value={q}
          onChange={(_, d) => setQ(d.value)}
          style={{ width: "100%", maxWidth: "100%" }}
        />
        <div className={styles.list}>
          {loading ? (
            <Spinner size="tiny" label="Loading" />
          ) : filtered.length === 0 ? (
            <Text className={styles.empty} as="p">
              {emptyText}
            </Text>
          ) : (
            <MenuList aria-label={label}>
              {filtered.map((g) => (
                <MenuGroup key={g.key}>
                  <MenuGroupHeader>{g.label}</MenuGroupHeader>
                  {g.items.map((i) => (
                    <MenuItem
                      key={i.value}
                      secondaryContent={i.secondary}
                      onClick={() => {
                        onPick(i.value);
                        setOpen(false);
                        setQ("");
                      }}
                    >
                      {i.label}
                    </MenuItem>
                  ))}
                </MenuGroup>
              ))}
            </MenuList>
          )}
        </div>
      </PopoverSurface>
    </Popover>
  );
}
