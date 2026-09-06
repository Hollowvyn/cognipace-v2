"use client";

import { useMemo } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";

// Theme keyed to the app palette (see globals.css). Kept minimal so the
// editor sits quietly inside the layout rather than announcing itself.
const theme = EditorView.theme(
  {
    "&": {
      color: "#efe9df",
      backgroundColor: "transparent",
      fontFamily: "var(--font-mono), ui-monospace, Menlo, monospace",
      fontSize: "14px",
    },
    ".cm-content": {
      caretColor: "#d24a30",
      padding: "12px 0",
    },
    ".cm-scroller": { overflow: "auto" },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "#7a756d",
      border: "none",
    },
    ".cm-activeLine": { backgroundColor: "rgba(122,117,109,0.06)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#efe9df" },
    "&.cm-focused .cm-cursor": { borderLeftColor: "#d24a30" },
    "&.cm-focused .cm-selectionBackground, ::selection": {
      backgroundColor: "rgba(210,74,48,0.35)",
    },
    ".cm-selectionMatch": { backgroundColor: "rgba(139,168,137,0.18)" },
    ".cm-tooltip": {
      backgroundColor: "#17191d",
      border: "1px solid #22252b",
      color: "#efe9df",
    },
  },
  { dark: true },
);

type Props = {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
};

export function CodeEditor({ value, onChange, readOnly }: Props) {
  const extensions = useMemo(() => [python(), theme], []);
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      readOnly={readOnly}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: true,
        foldGutter: false,
        autocompletion: true,
        bracketMatching: true,
        indentOnInput: true,
      }}
      theme="dark"
      className="h-full min-h-[320px]"
    />
  );
}
