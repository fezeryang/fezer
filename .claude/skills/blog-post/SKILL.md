---
name: blog-post
description: 创建和调优本项目的博客文章（自动带标题目录侧边栏 ProximitySidebar 效果）。Use this skill whenever the user wants to write, publish, or add a new blog post（写博客、发文章、新增一篇博客、新 post、发布文章）, restructure an existing post's headings, or tune the blog post sidebar minimap（目录条/dash 密度、颜色、高度、跳转偏移、滚动高亮）. 新文章只要按本规范落盘即自动获得目录侧边栏——本 skill 保证文件命名、frontmatter、标题结构不出错，并给出验证与调参路径。
---

# 博客文章创作与侧边栏调优

## 核心事实：目录侧边栏是自动的

博客文章是 `client/src/content/blog/` 下的 `.md` 文件，由 Vite 的 `import.meta.glob` 在构建时静态收集（`client/src/content/loaders/posts.ts`）。文章详情页 `client/src/pages/BlogPostDetail.tsx` 把正文交给 `renderBlogMarkdown()`（`client/src/content/loaders/markdown.ts`），一次渲染同时产出：

1. **消毒后的 HTML**——每个 h2/h3/h4 标题注入 `id`（中文保留、标点转 `-`、重复标题加 `-1` 后缀）
2. **目录 sections**——喂给 `ProximitySidebar`（`client/src/components/ui/proximity-sidebar.tsx`），右侧渲染 dash 导航：鼠标接近弹性伸长、滚动高亮当前章节、点击平滑跳转，并按内容量追加灰色"正文密度线"（约 +25%）

**所以不需要为侧边栏写任何代码**——只要新文章的文件命名、frontmatter、标题层级符合下面的规范，效果自动生效。规范存在的意义：命名决定 URL、frontmatter 决定列表排序与展示、标题层级直接决定目录条目的数量与样式。

## 新建文章

### 1. 文件名

```
client/src/content/blog/YYYY-MM-DD-<kebab-case-slug>.md
```

- 文件名里的日期只是归档习惯；**slug 部分决定 URL**（`/blog/<slug>`）。frontmatter 里写 `slug:` 可覆盖，一般不写
- 日期用当天真实日期，已存在的文章不要重命名（会改变 URL）
- `_` 开头和 `README.md` 会被加载器跳过，可用来存草稿

### 2. Frontmatter

照抄现有文章的形状（引号包裹字符串）：

```yaml
---
title: "文章标题，会渲染为页面大标题 h1"
date: "YYYY-MM-DD"        # 必填，决定列表排序（新→旧）
excerpt: "一两句摘要，展示在详情页头部与列表卡片"
tags:
  - "Tag1"
  - "Tag2"
category: "分类，如 DevOps / Product Engineering"
---
```

- `title`、`date` 必填（`parser.ts` 的 `requireField` 校验，缺失会抛错）；`excerpt`/`tags`/`category` 可选
- date 必须是合法 ISO 日期，否则加载时抛错

### 3. 正文与标题层级（决定目录形态）

- **不要用 `#`（h1）**——页面大标题来自 frontmatter 的 `title`，正文的 h1 不会进目录（侧边栏只取 h2/h3，密度线按 h2/h3 章节的内容量分配）
- `##` 大章节 → 目录里的**近黑长线**（可点击、可高亮）
- `###` 子节 → **深灰短线**
- 同一篇内标题文字不要重复（重复也能用，锚点会变成 `xxx-1`，但不优雅）
- 标题文字就是 URL 锚点：中文保留、空格和标点转 `-`。避免在标题里堆 `？！` 等符号
- 代码块（``` 围栏）内的 `##` 不会被当标题，放心写
- 内容块（段落/代码块/列表）≥2 的章节会在它的 dash 后挂 **1–3 条灰色不可点的密度线**；总量目标 = `max(标题数 × 50%, 10 − 标题数)`（总线条数不足 10 时补足），内容越重的章节分到越多、可叠多条。写长章节自然线多，不用刻意规划

### 4. 验证（新文章必做）

```bash
pnpm test                    # markdown 管线单测全绿
pnpm dev:client              # 打开 http://localhost:5173/blog/<slug>
```

浏览器里检查：右侧出现 dash 列（桌面端 ≥768px 才显示）；条数 = h2 数 + h3 数 + 密度线；点击任一条跳到对应标题；滚动时高亮跟随。

**e2e 不需要改**：`e2e/blog-sidebar.spec.ts` 的期望条数只针对既有的两篇文章写死；只有当用户明确要求为新文章加 e2e 用例、或改动全局密度参数时才需要同步（见下）。

## 调整侧边栏效果

密度、颜色、高度、跳转偏移、滚动高亮锚线等所有可调项集中在两个文件，**每个参数的位置、含义、改后要同步哪些测试**见 [references/sidebar-tuning.md](references/sidebar-tuning.md)。改任何参数后跑 `pnpm test`；改了密度或预期条数还要跑 `pnpm exec playwright test e2e/blog-sidebar.spec.ts`。
