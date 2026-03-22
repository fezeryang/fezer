import { and, desc, eq, isNull, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  Asset,
  assets,
  BlogPost,
  blogPosts,
  contentAssetRelations,
  InsertBlogPost,
  InsertUser,
  InsertWork,
  PortfolioProject,
  portfolioProjects,
  users,
  Work,
  works,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { renderMarkdownSnapshot } from "./_core/contentRenderer";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Blog Posts
export async function getBlogPosts(): Promise<BlogPost[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(blogPosts).orderBy(blogPosts.createdAt);
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Portfolio Projects
export async function getPortfolioProjects(): Promise<PortfolioProject[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(portfolioProjects).orderBy(portfolioProjects.createdAt);
}

export async function getFeaturedProjects(): Promise<PortfolioProject[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(portfolioProjects).where(eq(portfolioProjects.featured, 1));
}

export async function getProjectBySlug(slug: string): Promise<PortfolioProject | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(portfolioProjects).where(eq(portfolioProjects.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

type MySqlLikeError = {
  code?: string;
  errno?: number;
};

export class DatabaseUnavailableError extends Error {
  constructor(message = "Database connection unavailable") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

export class WorkNotFoundError extends Error {
  constructor(message = "Work not found") {
    super(message);
    this.name = "WorkNotFoundError";
  }
}

export class WorkSlugConflictError extends Error {
  constructor(message = "A work with this slug already exists") {
    super(message);
    this.name = "WorkSlugConflictError";
  }
}

export class PostNotFoundError extends Error {
  constructor(message = "Post not found") {
    super(message);
    this.name = "PostNotFoundError";
  }
}

export class PostSlugConflictError extends Error {
  constructor(message = "A post with this slug already exists") {
    super(message);
    this.name = "PostSlugConflictError";
  }
}

export class AssetNotFoundError extends Error {
  constructor(public readonly assetId: number, message?: string) {
    super(message ?? `Asset with id ${assetId} not found`);
    this.name = "AssetNotFoundError";
  }
}

export class AssetNotReadyError extends Error {
  constructor(public readonly assetId: number, public readonly status: string, message?: string) {
    super(message ?? `Asset ${assetId} is not ready for publish (status: ${status})`);
    this.name = "AssetNotReadyError";
  }
}

export class MalformedAssetReferenceError extends Error {
  constructor(public readonly reference: string, message?: string) {
    super(message ?? `Malformed asset reference: ${reference}`);
    this.name = "MalformedAssetReferenceError";
  }
}

export class ExternalAssetReferenceError extends Error {
  constructor(public readonly url: string, message?: string) {
    super(message ?? `External URLs are not allowed as publish-bound assets: ${url}`);
    this.name = "ExternalAssetReferenceError";
  }
}

const ASSET_REFERENCE_PATTERN = /\/assets\/(\d+)/g;
const ALL_ASSET_REFS_PATTERN = /\/assets\/([^\s)"'<>]*)/g;

const EXTERNAL_URL_PATTERNS = [
  /!\[[^\]]*\]\(((?:https?:)?\/\/[^)]+)\)/g,
  /<img\b[^>]*\bsrc\s*=\s*(?:"((?:https?:)?\/\/[^"\s>]+)"|'((?:https?:)?\/\/[^'\s>]+)'|((?:https?:)?\/\/[^\s>]+))/gi,
];

export function detectMalformedAssetRefs(content: string): string | null {
  const pattern = new RegExp(ALL_ASSET_REFS_PATTERN.source, 'g');
  let match: RegExpExecArray | null;
  
  while ((match = pattern.exec(content)) !== null) {
    const suffix = match[1];
    if (!suffix || !/^\d+$/.test(suffix)) {
      return match[0];
    }
    const id = parseInt(suffix, 10);
    if (id <= 0) {
      return match[0];
    }
  }
  return null;
}

export function extractAssetReferences(content: string): number[] {
  const assetIds = new Set<number>();
  const pattern = new RegExp(ASSET_REFERENCE_PATTERN.source, 'g');
  let match: RegExpExecArray | null;
  
  while ((match = pattern.exec(content)) !== null) {
    const idStr = match[1];
    const id = parseInt(idStr, 10);
    if (!Number.isNaN(id) && id > 0) {
      assetIds.add(id);
    }
  }
  
  return Array.from(assetIds);
}

export function detectExternalUrls(content: string): string | null {
  for (const pattern of EXTERNAL_URL_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(content);
    if (match) {
      return match[1] ?? match[2] ?? match[3] ?? null;
    }
  }
  return null;
}

export async function validateAssetReferences(
  assetIds: number[]
): Promise<Asset[]> {
  if (assetIds.length === 0) {
    return [];
  }

  const db = await requireDb();
  
  const foundAssets = await db
    .select()
    .from(assets)
    .where(and(
      inArray(assets.id, assetIds),
      isNull(assets.deletedAt)
    ));
  
  const foundIds = new Set(foundAssets.map(a => a.id));
  for (const requiredId of assetIds) {
    if (!foundIds.has(requiredId)) {
      throw new AssetNotFoundError(requiredId);
    }
  }
  
  const READY_STATUSES = ['uploaded', 'verified'] as const;
  for (const asset of foundAssets) {
    if (!READY_STATUSES.includes(asset.status as typeof READY_STATUSES[number])) {
      throw new AssetNotReadyError(asset.id, asset.status);
    }
  }
  
  return foundAssets;
}

async function persistContentAssetRelations(
  db: Awaited<ReturnType<typeof requireDb>> | Parameters<
    Parameters<Awaited<ReturnType<typeof requireDb>>["transaction"]>[0]
  >[0],
  contentType: "work" | "post",
  contentId: number,
  assetIds: number[]
): Promise<void> {
  await db
    .delete(contentAssetRelations)
    .where(and(
      eq(contentAssetRelations.contentType, contentType),
      eq(contentAssetRelations.contentId, contentId)
    ));
  
  if (assetIds.length > 0) {
    await db.insert(contentAssetRelations).values(
      assetIds.map(assetId => ({
        contentType,
        contentId,
        assetId,
      }))
    );
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  const err = error as MySqlLikeError;
  return err?.code === "ER_DUP_ENTRY" || err?.errno === 1062;
}

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new DatabaseUnavailableError();
  }
  return db;
}

export async function getPublishedWorks(input?: {
  limit?: number;
  offset?: number;
}): Promise<{ works: Work[]; total: number }> {
  const db = await requireDb();
  const limit = input?.limit ?? 20;
  const offset = input?.offset ?? 0;

  const whereClause = and(eq(works.status, "published"), isNull(works.deletedAt));

  const worksList = await db
    .select()
    .from(works)
    .where(whereClause)
    .orderBy(desc(works.publishedAt), desc(works.id))
    .limit(limit)
    .offset(offset);

  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(works)
    .where(whereClause);

  return {
    works: worksList,
    total: Number(totalResult[0]?.count ?? 0),
  };
}

export async function getPublishedWorkBySlug(slug: string): Promise<Work | undefined> {
  const db = await requireDb();
  const result = await db
    .select()
    .from(works)
    .where(and(eq(works.slug, slug), eq(works.status, "published"), isNull(works.deletedAt)))
    .limit(1);

  return result[0];
}

export async function getWorkDraftById(id: number): Promise<Work | undefined> {
  const db = await requireDb();
  const result = await db
    .select()
    .from(works)
    .where(and(eq(works.id, id), eq(works.status, "draft"), isNull(works.deletedAt)))
    .limit(1);

  return result[0];
}

export async function createWork(input: {
  title: string;
  slug: string;
  content: string;
  description?: string;
}): Promise<Work> {
  const db = await requireDb();

  try {
    const result = await db.insert(works).values({
      title: input.title,
      slug: input.slug,
      content: input.content,
      description: input.description ?? null,
      status: "draft",
    });

    const workId = Number(result[0].insertId);
    const inserted = await db.select().from(works).where(eq(works.id, workId)).limit(1);
    if (!inserted[0]) {
      throw new WorkNotFoundError("Work creation succeeded but record could not be retrieved");
    }

    return inserted[0];
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new WorkSlugConflictError();
    }
    throw error;
  }
}

export async function updateWork(input: {
  id: number;
  title?: string;
  slug?: string;
  description?: string;
  content?: string;
  status?: "draft" | "published" | "archived";
}): Promise<Work> {
  const db = await requireDb();

  const existing = await db
    .select()
    .from(works)
    .where(and(eq(works.id, input.id), isNull(works.deletedAt)))
    .limit(1);

  if (!existing[0]) {
    throw new WorkNotFoundError();
  }

  const setValues: Partial<InsertWork> = {};
  if (input.title !== undefined) setValues.title = input.title;
  if (input.slug !== undefined) setValues.slug = input.slug;
  if (input.description !== undefined) setValues.description = input.description;
  if (input.content !== undefined) setValues.content = input.content;
  if (input.status !== undefined) setValues.status = input.status;

  if (Object.keys(setValues).length > 0) {
    try {
      await db.update(works).set(setValues).where(eq(works.id, input.id));
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new WorkSlugConflictError();
      }
      throw error;
    }
  }

  const updated = await db.select().from(works).where(eq(works.id, input.id)).limit(1);
  if (!updated[0]) {
    throw new WorkNotFoundError("Work updated but record could not be retrieved");
  }

  return updated[0];
}

