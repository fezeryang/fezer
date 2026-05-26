---
title: "NUX：把 AI 金融研究终端做成一条证据链"
date: "2026-05-26"
excerpt: "一次对 NUX 当前代码库的产品和架构梳理：它不是一个聊天框，而是把行情、新闻、SEC 文件、期权、宏观、研报和学习系统组织到同一张研究工作台里。"
tags:
  - "NUX"
  - "AI"
  - "Finance"
  - "Research"
category: "Product Engineering"
---

NUX 现在已经不是一个“问 AI 股票怎么看”的页面。

从当前项目代码看，它更像一个单页金融研究终端：左侧是研究工作台导航，前端用 React + TypeScript 组织多个研究视图，后端用 Express 把外部数据源、AI 模型、SEC 文件、纸面交易和本地数据存储收进统一的 `/api/*` 网关。仓库里大约有 221 个 TypeScript/JavaScript 文件、4.6 万行代码、39 个 Express 路由、50 个单元与 E2E 测试文件。这个规模已经足够说明一件事：NUX 的核心不在聊天框，而在“如何让一次金融研究可追溯、可降级、可解释”。

这篇文章不是产品宣传稿，而是一次项目内视角的拆解：NUX 到底解决什么问题，当前架构怎么支撑它，以及接下来最值得继续打磨的地方。

## 从一个问题开始：金融 AI 最怕什么

金融研究里的 AI 问答有一个天然风险：它太容易把不确定性说得像结论。

一个模型可以很顺滑地解释财报、新闻、宏观变量和期权策略，但如果没有行情来源、没有官方披露、没有数据质量状态、没有“研究用途而非投资建议”的边界，用户看到的就只是语言能力，而不是研究能力。

NUX 的当前实现围绕这个问题做了几层约束：

- 实时数据不直接暴露第三方密钥，统一走 Express 后端代理。
- 聊天不是只有模型回复，还支持 slash command、工具注册、后端命令执行、证据块和来源追踪。
- 研报生成会并行拉取行情、基本面、新闻、SEC 文件、官方来源、历史价格、Whisper 社交情绪和内部人交易数据。
- 每个数据源都有健康状态，失败时进入 fallback 或 unavailable，而不是假装数据完整。
- 模型输出经过研究用途安全提示和交易导向语言过滤，避免输出买卖评级、目标价、入场点、止损位等指令化内容。

这让 NUX 的产品方向很清楚：它不是要替用户下判断，而是把研究材料、模型解释和不确定性放在同一个界面里。

## 产品表面：一个终端，多条研究路径

NUX 的主界面由 `AppShell` 承载，导航里已经覆盖了完整的研究流程：

- Overview：市场概览、简报、异动榜、新闻和最近研究。
- Report：股票综合研报。
- Chat：AI 聊天和命令式研究入口。
- Chain：期权链。
- Backtest：策略回测。
- News Impact：新闻影响分析。
- Macro：宏观数据和 AI 宏观解读。
- Trading：Alpaca 纸面交易。
- Time Machine：历史事件回放。
- Whisper：社交情绪和市场讨论信号。
- Academy：期权学习学院。
- Feedback / Admin：反馈与管理。

这个导航结构很重要。它说明 NUX 没有把所有交互都塞进一个聊天窗口，而是保留了金融终端应有的“视图分工”：行情看行情，研报看研报，期权链看链，学习系统看课程。聊天是入口之一，不是整个产品。

这种设计对金融研究尤其必要。因为金融问题通常不是一句话能结束的：

> “NVDA 最近怎么了？”

这个问题可能需要最新行情、新闻、SEC 文件、历史价格、期权波动率、宏观背景、来源可信度和风险提示。单一模型回答会把这些混在一起；NUX 的做法是把它拆成多个可检查的工作台。

## 数据层：所有外部世界先经过后端网关

前端的 `marketDataService` 不直接调用第三方金融 API，而是访问本地后端：

- `/api/quote/:ticker`
- `/api/fundamentals/:ticker`
- `/api/news/:ticker`
- `/api/history/:ticker`
- `/api/sec/filings/:ticker`
- `/api/options/chain/:ticker`
- `/api/options/expirations/:ticker`
- `/api/macro/energy`
- `/api/macro/fred/:seriesId`
- `/api/trading/*`

