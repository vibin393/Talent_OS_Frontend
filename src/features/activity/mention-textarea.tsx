"use client";

import {
  Avatar,
  Button,
  Field,
  makeStyles,
  mergeClasses,
  Spinner,
  Text,
  Textarea,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { Mention20Regular } from "@fluentui/react-icons";
import { useId, useRef, useState } from "react";
import { insertMention, type Mention, mentionQueryAt } from "./mentions";
import { usePeopleSearch } from "./people";

const useStyles = makeStyles({
  root: { position: "relative", display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  textarea: { width: "100%" },
  list: {
    position: "absolute",
    top: "100%",
    left: 0,
    zIndex: 10,
    marginTop: tokens.spacingVerticalXXS,
    width: "min(360px, 100%)",
    maxHeight: "260px",
    overflowY: "auto",
    padding: tokens.spacingVerticalXS,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow16,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorTransparentStroke}`,
  },
  option: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    borderRadius: tokens.borderRadiusMedium,
    cursor: "pointer",
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
  },
  active: { backgroundColor: tokens.colorNeutralBackground1Selected },
  optionText: { display: "flex", flexDirection: "column", minWidth: 0 },
  secondary: { color: tokens.colorNeutralForeground3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  empty: { padding: tokens.spacingHorizontalS, color: tokens.colorNeutralForeground3 },
  toolbar: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS },
});

/**
 * Plain-text `Textarea` with an @mention people picker: typing `@` (or pressing the mention button) opens
 * a suggestion list filtered by what follows; ↑/↓ + Enter/Tab pick, Esc closes. Picked people are
 * inserted as `@Name` and reported in `mentions` (turn into markup with `toMarkup`).
 */
export function MentionTextarea({
  label,
  value,
  mentions,
  onChange,
  placeholder,
  disabled,
  validationMessage,
  autoFocus,
  maxLength = 20000,
}: {
  label: string;
  value: string;
  mentions: readonly Mention[];
  onChange: (value: string, mentions: Mention[]) => void;
  placeholder?: string;
  disabled?: boolean;
  validationMessage?: string;
  autoFocus?: boolean;
  maxLength?: number;
}) {
  const styles = useStyles();
  const listId = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<{ start: number; query: string } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const people = usePeopleSearch(query?.query ?? "", query !== null && !disabled);
  const open = query !== null && people.available;
  const options = people.people;
  const active = Math.min(activeIndex, Math.max(0, options.length - 1));

  function sync(text: string, caret: number) {
    const q = mentionQueryAt(text, caret);
    setQuery(q);
    if (q?.query !== query?.query) setActiveIndex(0);
  }

  function pick(index: number) {
    const person = options[index];
    const el = ref.current;
    if (!person || !query) return;
    const caret = el?.selectionStart ?? value.length;
    const next = insertMention(value, query.start, caret, person.name);
    const nextMentions = mentions.some((m) => m.id === person.id && m.name === person.name)
      ? [...mentions]
      : [...mentions, { id: person.id, name: person.name }];
    onChange(next.text, nextMentions);
    setQuery(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.caret, next.caret);
    });
  }

  function startMention() {
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const needsSpace = caret > 0 && !/\s/.test(value[caret - 1] ?? "");
    const token = needsSpace ? " @" : "@";
    const text = value.slice(0, caret) + token + value.slice(caret);
    onChange(text, [...mentions]);
    const at = caret + token.length;
    setQuery({ start: at - 1, query: "" });
    setActiveIndex(0);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at, at);
    });
  }

  const activeId = open && options.length > 0 ? `${listId}-opt-${active}` : undefined;

  return (
    <div className={styles.root}>
      <Field label={label} validationState={validationMessage ? "error" : "none"} validationMessage={validationMessage}>
        <Textarea
          ref={ref}
          className={styles.textarea}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          resize="vertical"
          rows={3}
          maxLength={maxLength}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={activeId}
          onChange={(e, d) => {
            onChange(d.value, [...mentions]);
            sync(d.value, e.target.selectionStart ?? d.value.length);
          }}
          onSelect={(e) => {
            const t = e.currentTarget;
            if (t.selectionStart === t.selectionEnd) sync(t.value, t.selectionStart);
            else setQuery(null);
          }}
          onBlur={() => setTimeout(() => setQuery(null), 150)}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              setQuery(null);
            } else if (e.key === "ArrowDown" && options.length) {
              e.preventDefault();
              setActiveIndex((active + 1) % options.length);
            } else if (e.key === "ArrowUp" && options.length) {
              e.preventDefault();
              setActiveIndex((active - 1 + options.length) % options.length);
            } else if ((e.key === "Enter" || e.key === "Tab") && options.length) {
              e.preventDefault();
              pick(active);
            }
          }}
        />
      </Field>
      {open && (
        <div id={listId} role="listbox" aria-label="People" className={styles.list}>
          {options.map((p, i) => (
            <div
              key={p.id}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={mergeClasses(styles.option, i === active && styles.active)}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => pick(i)}
            >
              <Avatar name={p.name} size={24} color="colorful" aria-hidden />
              <span className={styles.optionText}>
                <Text size={300}>{p.name}</Text>
                {p.secondary && (
                  <Text size={200} className={styles.secondary}>
                    {p.secondary}
                  </Text>
                )}
              </span>
            </div>
          ))}
          {options.length === 0 &&
            (people.loading ? (
              <div className={styles.empty}>
                <Spinner size="extra-tiny" label="Searching people" />
              </div>
            ) : (
              <div className={styles.empty}>No matching people</div>
            ))}
        </div>
      )}
      <div className={styles.toolbar}>
        <Tooltip
          content={people.available ? "Mention someone" : "Mentions need access to the user or team directory"}
          relationship="label"
        >
          <Button
            appearance="subtle"
            size="small"
            icon={<Mention20Regular />}
            disabled={disabled || !people.available}
            onClick={startMention}
          />
        </Tooltip>
        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
          {people.available ? "Type @ to mention a colleague" : ""}
        </Text>
      </div>
    </div>
  );
}
