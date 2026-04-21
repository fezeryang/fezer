/**
 * Content Index Types
 *
 * 服务端内容索引的类型定义，对应 client/src/content/loaders/types.ts
 */

/**
 * 博客文章内容索引
 */
export interface BlogPostIndex {
	slug: string;
	title: string;
	date: string;
	excerpt: string;
	tags: string[];
	category?: string;
	body: string;
	/** 搜索文本片段（用于检索） */
	searchableText: string;
}

/**
 * 作品集内容索引
 */
export interface WorkIndex {
	slug: string;
	title: string;
	description: string;
	date?: string;
	tags: string[];
	technologies?: string;
	link?: string;
	imageUrl?: string;
	body: string;
	/** 搜索文本片段 */
	searchableText: string;
}

/**
 * 个人资料内容索引
 */
export interface ProfileIndex {
	name: string;
	bio: string;
	locale: string;
	avatar?: string;
	skills: string[];
	projects: Array<{ name: string; url: string }>;
	contact: Record<string, string>;
	body: string;
	/** 搜索文本片段 */
	searchableText: string;
}

/**
 * 内容搜索结果
 */
export interface ContentSearchResult {
	id: string;
	type: "blog" | "work" | "profile";
	title?: string;
	slug?: string;
	category?: string;
	content: string;
	relevance: number;
	metadata?: Record<string, unknown>;
}

/**
 * 内容索引汇总
 */
export interface ContentIndex {
	blog: BlogPostIndex[];
	works: WorkIndex[];
	profile: ProfileIndex | null;
	/** 索引构建时间 */
	builtAt: Date;
	/** 内容文件数量 */
	count: {
		blog: number;
		works: number;
		profile: number;
	};
}
