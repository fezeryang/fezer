# Harness 层 + 3D 简历产品化 + 地图优化：实施计划

> 上游文档：`参考.md`（Phase 1–5 产品计划）、`AGENT_ARCHITECTURE.md`（架构边界）、`docs/jianli-optimization-analysis.md`（早期分析）
> 本文合并三条线：**A. Harness 运行时** / **B. 3D 地图优化** / **C. 3D 简历产品功能**
> 状态基线：`pnpm check` 干净、289 单测通过（2026-09-13 实测）

---

## 0. 现状核对

### 0.1 `参考.md` Phase 1 已完成（当前工作区未提交）

| 项                              | 状态 | 证据                                                                                                                                      |
| ------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 内容感知路由                | ✅   | `orchestrator/graph.ts` `isExplicitTargeting`；`supervisor/graph.ts` `resolveContextualTargetAgent`；`intent-classifier.ts` `spatialHint` |
| 1.2 会话历史打通                | ✅   | `ConversationTurn` + 三链路透传 + 服务端 8×4000 sanitize                                                                                  |
| 1.3 消除重复用户输入            | ✅   | expert 消息数组单一 user 注入                                                                                                             |
| 1.4 递归防护 + 白名单强制       | ✅   | `MAX_CONSULT_DEPTH=1`、ALS 调用方身份、`canConsult` 代码强制                                                                              |
| 1.5 grounding 转发 + 死参数清理 | ✅   | `options.context` 透传、`previousContext` 已删                                                                                            |
| 1.6 工具暴露策略重做            | ✅   | 白名单常驻、条件预取、限额 6000/5000                                                                                                      |
| 1.7 错误信封 + 杂项             | ✅   | 400 message、`crypto.randomUUID`、显示名映射                                                                                              |

### 0.2 Agent 运行时缺口（对照 Microsoft harness 能力矩阵实测）

| 能力              | 现状                                                                        |
| ----------------- | --------------------------------------------------------------------------- |
| Run 身份 / 事件流 | ❌ 无 runId，只有 `res.json()`；全库零 SSE                                  |
| 会话与持久化      | ❌ 服务端无状态，历史由客户端上送；`MemorySaver`/`interrupt` 在依赖里但未用 |
| 预算 / 成本       | ❌ `InvokeResult.usage` 无人读取；唯一预算是 `MAX_TOOL_CALL_LOOPS=3`        |
| 取消              | ❌ 客户端断开不停循环                                                       |
| 工具面            | ⚠️ 注册 16 个，白名单只触达 10 个（6 个死工具）                             |
| 工具 schema 成本  | ⚠️ 实测每 agent 763–1127 tokens（core 最高）                                |
| 鉴权/限流         | ❌ `/api/chat`、`/api/guide`、`/api/character` 无认证、无限流               |

### 0.3 3D 地图体检（实测数据）

| 项               | 实测                                                                                                     | 影响                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 模型体积         | `client/public/models/` **57 个 glb / 9.5MB**                                                            | 首屏成本                                |
| 预加载策略       | `Room.tsx` 模块级 `useGLTF.preload` × 14（`MAP_PRELOAD_MODELS`）+ `Scene.tsx` `preloadCharacters()` × 18 | **约 9.3MB 无条件加载**                 |
| 最大单体         | `room-large.glb` 921KB、`room-large-variation.glb` 876KB、`room-wide-variation.glb` 828KB                | 移动端致命                              |
| 阴影             | `castShadow` 只在 directionalLight（Scene.tsx:55）；`receiveShadow` 只在地面（:107）                     | **渲染 shadow map 但零投射者 = 纯浪费** |
| 角色渲染         | `Character.tsx` `<primitive object={scene.clone()} />` 写在 JSX 内                                       | 每次 re-render 克隆整个 scene 图        |
| 帧率耦合         | `const delta = 0.016`（Character.tsx）                                                                   | 120Hz 屏角色速度 ×2                     |
| 相机             | 两个 `setLookAt` effect 在挂载时都触发                                                                   | 首帧视角被覆盖一次                      |
| 房间标签         | 7 个 drei `<Html>`，未用 `occlude`/`distanceFactor`                                                      | 每帧同步 DOM，移动端压住面板            |
| 移动端           | `Jianli.tsx` 断点类 **2 个**，`ChatModal.tsx` **0 个**；`useIsMobile` 未接入                             | 窄屏不可用                              |
| 健壮性           | 无 WebGL 检测、无错误边界、无加载进度、无 reduced-motion 降级                                            | 低端设备白屏                            |
| 未接线的现成能力 | `_core/voiceTranscription.ts`（`transcribeAudio`）**零消费者**                                           | 语音输入可零成本接入                    |

