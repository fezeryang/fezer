# Environment Variables Contract

This document defines the required environment variables for the kinetic-portfolio application across different environments.

## Variable Classification

### Critical Server-Only Variables (REQUIRED)

These variables **MUST** be set for the server to start. Missing any of these will cause immediate startup failure with an explicit error message.

| Variable | Description | Example | Required In |
|----------|-------------|---------|-------------|
| `DATABASE_URL` | MySQL connection string | `mysql://user:pass@host:3306/db` | All environments |
| `JWT_SECRET` | Secret for JWT token signing | Random 32+ character string | All environments |
| `OAUTH_SERVER_URL` | OAuth provider base URL | `https://oauth.example.com` | All environments |
| `OWNER_OPEN_ID` | OpenID of the owner/admin user | `user_abc123` | All environments |

### Optional Server-Only Variables

These variables have defaults or are optional for certain features.

| Variable | Description | Default | Required In |
|----------|-------------|---------|-------------|
| `PORT` | Server listen port | `3000` | Optional |
| `NODE_ENV` | Runtime environment | `development` | Optional |
| `BUILT_IN_FORGE_API_URL` | Built-in Forge API endpoint | Empty string | Optional |
| `BUILT_IN_FORGE_API_KEY` | Built-in Forge API key | Empty string | Optional |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | Empty (dev: localhost auto-allowed) | Production |
| `LOCAL_ADMIN_AUTH_BYPASS` | Enables local admin auth bypass by injecting a local admin user | `false` | Local development only |
| `LOCAL_CONTENT_IN_MEMORY_FALLBACK` | Enables in-memory posts/works fallback when DB is unavailable | `false` | Local development only |

### Frontend-Safe Variables (EXPOSED TO CLIENT)

These variables are prefixed with `VITE_` and are embedded into the client bundle at build time. **NEVER** put secrets here.

| Variable | Description | Example | Required In |
|----------|-------------|---------|-------------|
| `VITE_APP_ID` | OAuth application ID | `app_xyz789` | All environments |
| `VITE_OAUTH_PORTAL_URL` | OAuth portal URL for login | `https://oauth.example.com` | Frontend |
| `VITE_FRONTEND_FORGE_API_KEY` | Public Forge API key for maps | `pk_live_...` | Optional (Map feature) |
| `VITE_FRONTEND_FORGE_API_URL` | Forge API URL for frontend | `https://forge.example.com` | Optional (Map feature) |
| `VITE_ANALYTICS_ENDPOINT` | Analytics endpoint | `https://analytics.example.com` | Optional |
| `VITE_ANALYTICS_WEBSITE_ID` | Analytics website ID | `site_123` | Optional |

## Environment Setup

### Local Development

Create a `.env` file in the project root:

```bash
# Critical server secrets
DATABASE_URL=mysql://root:password@localhost:3306/kinetic_portfolio
JWT_SECRET=your-local-jwt-secret-min-32-chars
OAUTH_SERVER_URL=https://your-oauth-server.com
OWNER_OPEN_ID=your-openid-here

# Frontend config
VITE_APP_ID=your-app-id
VITE_OAUTH_PORTAL_URL=https://your-oauth-server.com

# Optional
PORT=3000
NODE_ENV=development
LOCAL_ADMIN_AUTH_BYPASS=false
LOCAL_CONTENT_IN_MEMORY_FALLBACK=false
```

### Local Fallback Safety Boundary

- Both fallback flags are hard-disabled in production (`NODE_ENV=production`), even if set to `true`.
- `LOCAL_ADMIN_AUTH_BYPASS=true` allows `/admin` APIs to run locally without OAuth/session setup.
- `LOCAL_CONTENT_IN_MEMORY_FALLBACK=true` allows posts/works CRUD + publish flows to run from process memory when MySQL is unavailable.
- When flags are `false`, existing OAuth and MySQL behavior remains unchanged.

### GitHub Pages (Frontend Only)

Configure as **repository secrets** or **environment variables** in GitHub Actions:

```bash
# Frontend variables only (VITE_* prefix)
VITE_APP_ID=prod-app-id
VITE_OAUTH_PORTAL_URL=https://oauth.production.com
VITE_FRONTEND_FORGE_API_KEY=pk_live_...
VITE_ANALYTICS_ENDPOINT=https://analytics.production.com
VITE_ANALYTICS_WEBSITE_ID=prod-site-id
```

