import { describe, expect, it } from "vitest";
import {
  renderBlogMarkdown,
  slugifyHeadingText,
  stripInlineMarkdown,
} from "../markdown";

describe("stripInlineMarkdown", () => {
  it("removes bold, strikethrough and code markers", () => {
    expect(stripInlineMarkdown("**bold** text")).toBe("bold text");
    expect(stripInlineMarkdown("~~gone~~")).toBe("gone");
    expect(stripInlineMarkdown("`code`")).toBe("code");
  });

  it("unwraps links and images to their text", () => {
    expect(stripInlineMarkdown("[label](https://example.com)")).toBe("label");
    expect(stripInlineMarkdown("![alt text](img.png)")).toBe("alt text");
  });

  it("keeps single underscores so snake_case survives", () => {
    expect(stripInlineMarkdown("api_chat endpoint")).toBe("api_chat endpoint");
  });
});

describe("slugifyHeadingText", () => {
  it("slugifies plain English headings", () => {
    expect(slugifyHeadingText("Hello World")).toBe("hello-world");
    expect(slugifyHeadingText("  spaced   out  ")).toBe("spaced-out");
  });

  it("collapses punctuation to dashes but keeps CJK characters", () => {
    expect(slugifyHeadingText("一、背景：为什么要在远端部署 Ollama")).toBe(
      "一-背景-为什么要在远端部署-ollama"
    );
  });

  it("collapses repeated punctuation and trims edge dashes", () => {
    expect(slugifyHeadingText("Hello -- World!")).toBe("hello-world");
  });

  it("returns empty string for symbol-only headings", () => {
    expect(slugifyHeadingText("？？！")).toBe("");
  });
});