### 0.4 执行前提（必须先做）

当前工作区有 **17 个已修改 + 8 个未追踪文件**，全部属于 `参考.md` Phase 1。在这个地基上直接叠加 harness，会得到一个无法回滚的巨型 diff。

**第 0 步：把 Phase 1 拆成 2–3 个 commit 落盘**（建议按「路由与会话链路」/「工具与协作硬化」/「TODŌU 嵌入桥」分组，最后一条与 agent 无关可独立提交），`pnpm check && pnpm test` 全绿后再开 P0。

---

## 1. 目标与非目标

### 目标

1. 把 agent 层从"一次请求一次响应"升级为**可被任意调用方复用的运行时（harness）**：有 run 身份、事件流、会话、预算、取消、计量。
2. 让 3D 简历从"能聊"变成**能带人逛、能记住访客、能展示真实内容**的产品界面。
3. 3D 地图达到可用的性能与体验基线：**首屏模型 < 1.5MB、稳定 60fps、移动端可用**。

### 非目标

- 不做通用 coding agent、不做多租户 SaaS、不做向量数据库/embedding 检索。
- **不重写** `orchestrator → supervisor → expert` 三层：harness 包在外面。
- 不引入新依赖：harness 原语已在 `@langchain/langgraph@1.2.9`（`MemorySaver`/`BaseCheckpointSaver`/`interrupt`/`Command`/`streamEvents`/`InMemoryStore`）。

---

## 2. 终态架构

```text
调用方
  ├─ /api/chat /api/guide /api/character      （现有聊天 UI，行为兼容）
  ├─ 3D 地图主动导览（进入房间自动招呼）        ← 新增，C1
  ├─ /api/agent/run  （流式 SSE）              ← 新增，A2
  ├─ 后台/内容运营（草稿、摘要、FAQ 沉淀）      ← 新增，P4
  └─ CLI / 脚本（评测、回归）                  ← 新增，A6

──────────────────────────────────────────────
server/agents/harness/          ← 新增，唯一对外运行时
  run.ts        runAgent / streamRun / resumeRun
  events.ts     RunEvent（单一事件协议）
  session.ts    thread store（内存 + Drizzle）
  policy.ts     工具白名单 / canConsult / depth / 审批
  budget.ts     turns / tokens / wall-clock
  errors.ts     RunError(code)
──────────────────────────────────────────────
现有引擎（不改结构）
  orchestrator/graph → supervisor/graph → expert/agent-factory → _core/llm
  tools/  rag/  spatial/  relations/
```

**关键决策：一份事件协议服务三个消费方。**
`参考.md` Phase 2 提的 `AgentStreamEvent` 不另起一套，直接采用 harness 的 `RunEvent`；路由只负责把它映射成 SSE，前端/地图/其他功能消费同一协议。

### 2.1 RunEvent 契约（先落契约，再写实现）

```ts
// shared/src/schemas/run.ts
export type RunEvent =
  | { type: "run.started"; runId: string; threadId: string; at: number }
  | { type: "step.started"; stepName: string; at: number }
  | { type: "step.finished"; stepName: string; at: number }
  | { type: "agent.start"; agentId: FezerType; displayName: string; at: number }
  | { type: "agent.done"; agentId: FezerType; at: number }
  | { type: "tool.call"; toolName: string; args: unknown; at: number }
  | {
      type: "tool.result";
      toolName: string;
      ok: boolean;
      truncated: boolean;
      bytes: number;
      at: number;
    }
  | { type: "text.delta"; messageId: string; delta: string; at: number }
  | {
      type: "run.finished";
      runId: string;
      outcome: RunOutcome;
      usage: RunUsage;
      answer: string;
      uiAction?: UiAction;
      at: number;
    }
  | {
      type: "run.error";
      runId: string;
      code: RunErrorCode;
      message: string;
      at: number;
    };

export type RunOutcome =
  | { type: "success" }
  | { type: "budget_exhausted"; limit: "turns" | "tokens" | "wall_clock" }
  | { type: "cancelled" }
  | { type: "interrupt"; reason: string }; // 预留：工具审批 / 需要澄清

export interface RunUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  toolCalls: number;
  providerFallbacks: number;
  wallClockMs: number;
}

export type RunErrorCode =
  | "provider_unavailable"
  | "budget_exhausted"
  | "cancelled"
  | "invalid_input"
  | "internal";
```

