# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript full-stack portfolio application with an AI agent system. The architecture consists of:

- **Frontend**: React 19 + Vite + TailwindCSS + React Three Fiber (3D graphics)
- **Backend**: Express + tRPC API + Drizzle ORM (MySQL)
- **AI System**: LangChain/LangGraph multi-agent orchestration
- **Package Manager**: pnpm (required). Note: `wouter` runs against a local patch — `patchedDependencies` in package.json applies `patches/wouter@3.7.1.patch`

## Essential Commands

### Development

```bash
# Start both client and server (recommended)
pnpm dev

# Start individually
pnpm dev:client    # Vite dev server on port 5173
pnpm dev:server    # Express API server on port 3000

# Type checking (no build)
pnpm check

# Format code
pnpm format
```

### Testing

```bash
# Unit tests (Vitest)
pnpm test
pnpm test server/posts.admin.test.ts    # Single test file / substring filter

# E2E tests (Playwright)
pnpm test:e2e
pnpm test:e2e:headed    # With browser UI
pnpm test:e2e e2e/blog-sidebar.spec.ts  # Single spec
pnpm test:e2e -g "blog"                # By test-name pattern

# First-time E2E setup
pnpm playwright:install
```

### Database

```bash
# Generate and run migrations
pnpm db:push
```

### Build & Deploy

```bash
# Build for production
pnpm build    # Outputs to dist/

# Run production build
pnpm start
```

## Architecture

### Directory Structure

```
kinetic-portfolio/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Route pages (Blog*, admin/)
│   │   ├── content/     # Markdown content (blog/, works/, profile/) + loaders/
│   │   ├── lib/         # Client utilities
│   │   └── hooks/       # React hooks
│   └── public/          # Static assets
├── server/              # Express backend
│   ├── _core/           # Core infrastructure (env, auth, llm, trpc)
│   ├── routes/          # Express route handlers (/api/chat, /api/guide, /api/character)
│   ├── agents/          # AI agent system
│   │   ├── orchestrator/   # Top-level orchestration
│   │   ├── supervisor/     # Task supervision
│   │   ├── expert/         # Domain experts
│   │   ├── tools/          # Agent tools
│   │   ├── rag/            # RAG utilities
│   │   └── spatial/        # Agent resolution
│   ├── content/         # Content management (admin CRUD, hot-reload, in-memory fallback)
│   └── db.ts            # Database layer
├── shared/              # Shared types/utilities
├── e2e/                 # Playwright specs
├── drizzle/             # Database schema/migrations
└── blog-markdown.ts     # Vite plugin: renders blog markdown at dev/build time
```

### Path Aliases (tsconfig.json)

```typescript
import { Component } from '@/components/...'   // client/src/
import { type } from '@shared/...'             // shared/
import { util } from '@fezer/shared/...'       // shared/src/
```

### Agent System Flow

**Critical**: The AI agent system follows a strict dependency chain (see AGENT_ARCHITECTURE.md):

```text
routes → harness → orchestrator → supervisor → expert → _core
```

**Single source of truth**:
- Run entry point: `server/agents/harness/run.ts` (`runAgent`)
- Run event protocol: `shared/src/schemas/run.ts`
- Agent resolution: `server/agents/spatial/agent-resolution.ts`
- Agent display names: `shared/src/characters/display-names.ts`
- Tool registration: `server/agents/tools/index.ts`
- LLM client: `server/_core/llm.ts`

**Do NOT**:
- Import from `server/agents/legacy/` (read-only reference)
- Import `orchestratorGraph` outside `server/agents/harness/` — new routes and
  features call `runAgent()` instead (enforced by `server/agents/structure.test.ts`)
- Duplicate agent/room mapping logic
- Create circular dependencies

### Adding New Features

**New Agent**:
1. Add agent ID in `server/agents/tools/agent.tool.ts` (`AgentId` type)
2. Configure in `server/agents/expert/agent-factory.ts` (`AGENT_TOOL_CONFIGS`)
3. Add resolution rules in `server/agents/spatial/agent-resolution.ts`
4. Add tests

**New Tool**:
1. Implement under `server/agents/tools/` or `server/agents/rag/`
2. Register in `server/agents/tools/index.ts`
3. Add to agent whitelist in `AGENT_TOOL_CONFIGS` (a tool absent from every
   whitelist is unreachable by the model)