export async function publishWork(id: number): Promise<Work> {
  const db = await requireDb();

  const existing = await db
    .select()
    .from(works)
    .where(and(eq(works.id, id), isNull(works.deletedAt)))
    .limit(1);

  const work = existing[0];
  if (!work) {
    throw new WorkNotFoundError();
  }

  const malformedRef = detectMalformedAssetRefs(work.content);
  if (malformedRef) {
    throw new MalformedAssetReferenceError(malformedRef);
  }

  const externalUrl = detectExternalUrls(work.content);
  if (externalUrl) {
    throw new ExternalAssetReferenceError(externalUrl);
  }

  const assetIds = extractAssetReferences(work.content);
  await validateAssetReferences(assetIds);

  const snapshot = renderMarkdownSnapshot(work.content);
  const publishedAt = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(works)
      .set({
        status: "published",
        publishedAt,
        renderedSnapshot: snapshot.html,
        snapshotVersion: sql`${works.snapshotVersion} + 1`,
      })
      .where(eq(works.id, id));

    await persistContentAssetRelations(tx, "work", id, assetIds);
  });

  const updated = await db.select().from(works).where(eq(works.id, id)).limit(1);
  if (!updated[0]) {
    throw new WorkNotFoundError("Work published but record could not be retrieved");
  }

  return updated[0];
}