SSE 映射：`event: <type>` / `data: <JSON>`；`at` 用于排序与客户端重放；`run.finished` / `run.error` 是**终止事件**，之后不得再发。

### 2.2 事件从哪里来（技术澄清）

**`streamEvents()` 不够用。** 专家工具循环跑在 `callSupervisor` **单个节点内部**（节点 → `askSupervisor` → `expert.invokeAgent` → 工具循环），不是 LangGraph 节点。所以 `streamEvents()` 只能给出 3 个节点级事件，**拿不到 `tool.*` 与 `text.delta`**。

推荐机制：**ALS 事件汇**，与项目已有的两个 `AsyncLocalStorage` 模式一致（`agent.tool.ts` 的调用方上下文、`langsmith.ts` 的 trace 上下文）。

```ts
// harness/events.ts
export function runWithEventSink<T>(
  sink: (e: RunEvent) => void,
  fn: () => Promise<T>
): Promise<T>;
export function emitRunEvent(e: Omit<RunEvent, "at"> & { at?: number }): void; // 无 sink 时静默
```

- 节点级 `step.*`：由 `streamEvents()` 产出（免费）
- `agent.*` / `tool.*` / `text.delta`：`agent-factory` 在循环里直接 `emitRunEvent()`
- 好处：**零签名透传**（不用把 `onEvent` 穿过 orchestrator → supervisor → expert 四层），且非 LangGraph 调用方（地图主动导览、CLI）复用同一套事件
- 已确认：ALS 在 `Promise.all` 并行分支内正确隔离（与现有 `runWithAgentToolContext` 同机制）

---

## 3. 工作流（WBS）

### A. Harness 运行时

| ID     | 内容                                                                                                                          | 关键文件                                                        | 验收                                                    |
| ------ | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------- |
| **A1** | Run 骨架：`runAgent(input, {threadId?, caller, budget?})` + `RunEvent` 联合类型 + run 记录                                    | `server/agents/harness/{run,events,errors}.ts`                  | 单测：事件顺序、runId 稳定、错误信封                    |
| **A2** | 事件源：`streamRun()` `streamEvents()` 产节点级事件 + ALS 事件汇产工具/文本事件（见 §2.2）；路由映射 SSE                      | `harness/run.ts`、`routes/chat.ts`、`shared/src/schemas/run.ts` | 集成测试：SSE 帧序、`stream:false` 走原 JSON 路径       |
| **A3** | 工具事件与步骤：工具前后发 `tool.call/tool.result`（带截断标记）、意图分类发 `step.*`                                         | `expert/agent-factory.ts`（注入 `onEvent`）                     | 单测：tool 事件 + `truncated:true` 元数据               |
| **A4** | 预算与取消：`maxTurns/maxTokens/maxWallClockMs/signal` 透传；超限产生 `outcome` 而非拼进文本                                  | `harness/budget.ts`、`_core/llm.ts`、`agent-factory.ts`         | 单测：超限、取消、部分结果                              |
| **A5** | 会话：`session.ts` + Drizzle 表 `threads/thread_turns`（内存 fallback）；`resume` 语义                                        | `harness/session.ts`、`drizzle/schema.ts`                       | 集成测试：两轮状态在服务端；重启行为明确                |
| **A6** | 观测与计量：run/step span、usage（token/latency/tool 次数/fallback 命中）；评测入口                                           | `harness/run.ts`、`_core/observability/langsmith.ts`            | 测试：usage 落库；`langsmith-feedback` 死代码接线或删除 |
| **A7** | 边界与安全：`/api/agent/run` 加限流 + 可选鉴权；工具面收敛（删 6 个死工具 + `@deprecated` 包装器 + `expert/index.ts` 死导出） | `tools/index.ts`、`expert/index.ts`、`_core/security.ts`        | 结构测试保持绿；工具数 16→10                            |

