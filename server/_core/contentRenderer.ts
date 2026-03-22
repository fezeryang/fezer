import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";

export const SNAPSHOT_RENDERER_VERSION = 1;

export type RenderedSnapshot = {
  html: string;
  rendererVersion: number;
};

const markdownRenderer = new Marked({
  gfm: true,
  breaks: false,
  async: false,
});

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "a",
    "abbr",
    "b",
    "blockquote",
    "br",
    "code",
    "del",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "i",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "s",
    "span",
    "strong",
    "sub",
    "sup",
    "table",
    "tbody",
    "td",
    "th",
    "thead",
    "tr",
    "u",
    "ul",
  ],
  allowedAttributes: {
    a: ["href", "name", "target", "rel", "title"],
    img: ["src", "alt", "title"],
    th: ["colspan", "rowspan", "align"],
    td: ["colspan", "rowspan", "align"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href", "src", "cite"],
  allowProtocolRelative: false,
};

export function renderMarkdownSnapshot(markdownSource: string): RenderedSnapshot {
  const html = markdownRenderer.parse(markdownSource);
  if (typeof html !== "string") {
    throw new Error("Markdown renderer unexpectedly returned async output");
  }

  const sanitizedHtml = sanitizeHtml(html, SANITIZE_OPTIONS).trim();

  return {
    html: sanitizedHtml,
    rendererVersion: SNAPSHOT_RENDERER_VERSION,
  };
}
