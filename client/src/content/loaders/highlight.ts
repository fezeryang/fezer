/**
 * Build-time syntax highlighting for blog code fences (see
 * build/blog-markdown.ts). This module is imported ONLY from the Vite
 * plugin and tests — never from client code — so shiki stays out of the
 * browser bundle.
 */
import {
  createHighlighter,
  type Highlighter,
  type ThemeRegistrationRaw,
} from "shiki";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

/**
 * Paper-editorial theme tuned for the blog's warm palette: the block
 * surface (#eceae4/#2d2a26) is baked into the theme so it survives
 * sanitization as a `pre[style]` and beats the typography plugin's
 * dark-zinc default for un-highlighted fences too.
 */
export const PAPER_THEME: ThemeRegistrationRaw = {
  name: "kinetic-paper",
  type: "light",
  bg: "#eceae4",
  fg: "#2d2a26",
  settings: [
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#9a948b", fontStyle: "italic" },
    },
    {
      scope: [
        "keyword",
        "keyword.control",
        "storage.type",
        "storage.modifier",
      ],
      settings: { foreground: "#a3512e" },
    },
    {
      scope: ["string", "string.quoted", "punctuation.definition.string"],
      settings: { foreground: "#6a7a52" },
    },
    {
      scope: [
        "constant.numeric",
        "constant.language",
        "constant.character",
      ],
      settings: { foreground: "#8a6d3b" },
    },
    {
      scope: [
        "entity.name.function",
        "entity.name.type",
        "entity.name.class",
        "support.function",
      ],
      settings: { foreground: "#35566b" },
    },
    {
      scope: ["entity.other.attribute-name"],
      settings: { foreground: "#8a6d3b" },
    },
    {
      scope: ["keyword.operator", "punctuation.separator"],
      settings: { foreground: "#6a6560" },
    },
  ],
};

/** Languages worth bundling grammars for; anything else renders plain. */
export const SUPPORTED_LANGS = [
  "typescript",
  "tsx",
  "javascript",
  "bash",
  "json",
  "yaml",
  "css",
  "html",
] as const;

/** Fence aliases seen in the wild → canonical grammar id. */
const LANG_ALIASES: Record<string, string> = {
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  ts: "typescript",
  js: "javascript",
};

export const normalizeFenceLang = (raw: string): string | null => {
  const first = raw.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (!first) return null;

  const alias = LANG_ALIASES[first] ?? first;
  return (SUPPORTED_LANGS as readonly string[]).includes(alias) ? alias : null;
};

let highlighterPromise: Promise<Highlighter> | null = null;

/**
 * Module-level singleton. The JS regex engine avoids loading oniguruma
 * wasm entirely; if a future grammar needs it, swap to the default
 * engine (Node resolves the wasm from node_modules unaided).
 */
export function ensureHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [PAPER_THEME],
      langs: [...SUPPORTED_LANGS],
      engine: createJavaScriptRegexEngine(),
    });
  }

  return highlighterPromise;
}