### B. 3D 地图优化

| ID     | 内容                                                                                                                           | 关键文件                                                         | 验收                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | -------------------------------------------------- |
| **B1** | 加载策略：删模块级全量 preload；按"当前房间 + 相邻"加载；角色只加载当前房间                                                    | `Room.tsx`、`Scene.tsx`、`Character.tsx`、`assets/modelPaths.ts` | 首屏模型字节 < 1.5MB（DevTools 实测）              |
| **B2** | 资源瘦身：评估 Draco 压缩 / 贴图降采样 / 房间模型复用（9 房间 → 3–4 个 base + 变体）；建立 `scripts/model-report.md`           | `client/public/models/`、构建管线                                | 总体积下降 ≥ 40%，观感无回归（截图对比）           |
| **B3** | 渲染修复：修 `scene.clone()` per-render（`useMemo`）；阴影二选一（真投射 或 全场关闭 shadow）；加 `fog` + 距离裁剪；动态 `dpr` | `Character.tsx`、`Scene.tsx`                                     | 中端笔记本 ≥ 55fps（3 分钟巡游采样）               |
| **B4** | 帧率无关移动 + 状态机收敛；`delta` 用 `clock.getDelta()`                                                                       | `Character.tsx`                                                  | 60/120Hz 下移动速度一致                            |
| **B5** | 相机：单一 `setLookAt` 源、reset 视角、聚焦角色、移动端约束（`minDistance`/`polar` 随视口）                                    | `CameraController.tsx`                                           | 首次进入无跳变；手机可单手操控                     |
| **B6** | 交互反馈：房间 hover 高亮/描边、cursor 变化、点击命中优先级（房间 > 角色）、标签 `occlude`/`distanceFactor`                    | `Room.tsx`、`Scene.tsx`                                          | 30 秒内新用户能自主找到目标房间（可用性小测）      |
| **B7** | Wayfinding：minimap（复刻 `ProximitySidebar` 的 dash 语言）、"你在这里"、已访问/未访问状态                                     | 新 `components/jianli/Minimap.tsx`                               | 7 房间状态与 `activeRoomId` 一致                   |
| **B8** | 健壮性：WebGL 检测与降级、错误边界、加载进度、`prefers-reduced-motion`、`prefers-reduced-data`                                 | `Jianli.tsx`、`Scene.tsx`                                        | 禁用 WebGL 时不白屏，有可读降级页                  |
| **B9** | 移动端：布局重排（面板改底部抽屉）、触摸手势、`useIsMobile` 接入                                                               | `Jianli.tsx`、`ChatModal.tsx`                                    | iPhone SE 尺寸可完成"进房间 → 提问 → 跳内容"全流程 |

> **B 表勘误（2026-09-13 实测）**：B1 原写「删模块级全量 preload」的前提是错的。`Scene.tsx` 会把 7 个房间 + 9 条走廊 + 4 个结构 + 18 个角色**同时挂载**，所以 `MAP_PRELOAD_MODELS` / `preloadCharacters()` 预加载的就是场景迟早要渲染的那一批 —— 删掉它们不会省字节，只会把并行预取变成串行瀑布。
>
> 真正能降首屏字节的只有一个手段：**按需挂载**（只挂当前房间 + 相邻房间，见 `shared/src/map/rooms.ts` 已有的 `ROOM_ADJACENCY` / `getAdjacentRooms`），代价是切房间时需要过渡（雾/遮罩）掩盖加载。这依赖决策点 2。
>
> 另一个更划算且顺带改善产品的选项：**角色从 18 降到 7（每房间 1 个，与 agent 一一对应）** —— 省 11 次模型加载（约 1.2MB）、11 个 `useFrame`、11 次克隆，同时让 3D 地图与 agent 系统对齐（现在 18 个无名 kitty 与 7 个 agent 毫无对应关系），也是 C1 主动导览 / C9 房间内容化的前提。

