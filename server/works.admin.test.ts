import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { worksRouter } from "./worksRouter";
import type { TrpcContext } from "./_core/context";

const { 
  DatabaseUnavailableError,
  WorkNotFoundError,
  WorkSlugConflictError,
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
  class WorkNotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "WorkNotFoundError";
    }
  }
  class WorkSlugConflictError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "WorkSlugConflictError";
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
    WorkNotFoundError,
    WorkSlugConflictError,
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
  toSanitizedError: vi.fn(() => new Error("Sanitized error")),
}));

vi.mock("./db", () => ({
  createWork: vi.fn(),
  updateWork: vi.fn(),
  publishWork: vi.fn(),
  softDeleteWork: vi.fn(),
  getWorkDraftById: vi.fn(),
  DatabaseUnavailableError,
  WorkNotFoundError,
  WorkSlugConflictError,
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

describe("Works Admin Operations - RED Phase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("create draft work with valid input", async () => {
    const ctx = createAdminContext();
    const caller = worksRouter.createCaller(ctx);

    const { createWork } = await import("./db");
    const mockWork = {
      id: 1,
      title: "Test Portfolio Work",
      slug: "test-portfolio-work",
      content: "Portfolio content",
      description: null,
      status: "draft" as const,
      createdAt: new Date("2026-03-17"),
      updatedAt: new Date("2026-03-17"),
      publishedAt: null,
      deletedAt: null,
      snapshotVersion: 0,
      renderedSnapshot: null,
    };

    vi.mocked(createWork).mockResolvedValue(mockWork);

    const result = await caller.create({
      title: "Test Portfolio Work",
      slug: "test-portfolio-work",
      content: "Portfolio content",
    });

    expect(result.success).toBe(true);
    expect(result.work.id).toBe(1);
    expect(result.work.title).toBe("Test Portfolio Work");
    expect(result.work.slug).toBe("test-portfolio-work");
    expect(result.work.status).toBe("draft");
    expect(createWork).toHaveBeenCalledWith({
      title: "Test Portfolio Work",
      slug: "test-portfolio-work",
      content: "Portfolio content",
    });
  });

  it("update work with partial fields", async () => {
    const ctx = createAdminContext();
    const caller = worksRouter.createCaller(ctx);

    const { updateWork } = await import("./db");
    const { invalidateContentType } = await import("./_core/cache");

    const mockUpdatedWork = {
      id: 1,
      title: "Updated Title",
      slug: "test-portfolio-work",
      content: "Portfolio content",
      description: null,
      status: "draft" as const,
      createdAt: new Date("2026-03-17"),
      updatedAt: new Date("2026-03-17"),
      publishedAt: null,
      deletedAt: null,
      snapshotVersion: 0,
      renderedSnapshot: null,
    };

    vi.mocked(updateWork).mockResolvedValue(mockUpdatedWork);

    const result = await caller.update({
      id: 1,
      title: "Updated Title",
    });

    expect(result.success).toBe(true);
    expect(result.work.title).toBe("Updated Title");
    expect(updateWork).toHaveBeenCalledWith({
      id: 1,
      title: "Updated Title",
    });
    expect(invalidateContentType).toHaveBeenCalledWith("works");
  });

  it("publish work with valid content", async () => {
    const ctx = createAdminContext();
    const caller = worksRouter.createCaller(ctx);

    const { publishWork } = await import("./db");
    const { logSecurityEvent } = await import("./_core/security");
    const { invalidateContentType } = await import("./_core/cache");

    const mockPublishedWork = {
      id: 1,
      title: "Published Work",
      slug: "published-work",
      content: "Published content",
      description: "A portfolio piece",
      status: "published" as const,
      createdAt: new Date("2026-03-17"),
      updatedAt: new Date("2026-03-17"),
      publishedAt: new Date("2026-03-17"),
      deletedAt: null,
      snapshotVersion: 1,
      renderedSnapshot: "<p>Published content</p>",
    };

    vi.mocked(publishWork).mockResolvedValue(mockPublishedWork);

    const result = await caller.publish({ id: 1 });

    expect(result.success).toBe(true);
    expect(result.work.id).toBe(1);
    expect(result.work.status).toBe("published");
    expect(result.work.publishedAt).not.toBeNull();
    expect(publishWork).toHaveBeenCalledWith(1);
    expect(logSecurityEvent).toHaveBeenCalledWith("work_published", {
      userId: "1",
      workId: 1,
    });
    expect(invalidateContentType).toHaveBeenCalledWith("works");
  });

  it("publish rejects invalid asset reference", async () => {
    const ctx = createAdminContext();
    const caller = worksRouter.createCaller(ctx);

    const { publishWork } = await import("./db");
    vi.mocked(publishWork).mockRejectedValueOnce(
      new AssetNotFoundError(888)
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

  it("publish rejects asset not ready", async () => {
    const ctx = createAdminContext();
    const caller = worksRouter.createCaller(ctx);

    const { publishWork } = await import("./db");
    vi.mocked(publishWork).mockRejectedValueOnce(
      new AssetNotReadyError(777, "pending")
    );

    try {
      await caller.publish({ id: 1 });
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("PRECONDITION_FAILED");
      expect((error as TRPCError).message).toBe("Asset upload not complete.");
    }
  });

  it("softDelete marks work as deleted", async () => {
    const ctx = createAdminContext();
    const caller = worksRouter.createCaller(ctx);

    const { softDeleteWork } = await import("./db");
    const { logSecurityEvent } = await import("./_core/security");
    const { invalidateContentType } = await import("./_core/cache");

    vi.mocked(softDeleteWork).mockResolvedValue(undefined);

    const result = await caller.softDelete({ id: 1 });

    expect(result.success).toBe(true);
    expect(softDeleteWork).toHaveBeenCalledWith(1);
    expect(logSecurityEvent).toHaveBeenCalledWith("work_deleted", {
      userId: "1",
      workId: 1,
    });
    expect(invalidateContentType).toHaveBeenCalledWith("works");
  });

  it("getDraft returns draft work by id", async () => {
    const ctx = createAdminContext();
    const caller = worksRouter.createCaller(ctx);

    const { getWorkDraftById } = await import("./db");
    const mockDraft = {
      id: 5,
      title: "Draft Work",
      slug: "draft-work",
      content: "Draft content",
      description: null,
      status: "draft" as const,
      createdAt: new Date("2026-03-17"),
      updatedAt: new Date("2026-03-17"),
      publishedAt: null,
      deletedAt: null,
      snapshotVersion: 0,
      renderedSnapshot: null,
    };

    vi.mocked(getWorkDraftById).mockResolvedValue(mockDraft);

    const result = await caller.getDraft({ id: 5 });

    expect(result.id).toBe(5);
    expect(result.title).toBe("Draft Work");
    expect(result.status).toBe("draft");
    expect(getWorkDraftById).toHaveBeenCalledWith(5);
  });

  it("getDraft throws when work not found", async () => {
    const ctx = createAdminContext();
    const caller = worksRouter.createCaller(ctx);

    const { getWorkDraftById } = await import("./db");
    vi.mocked(getWorkDraftById).mockResolvedValue(undefined);

    try {
      await caller.getDraft({ id: 999 });
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("NOT_FOUND");
      expect((error as TRPCError).message).toBe("Work not found.");
    }
  });
});
