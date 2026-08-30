# ProximitySidebar 调参指南

所有可调项集中在两个文件。改完必跑 `pnpm test`；凡影响「dash 条数」的改动还要同步 e2e 期望值并跑 `pnpm exec playwright test e2e/blog-sidebar.spec.ts`。

## 密度与正文线 — `client/src/content/loaders/markdown.ts`

分配模型：目标正文线数 `target = min(max(round(标题数 × RATIO), MIN_TOTAL_LINES − 标题数), 标题数 × 2)`；每个 h2/h3 章节容量 `min(块数 ÷ BLOCKS_PER_BODY_DASH, 每章上限)`，从最重的章节轮流发牌直到达标或容量耗尽。

| 参数 | 默认 | 含义 |
|---|---|---|
| `BODY_DASH_RATIO` | `0.5` | 密度线目标 = 标题数 × 此值。0 = 只靠 MIN_TOTAL_LINES 下限 |
| `MIN_TOTAL_LINES` | `10` | 总线条数（标题线 + 密度线）下限，防止短文侧边栏太稀疏 |
| `BODY_DASH_MIN_BLOCKS` | `2` | 章节至少几个内容块才有资格获得密度线 |
| `BLOCKS_PER_BODY_DASH` | `2` | 每章容量 = 块数 ÷ 此值（内容越重线越多） |
| `MAX_BODY_DASHES_PER_SECTION` | `3` | 单章密度线上限（防止一章独占） |

改密度参数后：

- 单测 `client/src/content/loaders/__tests__/markdown.test.ts` 的 "body dash augmentation" 组用静态期望值 + 注释里的公式推导，按新参数重算各用例的 target/容量
- e2e `e2e/blog-sidebar.spec.ts` 的 `EXPECTED_BODY_DASHES`（当前 11，基于 Ollama 部署文 21 个标题 → min(max(11, −11), 42) = 11）按新公式重算

## 视觉与交互 — `client/src/components/ui/proximity-sidebar.tsx`

| 参数 | 当前值 | 含义 |
|---|---|---|
| `DASH_PRESETS.*.base` | title 40 / subtitle 36 / section 30 / body 24 | 各级 dash 静止长度（px，基于 MAX_DASH_WIDTH=110 的 scaleX） |
| `DASH_PRESETS.*.bump` | 70 / 64 / 56 / 50 | 鼠标贴上时的额外伸长量 |
| `DASH_PRESETS.*.className` | `#1c1b1a`（h2、活跃）/ `#6a6560`（h3）/ `#8e8a85`（正文线） | 颜色分级。1px 线抗锯齿后显色偏浅，配色要比文字色深一档 |
| `ACTIVE_DASH_CLASS` | `#1c1b1a` | 当前章节 dash 的颜色（`transition-colors` 渐变过去） |
| `RADIUS` | `40` | 鼠标接近感应半径（px），决定「波浪」影响几条线 |
| 内层容器 `h-[45vh]` + `justify-between` | 45vh | dash 列纵向跨度。想更矮/更高改这一个 class |
| `gap-2` | 8px | dash 间最小间距兜底（space-between 主导实际间距） |
| `activeOffset`（prop，默认 `0.4`） | 40% | 滚动高亮的锚线位置：0=视口顶，1=视口底 |
| `scrollOffset`（prop，默认 `96`） | 96px | 点击跳转后标题停在顶部导航下方的间距，对齐页面 `pt-28`（112px）的留白习惯 |
| `SCROLL_SETTLE_MS` | `480` | 滚动停止后持续测量的时长，须大于 DampedScrollView 的 300ms 过渡 |

## 为什么有两个非显然的设计（改前必读）

- **点击跳转用 offsetTop 累积 + `window.scrollTo`，不是 `scrollIntoView`**：桌面端 `DampedScrollView` 是假滚动（scrollbox 被 `translateY(-window.scrollY)` 平移 + 0.3s 缓动），过渡中途 `getBoundingClientRect` 是「视觉位置」，scrollIntoView 会误靶
- **侧边栏必须渲染在 `DampedScrollView` 外层**（当前与 `<Navigation />` 平级）：transform 祖先会让 `position: fixed` 相对 scrollbox 定位，侧边栏会跟着内容滚走

## 改后验证清单

1. `pnpm test` — 组件与 markdown 单测
2. `pnpm exec playwright test e2e/blog-sidebar.spec.ts` — 条数断言变了就必须同步 `EXPECTED_HEADING_DASHES` / `EXPECTED_BODY_DASHES`
3. `pnpm dev:client` 打开任意长文（推荐 `/blog/deploy-ollama-on-school-ai-platform`）：接近动画、滚动高亮（停止滚动后 300ms 内仍正确）、阻尼滚动中点击落点 ≈ scrollOffset
