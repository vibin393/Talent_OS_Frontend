import { mergeAttributes, Node } from "@tiptap/react";
import { token } from "./merge-tokens";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mergeField: {
      /** Insert a merge-field chip at the cursor. */
      insertMergeField: (path: string) => ReturnType;
    };
  }
}

/**
 * Inline, atomic (non-editable) merge-field chip. Serialised as
 * `<span data-merge-field="group.field">{{ group.field }}</span>`; `chipsToTokens` turns it back into the
 * plain token before the HTML is sent to the server.
 */
export const MergeField = Node.create({
  name: "mergeField",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      path: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-merge-field") ?? "",
        renderHTML: (attrs) => ({ "data-merge-field": attrs.path }),
      },
      invalid: {
        default: false,
        parseHTML: (el) => el.getAttribute("data-invalid") === "true",
        renderHTML: (attrs) => (attrs.invalid ? { "data-invalid": "true" } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-merge-field]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { contenteditable: "false" }), token(String(node.attrs.path))];
  },

  renderText({ node }) {
    return token(String(node.attrs.path));
  },

  addCommands() {
    return {
      insertMergeField:
        (path: string) =>
        ({ commands }) =>
          commands.insertContent([{ type: this.name, attrs: { path } }, { type: "text", text: " " }]),
    };
  },
});