4. Add tests

**New Route**:
1. Add handler in `server/routes/`
2. Set trace context fields (route, interactionType)
3. Reuse orchestrator/supervisor flow
4. Add tests

## Environment Setup

**Critical**: See `ENV_CONTRACT.md` for complete documentation.

### Required Variables

Create `.env` in project root with these **required** variables:

```bash
# Database
DATABASE_URL=mysql://user:pass@localhost:3306/kinetic_portfolio

# Authentication
JWT_SECRET=your-secret-min-32-chars
OAUTH_SERVER_URL=https://your-oauth-server.com
OWNER_OPEN_ID=your-openid

# OAuth App Config
VITE_APP_ID=your-app-id
VITE_OAUTH_PORTAL_URL=https://your-oauth-server.com

# LLM Configuration
AI_PRIMARY_PROVIDER=deepseek
AI_PRIMARY_MODEL=deepseek-chat
DEEPSEEK_API_KEY=your-api-key
```

### Optional Development Flags

```bash
# Local development shortcuts (auto-disabled in production)
LOCAL_ADMIN_AUTH_BYPASS=false        # Bypass OAuth for /admin APIs
LOCAL_CONTENT_IN_MEMORY_FALLBACK=false  # In-memory DB fallback

# LangSmith Tracing
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_...
LANGSMITH_PROJECT=fezer-agent
```

**Security**: Never put secrets in `VITE_*` variables (they are embedded in client bundle).

### Environment Validation

The app uses **two-phase validation**:
1. **Import time**: Safe defaults, no validation (allows tests to run)
2. **Server startup**: Strict validation via `assertEnvValid()` in `server/_core/index.ts`

Missing required variables = immediate startup failure with clear error message.

## Frontend Architecture

### Component Patterns

- **UI Components**: Radix UI primitives in `client/src/components/ui/`
- **3D Graphics**: React Three Fiber components (avoid `data-loc` attributes in `/jianli/` components — they are injected build-time by `@builder.io/vite-plugin-jsx-loc`, see vite.config.ts)
- **State Management**: TanStack Query for server state, React Context for client state
- **Routing**: wouter (lightweight React router)
- **Styling**: TailwindCSS with custom design tokens

### API Communication

- **tRPC Client**: Type-safe API calls from frontend to backend
- **Query Hooks**: Use TanStack Query hooks for data fetching
- **Real-time**: Server streams responses for agent interactions

## Backend Architecture

### API Layer

- **tRPC Router**: Type-safe API routes in `server/routers.ts`
- **Express Routes**: Traditional REST endpoints in `server/routes/`
- **Middleware**: Authentication in `server/_core/auth.ts`

### Database

- **ORM**: Drizzle ORM with MySQL
- **Schema**: `drizzle/schema.ts`
- **Migrations**: `pnpm db:push` to sync schema

### LLM Integration

- **Multi-provider**: Supports DeepSeek, Forge, with fallback
- **Client**: Unified LLM client in `server/_core/llm.ts`
- **Tracing**: LangSmith integration (opt-in via `LANGSMITH_TRACING=true`)
- **Agent Framework**: LangGraph for multi-agent orchestration

## Content & Blog System

Site content is markdown + YAML frontmatter in `client/src/content/`:

- `blog/*.md` — posts, named `YYYY-MM-DD-title-slug.md`. Required frontmatter: `title`, `date` (ISO). Optional: `excerpt`/`summary` (pick one), `tags`, `category`, `slug` (auto-derived from filename)
- `works/*.md` — portfolio projects. Required: `title`, `description`
- `profile/*.{locale}.md` — per-locale profile (`fezer.zh-CN.md`, …)
- Full schema reference: `client/src/content/README.md`

**Render pipeline (build-time, not client)**: the custom Vite plugin `blog-markdown.ts` (repo root) turns `../blog/*.md?rendered` imports into ready `{ html, sections }` modules — shiki, marked, and sanitize-html run inside the plugin, so they never enter the browser bundle, and rendering is deterministic to keep HMR stable. `client/src/content/loaders/` (`posts.ts`, `renderedPosts.ts`, `works.ts`, `profile.ts`, `parser.ts`) parse frontmatter and expose typed content. `sections` drives the blog post TOC sidebar.

