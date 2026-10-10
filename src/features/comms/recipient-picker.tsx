"use client";

import {
  Avatar,
  Badge,
  Field,
  makeStyles,
  Tag,
  TagPicker,
  TagPickerControl,
  TagPickerGroup,
  TagPickerInput,
  TagPickerList,
  TagPickerOption,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import { Warning12Filled } from "@fluentui/react-icons";
import { useState } from "react";
import { addressRecipient, type ComposeRecipient, isBounced, isEmailAddress } from "./compose-model";

const useStyles = makeStyles({
  field: { flex: 1, minWidth: 0, gridTemplateColumns: "64px minmax(0, 1fr)" },
  control: { minHeight: "36px" },
  bounced: { marginInlineStart: tokens.spacingHorizontalXS },
  label: { minWidth: "48px", color: tokens.colorNeutralForeground2 },
});

/** Outlook-style people picker (To / Cc): chips with avatar, name and email; type an address to add it. */
export function RecipientPicker({
  label,
  value,
  onChange,
  suggestions,
  bounced,
  validationMessage,
  disabled,
}: {
  label: string;
  value: ComposeRecipient[];
  onChange: (next: ComposeRecipient[]) => void;
  suggestions: ComposeRecipient[];
  bounced: ReadonlySet<string>;
  validationMessage?: string;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const [query, setQuery] = useState("");
  const selectedKeys = value.map((r) => r.key);
  const q = query.trim().toLowerCase();
  const options = suggestions.filter(
    (s) =>
      !selectedKeys.includes(s.key) &&
      (!q || s.name.toLowerCase().includes(q) || (s.address ?? "").toLowerCase().includes(q)),
  );
  const typed = isEmailAddress(query) ? addressRecipient(query) : null;
  const showTyped = typed && !selectedKeys.includes(typed.key) && !options.some((o) => o.address?.toLowerCase() === q);

  const select = (key: string) => {
    if (selectedKeys.includes(key)) {
      onChange(value.filter((r) => r.key !== key));
      return;
    }
    const picked = suggestions.find((s) => s.key === key) ?? (typed && typed.key === key ? typed : null);
    if (picked) onChange([...value, picked]);
    setQuery("");
  };

  return (
    <Field
      label={label}
      orientation="horizontal"
      className={styles.field}
      validationState={validationMessage ? "error" : "none"}
      validationMessage={validationMessage}
    >
      <TagPicker
        selectedOptions={selectedKeys}
        onOptionSelect={(_, data) => select(String(data.value))}
        disabled={disabled}
        noPopover={options.length === 0 && !showTyped}
      >
        <TagPickerControl className={styles.control}>
          <TagPickerGroup aria-label={`${label} recipients`}>
            {value.map((r) => {
              const bad = isBounced(r, bounced);
              const tag = (
                <Tag
                  key={r.key}
                  value={r.key}
                  shape="circular"
                  media={<Avatar name={r.name} size={20} color="colorful" aria-hidden />}
                  secondaryText={r.address && r.address !== r.name ? r.address : undefined}
                >
                  {r.name}
                  {bad && (
                    <Badge
                      className={styles.bounced}
                      size="small"
                      color="warning"
                      appearance="filled"
                      icon={<Warning12Filled />}
                      aria-label="Bounced"
                    />
                  )}
                </Tag>
              );
              return bad ? (
                <Tooltip
                  key={r.key}
                  relationship="description"
                  content="Earlier mail to this address bounced. It may not be delivered."
                >
                  {tag}
                </Tooltip>
              ) : (
                tag
              );
            })}
          </TagPickerGroup>
          <TagPickerInput
            aria-label={label}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={value.length === 0 ? "Type a name or email address" : undefined}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === "," || e.key === ";") && typed && showTyped) {
                e.preventDefault();
                select(typed.key);
              }
            }}
          />
        </TagPickerControl>
        <TagPickerList>
          {options.map((o) => (
            <TagPickerOption
              key={o.key}
              value={o.key}
              text={o.name}
              media={<Avatar name={o.name} size={24} color="colorful" aria-hidden />}
              secondaryContent={o.address ?? "No email address"}
            >
              {o.name}
            </TagPickerOption>
          ))}
          {showTyped && typed && (
            <TagPickerOption key={typed.key} value={typed.key} text={typed.name} secondaryContent="Email address">
              {`Use ${typed.name}`}
            </TagPickerOption>
          )}
        </TagPickerList>
      </TagPicker>
    </Field>
  );
}
