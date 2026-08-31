import { beforeAll, describe, expect, it } from "vitest";
import { renderPostModule } from "../../../../../blog-markdown";
import {
  ensureHighlighter,
  normalizeFenceLang,
} from "../highlight";
import { renderBlogMarkdown } from "../markdown";

describe("normalizeFenceLang", () => {
  it("maps common aliases to canonical grammar ids", () => {
    expect(normalizeFenceLang("sh")).toBe("bash");
    expect(normalizeFenceLang("ZSH")).toBe("bash");
    expect(normalizeFenceLang("yml")).toBe("yaml");
    expect(normalizeFenceLang("ts")).toBe("typescript");
  });

  it("keeps the first word of info strings and drops the rest", () => {
    expect(normalizeFenceLang("bash title=install")).toBe("bash");
  });

  it("returns null for unsupported or empty languages", () => {
    expect(normalizeFenceLang("cobol")).toBeNull();
    expect(normalizeFenceLang("")).toBeNull();
    expect(normalizeFenceLang("   ")).toBeNull();
  });
});

describe("renderPostModule (real shiki)", () => {
  beforeAll(async () => {
    await ensureHighlighter();
  });

  it("highlights supported fences in the kinetic-paper theme, sanitizer-safe", async () => {
    const rendered = await renderPostModule(
      "## Setup\n\n```tsx\nconst x: number = 1;\n```\n"
    );

    expect(rendered.html).toContain('class="shiki kinetic-paper"');
    expect(rendered.html).toContain("background-color:#eceae4");
    expect(rendered.html).toMatch(/<span style="color:#[0-9a-fA-F]{6}">/);
    expect(rendered.html).not.toContain("<script");
  });

  it("renders plain paper blocks for unlabeled fences", async () => {
    const rendered = await renderPostModule("```\nplain & simple\n```\n");

    expect(rendered.html).toContain(
      "<pre><code>plain &amp; simple</code></pre>"
    );
    expect(rendered.html).not.toContain("shiki");
  });

  it("strips frontmatter before rendering", async () => {
    const rendered = await renderPostModule(
      '---\ntitle: "Test"\ndate: "2026-01-01"\nexcerpt: "leaked excerpt"\n---\n\n## Real heading\n'
    );

    expect(rendered.html).not.toContain("leaked excerpt");
    expect(rendered.html).not.toContain("title:");
    expect(rendered.sections.map(s => s.id)).toEqual(["real-heading"]);
  });

  it("is deterministic and keeps sections identical to the non-highlighted path", async () => {
    const body = "## Alpha\n\ntext\n\n```bash\necho ok\n```\n\n## Beta\n";

    const first = await renderPostModule(body);
    const second = await renderPostModule(body);

    expect(first).toEqual(second);
    expect(first.sections).toEqual(renderBlogMarkdown(body).sections);
  });
});
