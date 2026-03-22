import { describe, it, expect } from "vitest";

describe("works loader", () => {
  describe("loadWorks integration", () => {
    it("exports loadWorks function", async () => {
      const worksModule = await import("../works");
      expect(typeof worksModule.loadWorks).toBe("function");
    });

    it("exports getWorkBySlug function", async () => {
      const worksModule = await import("../works");
      expect(typeof worksModule.getWorkBySlug).toBe("function");
    });

    it("loadWorks returns an array", async () => {
      const { loadWorks } = await import("../works");
      const works = loadWorks();
      expect(Array.isArray(works)).toBe(true);
    });

    it("works have required fields", async () => {
      const { loadWorks } = await import("../works");
      const works = loadWorks();
      
      if (works.length === 0) return;
      
      const work = works[0];
      expect(work).toHaveProperty("slug");
      expect(work).toHaveProperty("title");
      expect(work).toHaveProperty("description");
      expect(work).toHaveProperty("tags");
      expect(work).toHaveProperty("body");
    });

    it("works are sorted newest first with slug tie-breaker", async () => {
      const { loadWorks } = await import("../works");
      const works = loadWorks();
      
      if (works.length < 2) return;
      
      for (let i = 0; i < works.length - 1; i++) {
        const currentDate = works[i].date ? new Date(works[i].date!).getTime() : 0;
        const nextDate = works[i + 1].date ? new Date(works[i + 1].date!).getTime() : 0;
        
        if (currentDate === nextDate) {
          expect(works[i].slug.localeCompare(works[i + 1].slug)).toBeLessThanOrEqual(0);
        } else {
          expect(currentDate).toBeGreaterThanOrEqual(nextDate);
        }
      }
    });

    it("getWorkBySlug returns undefined for non-existent slug", async () => {
      const { getWorkBySlug } = await import("../works");
      const work = getWorkBySlug("non-existent-slug-xyz-123");
      expect(work).toBeUndefined();
    });

    it("getWorkBySlug returns work for valid slug", async () => {
      const { loadWorks, getWorkBySlug } = await import("../works");
      const works = loadWorks();
      
      if (works.length === 0) return;
      
      const firstWork = works[0];
      const foundWork = getWorkBySlug(firstWork.slug);
      expect(foundWork).toBeDefined();
      expect(foundWork?.slug).toBe(firstWork.slug);
    });

    it("skips README.md file", async () => {
      const { loadWorks } = await import("../works");
      const works = loadWorks();
      
      const readmeWork = works.find(w => w.slug === "README" || w.slug === "readme");
      expect(readmeWork).toBeUndefined();
    });
  });

  describe("work normalization validation", () => {
    it("works have non-empty title", async () => {
      const { loadWorks } = await import("../works");
      const works = loadWorks();
      
      for (const work of works) {
        expect(work.title.length).toBeGreaterThan(0);
      }
    });

    it("works have non-empty slug", async () => {
      const { loadWorks } = await import("../works");
      const works = loadWorks();
      
      for (const work of works) {
        expect(work.slug.length).toBeGreaterThan(0);
        expect(work.slug).not.toBe("unknown");
      }
    });

    it("works have non-empty description", async () => {
      const { loadWorks } = await import("../works");
      const works = loadWorks();
      
      for (const work of works) {
        expect(work.description.length).toBeGreaterThan(0);
      }
    });

    it("tags array is always defined", async () => {
      const { loadWorks } = await import("../works");
      const works = loadWorks();
      
      for (const work of works) {
        expect(Array.isArray(work.tags)).toBe(true);
      }
    });

    it("body is string containing markdown content", async () => {
      const { loadWorks } = await import("../works");
      const works = loadWorks();
      
      for (const work of works) {
        expect(typeof work.body).toBe("string");
      }
    });

    it("optional fields are correct types when present", async () => {
      const { loadWorks } = await import("../works");
      const works = loadWorks();
      
      for (const work of works) {
        if (work.date !== undefined) {
          expect(typeof work.date).toBe("string");
        }
        if (work.technologies !== undefined) {
          expect(typeof work.technologies).toBe("string");
        }
        if (work.link !== undefined) {
          expect(typeof work.link).toBe("string");
        }
        if (work.imageUrl !== undefined) {
          expect(typeof work.imageUrl).toBe("string");
        }
      }
    });
  });
});

describe("works loader error handling", () => {
  it("ContentValidationError can be created with work-specific context", async () => {
    const { ContentValidationError } = await import("../types");
    const error = new ContentValidationError("Missing description", "works/project.md", "description");
    
    expect(error.message).toContain("works/project.md");
    expect(error.filePath).toBe("works/project.md");
    expect(error.field).toBe("description");
  });
});
