import { Marked, type Token, type Tokens } from "marked";
import sanitizeHtml from "sanitize-html";

export interface TocSection {
  id: string;
  label: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface RenderedMarkdown {
  html: string;
  sections: TocSection[];
}

/**
 * Body-dash density knobs. The minimap should reflect content weight and
 * never look sparse: aim for ~50% of the heading count, but never fewer
 * than MIN_TOTAL_LINES total dashes when the content supports it.
 */
export const BODY_DASH_RATIO = 0.5;
/** Total dashes (headings + body) a post aims for at minimum. */
export const MIN_TOTAL_LINES = 10;
/** A section needs at least this many content blocks to earn body dashes. */
const BODY_DASH_MIN_BLOCKS = 2;
/** One body dash per N content blocks within a section… */
const BLOCKS_PER_BODY_DASH = 2;
/** …but never more than this many stacked under a single section. */
const MAX_BODY_DASHES_PER_SECTION = 3;
/** Top-level lexer token types counted as one content block. */
const BLOCK_TOKEN_TYPES = new Set([
  "paragraph",
  "code",
  "list",
  "blockquote",
  "table",
  "hr",
]);

/**
 * Strip inline markdown while keeping the readable text, e.g. for TOC labels
 * and heading slugs. Single `*`/`_` are kept so snake_case words survive.
 */
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|~~|`)/g, "")
    .trim();
}

/**
 * Heading text → URL-safe id. Whitespace and punctuation (including CJK
 * punctuation, which `\p{P}` covers) collapse to `-`; letters — including
 * CJK — are kept, so Chinese headings keep readable ids like
 * `一-背景-为什么要在远端部署-ollama`. Symbol-only headings return "".
 */
export function slugifyHeadingText(text: string): string {
  return stripInlineMarkdown(text)
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Count content blocks (paragraphs, code blocks, lists…) belonging to each
 * heading, in document order. Blocks before the first heading are ignored.
 */
function countBlocksPerSection(tokens: Token[]): number[] {
  const counts: number[] = [];

  for (const token of tokens) {
    if (token.type === "heading") {
      counts.push(0);
    } else if (BLOCK_TOKEN_TYPES.has(token.type) && counts.length > 0) {
      counts[counts.length - 1] += 1;
    }
  }

  return counts;
}

/**
 * Insert non-interactive body dashes (id: "", level: 4) after the dashes of
 * content-heavy sections, so the minimap density tracks content weight:
 * heavier sections earn more (stacked) lines, and short posts get lifted to
 * a comfortable minimum. Headings keep their own interactive dash.
 */
function augmentWithBodyDashes(
  sections: TocSection[],
  blockCounts: number[]
): TocSection[] {
  const headingCount = sections.length;
  const target = Math.min(
    Math.max(
      Math.round(headingCount * BODY_DASH_RATIO),
      MIN_TOTAL_LINES - headingCount
    ),
    headingCount * 2
  );
  if (target <= 0) return sections;

  const eligible = sections
    .map((section, index) => ({
      section,
      index,
      blocks: blockCounts[index] ?? 0,
    }))
    .filter(
      ({ section, blocks }) =>
        section.level >= 2 && blocks >= BODY_DASH_MIN_BLOCKS
    )
    .sort((a, b) => b.blocks - a.blocks || a.index - b.index);

  const chosen = eligible
    .map(entry => ({
      ...entry,
      capacity: Math.min(
        Math.floor(entry.blocks / BLOCKS_PER_BODY_DASH),
        MAX_BODY_DASHES_PER_SECTION
      ),
    }))
    .filter(({ capacity }) => capacity > 0);

  // deal one dash at a time to the heaviest sections, cycling, until the
  // target is met or capacity runs out
  const allocations = new Map<number, number>();
  let remaining = target;

  while (remaining > 0) {
    let dealt = false;

    for (const entry of chosen) {
      if (remaining <= 0) break;

      const given = allocations.get(entry.index) ?? 0;
      if (given < entry.capacity) {
        allocations.set(entry.index, given + 1);
        remaining -= 1;
        dealt = true;
      }
    }

    if (!dealt) break;
  }

  if (!allocations.size) return sections;

  const augmented = [...sections];

  // splice from the back so earlier indices stay valid
  for (const index of [...allocations.keys()].sort((a, b) => b - a)) {
    const count = allocations.get(index) ?? 0;
    const dashes: TocSection[] = Array.from({ length: count }, () => ({
      id: "",
      label: sections[index].label,
      level: 4,
    }));
    augmented.splice(index + 1, 0, ...dashes);
  }

  return augmented;
}

/**
 * Render a blog post body to sanitized HTML while collecting its headings
 * as TOC sections (augmented with content-weight body dashes). The ids in
 * the HTML and in `sections` come from the same renderer pass, so they can
 * never drift apart.
 *
 * Uses a private Marked instance — the global `marked` singleton is shared
 * with other pages (e.g. About), so heading-id injection must not leak.
 */
export function renderBlogMarkdown(body: string): RenderedMarkdown {
  const sections: TocSection[] = [];
  const usedIds = new Map<string, number>();

  const md = new Marked();
  md.use({
    renderer: {
      heading(token: Tokens.Heading) {
        const inner = this.parser.parseInline(token.tokens);
        const plain = stripInlineMarkdown(token.text);

        let id = slugifyHeadingText(plain);
        if (!id) id = `h-${token.depth}-${sections.length + 1}`;

        const seen = usedIds.get(id) ?? 0;
        usedIds.set(id, seen + 1);
        if (seen > 0) id = `${id}-${seen}`;

        sections.push({
          id,
          label: plain || `H${token.depth}`,
          level: token.depth as TocSection["level"],
        });

        return `<h${token.depth} id="${id}">${inner}</h${token.depth}>`;
      },
    },
  });

  const html = sanitizeHtml(md.parse(body) as string, {
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      h1: ["id"],
      h2: ["id"],
      h3: ["id"],
      h4: ["id"],
      h5: ["id"],
      h6: ["id"],
    },
  });

  const blockCounts = countBlocksPerSection(md.lexer(body));
  const augmentedSections = augmentWithBodyDashes(sections, blockCounts);

  return { html, sections: augmentedSections };
}
