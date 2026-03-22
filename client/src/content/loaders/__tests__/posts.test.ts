import { describe, it, expect } from "vitest";

describe("posts loader", () => {
  describe("loadPosts integration", () => {
    it("exports loadPosts function", async () => {
      const postsModule = await import("../posts");
      expect(typeof postsModule.loadPosts).toBe("function");
    });

    it("exports getPostBySlug function", async () => {
      const postsModule = await import("../posts");
      expect(typeof postsModule.getPostBySlug).toBe("function");
    });

    it("loadPosts returns an array", async () => {
      const { loadPosts } = await import("../posts");
      const posts = loadPosts();
      expect(Array.isArray(posts)).toBe(true);
    });

    it("posts have required fields", async () => {
      const { loadPosts } = await import("../posts");
      const posts = loadPosts();
      
      if (posts.length === 0) return;
      
      const post = posts[0];
      expect(post).toHaveProperty("slug");
      expect(post).toHaveProperty("title");
      expect(post).toHaveProperty("date");
      expect(post).toHaveProperty("excerpt");
      expect(post).toHaveProperty("tags");
      expect(post).toHaveProperty("body");
    });

    it("posts are sorted newest first with slug tie-breaker", async () => {
      const { loadPosts } = await import("../posts");
      const posts = loadPosts();
      
      if (posts.length < 2) return;
      
      for (let i = 0; i < posts.length - 1; i++) {
        const currentDate = new Date(posts[i].date).getTime();
        const nextDate = new Date(posts[i + 1].date).getTime();
        
        if (currentDate === nextDate) {
          expect(posts[i].slug.localeCompare(posts[i + 1].slug)).toBeLessThanOrEqual(0);
        } else {
          expect(currentDate).toBeGreaterThanOrEqual(nextDate);
        }
      }
    });

    it("getPostBySlug returns undefined for non-existent slug", async () => {
      const { getPostBySlug } = await import("../posts");
      const post = getPostBySlug("non-existent-slug-xyz-123");
      expect(post).toBeUndefined();
    });

    it("getPostBySlug returns post for valid slug", async () => {
      const { loadPosts, getPostBySlug } = await import("../posts");
      const posts = loadPosts();
      
      if (posts.length === 0) return;
      
      const firstPost = posts[0];
      const foundPost = getPostBySlug(firstPost.slug);
      expect(foundPost).toBeDefined();
      expect(foundPost?.slug).toBe(firstPost.slug);
    });

    it("skips files starting with underscore", async () => {
      const { loadPosts } = await import("../posts");
      const posts = loadPosts();
      
      const malformedPost = posts.find(p => p.slug === "_test-malformed" || p.slug === "test-malformed");
      expect(malformedPost).toBeUndefined();
    });

    it("skips README.md file", async () => {
      const { loadPosts } = await import("../posts");
      const posts = loadPosts();
      
      const readmePost = posts.find(p => p.slug === "README" || p.slug === "readme");
      expect(readmePost).toBeUndefined();
    });
  });

  describe("post normalization validation", () => {
    it("valid posts have ISO 8601 date format", async () => {
      const { loadPosts } = await import("../posts");
      const posts = loadPosts();
      
      for (const post of posts) {
        const dateObj = new Date(post.date);
        expect(isNaN(dateObj.getTime())).toBe(false);
      }
    });

    it("posts have non-empty title", async () => {
      const { loadPosts } = await import("../posts");
      const posts = loadPosts();
      
      for (const post of posts) {
        expect(post.title.length).toBeGreaterThan(0);
      }
    });

    it("posts have non-empty slug", async () => {
      const { loadPosts } = await import("../posts");
      const posts = loadPosts();
      
      for (const post of posts) {
        expect(post.slug.length).toBeGreaterThan(0);
        expect(post.slug).not.toBe("unknown");
      }
    });

    it("tags array is always defined", async () => {
      const { loadPosts } = await import("../posts");
      const posts = loadPosts();
      
      for (const post of posts) {
        expect(Array.isArray(post.tags)).toBe(true);
      }
    });

    it("excerpt is string (may be empty)", async () => {
      const { loadPosts } = await import("../posts");
      const posts = loadPosts();
      
      for (const post of posts) {
        expect(typeof post.excerpt).toBe("string");
      }
    });

    it("body is string containing markdown content", async () => {
      const { loadPosts } = await import("../posts");
      const posts = loadPosts();
      
      for (const post of posts) {
        expect(typeof post.body).toBe("string");
      }
    });
  });
});

describe("posts loader error handling", () => {
  it("ContentValidationError is exported from types", async () => {
    const { ContentValidationError } = await import("../types");
    expect(ContentValidationError).toBeDefined();
    expect(typeof ContentValidationError).toBe("function");
  });

  it("ContentValidationError includes file path and field info", async () => {
    const { ContentValidationError } = await import("../types");
    const error = new ContentValidationError("Test error", "test/path.md", "title");
    
    expect(error.message).toContain("test/path.md");
    expect(error.filePath).toBe("test/path.md");
    expect(error.field).toBe("title");
    expect(error.name).toBe("ContentValidationError");
  });
});
