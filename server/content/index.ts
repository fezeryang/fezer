/**
 * Content Index - 统一的内容索引导出
 *
 * 提供访问所有网站内容的统一接口
 */

import type { ContentIndex, BlogPostIndex, WorkIndex, ProfileIndex } from "./types";
import { loadBlogPosts, getBlogPostBySlug } from "./blog";
import { loadWorks, getWorkBySlug } from "./works";
import { loadProfiles, getDefaultProfile } from "./profile";

/**
 * 缓存的内容索引
 */
let cachedIndex: ContentIndex | null = null;

/**
 * 构建内容索引
 */
function buildContentIndex(): ContentIndex {
	const blog = loadBlogPosts();
	const works = loadWorks();
	const profiles = loadProfiles();

	return {
		blog,
		works,
		profile: getDefaultProfile() || null,
		builtAt: new Date(),
		count: {
			blog: blog.length,
			works: works.length,
			profile: profiles.length,
		},
	};
}

/**
 * 获取内容索引（带缓存）
 */
export function getContentIndex(refresh = false): ContentIndex {
	if (!cachedIndex || refresh) {
		cachedIndex = buildContentIndex();
	}
	return cachedIndex;
}

/**
 * 重新加载内容索引
 */
export function reloadContentIndex(): ContentIndex {
	return getContentIndex(true);
}

// 导出类型
export type { ContentIndex, BlogPostIndex, WorkIndex, ProfileIndex };

// 导出各个内容加载器
export { loadBlogPosts, getBlogPostBySlug } from "./blog";
export { loadWorks, getWorkBySlug } from "./works";
export { loadProfiles, getDefaultProfile } from "./profile";
