import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Work } from "../drizzle/schema";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import {
  AssetNotFoundError,
  AssetNotReadyError,
  createWork,
  DatabaseUnavailableError,
  ExternalAssetReferenceError,
  getPublishedWorkBySlug,
  getPublishedWorks,
  getWorkDraftById,
  MalformedAssetReferenceError,
  publishWork,
  softDeleteWork,
  updateWork,
  WorkNotFoundError,
  WorkSlugConflictError,
} from "./db";
import {
  getCacheControlHeader,
  invalidateContentType,
  logCacheHit,
} from "./_core/cache";
import { logSecurityEvent, toSanitizedError } from "./_core/security";

function toTrpcError(error: unknown, context?: { route: string; userId?: string }): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }

  if (error instanceof DatabaseUnavailableError) {
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Service temporarily unavailable.",
    });
  }

  if (error instanceof WorkNotFoundError) {
    return new TRPCError({
      code: "NOT_FOUND",
      message: "Work not found.",
    });
  }

  if (error instanceof WorkSlugConflictError) {
    return new TRPCError({
      code: "CONFLICT",
      message: "A work with this slug already exists.",
    });
  }

  if (error instanceof AssetNotFoundError) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: "Referenced asset not found.",
    });
  }

  if (error instanceof AssetNotReadyError) {
    return new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Asset upload not complete.",
    });
  }

  if (error instanceof MalformedAssetReferenceError) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid asset reference.",
    });
  }

  if (error instanceof ExternalAssetReferenceError) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: "External asset references not allowed.",
    });
  }

  if (context) {
    return toSanitizedError(error, context);
  }

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Failed to process request.",
  });
}

const localWorkStore: Work[] = [];
let localWorkIdCounter = 1;

function canUseLocalContentFallback(): boolean {
  return ENV.enableLocalContentFallback;
}

