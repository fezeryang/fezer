import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const blogPosts = mysqlTable("blog_posts", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  date: varchar("date", { length: 50 }).notNull(),
  category: varchar("category", { length: 100 }),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  publishedAt: timestamp("publishedAt"),
  deletedAt: timestamp("deletedAt"),
  snapshotVersion: int("snapshotVersion").default(0).notNull(),
  renderedSnapshot: text("renderedSnapshot"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  statusIdx: index("blog_posts_status_idx").on(table.status),
  publishedAtIdx: index("blog_posts_publishedAt_idx").on(table.publishedAt),
}));

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = typeof blogPosts.$inferInsert;

export const portfolioProjects = mysqlTable("portfolio_projects", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description").notNull(),
  imageUrl: varchar("imageUrl", { length: 500 }),
  technologies: varchar("technologies", { length: 500 }),
  link: varchar("link", { length: 500 }),
  featured: int("featured").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PortfolioProject = typeof portfolioProjects.$inferSelect;
export type InsertPortfolioProject = typeof portfolioProjects.$inferInsert;

// Content publishing domain

export const works = mysqlTable("works", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  content: text("content").notNull(),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  publishedAt: timestamp("publishedAt"),
  deletedAt: timestamp("deletedAt"),
  snapshotVersion: int("snapshotVersion").default(0).notNull(),
  renderedSnapshot: text("renderedSnapshot"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  statusIdx: index("works_status_idx").on(table.status),
  publishedAtIdx: index("works_publishedAt_idx").on(table.publishedAt),
}));

export type Work = typeof works.$inferSelect;
export type InsertWork = typeof works.$inferInsert;

export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

export const assets = mysqlTable("assets", {
  id: int("id").autoincrement().primaryKey(),
  filename: varchar("filename", { length: 500 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  size: int("size").notNull(),
  storageKey: varchar("storageKey", { length: 500 }).notNull(),
  status: mysqlEnum("status", ["pending_upload", "uploaded", "verified", "failed"]).default("pending_upload").notNull(),
  uploadedBy: int("uploadedBy").references(() => users.id),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = typeof assets.$inferInsert;

export const contentAssetRelations = mysqlTable("content_asset_relations", {
  id: int("id").autoincrement().primaryKey(),
  contentType: mysqlEnum("contentType", ["work", "post"]).notNull(),
  contentId: int("contentId").notNull(),
  assetId: int("assetId").references(() => assets.id).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContentAssetRelation = typeof contentAssetRelations.$inferSelect;
export type InsertContentAssetRelation = typeof contentAssetRelations.$inferInsert;