**WARNING**: GitHub Pages is static hosting. Server-only variables (`DATABASE_URL`, `JWT_SECRET`, etc.) are **NOT** used here.

### Aliyun Backend (API Server)

Set these as environment variables on your Aliyun server (via PM2 ecosystem file, shell profile, or systemd service):

```bash
# Critical secrets
DATABASE_URL=mysql://user:secure-pass@rds.aliyun.com:3306/prod_db
JWT_SECRET=production-secret-min-32-chars-random
OAUTH_SERVER_URL=https://oauth.production.com
OWNER_OPEN_ID=prod-owner-openid

# Frontend config (used by server for validation)
VITE_APP_ID=prod-app-id

# Optional backend config
PORT=3000
NODE_ENV=production
BUILT_IN_FORGE_API_URL=https://forge-backend.example.com
BUILT_IN_FORGE_API_KEY=secret-backend-key
```

## Security Guidelines

### DO ✅

- Store production secrets in secure secret management systems (e.g., Aliyun Secrets Manager, GitHub Secrets)
- Use different values for `JWT_SECRET` and `DATABASE_URL` across environments
- Rotate `JWT_SECRET` periodically
- Use strong, randomly generated secrets (32+ characters)
- Keep `.env` files out of version control (already in `.gitignore`)

### DO NOT ❌

- **NEVER** put secrets in `VITE_*` variables (they are embedded in the client bundle)
- **NEVER** commit `.env` files to git
- **NEVER** use production secrets in local development
- **NEVER** share `JWT_SECRET` or `DATABASE_URL` values
- **NEVER** log or expose secret values in error messages

## Validation Behavior

### Two-Phase Safety Model

The application uses a **two-phase approach** to balance safety and testability:

**Phase 1: Module Import (Always Safe)**
- `server/_core/env.ts` can be imported without any environment variables
- `ENV` object exports with safe defaults (empty strings for missing vars)
- Tests can import server modules without production secrets
- NO process.exit() on import - allows test runner to load modules

**Phase 2: Server Startup (Strict Validation)**
- `assertEnvValid()` is called ONLY by `startServer()` in `server/_core/index.ts`
- Validates all critical variables are present and correctly formatted
- Exits process immediately if validation fails (fail-fast for production)
- Only runs when you execute `bun run dev` or `bun run start`

### Validation Rules

| Condition | Behavior | When It Happens |
|-----------|----------|-----------------|
| Missing critical variable (DATABASE_URL, JWT_SECRET, etc.) | Server exits immediately with error | During `bun run dev` or `bun run start` |
| Invalid format (e.g., JWT_SECRET < 32 chars) | Server exits with validation error | During `bun run dev` or `bun run start` |
| Optional variable missing | Server starts; feature may fail at usage time | During `bun run dev` or `bun run start` |
| Missing `DATABASE_URL` with `LOCAL_CONTENT_IN_MEMORY_FALLBACK=true` and non-production | Server starts; posts/works use in-memory fallback if DB calls fail | During `bun run dev` or `bun run start` |
| Missing `OAUTH_SERVER_URL` / `OWNER_OPEN_ID` with `LOCAL_ADMIN_AUTH_BYPASS=true` and non-production | Server starts; local admin auth bypass can be used | During `bun run dev` or `bun run start` |
| Test runtime (`bun run test`) | No validation; tests can import freely | During `bun run test` |

### Example Error Output

When running `bun run dev` without required variables:

```
═══════════════════════════════════════════════════════════
  [FATAL] Environment Configuration Error
═══════════════════════════════════════════════════════════

  Missing required environment variables:
    ✗ DATABASE_URL
    ✗ JWT_SECRET
    ✗ OWNER_OPEN_ID

  Server cannot start without proper configuration.
  Please see ENV_CONTRACT.md for setup instructions.

═══════════════════════════════════════════════════════════
```

## Migration Notes

When importing backend modules from `kinetic-portfolio-wt-backend-content-publishing-foundation`, the environment contract remains the same. Both repositories use identical variable names for consistency.
