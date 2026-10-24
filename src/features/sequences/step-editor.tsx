"use client";

import {
  Badge,
  Button,
  Card,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarBody,
  Option,
  Radio,
  RadioGroup,
  SpinButton,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, ArrowDown20Regular, ArrowUp20Regular, Delete20Regular } from "@fluentui/react-icons";
import { EmailContentEditor } from "@/features/campaigns/email-content-editor";
import { CHANNEL_LABELS } from "@/features/campaigns/logic";
import { OptionCombobox } from "@/features/campaigns/option-combobox";
import type { Channel, MarketingOptionsOut } from "@/features/campaigns/types";
import {
  addStep,
  BRANCH_ON_LABELS,
  branchTargets,
  MAX_STEPS,
  moveStep,
  removeStep,
  STEP_KIND_LABELS,
  stepSummary,
  validateSteps,
  WAIT_MAX_DAYS,
  WAIT_MIN_DAYS,
} from "./logic";
import type { BranchOn, StepConfigByKind, StepDraft, StepKind } from "./types";

const useStyles = makeStyles({
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  step: { padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalM },
  head: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  num: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground2,
    fontWeight: tokens.fontWeightSemibold,
    flexShrink: 0,
  },
  grow: { flex: 1, minWidth: 0 },
  row: { display: "flex", gap: tokens.spacingHorizontalL, flexWrap: "wrap", alignItems: "flex-start" },
  muted: { color: tokens.colorNeutralForeground3 },
  add: { marginTop: tokens.spacingVerticalM },
});

