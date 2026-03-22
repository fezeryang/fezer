import { describe, it, expect } from "vitest";
import {
  parseFrontmatter,
  requireField,
  extractSlugFromPath,
  ContentValidationError,
} from "../parser";

describe("parseFrontmatter", () => {
  it("parses valid frontmatter with all fields", () => {
    const raw = `---
title: "Test Post"
date: "2024-06-15"
excerpt: "A test excerpt"
tags:
  - "tag1"
  - "tag2"
---

Body content here.`;

    const result = parseFrontmatter(raw, "test.md");

    expect(result.data.title).toBe("Test Post");
    expect(result.data.date).toBe("2024-06-15");
    expect(result.data.excerpt).toBe("A test excerpt");
    expect(result.data.tags).toEqual(["tag1", "tag2"]);
    expect(result.content).toBe("Body content here.");
  });

  it("parses frontmatter with inline array syntax", () => {
    const raw = `---
title: "Inline Tags"
tags: ["alpha", "beta"]
---

Content.`;

    const result = parseFrontmatter(raw, "inline.md");

    expect(result.data.tags).toEqual(["alpha", "beta"]);
  });

  it("parses frontmatter with empty arrays and objects", () => {
    const raw = `---
title: "Empty Collections"
tags: []
contact: {}
---

Content.`;

    const result = parseFrontmatter(raw, "empty.md");

    expect(result.data.tags).toEqual([]);
    expect(result.data.contact).toEqual({});
  });

  it("throws ContentValidationError for missing frontmatter", () => {
    const raw = "Just plain markdown without frontmatter.";

    expect(() => parseFrontmatter(raw, "no-frontmatter.md")).toThrow(
      ContentValidationError
    );
  });

  it("includes file path in error message for missing frontmatter", () => {
    const raw = "No frontmatter here.";

    try {
      parseFrontmatter(raw, "path/to/missing.md");
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ContentValidationError);
      expect((error as ContentValidationError).filePath).toBe("path/to/missing.md");
      expect((error as Error).message).toContain("path/to/missing.md");
    }
  });

  it("throws ContentValidationError for malformed YAML syntax", () => {
    const raw = `---
title
no colon here
---

Body.`;

    expect(() => parseFrontmatter(raw, "malformed.md")).toThrow(
      ContentValidationError
    );
  });

  it("handles quoted strings correctly", () => {
    const raw = `---
title: "Contains: colon in value"
subtitle: 'Single quotes work too'
---

Body.`;

    const result = parseFrontmatter(raw, "quoted.md");

    expect(result.data.title).toBe("Contains: colon in value");
    expect(result.data.subtitle).toBe("Single quotes work too");
  });

  it("handles boolean and numeric values", () => {
    const raw = `---
draft: true
published: false
count: 42
---

Body.`;

    const result = parseFrontmatter(raw, "types.md");

    expect(result.data.draft).toBe(true);
    expect(result.data.published).toBe(false);
    expect(result.data.count).toBe(42);
  });

  it("handles nested objects in arrays", () => {
    const raw = `---
projects:
  - name: "Project A"
    url: "https://a.com"
  - name: "Project B"
    url: "https://b.com"
---

Body.`;

    const result = parseFrontmatter(raw, "nested.md");

    expect(result.data.projects).toEqual([
      { name: "Project A", url: "https://a.com" },
      { name: "Project B", url: "https://b.com" },
    ]);
  });
});

describe("requireField", () => {
  it("returns value when field exists", () => {
    const data = { title: "Hello", date: "2024-01-01" };

    expect(requireField(data, "title", "test.md")).toBe("Hello");
    expect(requireField(data, "date", "test.md")).toBe("2024-01-01");
  });

  it("throws ContentValidationError when field is missing", () => {
    const data = { title: "Hello" };

    expect(() => requireField(data, "date", "test.md")).toThrow(
      ContentValidationError
    );
  });

  it("throws ContentValidationError when field is empty string", () => {
    const data = { title: "" };

    expect(() => requireField(data, "title", "test.md")).toThrow(
      ContentValidationError
    );
  });

  it("throws ContentValidationError when field is null", () => {
    const data = { title: null };

    expect(() => requireField(data, "title", "test.md")).toThrow(
      ContentValidationError
    );
  });

  it("includes field name in error message", () => {
    const data = {};

    try {
      requireField(data, "missingField", "test.md");
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ContentValidationError);
      expect((error as ContentValidationError).field).toBe("missingField");
      expect((error as Error).message).toContain("missingField");
    }
  });

  it("includes file path in error message", () => {
    const data = {};

    try {
      requireField(data, "title", "path/to/file.md");
      expect.fail("Should have thrown");
    } catch (error) {
      expect((error as ContentValidationError).filePath).toBe("path/to/file.md");
    }
  });
});

describe("extractSlugFromPath", () => {
  it("extracts slug from simple filename", () => {
    expect(extractSlugFromPath("content/blog/my-post.md")).toBe("my-post");
  });

  it("removes date prefix from filename", () => {
    expect(extractSlugFromPath("content/blog/2024-06-15-my-post.md")).toBe("my-post");
  });

  it("handles nested paths", () => {
    expect(extractSlugFromPath("a/b/c/d/filename.md")).toBe("filename");
  });

  it("returns 'unknown' for empty result", () => {
    expect(extractSlugFromPath("")).toBe("unknown");
  });

  it("handles path with only extension", () => {
    expect(extractSlugFromPath(".md")).toBe("unknown");
  });

  it("handles date-only filename after stripping", () => {
    expect(extractSlugFromPath("2024-01-01-.md")).toBe("unknown");
  });
});

describe("ContentValidationError", () => {
  it("formats error message with file path", () => {
    const error = new ContentValidationError(
      "Missing required field",
      "path/to/file.md"
    );

    expect(error.message).toBe("[path/to/file.md] Missing required field");
    expect(error.filePath).toBe("path/to/file.md");
    expect(error.name).toBe("ContentValidationError");
  });

  it("includes optional field property", () => {
    const error = new ContentValidationError(
      "Missing required field",
      "file.md",
      "title"
    );

    expect(error.field).toBe("title");
  });
});
