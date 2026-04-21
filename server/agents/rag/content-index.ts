/**
 * Content Index RAG Tools
 *
 * 基于网站真实内容的检索工具
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  getContentIndex,
  loadBlogPosts,
  getBlogPostBySlug,
  loadWorks,
  getWorkBySlug,
  getDefaultProfile,
  loadProfiles,
} from "../../content";

/**
 * 内容搜索工具
 * 支持关键词匹配和语义搜索
 */
export const searchContentTool = tool(
  async ({ query, topK = 3, category }) => {
    const index = getContentIndex();
    const queryLower = query.toLowerCase();

    // 收集所有可搜索的内容
    const searchItems: Array<{
      id: string;
      type: "blog" | "work" | "profile";
      title?: string;
      slug?: string;
      category?: string;
      searchableText: string;
      metadata?: Record<string, unknown>;
    }> = [];

    // 添加博客
    if (!category || category === "blog") {
      for (const post of index.blog) {
        searchItems.push({
          id: `blog-${post.slug}`,
          type: "blog",
          title: post.title,
          slug: post.slug,
          category: post.category,
          searchableText: post.searchableText,
          metadata: {
            date: post.date,
            tags: post.tags,
            excerpt: post.excerpt,
          },
        });
      }
    }

    // 添加作品
    if (!category || category === "work") {
      for (const work of index.works) {
        searchItems.push({
          id: `work-${work.slug}`,
          type: "work",
          title: work.title,
          slug: work.slug,
          searchableText: work.searchableText,
          metadata: {
            description: work.description,
            tags: work.tags,
            technologies: work.technologies,
          },
        });
      }
    }

    // 添加个人资料
    if (!category || category === "profile") {
      if (index.profile) {
        searchItems.push({
          id: "profile",
          type: "profile",
          title: index.profile.name,
          searchableText: index.profile.searchableText,
          metadata: {
            bio: index.profile.bio,
            skills: index.profile.skills,
          },
        });
      }
    }

    // 计算相关性分数
    const scored = searchItems.map(item => {
      let score = 0;
      const textLower = item.searchableText.toLowerCase();
      const titleLower = (item.title || "").toLowerCase();

      // 标题完全匹配
      if (titleLower.includes(queryLower)) {
        score += 10;
      }

      // 标签匹配
      const tags = item.metadata?.tags as string[] | undefined;
      if (tags) {
        for (const tag of tags) {
          if (
            queryLower.includes(tag.toLowerCase()) ||
            tag.toLowerCase().includes(queryLower)
          ) {
            score += 5;
          }
        }
      }

      // 文本内容匹配 - 按单词
      const words = queryLower.split(/\s+/);
      for (const word of words) {
        if (textLower.includes(word)) {
          score += 1;
        }
      }

      // 完整查询匹配
      if (textLower.includes(queryLower)) {
        score += 3;
      }

      return { item, score };
    });

    // 过滤和排序
    const filtered = scored.filter(r => r.score > 0);
    filtered.sort((a, b) => b.score - a.score);

    // 返回 topK 结果
    const results = filtered.slice(0, topK);

    return {
      query,
      count: results.length,
      matches: results.map(r => ({
        id: r.item.id,
        type: r.item.type,
        title: r.item.title,
        slug: r.item.slug,
        category: r.item.category,
        content: r.item.searchableText.slice(0, 500) + "...",
        relevance: r.score,
        metadata: r.item.metadata,
      })),
    };
  },
  {
    name: "search_content",
    description: `搜索 Fezer 网站的真实内容，包括博客文章、作品集和个人资料。

支持的内容类型：
- blog: 博客文章，包含技术思考、项目记录等
- work: 作品集，包含项目介绍、技术实现等
- profile: 个人资料，包含技能、经历等

可以回答关于：
- 博客内容："最近写了什么文章？"、"关于XX主题的文章"
- 作品详情："kinetic-typography作品讲了什么"
- 个人信息："Fezer会什么技术"、"有什么项目经验"

用法示例：
- search_content({ query: "refraction theory", category: "blog" })
- search_content({ query: "typography animation", topK: 5 })`,
    schema: z.object({
      query: z.string().describe("搜索查询，支持关键词和自然语言问题"),
      topK: z.number().optional().default(3).describe("返回结果数量，默认3"),
      category: z
        .enum(["blog", "work", "profile"])
        .optional()
        .describe("按内容类型过滤"),
    }),
  }
);

/**
 * 获取博客文章工具
 */
