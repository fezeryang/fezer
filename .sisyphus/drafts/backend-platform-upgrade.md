# Draft: 后端完善与内容发布能力

## Requirements (confirmed)
- 用户希望完善个人网站后端，提升可用性与长期可维护性。
- 用户明确提到需要支持：上传作品、发布文字内容、并保障前端稳定渲染。
- 用户希望补充其未想到的关键能力（不仅限于上传与渲染）。

## Technical Decisions
- 当前处于访谈与规划阶段，暂不进入实现。
- 先进行架构与测试基线调研，再收敛功能边界与优先级。

## Research Findings
- 现有工程是 React + Vite 前端，Express/tRPC 后端，Drizzle 数据层，Vitest 测试框架。
- 后端路由入口：`server/routers.ts`；系统路由：`server/_core/systemRouter.ts`。
- 数据相关核心：`server/db.ts` 与 `drizzle/schema.ts`。
- 测试文件较少，当前可见 `server/auth.logout.test.ts`。

## Open Questions
- 内容模型如何定义：作品、文章、标签、封面、状态（草稿/发布）等字段范围。
- 上传链路目标：直传对象存储还是经后端中转。
- 前端渲染策略：SSR/SSG/CSR、是否需要预览与增量更新。
- 权限策略：仅站长后台，还是后续支持多角色。
- 审核与风控：文件类型、大小、频率限制、恶意内容检测需求。
- 备份恢复与版本管理要求。

## Scope Boundaries
- INCLUDE: 后端能力规划、内容发布链路、前端可渲染保障策略、扩展能力建议。
- EXCLUDE: 具体代码实现与部署变更（当前阶段仅输出可执行工作计划）。
