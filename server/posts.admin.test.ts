import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { postsRouter } from "./postsRouter";
import type { TrpcContext } from "./_core/context";

const { 
  DatabaseUnavailableError,
  PostNotFoundError,
  PostSlugConflictError,
  AssetNotFoundError,
  AssetNotReadyError,
  MalformedAssetReferenceError,
  ExternalAssetReferenceError,
} = vi.hoisted(() => {
  class DatabaseUnavailableError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "DatabaseUnavailableError";
    }
  }
  class PostNotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "PostNotFoundError";
    }
  }
  class PostSlugConflictError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "PostSlugConflictError";
    }
  }
  class AssetNotFoundError extends Error {
    constructor(public readonly assetId: number, message?: string) {
      super(message ?? `Asset with id ${assetId} not found`);
      this.name = "AssetNotFoundError";
    }
  }
  class AssetNotReadyError extends Error {
    constructor(public readonly assetId: number, public readonly status: string, message?: string) {
      super(message ?? `Asset ${assetId} is not ready for publish (status: ${status})`);
      this.name = "AssetNotReadyError";
    }
  }
  class MalformedAssetReferenceError extends Error {
    constructor(public readonly reference: string, message?: string) {
      super(message ?? `Malformed asset reference: ${reference}`);
      this.name = "MalformedAssetReferenceError";
    }
  }
  class ExternalAssetReferenceError extends Error {
    constructor(public readonly url: string, message?: string) {
      super(message ?? `External asset reference not allowed: ${url}`);
      this.name = "ExternalAssetReferenceError";
    }
  }

  return {
    DatabaseUnavailableError,
    PostNotFoundError,
    PostSlugConflictError,
    AssetNotFoundError,
    AssetNotReadyError,
    MalformedAssetReferenceError,
    ExternalAssetReferenceError,
  };
});

vi.mock("./_core/cache", () => ({
  getCacheControlHeader: vi.fn(() => "public, max-age=300"),
  invalidateContentType: vi.fn(),
  logCacheHit: vi.fn(),
}));

vi.mock("./_core/security", () => ({
  logSecurityEvent: vi.fn(),
  toSanitizedError: vi.fn((err) => new Error("Sanitized error")),
}));

vi.mock("./db", () => ({
  createPost: vi.fn(),
  updatePost: vi.fn(),
  publishPost: vi.fn(),
  softDeletePost: vi.fn(),
  getPostDraftById: vi.fn(),
  DatabaseUnavailableError,
  PostNotFoundError,
  PostSlugConflictError,
  AssetNotFoundError,
  AssetNotReadyError,
  MalformedAssetReferenceError,
  ExternalAssetReferenceError,
}));