function isDatabaseUnavailable(error: unknown): error is DatabaseUnavailableError {
  if (error instanceof DatabaseUnavailableError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const directCode = (error as { code?: unknown }).code;
  if (directCode === "ECONNREFUSED") {
    return true;
  }

  const cause = (error as { cause?: unknown }).cause;
  if (!(cause instanceof Error)) {
    return false;
  }

  const causeCode = (cause as { code?: unknown }).code;
  return causeCode === "ECONNREFUSED";
}

function cloneWork(work: Work): Work {
  return {
    ...work,
  };
}

function getVisibleLocalWorks(): Work[] {
  return localWorkStore
    .filter((work) => work.status === "published" && work.deletedAt === null)
    .sort((a, b) => {
      const aTime = a.publishedAt ? a.publishedAt.getTime() : 0;
      const bTime = b.publishedAt ? b.publishedAt.getTime() : 0;
      if (aTime === bTime) {
        return b.id - a.id;
      }
      return bTime - aTime;
    });
}

function localListWorks(input?: { limit?: number; offset?: number }) {
  const limit = input?.limit ?? 20;
  const offset = input?.offset ?? 0;
  const visible = getVisibleLocalWorks();
  return {
    works: visible.slice(offset, offset + limit).map(cloneWork),
    total: visible.length,
  };
}

function localGetWork(slug: string): Work | null {
  const work = localWorkStore.find(
    (item) => item.slug === slug && item.status === "published" && item.deletedAt === null
  );
  return work ? cloneWork(work) : null;
}

function localGetDraftWork(id: number): Work | null {
  const work = localWorkStore.find(
    (item) => item.id === id && item.status === "draft" && item.deletedAt === null
  );
  return work ? cloneWork(work) : null;
}

function ensureLocalSlugAvailable(slug: string, currentId?: number): void {
  const hasConflict = localWorkStore.some(
    (item) => item.slug === slug && item.deletedAt === null && item.id !== currentId
  );
  if (hasConflict) {
    throw new WorkSlugConflictError();
  }
}

function localCreateWork(input: {
  title: string;
  slug: string;
  content: string;
  description?: string;
}): Work {
  ensureLocalSlugAvailable(input.slug);
  const now = new Date();
  const work: Work = {
    id: localWorkIdCounter++,
    title: input.title,
    slug: input.slug,
    content: input.content,
    description: input.description ?? null,
    status: "draft",
    publishedAt: null,
    deletedAt: null,
    snapshotVersion: 0,
    renderedSnapshot: null,
    createdAt: now,
    updatedAt: now,
  };
  localWorkStore.push(work);
  return cloneWork(work);
}

function localUpdateWork(input: {
  id: number;
  title?: string;
  slug?: string;
  description?: string;
  content?: string;
  status?: "draft" | "published" | "archived";
}): Work {
  const index = localWorkStore.findIndex((item) => item.id === input.id && item.deletedAt === null);
  if (index === -1) {
    throw new WorkNotFoundError();
  }

  const existing = localWorkStore[index];
  if (!existing) {
    throw new WorkNotFoundError();
  }

  if (input.slug !== undefined) {
    ensureLocalSlugAvailable(input.slug, existing.id);
  }

  const next: Work = {
    ...existing,
    title: input.title ?? existing.title,
    slug: input.slug ?? existing.slug,
    description: input.description === undefined ? existing.description : input.description,
    content: input.content ?? existing.content,
    status: input.status ?? existing.status,
    updatedAt: new Date(),
  };

  localWorkStore[index] = next;
  return cloneWork(next);
}

function localPublishWork(id: number): Work {
  const index = localWorkStore.findIndex((item) => item.id === id && item.deletedAt === null);
  if (index === -1) {
    throw new WorkNotFoundError();
  }

  const existing = localWorkStore[index];
  if (!existing) {
    throw new WorkNotFoundError();
  }

  const publishedAt = new Date();
  const next: Work = {
    ...existing,
    status: "published",
    publishedAt,
    snapshotVersion: existing.snapshotVersion + 1,
    updatedAt: publishedAt,
  };

  localWorkStore[index] = next;
  return cloneWork(next);
}

function localSoftDeleteWork(id: number): void {
  const index = localWorkStore.findIndex((item) => item.id === id && item.deletedAt === null);
  if (index === -1) {
    throw new WorkNotFoundError();
  }

  const existing = localWorkStore[index];
  if (!existing) {
    throw new WorkNotFoundError();
  }

  localWorkStore[index] = {
    ...existing,
    deletedAt: new Date(),
    updatedAt: new Date(),
  };
}

export const worksRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          offset: z.number().min(0).optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      try {
        ctx.res.setHeader("Cache-Control", getCacheControlHeader("works:list"));
        logCacheHit("works:list");
        return await getPublishedWorks(input);
      } catch (error) {
        if (canUseLocalContentFallback() && isDatabaseUnavailable(error)) {
          return localListWorks(input);
        }
        throw toTrpcError(error);
      }
    }),

  get: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        ctx.res.setHeader("Cache-Control", getCacheControlHeader("works:detail"));
        logCacheHit("works:detail");
        const work = await getPublishedWorkBySlug(input.slug);
        return work ?? null;
      } catch (error) {
        if (canUseLocalContentFallback() && isDatabaseUnavailable(error)) {
          return localGetWork(input.slug);
        }
        throw toTrpcError(error);
      }
    }),

  getDraft: adminProcedure
    .input(
      z.object({
        id: z.coerce.number().int().positive(),
      })
    )
    .query(async ({ input }) => {
      try {
        const draft = await getWorkDraftById(input.id);
        if (!draft) {
          throw new WorkNotFoundError("Draft work not found");
        }
        return draft;
      } catch (error) {
        if (canUseLocalContentFallback() && isDatabaseUnavailable(error)) {
          const draft = localGetDraftWork(input.id);
          if (!draft) {
            throw toTrpcError(new WorkNotFoundError("Draft work not found"));
          }
          return draft;
        }
        throw toTrpcError(error);
      }
    }),

  create: adminProcedure
    .input(
      z.object({
        title: z.string().min(1),
        slug: z.string().min(1),
        content: z.string(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const created = await createWork(input);
        return { success: true, work: created };
      } catch (error) {
        if (canUseLocalContentFallback() && isDatabaseUnavailable(error)) {
          const created = localCreateWork(input);
          return { success: true, work: created };
        }
        throw toTrpcError(error);
      }
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.coerce.number().int().positive(),
        title: z.string().optional(),
        slug: z.string().min(1).optional(),
        description: z.string().optional(),
        content: z.string().optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const updated = await updateWork(input);
        invalidateContentType("works");
        return { success: true, work: updated };
      } catch (error) {
        if (canUseLocalContentFallback() && isDatabaseUnavailable(error)) {
          const updated = localUpdateWork(input);
          invalidateContentType("works");
          return { success: true, work: updated };
        }
        throw toTrpcError(error);
      }
    }),

  publish: adminProcedure
    .input(
      z.object({
        id: z.coerce.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id?.toString();
      try {
        const published = await publishWork(input.id);
        invalidateContentType("works");
        logSecurityEvent("work_published", { userId, workId: input.id });
        return { success: true, work: published };
      } catch (error) {
        if (canUseLocalContentFallback() && isDatabaseUnavailable(error)) {
          const published = localPublishWork(input.id);
          invalidateContentType("works");
          logSecurityEvent("work_published", { userId, workId: input.id });
          return { success: true, work: published };
        }
        throw toTrpcError(error, { route: "works.publish", userId });
      }
    }),

  softDelete: adminProcedure
    .input(
      z.object({
        id: z.coerce.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id?.toString();
      try {
        await softDeleteWork(input.id);
        invalidateContentType("works");
        logSecurityEvent("work_deleted", { userId, workId: input.id });
        return { success: true };
      } catch (error) {
        if (canUseLocalContentFallback() && isDatabaseUnavailable(error)) {
          localSoftDeleteWork(input.id);
          invalidateContentType("works");
          logSecurityEvent("work_deleted", { userId, workId: input.id });
          return { success: true };
        }
        throw toTrpcError(error, { route: "works.softDelete", userId });
      }
    }),
});