### C. 3D 简历产品功能（`参考.md` Phase 2–5 + 新增）

| ID      | 功能                                                                                                                                          | 依赖 harness            | 来源        |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------- |
| **C1**  | **主动导览**：进入房间 1.5s 后该房间 agent 主动招呼，带房间真实内容摘要；可关闭                                                               | A5（会话）+ A3          | 新增        |
| **C2**  | **流式响应**：真实 `text_delta` 增量渲染（Streamdown），替换假 thinking                                                                       | A2/A3                   | 参考.md 2.x |
| **C3**  | **思考可视化**：工具名 → 中文标签（`get_profile_full → 正在查阅简历档案`）、步骤时间线                                                        | A3                      | 参考.md 2.x |
| **C4**  | **多专家协作可视化**：并行路径激活 + 协作时间线（各 agent 状态圆点）+ 真实综合（显式 span、失败降级为分段）                                   | A2/A3                   | 参考.md 3.x |
| **C5**  | **内容卡片**：回答尾部确定性派生作品/博客卡片（slug 必须在 content-index 校验通过，最多 3 张），点击深链 `/works/:slug`、`/blog/:slug`        | —                       | 参考.md 4.x |
| **C6**  | **访客进度**：`localStorage` 记录已探索房间/已问问题；服务端注入进度上下文；推荐未访问房间                                                    | A5（可选，v1 纯客户端） | 参考.md 5.x |
| **C7**  | **跨会话记忆**：harness thread 持久化 → "继续上次对话"入口                                                                                    | A5                      | 新增        |
| **C8**  | **语音输入**：复用 `_core/voiceTranscription.ts`（现有零消费者）+ 新路由                                                                      | —                       | 新增        |
| **C9**  | **房间内容化**：每个房间展示真实作品/博客/技能（3D 场景内浮层或侧栏内容区），不再只有 `highlights` 标签                                       | C5                      | 新增        |
| **C10** | **分享/导出**：把一次对话或一次探索生成可分享卡片（图片或链接），用于求职场景                                                                 | A1                      | 新增        |
| **C11** | **简历内容运营化**：`shared/src/resume/profile.ts`（126 行硬编码）迁到 `client/src/content/profile/*.md` + admin 可编辑，改内容不再需要改代码 | —                       | 新增        |

---

## 4. 分期路线图

依赖顺序：**harness 是产品功能的底座，3D 地图优化可完全并行**。

### P0 — 地基（≈4 天）★ 建议先做

| 项       | 内容                                                                        |
| -------- | --------------------------------------------------------------------------- |
| A1 + A2  | harness 骨架 + 事件协议 + `/api/chat` 迁移（**前端零改动**，JSON 路径保留） |
| B1 + B3  | 3D 最痛的两处：全量预加载 + clone/阴影浪费                                  |
| B4       | 帧率无关移动（3 行修复）                                                    |
| A7(部分) | 删 6 个死工具                                                               |

**验收**：`pnpm check` + 289 测试全绿；新增 harness 单测覆盖事件顺序/预算/取消；首屏模型字节实测 < 1.5MB；巡游 FPS ≥ 55。

### P1 — 流式与可视化（≈5 天）

A3（工具事件）+ A4（预算/取消）+ C2（流式文本）+ C3（思考可视化）+ B6（交互反馈）+ B5（相机）

**验收**：SSE 端到端可用；`ThinkingIndicator` 显示真实工具步骤；取消按钮能真正中断请求；e2e mock 下移到 harness 后 e2e 仍绿。

### P2 — 内容与外化（≈5 天）

C5（内容卡片）+ C9（房间内容化）+ B7（minimap）+ B9（移动端）+ C4（协作可视化）

**验收**：回答带可点击卡片并能跳转；手机完成全流程；minimap 状态正确；多专家问题显示协作时间线。

### P3 — 记忆与个性化（≈4 天）

A5（thread store）+ C6（访客进度）+ C7（继续上次对话）+ C1（主动导览）

**验收**：刷新页面后能继续上次对话；进入未访问房间触发招呼且不重复；推荐随进度变化。

### P4 — 运营与评测（≈4 天）

