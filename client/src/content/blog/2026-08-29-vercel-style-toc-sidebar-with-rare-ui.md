---
title: "用 rare-ui 注册表给博客加一个 Vercel 风格的目录侧边栏"
date: "2026-08-29"
excerpt: "记录把 rare-ui 的 ProximitySidebar 接进博客的全过程：从 shadcn 注册表拉源码、让 Markdown 渲染器一次产出正文 HTML 和目录 sections，以及和自研阻尼滚动的几个兼容坑。"
tags:
  - "shadcn"
  - "React"
  - "framer-motion"
category: "Product Engineering"
---

博客详情页一直缺一个像样的目录导航。长文读到一半想跳回某一节，只能靠肉眼滚。这周终于把这件事解决了：右侧加了一条 Vercel 文档风格的目录侧边栏——不是常见的文字链接列表，而是一列细横线（dash），鼠标靠近时弹性伸长，滚动时自动高亮当前章节，点击平滑跳转。

整个过程没写几行 UI 代码：核心组件是从 shadcn 生态的 rare-ui 注册表拉的，真正的工作量在把 Markdown 渲染管线的标题喂给它。记录一下。

## 为什么要抄 Vercel 的目录侧边栏

Vercel 的文档在页面右缘放了一列极简横线作为目录：每条线对应一个章节，长度和颜色深浅区分层级，几乎不占视觉重量，却在滚动时持续告诉你"读到哪了"。相比传统的文字 TOC，它更像一个 minimap。

我的博客正文是论文式排版，右栏空间有限，塞一列文字链接会破坏版面；这组 dash 只占约 110px 宽的一条窄带，正好。另外我希望它有点"活"的感觉——鼠标扫过时线会朝指针弹性伸长——这类 proximity 交互手写成本不低，而 rare-ui 注册表里恰好有一个现成的 ProximitySidebar，效果和 Vercel 的几乎一致。

## 从 rare-ui 注册表拉源码

shadcn 的 registry 机制和装 npm 包不一样：CLI 把组件源码直接拷进仓库的 `client/src/components/ui/`，之后它就是你的代码，随便改。一条命令：

```bash
pnpm dlx shadcn@latest add https://rareui.com/r/proximity-sidebar.json
```

组件基于 framer-motion，本仓库本来就有 framer-motion 12，没有新增依赖。拉下来的接口很简单：传一个 `sections` 数组（`id` + `label` + 可选层级），指定 `side="right"`，接近弹性、滚动高亮和平滑跳转它自己全包了。

真正的工作量在数据侧：`sections` 里的 `id` 必须和正文里对应标题元素的 DOM id 一一对应，而且这份 id 同时是 URL 锚点。手写一份目录意味着两处维护；我选择让 Markdown 渲染器在渲染时顺便生成。

## 接进 Markdown 渲染管线

### 一次渲染产出两份结果

文章正文走的是 `renderBlogMarkdown()`（marked + sanitize-html）。改造思路是用 marked 的自定义 heading renderer，在渲染每个标题时做两件事：给标题注入 slug id，同时把 `{ id, label, level }` push 进一个 sections 数组；消毒时把 `id` 加进 sanitize-html 的允许属性即可。

```tsx
// BlogPostDetail.tsx
const { html, sections } = renderBlogMarkdown(post.body)
// ...
<ProximitySidebar sections={sections} side="right" />
```

HTML 和目录来自同一次渲染，id 永远不会漂移。slug 规则是中文保留、空格和标点折叠成 `-`，所以中文标题会得到 `一-背景-…` 这样可读的锚点；重复标题自动加 `-1` 后缀。顺带处理了 `#hash` 深链：进页面时 URL 带锚点的话，挂载后直接跳过去。

### 密度线与滚动高亮

光有结构线还不够像 minimap——Vercel 那条的妙处是长章节的线更"重"。实现是渲染前先用 lexer 数一下每个标题下有多少内容块（段落、代码块、列表都算），块数不少于 2 的章节有资格获得若干条灰色、不可点的"密度线"，追加在它的 dash 后面；总量按「标题数的 50%、总线条数不足 10 条时补足」的目标，从最重的章节轮流分配。一眼扫过去，dash 的疏密就是各节的体量分布。

滚动高亮以视口 40% 高度处为锚线，取覆盖（或最接近）锚线的章节为当前章节。有两个和自研滚动容器的兼容坑值得记：

- 本站的阻尼滚动（DampedScrollView）用 transform 平移内容，`scrollIntoView` 会落在过渡中的视觉位置上导致跳转偏移。解法是沿 `offsetParent` 链累加 `offsetTop` 得到未变换的布局位置，改用 `window.scrollTo`，并留 96px 给固定头部。
- 阻尼在滚动停止后还会继续平移约 300ms，所以高亮更新不能只监听 scroll 事件，而是一帧帧重测，直到 480ms 内再无滚动活动才视为静止。

侧边栏只在桌面端（≥768px）显示。至此每篇结构规整的文章自动获得目录侧边栏，新文章落盘即生效，不需要为侧边栏写任何代码——这大概是把接线做进渲染管线里最大的回报。
