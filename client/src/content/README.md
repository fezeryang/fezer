# Content Schema Reference

This directory contains static content for the portfolio site. All markdown files use YAML frontmatter.

## Frontmatter Schema

### Blog Posts (`blog/*.md`)

**Required fields:**
- `title` (string): Post title displayed in sidebar
- `date` (string): ISO 8601 date (e.g., "2024-03-15") for chronological sort

**Optional fields:**
- `excerpt` (string): Short preview text (1-3 sentences)
- `summary` (string): Alternative to `excerpt` for preview text (use one or the other)
- `tags` (string[]): Array of topic tags for filtering/categorization
- `category` (string): Post category/tag
- `slug` (string): URL-friendly identifier (auto-derived from filename if omitted)

**Example:**
```yaml
---
title: "Architectural Sonics"
date: "2024-06-15"
excerpt: "Exploring the intersection of sound and spatial design."
category: "Architecture"
---

Post content goes here...
```

### Works (`works/*.md`)

**Required fields:**
- `title` (string): Project name
- `description` (string): One-paragraph summary (shown in grid cards)

**Optional fields:**
- `slug` (string): URL-friendly identifier (auto-derived from filename if omitted)
- `summary` (string): Alternative to `description` for brief project summary
- `tags` (string[]): Array of technology/domain tags
- `technologies` (string): Comma-separated tech stack
- `link` (string): External project URL
- `imageUrl` (string): Path to project thumbnail

**Example:**
```yaml
---
title: "Kinetic Typography Engine"
description: "A creative work exploring digital and physical boundaries."
technologies: "React, p5.js, TypeScript"
link: "https://example.com"
---

Detailed project write-up...
```

### Profile (`profile/*.{lang}.md`)

**Required fields:**
- `name` (string): Display name
- `bio` (string): One-line tagline
- `locale` (string): Language code (e.g., "zh-CN", "en-US")

**Optional fields:**
- `avatar` (string): Path to profile image
- `skills` (string[]): List of skills/interests
- `projects` (object[]): Featured projects with `name` and `url`
- `contact` (object): Social links with platform names as keys

**Example:**
```yaml
---
name: "Fezer"
bio: "AI爱好者 / 研究生在读"
locale: "zh-CN"
skills: ["vibe coding", "写作", "摄影"]
projects: []
contact: {}
---

Extended biography content (optional)...
```

## File Naming Conventions

- Blog posts: `YYYY-MM-DD-title-slug.md` (date prefix for chronological file sorting)
- Works: `project-slug.md` (no date prefix)
- Profile: `username.{locale}.md` (e.g., `fezer.zh-CN.md`, `fezer.en-US.md`)

## Loading Pattern (for Task 3)

Recommended loader using `import.meta.glob` + `gray-matter`:

```typescript
import matter from 'gray-matter';

const rawFiles = import.meta.glob('./blog/*.md', { eager: true, as: 'raw' });

export function loadPosts() {
  return Object.entries(rawFiles)
    .map(([path, raw]) => {
      const { data, content } = matter(raw as string);
      return { ...data, body: content };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
```

See `.sisyphus/notepads/fezer-github-pages-static-refresh/learnings.md` for full implementation guide.