export async function softDeleteWork(id: number): Promise<void> {
  const db = await requireDb();

  const existing = await db
    .select()
    .from(works)
    .where(and(eq(works.id, id), isNull(works.deletedAt)))
    .limit(1);

  if (!existing[0]) {
    throw new WorkNotFoundError();
  }

  await db
    .update(works)
    .set({
      deletedAt: new Date(),
    })
    .where(eq(works.id, id));
}

export async function getPublishedPosts(input?: {
  limit?: number;
  offset?: number;
}): Promise<{ posts: BlogPost[]; total: number }> {
  const db = await requireDb();
  const limit = input?.limit ?? 20;
  const offset = input?.offset ?? 0;

  const whereClause = and(
    eq(blogPosts.status, "published"),
    isNull(blogPosts.deletedAt)
  );

  const posts = await db
    .select()
    .from(blogPosts)
    .where(whereClause)
    .orderBy(desc(blogPosts.publishedAt), desc(blogPosts.id))
    .limit(limit)
    .offset(offset);

  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(blogPosts)
    .where(whereClause);

  return {
    posts,
    total: Number(totalResult[0]?.count ?? 0),
  };
}

export async function getPublishedPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const db = await requireDb();
  const result = await db
    .select()
    .from(blogPosts)
    .where(
      and(
        eq(blogPosts.slug, slug),
        eq(blogPosts.status, "published"),
        isNull(blogPosts.deletedAt)
      )
    )
    .limit(1);

  return result[0];
}