function num(v: { value?: number | null; displayValue?: string }, fallback: number): number {
  const n = v.value ?? (v.displayValue !== undefined ? Number(v.displayValue) : Number.NaN);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

/** Vertical step list editor: add Send / Wait / Branch / Task / Add to pool, reorder, remove. */
export function StepEditor({
  steps,
  onChange,
  options,
  readOnly,
  showErrors,
}: {
  steps: StepDraft[];
  onChange: (steps: StepDraft[]) => void;
  options: MarketingOptionsOut | undefined;
  readOnly?: boolean;
  showErrors?: boolean;
}) {
  const styles = useStyles();
  const v = validateSteps(steps);
  const update = <K extends StepKind>(i: number, kind: K, patch: Partial<StepConfigByKind[K]>) =>
    onChange(steps.map((s, j) => (j === i && s.kind === kind ? ({ ...s, config: { ...s.config, ...patch } } as StepDraft) : s)));

  return (
    <div>
      {showErrors && v.form.length > 0 && (
        <MessageBar intent="error">
          <MessageBarBody>{v.form.join(" ")}</MessageBarBody>
        </MessageBar>
      )}
      {steps.length === 0 && <Text className={styles.muted}>No steps yet. Add a first step below.</Text>}
      <ol className={styles.list} aria-label="Sequence steps">
        {steps.map((s, i) => {
          const pos = i + 1;
          const errs = showErrors ? v.steps[i] : undefined;
          return (
            <li key={i}>
              <Card className={styles.step}>
                <div className={styles.head}>
                  <span className={styles.num} aria-hidden>
                    {pos}
                  </span>
                  <Badge appearance="outline">{STEP_KIND_LABELS[s.kind]}</Badge>
                  <Text className={styles.grow} truncate wrap={false}>
                    {stepSummary(s)}
                  </Text>
                  {!readOnly && (
                    <>
                      <Button
                        appearance="subtle"
                        icon={<ArrowUp20Regular />}
                        aria-label={`Move step ${pos} up`}
                        disabled={i === 0}
                        onClick={() => onChange(moveStep(steps, i, i - 1))}
                      />
                      <Button
                        appearance="subtle"
                        icon={<ArrowDown20Regular />}
                        aria-label={`Move step ${pos} down`}
                        disabled={i === steps.length - 1}
                        onClick={() => onChange(moveStep(steps, i, i + 1))}
                      />
                      <Button
                        appearance="subtle"
                        icon={<Delete20Regular />}
                        aria-label={`Remove step ${pos}`}
                        onClick={() => onChange(removeStep(steps, i))}
                      />
                    </>
                  )}
                </div>
                {s.kind === "send" && (
                  <>
                    <Field label="Channel">
                      <RadioGroup
                        layout="horizontal"
                        value={s.config.channel}
                        disabled={readOnly}
                        onChange={(_, d) => update(i, "send", { channel: d.value as Channel, channel_template_id: null })}
                      >
                        {(Object.keys(CHANNEL_LABELS) as Channel[]).map((c) => (
                          <Radio key={c} value={c} label={CHANNEL_LABELS[c]} />
                        ))}
                      </RadioGroup>
                    </Field>
                    {s.config.channel === "email" ? (
                      <EmailContentEditor
                        disabled={readOnly}
                        value={{
                          subject: s.config.subject ?? "",
                          body_html: s.config.body_html ?? "",
                          job_links: (s.config.job_links ?? []).map((l) => ({ posting_id: l.posting_id, label: l.label ?? "" })),
                        }}
                        onChange={(c) => update(i, "send", { subject: c.subject, body_html: c.body_html, job_links: c.job_links })}
                        postings={options?.postings ?? []}
                      />
                    ) : (
                      <OptionCombobox
                        label={`${CHANNEL_LABELS[s.config.channel]} template`}
                        required
                        disabled={readOnly}
                        placeholder="Search registered templates"
                        options={(s.config.channel === "sms" ? options?.sms_templates : options?.whatsapp_templates) ?? []}
                        value={s.config.channel_template_id ?? null}
                        onChange={(o) => update(i, "send", { channel_template_id: o?.id ?? null })}
                      />
                    )}
                  </>
                )}
                {s.kind === "wait" && (
                  <Field label="Days" hint={`${WAIT_MIN_DAYS} to ${WAIT_MAX_DAYS}`}>
                    <SpinButton
                      min={WAIT_MIN_DAYS}
                      max={WAIT_MAX_DAYS}
                      disabled={readOnly}
                      value={s.config.days}
                      onChange={(_, d) => update(i, "wait", { days: Math.min(WAIT_MAX_DAYS, Math.max(WAIT_MIN_DAYS, num(d, s.config.days))) })}
                    />
                  </Field>
                )}
                {s.kind === "branch" && (
                  <div className={styles.row}>
                    <Field label="If the candidate">
                      <Dropdown
                        disabled={readOnly}
                        value={BRANCH_ON_LABELS[s.config.on]}
                        selectedOptions={[s.config.on]}
                        onOptionSelect={(_, d) => update(i, "branch", { on: d.optionValue as BranchOn })}
                      >
                        {(Object.keys(BRANCH_ON_LABELS) as BranchOn[]).map((o) => (
                          <Option key={o} value={o}>
                            {BRANCH_ON_LABELS[o]}
                          </Option>
                        ))}
                      </Dropdown>
                    </Field>
                    <Field label="Within (days)">
                      <SpinButton
                        min={1}
                        max={WAIT_MAX_DAYS}
                        disabled={readOnly}
                        value={s.config.within_days}
                        onChange={(_, d) => update(i, "branch", { within_days: Math.min(WAIT_MAX_DAYS, Math.max(1, num(d, s.config.within_days))) })}
                      />
                    </Field>
                    {(["then_position", "else_position"] as const).map((key) => {
                      const targets = branchTargets(pos, steps.length);
                      const current = s.config[key];
                      return (
                        <Field key={key} label={key === "then_position" ? "Then go to" : "Otherwise go to"}>
                          <Dropdown
                            disabled={readOnly || targets.length === 0}
                            placeholder={targets.length ? "Choose a step" : "Add later steps first"}
                            value={current ? `Step ${current}` : ""}
                            selectedOptions={current ? [String(current)] : []}
                            onOptionSelect={(_, d) => update(i, "branch", { [key]: Number(d.optionValue) } as Partial<StepConfigByKind["branch"]>)}
                          >
                            {targets.map((t) => (
                              <Option key={t} value={String(t)}>
                                {`Step ${t}`}
                              </Option>
                            ))}
                          </Dropdown>
                        </Field>
                      );
                    })}
                  </div>
                )}
                {s.kind === "task" && (
                  <div className={styles.row}>
                    <Field label="Title" required style={{ flex: "1 1 260px" }}>
                      <Input value={s.config.title} maxLength={200} disabled={readOnly} onChange={(_, d) => update(i, "task", { title: d.value })} />
                    </Field>
                    <Field label="Assign to">
                      <Dropdown disabled value="Sequence owner" selectedOptions={["owner"]}>
                        <Option value="owner">Sequence owner</Option>
                      </Dropdown>
                    </Field>
                    <Field label="Due in (days)">
                      <SpinButton
                        min={0}
                        max={WAIT_MAX_DAYS}
                        disabled={readOnly}
                        value={s.config.due_days}
                        onChange={(_, d) => update(i, "task", { due_days: Math.min(WAIT_MAX_DAYS, Math.max(0, num(d, s.config.due_days))) })}
                      />
                    </Field>
                  </div>
                )}
                {s.kind === "add_to_pool" && (
                  <OptionCombobox
                    label="Talent pool"
                    required
                    disabled={readOnly}
                    placeholder="Search pools"
                    options={options?.pools ?? []}
                    value={s.config.talent_pool_id}
                    onChange={(o) => update(i, "add_to_pool", { talent_pool_id: o?.id ?? null })}
                  />
                )}
                {errs && (
                  <MessageBar intent="error" layout="multiline">
                    <MessageBarBody>{errs.join(" ")}</MessageBarBody>
                  </MessageBar>
                )}
              </Card>
            </li>
          );
        })}
      </ol>
      {!readOnly && (
        <div className={styles.add}>
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button icon={<Add20Regular />} disabled={steps.length >= MAX_STEPS}>
                Add step
              </Button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                {(Object.keys(STEP_KIND_LABELS) as StepKind[]).map((k) => (
                  <MenuItem key={k} onClick={() => onChange(addStep(steps, k))}>
                    {STEP_KIND_LABELS[k]}
                  </MenuItem>
                ))}
              </MenuList>
            </MenuPopover>
          </Menu>
          {steps.length >= MAX_STEPS && <Text className={styles.muted}> The maximum is {MAX_STEPS} steps.</Text>}
        </div>
      )}
    </div>
  );
}