后端再去接 Alpaca、Polygon/Massive、Finnhub、Yahoo Finance、SEC EDGAR、EIA、FRED 等来源。这个边界有两个实际价值。

第一，密钥不需要进浏览器。项目说明里也明确要求：不要用 `VITE_` 暴露 server-only keys，DeepSeek 这类密钥保持在后端环境变量中。

第二，前端获得的是统一后的数据结构。无论底层来源是实时行情、第三方 API、缓存、模拟 fallback，UI 都能通过 `source`、`status`、`dataSourceHealth` 这类字段表达数据质量。

金融产品里，数据失败不是异常情况，而是日常情况。限流、空结果、延迟、供应商不可用都会发生。NUX 当前的实现没有把这些都吞掉，而是把失败状态变成研究结果的一部分。

## 聊天层：从“模型回答”升级成“工具化研究”

NUX 的聊天系统有两条路径。

一条是自然语言分析：用户输入普通问题，系统会构建研究用途 prompt，选择 Gemini 或 DeepSeek 等服务，然后经过安全过滤后返回。

另一条是命令式研究：用户输入 `/quote AAPL`、`/news NVDA`、`/sec MSFT`、`/trust TSLA`、`/evidence GOOGL` 这类 slash command，后端命令执行器会直接拉取结构化数据，生成可渲染的 blocks 和 evidence items。

当前命令注册表覆盖了：

- 行情：`quote`
- 新闻：`news`
- 基本面：`fundamentals`
- 历史和图表：`history`、`chart`
- 研报和视图跳转：`report`、`chain`、`backtest`、`impact`、`macro`
- 可信度：`verified-news`、`sec`、`official`、`trust`、`evidence`
- 公司事件：`insiders`、`earnings`、`dividends`

这让聊天从“生成文本”变成“调度工具”。更关键的是，工具结果不是只拼进一段文字里，而是会生成图表、表格、公式、免责声明、证据列表和数据质量卡片。用户可以看到回答背后的来源，而不是只看到模型语气。

## 研报层：并行抓取，失败可见，AI 可替换

`generateStockAnalysisReport` 是 NUX 当前最能代表产品哲学的一段流程。

它并行抓取多个来源：

- Quote
- Fundamentals
- News
- SEC Filings
- Official Sources
- Price History
- Whisper social sentiment
- Insider Trading

每个来源都通过 `safeResolveSource` 包起来，带 timeout、健康状态和失败原因。然后系统构建 evidence pack、source trust summary 和 fallback report。最后才进入 AI 分析阶段。

这意味着即使 DeepSeek 不可用，NUX 也能产出确定性的 fallback report；即使某个市场数据供应商失败，报告也会记录“这个来源不可用”，而不是把缺口藏起来。

这是一个很正确的方向。金融研报最重要的不是每段话都漂亮，而是每个结论知道自己依赖了什么，缺了什么。

## 来源可信度：把“看到新闻”变成“检查新闻”

NUX 当前有一套来源可信度体系。

新闻会先经过 source tier 分类：官方/监管来源、金融数据 API、主流媒体、聚合器、未知来源。系统会基于 URL、正文、发布时间、重复报道、来源数量和情绪标签计算 confidence score，并做标题相似度去重。

官方来源则走另一条路径：SEC 文件、投资者关系页面、公司官网、新闻发布页和其他候选官方渠道会被聚合到 official source verification 中。

最后 `sourceTrustService` 用四个维度打分：

- Source diversity：来源类型是否多样。
- Authority depth：是否有 SEC 文件、IR 页面、官网/新闻室等权威来源。
- Cross-verification：官方来源、SEC 文件和高置信新闻之间是否互相支撑。
- Mode bonus：是否包含 AI 权威性审查信号。

这个设计比“新闻情绪正面/负面”更接近真实研究工作。因为金融研究不是只问“新闻说什么”，还要问“谁说的、是否重复、是否有官方披露支撑、是否只是聚合器转载”。

## 期权和学习：把复杂工具变成可练习的空间

NUX 的期权能力不只是展示期权链。

