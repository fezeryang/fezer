/**
 * Content Loader Types
 *
 * Type definitions for statically loaded content from markdown files.
 * These types match the frontmatter schema defined in content/README.md.
 */

/**
 * Blog post content loaded from content/blog/*.md
 */
export interface Post {
  /** Unique identifier derived from filename or frontmatter slug */
  slug: string;
  /** Post title (required) */
  title: string;
  /** ISO 8601 date string for sorting (required) */
  date: string;
  /** Short preview text (normalized from excerpt or summary) */
  excerpt: string;
  /** Topic tags for categorization */
  tags: string[];
  /** Optional primary category */
  category?: string;
  /** Markdown body content */
  body: string;
}

/**
 * Raw frontmatter from blog posts before normalization
 * Index signature allows for additional unknown properties in YAML
 */
export interface PostFrontmatter {
  title?: string;
  date?: string;
  excerpt?: string;
  summary?: string;
  tags?: string[];
  category?: string;
  slug?: string;
  [key: string]: unknown;
}

/**
 * Portfolio work/project loaded from content/works/*.md
 */
export interface Work {
  /** Unique identifier derived from filename or frontmatter slug */
  slug: string;
  /** Project name (required) */
  title: string;
  /** One-paragraph summary for card display (required) */
  description: string;
  /** ISO 8601 date string for sorting (optional, defaults to epoch for sort) */
  date?: string;
  /** Technology/domain tags */
  tags: string[];
  /** Comma-separated tech stack */
  technologies?: string;
  /** External project URL */
  link?: string;
  /** Path to project thumbnail */
  imageUrl?: string;
  /** Markdown body content */
  body: string;
}

/**
 * Raw frontmatter from works before normalization
 */
export interface WorkFrontmatter {
  title?: string;
  description?: string;
  summary?: string;
  date?: string;
  tags?: string[];
  technologies?: string;
  link?: string;
  imageUrl?: string;
  slug?: string;
  [key: string]: unknown;
}

/**
 * Profile content loaded from content/profile/*.{locale}.md
 */
export interface Profile {
  /** Display name (required) */
  name: string;
  /** One-line tagline (required) */
  bio: string;
  /** Language code like "zh-CN" or "en-US" (required) */
  locale: string;
  /** Path to profile image */
  avatar?: string;
  /** List of skills/interests */
  skills: string[];
  /** Featured projects with name and url */
  projects: Array<{ name: string; url: string }>;
  /** Social links with platform names as keys */
  contact: Record<string, string>;
  /** Extended biography markdown content */
  body: string;
}

/**
 * Raw frontmatter from profile before normalization
 */
export interface ProfileFrontmatter {
  name?: string;
  bio?: string;
  locale?: string;
  avatar?: string;
  skills?: string[];
  projects?: Array<{ name: string; url: string }>;
  contact?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Error thrown when content validation fails
 */
export class ContentValidationError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly field?: string
  ) {
    super(`[${filePath}] ${message}`);
    this.name = "ContentValidationError";
  }
}