export const getBlogPostsTool = tool(
  async ({ slug, limit }) => {
    if (slug) {
      const post = getBlogPostBySlug(slug);
      if (post) {
        return {
          post: {
            slug: post.slug,
            title: post.title,
            date: post.date,
            excerpt: post.excerpt,
            tags: post.tags,
            category: post.category,
            body: post.body,
          },
        };
      }
      return {
        error: `Blog post "${slug}" not found`,
        availablePosts: loadBlogPosts().map(p => ({
          slug: p.slug,
          title: p.title,
        })),
      };
    }

    const posts = loadBlogPosts();
    const limited = limit ? posts.slice(0, limit) : posts;

    return {
      count: limited.length,
      posts: limited.map(p => ({
        slug: p.slug,
        title: p.title,
        date: p.date,
        excerpt: p.excerpt,
        tags: p.tags,
        category: p.category,
      })),
    };
  },
  {
    name: "get_blog_posts",
    description: `获取博客文章列表或单篇文章详情。

用途：
- 获取所有/最新博客文章列表
- 获取指定文章的完整内容

可以回答：
- "有哪些博客文章？"
- "Refraction Theory 这篇文章讲了什么？"
- "最近的文章有哪些？"

参数：
- slug: 文章的 slug（可选），不指定则返回列表
- limit: 返回的最大文章数量（可选）`,
    schema: z.object({
      slug: z
        .string()
        .optional()
        .describe("文章的 slug，如 'refraction-theory'"),
      limit: z.number().optional().describe("返回的最大文章数量"),
    }),
  }
);

/**
 * 获取作品详情工具
 */
export const getWorksDetailTool = tool(
  async ({ slug, limit }) => {
    if (slug) {
      const work = getWorkBySlug(slug);
      if (work) {
        return {
          work: {
            slug: work.slug,
            title: work.title,
            description: work.description,
            date: work.date,
            tags: work.tags,
            technologies: work.technologies,
            link: work.link,
            imageUrl: work.imageUrl,
            body: work.body,
          },
        };
      }
      return {
        error: `Work "${slug}" not found`,
        availableWorks: loadWorks().map(w => ({
          slug: w.slug,
          title: w.title,
        })),
      };
    }

    const works = loadWorks();
    const limited = limit ? works.slice(0, limit) : works;

    return {
      count: limited.length,
      works: limited.map(w => ({
        slug: w.slug,
        title: w.title,
        description: w.description,
        date: w.date,
        tags: w.tags,
        technologies: w.technologies,
      })),
    };
  },
  {
    name: "get_works_detail",
    description: `获取作品集列表或单个作品的详细信息。

用途：
- 获取所有/最新作品列表
- 获取指定作品的完整介绍

可以回答：
- "有哪些作品？"
- "Kinetic Typography Engine 这个作品是关于什么的？"
- "用了什么技术？"

参数：
- slug: 作品的 slug（可选），不指定则返回列表
- limit: 返回的最大作品数量（可选）`,
    schema: z.object({
      slug: z
        .string()
        .optional()
        .describe("作品的 slug，如 'kinetic-typography'"),
      limit: z.number().optional().describe("返回的最大作品数量"),
    }),
  }
);

/**
 * 获取完整个人资料工具
 */
export const getProfileFullTool = tool(
  async ({ locale }) => {
    let profile;
    if (locale) {
      const profiles = loadProfiles();
      profile = profiles.find(p => p.locale === locale);
    } else {
      profile = getDefaultProfile();
    }

    if (!profile) {
      return {
        error: `Profile not found${locale ? ` for locale: ${locale}` : ""}`,
      };
    }

    return {
      profile: {
        name: profile.name,
        bio: profile.bio,
        locale: profile.locale,
        avatar: profile.avatar,
        skills: profile.skills,
        projects: profile.projects,
        contact: profile.contact,
        body: profile.body,
      },
    };
  },
  {
    name: "get_profile_full",
    description: `获取 Fezer 的完整个人资料，来自真实的 profile.md 文件。

用途：
- 获取姓名、简介、技能等基本信息
- 了解兴趣爱好和项目经历

可以回答：
- "Fezer 是谁？"
- "有什么技能？"
- "有什么兴趣爱好？"

参数：
- locale: 语言代码（可选），如 "zh-CN"、"en-US"，默认获取默认资料`,
    schema: z.object({
      locale: z.string().optional().describe("语言代码，如 zh-CN"),
    }),
  }
);

/**
 * 导出所有内容索引工具
 */
export async function getContentIndexTools() {
  return [
    searchContentTool,
    getBlogPostsTool,
    getWorksDetailTool,
    getProfileFullTool,
  ];
}
