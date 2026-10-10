"use client";

/** Copilot composer (Epic 54 B2): Enter sends, Shift+Enter adds a newline; a counter after 3,500 characters. */
import { Button, Caption1, makeStyles, Textarea, Tooltip, tokens } from "@fluentui/react-components";
import { Send20Regular, Stop20Regular } from "@fluentui/react-icons";
import { forwardRef, useState } from "react";
import { COPY, COUNTER_FROM, MAX_QUESTION } from "./copy";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
  row: { display: "flex", alignItems: "flex-end", gap: tokens.spacingHorizontalS },
  input: { flex: 1, minWidth: 0 },
  counter: { alignSelf: "flex-end", color: tokens.colorNeutralForeground3 },
});

export interface ComposerProps {
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  /** Epic 77 (D-22, additive): the portal Copilots pass their own placeholder (default: the internal one). */
  placeholder?: string;
}

export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(function Composer(
  { onSend, onStop, streaming, disabled, placeholder = COPY.placeholder },
  ref,
) {
  const styles = useStyles();
  const [text, setText] = useState("");
  const send = () => {
    const value = text.trim();
    if (!value || streaming || disabled) return;
    onSend(value.slice(0, MAX_QUESTION));
    setText("");
  };
  return (
    <div className={styles.root}>
      <div className={styles.row}>
        <Textarea
          ref={ref}
          className={styles.input}
          aria-label={placeholder}
          placeholder={placeholder}
          value={text}
          maxLength={MAX_QUESTION}
          resize="vertical"
          disabled={disabled}
          onChange={(_, d) => setText(d.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        {streaming ? (
          <Tooltip content={COPY.stop} relationship="label">
            <Button icon={<Stop20Regular />} aria-label={COPY.stop} onClick={onStop} />
          </Tooltip>
        ) : (
          <Tooltip content={COPY.send} relationship="label">
            <Button
              appearance="primary"
              icon={<Send20Regular />}
              aria-label={COPY.send}
              disabled={disabled || !text.trim()}
              onClick={send}
            />
          </Tooltip>
        )}
      </div>
      {text.length > COUNTER_FROM ? (
        <Caption1 className={styles.counter} aria-live="polite">{`${text.length} / ${MAX_QUESTION}`}</Caption1>
      ) : null}
    </div>
  );
});