A6（计量 + eval harness）+ C8（语音）+ C10（分享导出）+ C11（内容运营化）+ B2（资源瘦身）+ B8（健壮性）

**验收**：pass@k 基线纳入 CI；admin 能看到"未答好的问题"；简历内容可在后台编辑。

---

## 5. 产品需求细化（PRD-lite）

### C1 主动导览

- **用户故事**：作为访客，我进入一个房间时希望立刻知道这里有什么，而不是自己去猜。
- **行为**：房间切换 → 1.5s 后该房间 agent 发一条 ≤2 句的招呼（含 1 个真实内容锚点）；同一房间本次会话只触发一次；有"不再自动出现"开关；正在聊天时不打断。
- **约束**：不得触发工具循环（用已预取上下文），延迟 ≤1.2s，失败静默。
- **验收**：切换 7 个房间恰好触发 7 次；关闭开关后为 0 次。

### C2 + C3 流式 + 思考可视化

- **用户故事**：等待时我知道 agent 在做什么，而不是看一个转圈。
- **行为**：`step.started` → 显示中文步骤（工具名映射表）；`text.delta` → 逐字渲染；`run.error` → 显示可重试错误。
- **约束**：映射表集中在 `client/src/components/jianli/utils/toolLabels.ts`；未知工具回退显示"正在检索信息"；reduced-motion 下不做逐字动画。

### C4 协作可视化

- **用户故事**：复杂问题我希望看到多个视角被认真对待。
- **行为**：仅在 `needsConsultation=true` 触发；时间线展示参与者 + 状态；综合回答以 core 身份呈现，尾部标注参与者。
- **风险控制**：真实综合 = **多一次 LLM 调用**，必须（1）有独立 span/计量（2）失败降级为带显示名的分段（3）不修改各专家原文。禁止静默"润色"。

### C5 内容卡片

- **行为**：工具成功返回作品/博客后，派生卡片（`type/slug/title/description/tags`）；slug **必须**在 `server/content` 索引中校验；最多 3 张；点击深链。
- **约束**：LLM 不生成 slug；无校验通过则整张卡片丢弃。

### C6 访客进度

- **行为**：`localStorage` key `jianli.visitor.v1`：`{visitedRooms, discoveredCharacters, askedQuestions, lastSession}`；纯客户端、无 PII；注入一行进度上下文给 supervisor；推荐优先未访问房间。
- **约束**：清空浏览器数据即重置；不得上送服务端（除非 P3 选择纳入 thread）。

### C9 房间内容化

- **行为**：每个房间可展开一个内容区，列出该房间主题下的真实作品/博客（来源 `content-index`），点击进详情。
- **约束**：内容为空时显示引导而不是空白。

### C1 的成本澄清

原约束「不得触发工具循环 + 延迟 ≤1.2s + 失败静默」与「带 1 个真实内容锚点」存在矛盾 —— 后者必然要调 LLM 或做模板。

**决定：v1 用模板 + 真实数据拼接，零 LLM 调用。**
`roomsConfig.summary` + `highlights` + content-index 中该房间首个作品标题 → 直接拼两句。延迟 ≈0、成本 0、可预测、可离线测试。
若日后要 LLM 版：加开关 `PROACTIVE_GREETING_LLM=false`，每会话上限 7 次，走 quick model。

### C12 房间↔内容映射（C9 的前置）

现在**没有任何数据说明「哪个作品/博客属于哪个房间」**（`works/*.md` 只有 tags/technologies）。C9 因此无法实现，必须先定数据模型。

- **方案 A（推荐）**：`works/*.md` / `blog/*.md` frontmatter 加可选 `rooms: [builder, ai]`，服务端索引时收集。零新表、内容自描述、写文章时顺手标。
- 方案 B：`room_content(roomId, contentType, slug, weight)` 映射表 + admin UI。适合人工编排，放 P4 按需再上。

验收：7 个房间各有 ≥1 条内容；无映射时显示引导文案。

---

## 6. 3D 地图优化：性能预算

