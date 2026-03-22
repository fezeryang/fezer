import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { BlogPost } from "../drizzle/schema";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import {
  AssetNotFoundError,
  AssetNotReadyError,
  createPost,
  DatabaseUnavailableError,
  ExternalAssetReferenceError,
  getPostDraftById,
  getPublishedPostBySlug,
  getPublishedPosts,
  MalformedAssetReferenceError,
  PostNotFoundError,
  PostSlugConflictError,
  publishPost,
  softDeletePost,
  updatePost,
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

  if (error instanceof PostNotFoundError) {
    return new TRPCError({
      code: "NOT_FOUND",
      message: "Post not found.",
    });
  }

  if (error instanceof PostSlugConflictError) {
    return new TRPCError({
      code: "CONFLICT",
      message: "A post with this slug already exists.",
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

const localPostStore: BlogPost[] = [];
let localPostIdCounter = 1;

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

function clonePost(post: BlogPost): BlogPost {
  return {
    ...post,
  };
}

function getVisibleLocalPosts(): BlogPost[] {
  return localPostStore
    .filter((post) => post.status === "published" && post.deletedAt === null)
    .sort((a, b) => {
      const aTime = a.publishedAt ? a.publishedAt.getTime() : 0;
      const bTime = b.publishedAt ? b.publishedAt.getTime() : 0;
      if (aTime === bTime) {
        return b.id - a.id;
      }
      return bTime - aTime;
    });
}

function localListPosts(input?: { limit?: number; offset?: number }) {
  const limit = input?.limit ?? 20;
  const offset = input?.offset ?? 0;
  const visible = getVisibleLocalPosts();
  return {
    posts: visible.slice(offset, offset + limit).map(clonePost),
    total: visible.length,
  };
}

function localGetPost(slug: string): BlogPost | null {
  const post = localPostStore.find(
    (item) => item.slug === slug && item.status === "published" && item.deletedAt === null
  );
  return post ? clonePost(post) : null;
}

function localGetDraftPost(id: number): BlogPost | null {
  const post = localPostStore.find(
    (item) => item.id === id && item.status === "draft" && item.deletedAt === null
  );
  return post ? clonePost(post) : null;
}

function ensureLocalSlugAvailable(slug: string, currentId?: number): void {
  const hasConflict = localPostStore.some(
    (item) => item.slug === slug && item.deletedAt === null && item.id !== currentId
  );
  if (hasConflict) {
    throw new PostSlugConflictError();
  }
}

function localCreatePost(input: {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
}): BlogPost {
  ensureLocalSlugAvailable(input.slug);
  const now = new Date();
  const post: BlogPost = {
    id: localPostIdCounter++,
    title: input.title,
    slug: input.slug,
    content: input.content,
    excerpt: input.excerpt ?? null,
    date: now.toISOString().slice(0, 10),
    category: null,
    status: "draft",
    publishedAt: null,
    deletedAt: null,
    snapshotVersion: 0,
    renderedSnapshot: null,
    createdAt: now,
    updatedAt: now,
  };
  localPostStore.push(post);
  return clonePost(post);
}

function localUpdatePost(input: {
  id: number;
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  status?: "draft" | "published" | "archived";
}): BlogPost {
  const index = localPostStore.findIndex((item) => item.id === input.id && item.deletedAt === null);
  if (index === -1) {
    throw new PostNotFoundError();
  }

  const existing = localPostStore[index];
  if (!existing) {
    throw new PostNotFoundError();
  }

  if (input.slug !== undefined) {
    ensureLocalSlugAvailable(input.slug, existing.id);
  }

  const next: BlogPost = {
    ...existing,
    title: input.title ?? existing.title,
    slug: input.slug ?? existing.slug,
    excerpt: input.excerpt === undefined ? existing.excerpt : input.excerpt,
    content: input.content ?? existing.content,
    status: input.status ?? existing.status,
    updatedAt: new Date(),
  };

  localPostStore[index] = next;
  return clonePost(next);
}

function localPublishPost(id: number): BlogPost {
  const index = localPostStore.findIndex((item) => item.id === id && item.deletedAt === null);
  if (index === -1) {
    throw new PostNotFoundError();
  }

  const existing = localPostStore[index];
  if (!existing) {
    throw new PostNotFoundError();
  }

  const publishedAt = new Date();
  const next: BlogPost = {
    ...existing,
    status: "published",
    publishedAt,
    snapshotVersion: existing.snapshotVersion + 1,
    updatedAt: publishedAt,
  };

  localPostStore[index] = next;
  return clonePost(next);
}

function localSoftDeletePost(id: number): void {
  const index = localPostStore.findIndex((item) => item.id === id && item.deletedAt === null);
  if (index === -1) {
    throw new PostNotFoundError();
  }

  const existing = localPostStore[index];
  if (!existing) {
    throw new PostNotFoundError();
  }

  localPostStore[index] = {
    ...existing,
    deletedAt: new Date(),
    updatedAt: new Date(),
  };
}

export const postsRouter = router({
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
        ctx.res.setHeader("Cache-Control", getCacheControlHeader("posts:list"));
        logCacheHit("posts:list");
        return await getPublishedPosts(input);
      } catch (error) {
        if (canUseLocalContentFallback() && isDatabaseUnavailable(error)) {
          return localListPosts(input);
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
        ctx.res.setHeader("Cache-Control", getCacheControlHeader("posts:detail"));
        logCacheHit("posts:detail");
        const post = await getPublishedPostBySlug(input.slug);
        return post ?? null;
      } catch (error) {
        if (canUseLocalContentFallback() && isDatabaseUnavailable(error)) {
          return localGetPost(input.slug);
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
        const draft = await getPostDraftById(input.id);
        if (!draft) {
          throw new PostNotFoundError("Draft post not found");
        }
        return draft;
      } catch (error) {
        if (canUseLocalContentFallback() && isDatabaseUnavailable(error)) {
          const draft = localGetDraftPost(input.id);
          if (!draft) {
            throw toTrpcError(new PostNotFoundError("Draft post not found"));
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
        excerpt: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const created = await createPost(input);
        return { success: true, post: created };
      } catch (error) {
        if (canUseLocalContentFallback() && isDatabaseUnavailable(error)) {
          const created = localCreatePost(input);
          return { success: true, post: created };
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
        content: z.string().optional(),
        excerpt: z.string().optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const updated = await updatePost(input);
        invalidateContentType("posts");
        return { success: true, post: updated };
      } catch (error) {
        if (canUseLocalContentFallback() && isDatabaseUnavailable(error)) {
          const updated = localUpdatePost(input);
          invalidateContentType("posts");
          return { success: true, post: updated };
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
        const published = await publishPost(input.id);
        invalidateContentType("posts");
        logSecurityEvent("post_published", { userId, postId: input.id });
        return { success: true, post: published };
      } catch (error) {
        if (canUseLocalContentFallback() && isDatabaseUnavailable(error)) {
          const published = localPublishPost(input.id);
          invalidateContentType("posts");
          logSecurityEvent("post_published", { userId, postId: input.id });
          return { success: true, post: published };
        }
        throw toTrpcError(error, { route: "posts.publish", userId });
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
        await softDeletePost(input.id);
        invalidateContentType("posts");
        logSecurityEvent("post_deleted", { userId, postId: input.id });
        return { success: true };
      } catch (error) {
        if (canUseLocalContentFallback() && isDatabaseUnavailable(error)) {
          localSoftDeletePost(input.id);
          invalidateContentType("posts");
          logSecurityEvent("post_deleted", { userId, postId: input.id });
          return { success: true };
        }
        throw toTrpcError(error, { route: "posts.softDelete", userId });
      }
    }),
});
