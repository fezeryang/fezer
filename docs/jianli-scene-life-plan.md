# 3D 简历场景活化：角色气泡 + 协同可视化 + Minimap 优化

> 上游：`docs/agent-layer-changes.md`（P0–P4 已完成）、`docs/harness-and-jianli-roadmap.md`
> 状态：✅ 已完成（2026-09-14，验证结果见 §6）
> 原则：全部为客户端改动，复用既有 RunEvent 协议与既有数据源，零新增依赖、零新增 LLM 调用。

---

## 1. 研究结论（现状）

| 关注点           | 现状                                                                                                                                                                        | 缺口                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 角色气泡         | 18 个无名 kitty 在 7 个房间游走（`Character.tsx`），点击只弹聊天窗                                                                                                          | 角色从不"说话"，与 agent 系统无视觉关联                            |
| 招呼（C1）       | 房间招呼显示在**左下角固定卡片**（`Jianli.tsx`），与 3D 场景脱节                                                                                                            | 不是"角色在说话"，是 UI 面板在说话                                 |
| 协作可视化（C4） | 协作时间线只在 `ChatModal` 内部（头像 + 状态点）                                                                                                                            | 3D 场景本身毫无反应：多专家协作时地图是静止的                      |
| Minimap（B7）    | 只有 7 根竖线（当前/已访问/未访问三态）                                                                                                                                     | 无空间结构（走廊邻接线）、无"你在这里"、无探索进度、无协作态       |
| 事件协议         | `RunEvent`（`shared/src/schemas/run.ts`）已有 `agent.start/agent.done/text.delta/tool.*`，ChatModal 已消费                                                                  | 事件止步于聊天弹窗，没有第二消费方（协议设计初衷之一就是多消费方） |
| 既有可复用       | `resolveFezerTypeByCharacterId`（fezer-01..18 → agent）、`ROOM_AGENT_IDS`（房间↔agent）、`ROOM_ADJACENCY`（走廊邻接）、`transitions.css` 已装 motion tokens + tooltip 配方 | —                                                                  |

## 2. 方案（D1–D5）

### D1 角色气泡系统（新）

- `client/src/lib/scene-bubbles.ts`（纯逻辑，可测）：
  - `SceneBubble = { kind: "greeting" | "thinking" | "speaking" | "done" | "chatter"; speaker?; text }`
  - `roomOfAgent` / `roomOfCharacter` / `leadCharacterIdOfRoom`（每房间第一个角色，气泡挂它头上）/ `charactersInRoom`
  - `clipStreamText`（气泡内流式文本截断 ~64 字符）
  - `mergeSceneBubbles`（纯函数：agent 活动气泡 > 房间招呼 > 环境闲聊，逐角色合并去冲突）
- `SpeechBubble.tsx`：drei `Html` 内的展示组件；入场动画用 `transitions.css` 新增 `.t-bubble`（挂载即动画、退出即卸载、reduced-motion 守卫）
- `Character.tsx`：外层移动 group + 内层缩放 group 重构（气泡挂世界坐标高度，不随 0.3 缩放）；`bubble?` 缺省时**不渲染 Html**（零每帧 DOM 成本）
- 预算：同屏气泡 ≤ 3~4（当前房间 1 + 协作房间各 1），短生命周期，符合 roadmap「每帧 DOM 同步 ≤ 3」精神

### D2 招呼迁移（改造既有 C1）

- 删掉左下角固定卡片：招呼文本 + 「聊聊这个房间 / 不再自动出现」按钮直接进当前房间首席角色的气泡
- 纯客户端、零 LLM，模板拼接逻辑（`room-greeting.ts`）不动

### D3 Agent 活动 → 场景气泡（协同可视化）

- `ChatModal` 新增 `onAgentActivity` 回调，把已有 RunEvent 转发（复用，不改协议）：
  `agent.start`（含 displayName）→ thinking 气泡（三点跳动）；`agent.done` → ✓ 已回应；
  `text.delta` → speaking 气泡（截断文本 + 光标，真实流）；run 结束（成功/失败/取消）→ `run-settled` 清场（延迟 1.6s）
- Jianli 按 `roomOfAgent(agentId)` 把气泡挂到**对应房间**的首席角色：跨房间咨询时，多个房间的角色同时亮气泡 —— 这就是 3D 场景里的"协同办公"
- 流式失败降级路径（非流式）不产生假事件，保持诚实

### D4 环境闲聊（新，零后端）

- `roomsConfig.ts` 每房间新增 `chatter: [A台词, B台词][]`（2 组对话/房间，人设贴合房间主题）
- `useAmbientChatter(roomId, suppressed)`：进入房间 4–8s 后，随机挑房间内两个角色轮流"对话"（A 3.6s → 空 1.6s → B 3.4s → 间隔 9–14s 再来）
- 抑制条件：该房间有招呼/agent 活动气泡、`document.hidden`；房间切换即清场重排

### D5 Minimap 优化（改造既有 B7）

- **邻接走廊线**：用 `ROOM_ADJACENCY` 去重画虚线（空间结构一眼可读，`adjacencySegments` 纯函数可测）
- **你在这里**：当前房间竖线外扩一圈指示环 + 房间名小字
- **探索进度**：标题下 `N/7 已探索`
- **协作态**：`collaboratingRoomIds`（来自 D3 的活动气泡房间）→ 当前房间到各协作房间画主题色连线 + 脉冲点；协作房间竖线点亮