**Admin/CRUD side**: `server/content/` (per-type modules + `hot-reload.ts`) backs the tRPC `postsRouter`/`worksRouter`/`assetsRouter` composed in `server/routers.ts`; DB-backed, with `LOCAL_CONTENT_IN_MEMORY_FALLBACK=true` for DB-less dev. Blog UI lives in `client/src/pages/Blog*.tsx` and `client/src/pages/blog/BlogExperience.tsx`. When writing or restructuring posts, use the project's `blog-post` skill — it encodes the naming/frontmatter/heading rules and verification steps.

## Development Patterns

### Immutability

**Always** create new objects, **never** mutate:

```typescript
// WRONG
function updateUser(user: User, name: string) {
  user.name = name  // MUTATION!
  return user
}

// CORRECT
function updateUser(user: User, name: string) {
  return { ...user, name }
}
```

### Error Handling

```typescript
async function loadData() {
  try {
    return await riskyOperation()
  } catch (error: unknown) {
    logger.error('Operation failed', error)
    throw new Error(getErrorMessage(error))
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Unexpected error'
}
```

### Input Validation

Use Zod schemas:

```typescript
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0)
})

type Input = z.infer<typeof schema>
const validated = schema.parse(input)
```

## Testing Requirements

- **Unit Tests**: Vitest (`vitest.config.ts`). Included paths: `server/**/*.test.ts` (co-located) plus `client/src/content/loaders/__tests__/`, `client/src/hooks/__tests__/`, `client/src/components/__tests__/`. Note: `tsconfig.json` excludes `**/*.test.ts`, so `pnpm check` does NOT type-check test files — type errors there surface only in the editor or when vitest runs
- **E2E Tests**: Playwright, chromium only, specs in `e2e/`
- **E2E is self-contained**: Playwright boots its own Vite (`127.0.0.1:4301`) and API server (`127.0.0.1:4300`) with `E2E_MOCK_AGENT_API=true`, `LOCAL_ADMIN_AUTH_BYPASS=true`, `LOCAL_CONTENT_IN_MEMORY_FALLBACK=true` — no MySQL, OAuth server, or LLM keys needed

## Common Issues

### Build Failures

- Check TypeScript errors: `pnpm check`
- Verify all imports use correct path aliases
- Ensure environment variables are set

### Agent System Issues

- Verify agent resolution in `server/agents/spatial/agent-resolution.ts`
- Check tool registration in `server/agents/tools/index.ts`
- Review LangSmith traces if `LANGSMITH_TRACING=true`

### Database Connection

- Verify `DATABASE_URL` in `.env`
- Run migrations: `pnpm db:push`
- For local dev, use `LOCAL_CONTENT_IN_MEMORY_FALLBACK=true` to bypass DB

### Authentication Issues

- For local dev: `LOCAL_ADMIN_AUTH_BYPASS=true` skips OAuth
- Verify `JWT_SECRET` length (min 32 chars)
- Check OAuth URLs match between client (`VITE_OAUTH_PORTAL_URL`) and server (`OAUTH_SERVER_URL`)

### WSL Workspace

This repo is opened from Linux/WSL at `/home/fezer/projects/selfweb/kinetic-portfolio`. Always use Linux absolute paths. Never prefix an already-absolute path with the workspace root — that produces invalid mixed paths like `/home/.../C:\home\...` (one such junk file currently sits untracked in the repo root: a file literally named `C:\home\fezer\projects\selfweb\kinetic-portfolio\.cursor\rules\agent-tooling.mdc`). Cursor-side agent guidance belongs in `.cursor/rules/`.

## Deployment

- **Frontend**: GitHub Pages or static hosting (outputs to `dist/public`)
- **Backend**: Node.js server (outputs to `dist/`)
- **Database**: MySQL 8+
- **Environment**: Set all required variables per `ENV_CONTRACT.md`

See `DEPLOYMENT.md`, `DEPLOYMENT_CHECKLIST.md`, `AZURE_VM_DEPLOYMENT.md`, `HTTPS_DEPLOYMENT_PLAN.md`, `BACKEND_CONFIG.md`, `FRONTEND_API_CONFIG.md`, and `LANGSMITH_OPERATIONS.md` for tracing operations. Production host runs Nginx + PM2 + SSL via `ops/` (`deploy.sh`, `rollback.sh`, `health-check.sh`, `ecosystem.config.cjs`, `nginx-api.conf`; `ops/VM.md` documents the live production VM — start there).