export async function getPostDraftById(id: number): Promise<BlogPost | undefined> {
  const db = await requireDb();
  const result = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.id, id), eq(blogPosts.status, "draft"), isNull(blogPosts.deletedAt)))
    .limit(1);

  return result[0];
}

export async function createPost(input: {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
}): Promise<BlogPost> {
  const db = await requireDb();

  try {
    const result = await db.insert(blogPosts).values({
      title: input.title,
      slug: input.slug,
      content: input.content,
      excerpt: input.excerpt ?? null,
      date: new Date().toISOString().slice(0, 10),
      status: "draft",
    });

    const postId = Number(result[0].insertId);
    const inserted = await db.select().from(blogPosts).where(eq(blogPosts.id, postId)).limit(1);
    if (!inserted[0]) {
      throw new PostNotFoundError("Post creation succeeded but record could not be retrieved");
    }

    return inserted[0];
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new PostSlugConflictError();
    }
    throw error;
  }
}

export async function updatePost(input: {
  id: number;
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  status?: "draft" | "published" | "archived";
}): Promise<BlogPost> {
  const db = await requireDb();

  const existing = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.id, input.id), isNull(blogPosts.deletedAt)))
    .limit(1);

  if (!existing[0]) {
    throw new PostNotFoundError();
  }

  const setValues: Partial<InsertBlogPost> = {};
  if (input.title !== undefined) setValues.title = input.title;
  if (input.slug !== undefined) setValues.slug = input.slug;
  if (input.excerpt !== undefined) setValues.excerpt = input.excerpt;
  if (input.content !== undefined) setValues.content = input.content;
  if (input.status !== undefined) setValues.status = input.status;

  if (Object.keys(setValues).length > 0) {
    try {
      await db.update(blogPosts).set(setValues).where(eq(blogPosts.id, input.id));
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new PostSlugConflictError();
      }
      throw error;
    }
  }

  const updated = await db.select().from(blogPosts).where(eq(blogPosts.id, input.id)).limit(1);
  if (!updated[0]) {
    throw new PostNotFoundError("Post updated but record could not be retrieved");
  }

  return updated[0];
}

export async function publishPost(id: number): Promise<BlogPost> {
  const db = await requireDb();

  const existing = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.id, id), isNull(blogPosts.deletedAt)))
    .limit(1);

  const post = existing[0];
  if (!post) {
    throw new PostNotFoundError();
  }

  const malformedRef = detectMalformedAssetRefs(post.content);
  if (malformedRef) {
    throw new MalformedAssetReferenceError(malformedRef);
  }

  const externalUrl = detectExternalUrls(post.content);
  if (externalUrl) {
    throw new ExternalAssetReferenceError(externalUrl);
  }

  const assetIds = extractAssetReferences(post.content);
  await validateAssetReferences(assetIds);

  const snapshot = renderMarkdownSnapshot(post.content);
  const publishedAt = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(blogPosts)
      .set({
        status: "published",
        publishedAt,
        renderedSnapshot: snapshot.html,
        snapshotVersion: sql`${blogPosts.snapshotVersion} + 1`,
      })
      .where(eq(blogPosts.id, id));

    await persistContentAssetRelations(tx, "post", id, assetIds);
  });

  const updated = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
  if (!updated[0]) {
    throw new PostNotFoundError("Post published but record could not be retrieved");
  }

  return updated[0];
}

export async function softDeletePost(id: number): Promise<void> {
  const db = await requireDb();

  const existing = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.id, id), isNull(blogPosts.deletedAt)))
    .limit(1);

  if (!existing[0]) {
    throw new PostNotFoundError();
  }

  await db
    .update(blogPosts)
    .set({
      deletedAt: new Date(),
    })
    .where(eq(blogPosts.id, id));
}
