import { describe, expect, it } from "vitest";
import {
  BODY_DASH_RATIO,
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

describe("body dash augmentation", () => {
  const para = (n: number) =>
    Array.from({ length: n }, (_, i) => `p${i}\n`).join("\n");

  it("adds an inert body dash after content-heavy sections", () => {
    const { sections } = renderBlogMarkdown(
      `## Long\n\n${para(5)}## Short\n\none\n`
    );

    // 2 headings → round(2 * 0.25) = 1 extra, given to the longest section
    expect(sections).toEqual([
      { id: "long", label: "Long", level: 2 },
      { id: "", label: "Long", level: 4 },
      { id: "short", label: "Short", level: 2 },
    ]);
  });

  it("caps extras at the ratio of headings and skips thin sections", () => {
    const { sections } = renderBlogMarkdown(
      `## A\n\n${para(6)}## B\n\n${para(6)}## C\n\n${para(6)}## D\n\n${para(6)}## E\n\n${para(2)}`
    );

    // 5 headings → round(5 * 0.25) = 1 extra only, despite 4 eligible sections
    expect(sections.filter(s => s.id === "")).toHaveLength(
      Math.round(5 * BODY_DASH_RATIO)
    );
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