| 指标                   | 现状          | 目标                  |
| ---------------------- | ------------- | --------------------- |
| 首屏模型字节           | ≈9.3MB        | **< 1.5MB**           |
| 首屏可交互             | 无测量        | < 3.5s（4G 模拟）     |
| 巡游 FPS（中端笔记本） | 未测量        | ≥ 55                  |
| 同上（中端手机）       | 未测量        | ≥ 30                  |
| shadow map             | 渲染但零投射  | 0 或 真投射           |
| 每帧 DOM 同步          | 7 个 `<Html>` | ≤ 3（或改 `occlude`） |
| 模型总体积             | 9.5MB         | < 5.5MB               |

### 6.1 成本护栏

| 层             | 限制                                                    | 位置                |
| -------------- | ------------------------------------------------------- | ------------------- |
| 每 IP 每分钟   | 复用 `checkRateLimit`，chat 阈值建议 20（现仅上传在用） | `_core/security.ts` |
| 每 thread 每天 | 50 run                                                  | A5 计数             |
| 单 run         | `maxTurns=3` / `maxTokens` / `maxWallClockMs=60s`       | A4                  |
| C1 主动导览    | 每会话每房间 1 次，且模板化（0 LLM）                    | C1                  |
| C4 并行综合    | 仅 `needsConsultation` + 参与者 ≤3 + 综合 1 次          | C4                  |

理由：C1（≤7 次）+ C4（+1~3 次）叠加后，一个爬虫能成倍放大成本；护栏必须在 P1 之前就位。

---

## 7. 风险与缓解

| 风险                     | 缓解                                                            |
| ------------------------ | --------------------------------------------------------------- |
| harness 迁移改变聊天行为 | `/api/chat` 保持 JSON 契约与现有 e2e/单测；新旧路径并存一个版本 |
| 流式引入后 e2e mock 失效 | mock 下移到 harness 层（`shouldUseE2eAgentMock` 在 run 入口）   |
| 真实综合变成"隐藏修复层" | 独立 span + 计量 + 失败降级；审计技能明确反对 silent repair     |
| 内容卡片 slug 幻觉       | 确定性派生 + 索引校验 + 丢弃策略                                |
| 3D 优化破坏观感          | 每个 B 项前后截图对比；B2 单独分支                              |
| Draco 压缩改动加载器     | 先做 B1/B3（零风险高收益），B2 放 P4                            |
| 并行咨询烧 token         | 仅 `needsConsultation` 触发 + 参与者上限 3 + 预算上限           |
| 移动端 = 双份工作量      | P2 集中处理，避免零散改动                                       |

### 7.1 补充风险

| 风险                                                                   | 缓解              |
| ---------------------------------------------------------------------- | ----------------- |
| 工作区未落盘就开工                                                     | 先执行 §9 第 0 步 |
| 无成本护栏                                                             | §6.1              |
| 房间↔内容无数据模型                                                   | C12 方案 A        |
| 文档漂移（`AGENT_ARCHITECTURE.md` 已与代码不一致：写 loops=4，实际 3） | §11               |

> **已实测（2026-09-13）**：测试文件不在 `tsconfig.json` 内，`pnpm check` 不校验它们。开启校验会暴露 **13 个既存错误**（`langsmith.test.ts` 10 个 mock 元组类型、`agent-routes.test.ts` 3 个 mock 未满足 LangGraph state 类型）。修这 13 个 + 加一个 `tsconfig.test.json` 是独立小任务，不要混进功能提交；在那之前，新增测试文件只能靠编辑器 LSP 把关。

---

## 8. 决策点（需确认）

1. **P0 范围**：确认按 §9 的六步执行（A1+A2 + A7 部分 + B1/B3/B4）？这是最小可验证切片。
2. **首屏加载取舍**：接受"进入 /jianli 只加载中央大厅 + 当前角色"吗？（会牺牲一点切换房间时的顺滑度，换 6× 首屏体积下降）
3. **内容卡片跳转**：跳 `/works/:slug`、`/blog/:slug`（现有页面）还是做成房间内浮层不跳走？（影响 C9 形态）
4. **C11 内容运营化**：把 `shared/src/resume/profile.ts` 迁到 markdown 涉及 RAG 与工具读取路径，是否纳入本期？
5. **6 个死工具**：删除还是接回白名单？
6. **harness 开关**：`AGENT_HARNESS_ENABLED` 默认 `true`（`false` 时 `/api/chat` 走旧路径），保留一个版本后删旧路径 —— 同意吗？
7. **房间↔内容映射**：方案 A（frontmatter `rooms:`）还是方案 B（映射表 + admin）？
8. **C1 主动导览**：确认 v1 用模板、零 LLM 调用？
9. **3D 角色数量**：18 → 7（每房间 1 个，与 agent 对齐）？这是省首屏字节、同时让地图与 agent 体系一致的最划算一步，但会明显改变场景视觉密度。