## 3. 文件清单

| 动作 | 文件                                                                                                                                                                        |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 新增 | `client/src/lib/scene-bubbles.ts`、`client/src/components/jianli/SpeechBubble.tsx`、`client/src/hooks/useAmbientChatter.ts`                                                 |
| 修改 | `client/src/components/jianli/{Character,Scene,ChatModal,Minimap}.tsx`、`assets/{types,roomsConfig}.ts`、`client/src/pages/Jianli.tsx`、`client/src/styles/transitions.css` |
| 测试 | `client/src/lib/scene-bubbles.test.ts`、`client/src/hooks/__tests__/use-ambient-chatter.test.ts`                                                                            |

## 4. 验证口径

- `pnpm check` + `pnpm check:tests` 0 错误
- `pnpm test` 全绿（新增：气泡归属/优先级/截断、邻接线段、闲聊调度与抑制）
- `lens_diagnostics` 对改动文件无阻塞项
- 动画遵循 `prefers-reduced-motion`；气泡 zIndex 压在聊天弹窗（z-50）之下（`zIndexRange={[20,0]}`，沿用房间标签的既有结论）

## 5. 明确不做（YAGNI）

- 不做 3D 场景内角色间连线/路径动画（Minimap 上的协作风线已覆盖"协同"表达，成本 1/20）
- 不给 18 个角色全部挂常驻名牌（房间标签已表达空间归属；气泡自带 speaker）
- 不加新后端接口、不加 LLM 调用、不动 harness
- 移动端 Minimap 维持隐藏（既有决策）

## 7. 二期：会议可视化（D6）+ 给角色投喂（D7）

> 状态：✅ 已完成（同日验证）｜纯客户端，零新增依赖

### D6 会议可视化

- 多专家咨询发生时（`agentBubbles` 中出现非聊天房间的房间），被咨询房间的**首席角色**以会议速度（2.2 u/s，漫游速度的 4-7 倍）走到聊天房间，站到中心圆周（半径 2.0，角度由 roomId 哈希稳定分配）上面向中心“开会”；气泡（thinking/speaking）与 Minimap 协作连线随角色移动自动生效
- run 结束后随 `agentBubbles` 清场（同 1.6s 停留），角色走回原房间恢复漫游
- 目标全部由现有状态**派生**（agentBubbles × chatContext.roomId），不新增生命周期

### D7 给角色投喂

- 悬停角色（桌面端）头顶出现投喂条：☕ 咖啡 / 🐟 鱼干 / 📖 书；点击不触发聊天（Html 门户不透传 3D 点击）
- 投喂效果（会话内存，3 分钟过期，可覆盖）：
  - 立刻：该角色冒反应气泡（每物品 3 条随机台词）
  - 咖啡：房间闲聊频率翻倍；鱼干/书：闲聊有 50% 抽到情绪台词池
- 优先级：agent 活动 > 投喂反应 > 招呼 > 闲聊（mergeSceneBubbles 扩展 reaction 输入）

### 验证

`pnpm check` / `check:tests` 0 错误；全部单测绿（新增：会议点位确定性/范围/不含聊天房间、投喂优先级、情绪台词池合法性、咖啡间隔减半）；推送后 GitHub Pages 自动部署。

## 6. 一期验证结果（2026-09-14）

| 检查               | 结果                                                              |
| ------------------ | ----------------------------------------------------------------- |
| `pnpm check`       | ✅ 0 错误                                                         |
| `pnpm check:tests` | ✅ 0 错误                                                         |
| `pnpm test`        | ✅ **46 文件 / 418 测试全绿**（基线 44/397，新增 2 文件 21 测试） |
| lens / LSP         | ✅ 改动文件无阻塞项                                               |

新增测试：

- `client/src/lib/scene-bubbles.test.ts`（16 条）：归属链（agent↔房间↔角色）、合并优先级（agent > 招呼 > 闲聊）、流式截断、对话池抽样、邻接线段去重与端点校验
- `client/src/hooks/__tests__/use-ambient-chatter.test.ts`（5 条）：A→空→B 生命周期采样、抑制与恢复、页面不可见不冒泡、换房清场。注：闲聊首延迟随机（4–8s），测试用步进采样而非绝对时刻断言（绝对边界在延迟落在 [4,4.4)s 窗口时必飘）

过程中修掉的自入缺陷：

| 缺陷                                                                         | 修复                              |
| ---------------------------------------------------------------------------- | --------------------------------- |
| `greetingActions` useMemo 依赖 `[]` 冻结闭包，非首房间的「聊聊」会路由错房间 | 依赖改 `[activeRoomId]`           |
| Minimap 活动房间名固定右锚，Wanderer Base 溢出 SVG 边界                      | 右侧房间左锚（`textAnchor` 切换） |
| `@shared/*` 别名指向 `shared/` 而非 `shared/src/`                            | 改用 `@fezer/shared/map/rooms`    |

体验链路（手工可复核）：进房 1.5s → 首席角色头顶招呼气泡（含操作按钮）；提问 → 对应房间角色 thinking 三点 → text.delta 流式气泡（64 字截断+光标）；多专家咨询 → 多个房间同时亮气泡 + Minimap 协作连线；空闲 4–8s → 房间内两角色轮流闲聊；run 结束 1.6s 后气泡全部清场。