`marketDataService` 里包含 Black-Scholes、Heston、Greeks、期权链归一化、term structure、fallback synthetic chain 等逻辑。前端有期权链、波动率曲面、收益图、策略构建器、回测、3D 可视化和 Options Runner game。

Academy 模块进一步把这些工具变成课程：

- 课程有 manifest。
- 每节课定义目标、互动工具、数据策略、验收标准、Remotion 场景和 agent demo actions。
- Tutor 可以评分、给提示、指出误解。
- Academy Agent 可以观察用户交互，给出指导或演示动作。
- 学习进度存在本地 storage 中。

这部分很有产品想象力。很多金融工具的问题是“功能强，但用户不知道怎么学”。NUX 把期权工具和学习路径放在同一个系统里：用户可以先看概念，再改参数，再看 payoff，再让 tutor 检查理解。

## 宏观和纸面交易：研究上下文继续向外扩

Macro View 把 FRED、EIA 和经济日历数据放到一个宏观仪表盘里，并支持 AI 宏观分析。即使模型不可用，也有本地 fallback 分析，能基于联邦基金利率、CPI、失业率、10Y-2Y 利差、VIX、WTI 原油等变量生成研究性解读。

Trading View 接入 Alpaca paper trading，展示账户、持仓、市场时钟，并支持下单表单。这里的产品边界需要继续保持清楚：交易入口必须始终强调 paper trading、研究用途和风险提示，不能让 AI 分析自然滑向交易指令。

当前代码里已经有 `RiskDisclaimer`、模型安全过滤和研究用途 prompt，这些是正确的底座。随着交易功能更完整，安全边界还需要继续加强。

## 工程取舍：它现在更像一个“本地研究操作系统”

从工程角度看，NUX 当前有几个明显取舍。

第一，系统优先可用。外部数据失败时会 fallback 到模拟或确定性分析，避免页面整个空掉。这对演示和开发很实用。

第二，系统优先透明。报告、聊天、证据块、source trust、data source health 都在提醒用户：数据质量本身就是研究材料。

第三，系统优先模块化。前端组件按工作台视图拆分，服务层按领域拆分，后端也把聊天路由、模型 provider、工具执行、证据构建、source trust、academy tutor/agent 拆成单独模块。

第四，系统还处在快速扩张阶段。比如 README 里写的是 NUX，但本地 storage key 仍有 `volt-language`；某些 fallback 和模拟数据是为了可用性服务，但在正式产品中需要更醒目的标注；部分命令在前端注册但后端命令执行器里暂未完全支持。这些不是方向错误，而是从 prototype 走向 product 时要收紧的地方。

## 当前最值得继续打磨的三件事

第一，继续统一“真实数据 / fallback / simulation”的视觉语言。

NUX 已经记录了数据健康状态，但在所有视图里都应该同样显眼。尤其是期权链、研报、宏观和聊天块，用户必须一眼知道当前结论来自实时数据、延迟数据、fallback 还是模拟数据。

第二，把 evidence pack 做成产品核心资产。

现在 evidence 已经散布在报告、聊天 trace、source trust 和新闻验证里。下一步可以把它升级成统一的“研究证据抽屉”：一个 ticker 的行情、新闻、SEC、官方来源、历史价格、社交情绪、内部人交易都能在同一个证据面板里被复用。

第三，收紧 AI 与交易之间的边界。

AI 可以解释风险、生成研究问题、帮助理解期权结构，但不能输出交易指令。当前 `modelSafetyService` 已经在做过滤，未来还可以在 UI 层、API 层和日志层继续强化：只要涉及交易、订单、仓位，就把“研究解释”和“执行动作”明确分开。

## 结尾：NUX 真正有价值的不是 AI，而是研究结构

很多 AI 金融产品会把重点放在“模型多聪明”。NUX 当前代码库展示的是另一条路：让模型站在数据、证据、来源可信度和交互工具之上。

这条路更慢，也更工程化。它需要处理 API 限流、空数据、缓存、fallback、双语文案、图表渲染、E2E 回归、模型安全、来源评分和学习进度。但它也更接近真实用户需要的东西。

金融研究不是让 AI 给一句答案。

金融研究是把问题拆开，把证据摆出来，把数据质量说清楚，把不确定性留在桌面上，然后让用户自己做判断。

NUX 当前最有价值的地方，就在这里。