---

## 9. P0 任务级拆解（六步）

| 步  | 内容                                                                               | 文件                                     | 验证                        |
| --- | ---------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------- |
| 0   | Phase 1 落盘（按线拆 commit）                                                      | —                                        | `pnpm check && pnpm test`   |
| 1   | RunEvent 契约 + 序列化单测                                                         | `shared/src/schemas/run.ts`              | 单测                        |
| 2   | harness 骨架：ALS 事件汇 + `runAgent()`（先不流式，包 `orchestratorGraph.invoke`） | `harness/{run,events,errors}.ts`         | 单测：事件顺序、runId 稳定  |
| 3   | `/api/chat` 走 harness（flag 可回退），**前端零改动**                              | `routes/chat.ts`、`harness/run.ts`       | 现有 route 测试 + 手工 chat |
| 4   | 删 6 个死工具 + `@deprecated` 包装器 + `expert/index.ts` 死导出                    | `tools/index.ts`、`expert/index.ts`      | `structure.test.ts` + 全绿  |
| 5   | 3D：B4 → B3 → B1（先改行为最小的）                                                 | `Character.tsx`、`Scene.tsx`、`Room.tsx` | FPS / 字节实测              |
| 6   | 记录性能基线                                                                       | `docs/perf-baseline.md`                  | 数据可复现                  |

每步 1 个 commit，每步跑 `pnpm check && pnpm test`。

---

## 10. 成功度量

技术验收之外的产品指标 —— 没有它，无法判断 P1–P4 是否值得继续。

| 指标                                  | 现状 | P2 目标      | 来源                                                 |
| ------------------------------------- | ---- | ------------ | ---------------------------------------------------- |
| 访客提问率（进入 /jianli 后提问比例） | 无   | ≥ 25%        | 客户端事件（`VITE_ANALYTICS_ENDPOINT` 已存在，可选） |
| 平均会话轮次                          | 无   | ≥ 3          | 同上                                                 |
| 房间探索完成度                        | 无   | 平均 ≥ 4 / 7 | C6 localStorage 匿名聚合                             |
| 内容卡片点击率                        | 无   | ≥ 15%        | C5                                                   |
| 错误率                                | 无   | < 2%         | harness run 记录                                     |
| p95 首字延迟                          | 无   | < 2.5s       | A6 usage                                             |

无后端埋点前先用 LangSmith run 记录 + 客户端事件；不采集 PII。

---

## 11. 文档同步与边界维护

- `AGENT_ARCHITECTURE.md`：依赖链加入 harness；修正「max tool loops: 4」→ 3；补 `MAX_CONSULT_DEPTH` 与 canConsult 代码强制
- `CLAUDE.md`：新增约定「新功能通过 harness 调用 agent，不得直接 import `orchestratorGraph`」
- `server/agents/structure.test.ts`：加断言「harness 之外的文件不得 import `orchestratorGraph` / `supervisorGraph`」
- 本文件：每期完成后更新 §0 现状表

---

## 12. 验证策略（每期门槛）

| 检查   | 命令                              | 门槛                             |
| ------ | --------------------------------- | -------------------------------- |
| 类型   | `pnpm check`                      | 0 错误                           |
| 单测   | `pnpm test`                       | 现有 289 + 新增全绿              |
| E2E    | `pnpm test:e2e`                   | 现有 spec 全绿（含 mock 下移后） |
| 结构   | `server/agents/structure.test.ts` | 边界断言保持                     |
| 性能   | DevTools Network + FPS 采样       | 满足 §6 预算                     |
| 可用性 | 手测脚本（新用户 5 分钟）         | 能独立完成"逛 → 问 → 跳内容"     |
