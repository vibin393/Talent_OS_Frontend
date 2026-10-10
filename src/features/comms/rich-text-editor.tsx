"use client";

import {
  Button,
  Field,
  Input,
  makeStyles,
  mergeClasses,
  Popover,
  shorthands,
  PopoverSurface,
  PopoverTrigger,
  Toolbar,
  ToolbarButton,
  ToolbarDivider,
  ToolbarToggleButton,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowRedo20Regular,
  ArrowUndo20Regular,
  LinkAdd20Regular,
  TextBold20Regular,
  TextBulletListLtr20Regular,
  TextItalic20Regular,
  TextNumberListLtr20Regular,
  TextUnderline20Regular,
} from "@fluentui/react-icons";
import Link from "@tiptap/extension-link";
import { type Editor, EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { MergeField } from "./merge-field-node";
import { chipsToTokens, tokensToChips } from "./merge-tokens";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    ":focus-within": { borderBottomColor: tokens.colorCompoundBrandStroke },
  },
  invalidRoot: { ...shorthands.borderColor(tokens.colorPaletteRedBorder2) },
  toolbar: {
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    flexWrap: "wrap",
  },
  content: {
    minHeight: "var(--rte-min-height, 200px)",
    maxHeight: "var(--rte-max-height, 480px)",
    overflowY: "auto",
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    "& .ProseMirror": { outlineStyle: "none", minHeight: "inherit" },
    "& .ProseMirror p": { marginBlock: tokens.spacingVerticalXS },
    "& .ProseMirror a": { color: tokens.colorBrandForegroundLink },
    // Merge-field chips (non-editable brand tokens).
    "& span[data-merge-field]": {
      display: "inline-block",
      paddingInline: tokens.spacingHorizontalXS,
      marginInline: "1px",
      borderRadius: tokens.borderRadiusMedium,
      backgroundColor: tokens.colorBrandBackground2,
      color: tokens.colorBrandForeground2,
      border: `${tokens.strokeWidthThin} solid ${tokens.colorBrandStroke2}`,
      fontSize: tokens.fontSizeBase200,
      lineHeight: tokens.lineHeightBase200,
      whiteSpace: "nowrap",
      userSelect: "all",
    },
    "& span[data-merge-field][data-invalid='true']": {
      backgroundColor: tokens.colorPaletteRedBackground1,
      color: tokens.colorPaletteRedForeground1,
      ...shorthands.borderColor(tokens.colorPaletteRedBorder2),
    },
    "& span[data-merge-field].ProseMirror-selectednode": {
      outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}`,
    },
  },
});

export type RichTextHandle = {
  /** Insert a merge-field chip at the cursor. */
  insertField: (path: string) => void;
  /** Replace the whole document (server HTML with plain tokens). */
  setHtml: (html: string) => void;
  /** Mark the chips whose path is in `paths` as invalid (red); others are cleared. */
  markInvalid: (paths: readonly string[]) => void;
  focus: () => void;
};

function markInvalidChips(editor: Editor, paths: readonly string[]) {
  const bad = new Set(paths);
  const tr = editor.state.tr;
  let changed = false;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "mergeField") return;
    const invalid = bad.has(String(node.attrs.path));
    if (invalid !== !!node.attrs.invalid) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, invalid });
      changed = true;
    }
  });
  if (changed) {
    tr.setMeta("addToHistory", false);
    editor.view.dispatch(tr);
  }
}

/**
 * Tiptap rich-text body with a Fluent formatting `Toolbar`. `value` / `onChange` carry server HTML with
 * plain `{{ tokens }}`; in the editor tokens are non-editable chips.
 */
export function RichTextEditor({
  value,
  onChange,
  ariaLabel,
  invalid,
  minHeight,
  disabled,
  ref,
}: {
  value: string;
  onChange: (html: string) => void;
  ariaLabel: string;
  invalid?: boolean;
  minHeight?: number;
  disabled?: boolean;
  ref?: React.Ref<RichTextHandle>;
}) {
  const styles = useStyles();
  const lastEmitted = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false, heading: { levels: [2, 3] }, codeBlock: false, code: false }),
      Link.configure({ openOnClick: false, autolink: true, protocols: ["https", "mailto"] }),
      MergeField,
    ],
    content: tokensToChips(value),
    editable: !disabled,
    immediatelyRender: false,
    editorProps: { attributes: { "aria-label": ariaLabel, "aria-multiline": "true", role: "textbox" } },
    onUpdate: ({ editor: e }) => {
      const html = chipsToTokens(e.getHTML());
      lastEmitted.current = html;
      onChangeRef.current(html);
    },
  });

  // External value changes (template inserted, draft restored) replace the document.
  useEffect(() => {
    if (!editor || value === lastEmitted.current) return;
    lastEmitted.current = value;
    editor.commands.setContent(tokensToChips(value), { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  useImperativeHandle(
    ref,
    () => ({
      insertField: (path) => editor?.chain().focus().insertMergeField(path).run(),
      setHtml: (html) => {
        lastEmitted.current = html;
        editor?.commands.setContent(tokensToChips(html), { emitUpdate: false });
        onChangeRef.current(html);
      },
      markInvalid: (paths) => {
        if (editor) markInvalidChips(editor, paths);
      },
      focus: () => editor?.commands.focus(),
    }),
    [editor],
  );

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            link: e.isActive("link"),
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : null,
  });

  const checked = Object.entries(state ?? {})
    .filter(([k, v]) => v === true && !k.startsWith("can"))
    .map(([k]) => k);

  const applyLink = (url: string) => {
    if (!editor) return;
    const href = url.trim();
    if (href === "" || href === "https://") editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  };

  return (
    <div className={mergeClasses(styles.root, invalid && styles.invalidRoot)}>
      <Toolbar
        aria-label="Formatting"
        size="small"
        className={styles.toolbar}
        checkedValues={{ format: checked }}
      >
        <Tooltip content="Bold" relationship="label">
          <ToolbarToggleButton
            name="format"
            value="bold"
            appearance="subtle"
            icon={<TextBold20Regular />}
            disabled={disabled}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          />
        </Tooltip>
        <Tooltip content="Italic" relationship="label">
          <ToolbarToggleButton
            name="format"
            value="italic"
            appearance="subtle"
            icon={<TextItalic20Regular />}
            disabled={disabled}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          />
        </Tooltip>
        <Tooltip content="Underline" relationship="label">
          <ToolbarToggleButton
            name="format"
            value="underline"
            appearance="subtle"
            icon={<TextUnderline20Regular />}
            disabled={disabled}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          />
        </Tooltip>
        <ToolbarDivider />
        <Tooltip content="Bulleted list" relationship="label">
          <ToolbarToggleButton
            name="format"
            value="bullet"
            appearance="subtle"
            icon={<TextBulletListLtr20Regular />}
            disabled={disabled}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          />
        </Tooltip>
        <Tooltip content="Numbered list" relationship="label">
          <ToolbarToggleButton
            name="format"
            value="ordered"
            appearance="subtle"
            icon={<TextNumberListLtr20Regular />}
            disabled={disabled}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          />
        </Tooltip>
        <LinkButton
          disabled={disabled}
          current={() => String(editor?.getAttributes("link").href ?? "")}
          onApply={applyLink}
        />
        <ToolbarDivider />
        <Tooltip content="Undo" relationship="label">
          <ToolbarButton
            appearance="subtle"
            icon={<ArrowUndo20Regular />}
            disabled={disabled || !state?.canUndo}
            onClick={() => editor?.chain().focus().undo().run()}
          />
        </Tooltip>
        <Tooltip content="Redo" relationship="label">
          <ToolbarButton
            appearance="subtle"
            icon={<ArrowRedo20Regular />}
            disabled={disabled || !state?.canRedo}
            onClick={() => editor?.chain().focus().redo().run()}
          />
        </Tooltip>
      </Toolbar>
      <EditorContent
        editor={editor}
        className={styles.content}
        style={minHeight ? ({ "--rte-min-height": `${minHeight}px` } as React.CSSProperties) : undefined}
      />
    </div>
  );
}

/** Toolbar button with a small popover to add, change or remove a link on the selection. */
function LinkButton({
  disabled,
  current,
  onApply,
}: {
  disabled?: boolean;
  current: () => string;
  onApply: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  return (
    <Popover
      open={open}
      trapFocus
      onOpenChange={(_, d) => {
        if (d.open) setUrl(current() || "https://");
        setOpen(d.open);
      }}
    >
      <PopoverTrigger disableButtonEnhancement>
        <Tooltip content="Link" relationship="label">
          <ToolbarToggleButton name="format" value="link" appearance="subtle" icon={<LinkAdd20Regular />} disabled={disabled} />
        </Tooltip>
      </PopoverTrigger>
      <PopoverSurface aria-label="Link">
        <form
          style={{ display: "flex", gap: 8, alignItems: "flex-end" }}
          onSubmit={(e) => {
            e.preventDefault();
            onApply(url);
            setOpen(false);
          }}
        >
          <Field label="Address">
            <Input value={url} onChange={(_, d) => setUrl(d.value)} type="url" style={{ minWidth: 260 }} />
          </Field>
          <Button appearance="primary" type="submit">
            Apply
          </Button>
          <Button
            onClick={() => {
              onApply("");
              setOpen(false);
            }}
          >
            Remove
          </Button>
        </form>
      </PopoverSurface>
    </Popover>
  );
}