function createAdminContext(): TrpcContext {
  return {
    req: {} as TrpcContext["req"],
    res: {
      setHeader: vi.fn(),
    } as unknown as TrpcContext["res"],
    user: {
      id: 1,
      openId: "admin-open-id",
      name: "Admin User",
      email: "admin@example.com",
      loginMethod: "password",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  };
}

describe("Posts Admin Operations - GREEN Phase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("create draft post with valid input", async () => {
    const ctx = createAdminContext();
    const caller = postsRouter.createCaller(ctx);

    const { createPost } = await import("./db");
    const mockPost = {
      id: 1,
      title: "Test Draft",
      slug: "test-draft",
      content: "Draft content",
      excerpt: null,
      status: "draft" as const,
      date: "2026-03-17",
      category: null,
      createdAt: new Date("2026-03-17"),
      updatedAt: new Date("2026-03-17"),
      publishedAt: null,
      deletedAt: null,
      snapshotVersion: 0,
      renderedSnapshot: null,
    };

    vi.mocked(createPost).mockResolvedValue(mockPost);

    const result = await caller.create({
      title: "Test Draft",
      slug: "test-draft",
      content: "Draft content",
    });

    expect(result.success).toBe(true);
    expect(result.post.id).toBe(1);
    expect(result.post.title).toBe("Test Draft");
    expect(result.post.slug).toBe("test-draft");
    expect(result.post.status).toBe("draft");
    expect(createPost).toHaveBeenCalledWith({
      title: "Test Draft",
      slug: "test-draft",
      content: "Draft content",
    });
  });

  it("publish post with valid content", async () => {
    const ctx = createAdminContext();
    const caller = postsRouter.createCaller(ctx);

    const { publishPost } = await import("./db");
    const { logSecurityEvent } = await import("./_core/security");
    const { invalidateContentType } = await import("./_core/cache");

    const mockPublishedPost = {
      id: 1,
      title: "Published Post",
      slug: "published-post",
      content: "Published content",
      excerpt: null,
      status: "published" as const,
      date: "2026-03-17",
      category: null,
      createdAt: new Date("2026-03-17"),
      updatedAt: new Date("2026-03-17"),
      publishedAt: new Date("2026-03-17"),
      deletedAt: null,
      snapshotVersion: 1,
      renderedSnapshot: "<p>Published content</p>",
    };

    vi.mocked(publishPost).mockResolvedValue(mockPublishedPost);

    const result = await caller.publish({ id: 1 });

    expect(result.success).toBe(true);
    expect(result.post.id).toBe(1);
    expect(result.post.status).toBe("published");
    expect(result.post.publishedAt).not.toBeNull();
    expect(publishPost).toHaveBeenCalledWith(1);
    expect(logSecurityEvent).toHaveBeenCalledWith("post_published", {
      userId: "1",
      postId: 1,
    });
    expect(invalidateContentType).toHaveBeenCalledWith("posts");
  });

  it("publish rejects invalid asset reference", async () => {
    const ctx = createAdminContext();
    const caller = postsRouter.createCaller(ctx);

    const { publishPost } = await import("./db");
    vi.mocked(publishPost).mockRejectedValueOnce(
      new AssetNotFoundError(999)
    );

    await expect(caller.publish({ id: 1 })).rejects.toThrow(TRPCError);

    try {
      await caller.publish({ id: 1 });
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("BAD_REQUEST");
      expect((error as TRPCError).message).toBe("Referenced asset not found.");
    }
  });

  it("softDelete marks post as deleted", async () => {
    const ctx = createAdminContext();
    const caller = postsRouter.createCaller(ctx);

    const { softDeletePost } = await import("./db");
    const { logSecurityEvent } = await import("./_core/security");
    const { invalidateContentType } = await import("./_core/cache");

    vi.mocked(softDeletePost).mockResolvedValue(undefined);

    const result = await caller.softDelete({ id: 1 });

    expect(result.success).toBe(true);
    expect(softDeletePost).toHaveBeenCalledWith(1);
    expect(logSecurityEvent).toHaveBeenCalledWith("post_deleted", {
      userId: "1",
      postId: 1,
    });
    expect(invalidateContentType).toHaveBeenCalledWith("posts");
  });

  it("update post with partial fields", async () => {
    const ctx = createAdminContext();
    const caller = postsRouter.createCaller(ctx);

    const { updatePost } = await import("./db");
    const { invalidateContentType } = await import("./_core/cache");

    const mockUpdatedPost = {
      id: 1,
      title: "Updated Title",
      slug: "test-draft",
      content: "Draft content",
      excerpt: null,
      status: "draft" as const,
      date: "2026-03-17",
      category: null,
      createdAt: new Date("2026-03-17"),
      updatedAt: new Date("2026-03-17"),
      publishedAt: null,
      deletedAt: null,
      snapshotVersion: 0,
      renderedSnapshot: null,
    };

    vi.mocked(updatePost).mockResolvedValue(mockUpdatedPost);

    const result = await caller.update({
      id: 1,
      title: "Updated Title",
    });

    expect(result.success).toBe(true);
    expect(result.post.id).toBe(1);
    expect(result.post.title).toBe("Updated Title");
    expect(updatePost).toHaveBeenCalledWith({
      id: 1,
      title: "Updated Title",
    });
    expect(invalidateContentType).toHaveBeenCalledWith("posts");
  });

  it("getDraft retrieves draft post by id", async () => {
    const ctx = createAdminContext();
    const caller = postsRouter.createCaller(ctx);

    const { getPostDraftById } = await import("./db");

    const mockDraft = {
      id: 5,
      title: "Draft Post",
      slug: "draft-post",
      content: "Draft content",
      excerpt: null,
      status: "draft" as const,
      date: "2026-03-17",
      category: null,
      createdAt: new Date("2026-03-17"),
      updatedAt: new Date("2026-03-17"),
      publishedAt: null,
      deletedAt: null,
      snapshotVersion: 0,
      renderedSnapshot: null,
    };

    vi.mocked(getPostDraftById).mockResolvedValue(mockDraft);

    const result = await caller.getDraft({ id: 5 });

    expect(result.id).toBe(5);
    expect(result.title).toBe("Draft Post");
    expect(result.status).toBe("draft");
    expect(getPostDraftById).toHaveBeenCalledWith(5);
  });

  it("getDraft throws NOT_FOUND for missing draft", async () => {
    const ctx = createAdminContext();
    const caller = postsRouter.createCaller(ctx);

    const { getPostDraftById } = await import("./db");
    vi.mocked(getPostDraftById).mockResolvedValue(undefined);

    await expect(caller.getDraft({ id: 999 })).rejects.toThrow(TRPCError);

    try {
      await caller.getDraft({ id: 999 });
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("NOT_FOUND");
    }
  });
});