describe("renderBlogMarkdown", () => {
  it("injects ids into heading HTML matching the returned sections", () => {
    const { html, sections } = renderBlogMarkdown(
      "# Title\n\n## Section A\n\ntext\n\n### Sub B\n"
    );

    expect(sections).toEqual([
      { id: "title", label: "Title", level: 1 },
      { id: "section-a", label: "Section A", level: 2 },
      { id: "sub-b", label: "Sub B", level: 3 },
    ]);
    expect(html).toContain('<h1 id="title">');
    expect(html).toContain('<h2 id="section-a">');
    expect(html).toContain('<h3 id="sub-b">');
  });

  it("suffixes duplicate heading ids", () => {
    const { html, sections } = renderBlogMarkdown(
      "## Same\n\n## Same\n\n## Same\n"
    );

    expect(sections.map(s => s.id)).toEqual(["same", "same-1", "same-2"]);
    expect(html).toContain('<h2 id="same-1">');
    expect(html).toContain('<h2 id="same-2">');
  });

  it("falls back to an index-based id for symbol-only headings", () => {
    const { html, sections } = renderBlogMarkdown("## ？？！\n");

    expect(sections[0].id).toBe("h-2-1");
    expect(html).toContain('<h2 id="h-2-1">');
  });

  it("keeps CJK ids intact in both html and sections", () => {
    const { html, sections } = renderBlogMarkdown("## 一、背景\n");

    expect(sections[0].id).toBe("一-背景");
    expect(html).toContain(`<h2 id="${sections[0].id}">`);
  });

  it("ignores heading markers inside code fences", () => {
    const { sections } = renderBlogMarkdown(
      "```\n## not a heading\n```\n\n## real heading\n"
    );

    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe("real heading");
  });

  it("strips inline markdown from labels but keeps it in html", () => {
    const { html, sections } = renderBlogMarkdown("## **Bold** Heading\n");

    expect(sections[0].label).toBe("Bold Heading");
    expect(html).toContain("<strong>Bold</strong>");
  });

  it("still sanitizes dangerous html", () => {
    const { html } = renderBlogMarkdown(
      '## ok\n\n<script>alert("x")</script>\n\n<img src="x" onerror="alert(1)">\n'
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
  });

  it("preserves default allowed attributes such as link href", () => {
    const { html } = renderBlogMarkdown("[site](https://example.com)\n");

    expect(html).toContain('<a href="https://example.com">');
  });

  it("returns no sections for heading-less bodies", () => {
    const { sections } = renderBlogMarkdown("just some text\n\nand more\n");

    expect(sections).toEqual([]);
  });

  it("is deterministic across calls", () => {
    const body = "## Alpha\n\n## Alpha\n\n### Beta\n";
    expect(renderBlogMarkdown(body)).toEqual(renderBlogMarkdown(body));
  });
});

describe("code highlighting", () => {
  it("passes fenced code through an injected highlighter and keeps its output sanitization-safe", () => {
    const highlighted =
      '<pre class="shiki kinetic-paper" style="background-color:#eceae4;color:#2d2a26" tabindex="0" lang="tsx"><code><span style="color:#A3512E">const</span></code></pre>';
    const { html } = renderBlogMarkdown("```tsx\nconst x = 1;\n```\n", {
      highlightCode: () => highlighted,
    });

    expect(html).toContain('class="shiki kinetic-paper"');
    expect(html).toContain('style="background-color:#eceae4;color:#2d2a26"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('<span style="color:#A3512E">const</span>');
  });

  it("renders plain language-tagged fences marked-equivalently without an injector", () => {
    const { html } = renderBlogMarkdown("```bash\necho <hi>\n```\n");

    expect(html).toContain('<code class="language-bash">');
    expect(html).toContain("echo &lt;hi&gt;");
  });

  it("renders unlabeled fences as plain escaped blocks", () => {
    const { html } = renderBlogMarkdown("```\na & b\n```\n");

    expect(html).toContain("<pre><code>a &amp; b</code></pre>");
  });

  it("falls through to plain output when the injector declines", () => {
    const { html } = renderBlogMarkdown("```cobol\nMOVE 1 TO X.\n```\n", {
      highlightCode: () => null,
    });

    expect(html).toContain('<code class="language-cobol">');
  });

  it("still strips images and scripts alongside highlighted code", () => {
    const { html } = renderBlogMarkdown(
      '```ts\nconst a = 1;\n```\n\n<img src="x" onerror="alert(1)">\n',
      { highlightCode: () => '<pre class="shiki"><code>x</code></pre>' }
    );

    expect(html).not.toContain("<img");
    expect(html).not.toContain("onerror");
  });
});

describe("body dash augmentation", () => {
  const para = (n: number) =>
    Array.from({ length: n }, (_, i) => `p${i}\n`).join("\n");

  it("adds inert body dashes after content-heavy sections, stacked by weight", () => {
    const { sections } = renderBlogMarkdown(
      `## Long\n\n${para(5)}## Short\n\none\n`
    );

    // 2 headings → target min(max(round(2×0.5)=1, 10−2=8), 2×2=4) = 4,
    // but Long only has capacity ⌊5/2⌋=2 and Short (1 block) is ineligible
    expect(sections).toEqual([
      { id: "long", label: "Long", level: 2 },
      { id: "", label: "Long", level: 4 },
      { id: "", label: "Long", level: 4 },
      { id: "short", label: "Short", level: 2 },
    ]);
  });

  it("fills up to the density target, heaviest sections first", () => {
    const { sections } = renderBlogMarkdown(
      `## A\n\n${para(6)}## B\n\n${para(6)}## C\n\n${para(6)}## D\n\n${para(6)}## E\n\none\n`
    );

    // 5 headings → target min(max(3, 5), 10) = 5; E has 1 block → never
    // eligible; round-robin deals A a second dash before anyone's third
    expect(sections.filter(s => s.id === "")).toHaveLength(5);
    expect(sections.slice(0, 3)).toEqual([
      { id: "a", label: "A", level: 2 },
      { id: "", label: "A", level: 4 },
      { id: "", label: "A", level: 4 },
    ]);
    expect(sections.some(s => s.id === "e")).toBe(true);
    expect(sections[sections.length - 1]).toEqual({
      id: "e",
      label: "E",
      level: 2,
    });
  });

  it("lifts sparse posts toward the minimum total lines", () => {
    // 3 headings × 8 blocks: target min(max(2, 7), 6) = 6, capacity 3 each
    const { sections } = renderBlogMarkdown(
      `## A\n\n${para(8)}## B\n\n${para(8)}## C\n\n${para(8)}`
    );

    expect(sections.filter(s => s.id === "")).toHaveLength(6);
  });

  it("cannot fake density when the content is too thin", () => {
    // 4 headings × 1 block: target is 6 but no section has any capacity
    const { sections } = renderBlogMarkdown(
      "## A\n\nx\n\n## B\n\nx\n\n## C\n\nx\n\n## D\n\nx\n"
    );

    expect(sections.filter(s => s.id === "")).toHaveLength(0);
  });

  it("never attaches body dashes to the post title (h1)", () => {
    const { sections } = renderBlogMarkdown(`# Title\n\n${para(6)}## Body\n`);

    expect(sections.some(s => s.id === "" && s.level === 1)).toBe(false);
    expect(sections.filter(s => !s.id)).toHaveLength(0);
  });

  it("leaves the rendered html untouched by body dashes", () => {
    const { html } = renderBlogMarkdown(`## Long\n\n${para(5)}## Short\n`);

    expect(html.match(/<h2 /g)).toHaveLength(2);
    expect(html.match(/<h\d /g)).toHaveLength(2);
  });
});
