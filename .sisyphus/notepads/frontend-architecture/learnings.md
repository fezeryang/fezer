# Frontend Architecture Pattern Catalog

## Project Context
**Repository**: kinetic-portfolio  
**Tech Stack**: React 19 + Vite + TypeScript + tRPC + TanStack Query + Tailwind CSS v4 + Radix UI + shadcn/ui patterns + Drizzle ORM + Express

---

## 1. App/Router Structure

### Pattern: Centralized Route Registry with wouter
**Canonical Pattern**: File-based routing (like Next.js) or explicit route registry

**This Repo**: Explicit registry in `App.tsx` using wouter's `<Route>` components

```typescript
// client/src/App.tsx
function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/portfolio"} component={Portfolio} />
      <Route path={"/lab"} component={Lab} />
      <Route path={"/blog"} component={Blog} />
      <Route path={"/about"} component={About} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}
```

**Signals in Code**:
- ✅ `wouter` package in dependencies (`package.json`: line 78)
- ✅ Route definitions in `App.tsx` with explicit `path` props
- ✅ Page components in `client/src/pages/` directory
- ✅ No nested routing in current setup

**Pros**:
- Simple, explicit routing
- No build-time code generation
- Full TypeScript support
- Lightweight (~3KB)

**Cons**:
- Manual route management (no auto-discovery)
- No built-in route guards
- Less scalable than file-based routing for large apps

**Recommended Searches**:
```bash
# Find route definitions
grep -r "Route path=" client/src/

# Find page imports
ls client/src/pages/
```

---

## 2. Component Organization

### Pattern: shadcn/ui + Feature Components Separation
**Canonical Pattern**: Three-layer component organization

| Layer | Location | Purpose |
|-------|----------|---------|
| UI Primitives | `components/ui/` | Raw Radix/Tailwind components |
| Feature Components | `components/` | Business-specific compositions |
| Pages | `pages/` | Page-level layouts |

**This Repo**: Matches pattern

```
client/src/
├── components/
│   ├── ui/                    # ~50+ shadcn/ui primitives
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── Navigation.tsx         # Feature component
│   ├── DashboardLayout.tsx    # Layout component
│   ├── CustomCursor.tsx       # Portfolio-specific
│   ├── AIChatBox.tsx
│   └── ErrorBoundary.tsx
├── pages/
│   ├── Home.tsx
│   ├── Portfolio.tsx
│   └── ...
```

**Signals in Code**:
- ✅ `components.json` exists (shadcn config)
- ✅ Heavy use of Radix UI primitives (package.json lines 19-44)
- ✅ 50+ UI components in `components/ui/`
- ✅ Feature components co-located with pages
- ✅ CVA (class-variance-authority) in dependencies (package.json line 50)

**Pros**:
- Clear separation of concerns
- shadcn/ui = full ownership of source code
- Easy to customize per-product needs
- Tree-shaking by default (only used components bundled)

**Cons**:
- Manual updates (no npm update for components)
- Need to track upstream changes manually

**Anti-Pattern Indicators**:
- ❌ Direct imports from `node_modules` for UI (should be in `components/ui/`)
- ❌ Hardcoded Tailwind values instead of design tokens
- ❌ Mixed concerns in single component files

**Recommended Searches**:
```bash
# Find all UI components
ls client/src/components/ui/ | wc -l

# Find feature components (non-ui)
ls client/src/components/*.tsx

# Check for CVA usage
grep -r "cva(" client/src/components/
```

---

## 3. Styling Systems & Design Tokens

### Pattern: Tailwind CSS v4 with CSS-First Theme + Custom Design Tokens

**This Repo**: Advanced implementation with custom tokens

```css
/* client/src/index.css */
@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --color-background: var(--background);
  --color-primary: var(--primary);
  /* ... */
}

:root {
  /* Sand/Paper Tone Palette - Custom Brand */
  --sand-base: #e9e5d9;
  --accent-lava: #ff4d00;
  --blueprint-blue: #0047FF;
  
  /* Semantic tokens */
  --background: #e9e5d9;
  --foreground: #2a2a2a;
  --primary: var(--accent-lava);
}

.dark {
  --background: #020812;
  --foreground: #e0e6ed;
  --accent: #00d1ff;
}
```

**Signals in Code**:
- ✅ `@import "tailwindcss"` (v4 syntax)
- ✅ `@theme inline` directive (v4)
- ✅ Custom color palette (sand/lava/blueprint/cyan)
- ✅ Custom component styles in `@layer components`
- ✅ Dark mode via `.dark` class + CSS variables
- ✅ `tailwindcss-animate` package (package.json line 76)
- ✅ `tw-animate-css` for animations (package.json line 100)

**Token Hierarchy Used**:
1. **Base**: `--accent-lava`, `--blueprint-blue` (raw brand colors)
2. **Semantic**: `--primary`, `--background`, `--foreground`
3. **Component Variants**: `--radius-sm`, `--radius-md` (via CVA)

**Pros**:
- CSS-first = native CSS variables = runtime theme switching
- v4 Oxide engine = 5x faster builds
- All tokens exposed as CSS variables for runtime access
- Easy dark mode with class-based switching

**Cons**:
- Migration from v3 requires learning new `@theme` syntax
- Some v3 plugins may not be compatible

**Anti-Pattern Indicators**:
- ❌ Hardcoded hex values like `#ff4d00` in components
- ❌ Using `@apply` in v4 (prefer explicit CSS or utilities)
- ❌ No design token layer (everything in components)

**Recommended Searches**:
```bash
# Find hardcoded colors
grep -r "#ff4d00\|#0047FF" client/src/components/

# Check for @apply usage (anti-pattern in v4)
grep -r "@apply" client/src/

# Find CSS variable usage
grep -r "var(--" client/src/
```

---

## 4. Build/Test Tooling Baseline

### Pattern: Vite + Vitest + TypeScript Strict

**This Repo**: Full production setup

**Build Tools**:
- **Vite** v7 (package.json line 102) - modern ESM build
- **esbuild** (package.json line 94) - for server bundling
- **tsx** (package.json line 99) - TypeScript execution
- **TypeScript** 5.9.3 (package.json line 101) - strict mode

**Test Tools**:
- **Vitest** v2 (package.json line 104) - unit testing
- No E2E testing framework currently visible

**Signals in Code**:
- ✅ `vite.config.ts` - Vite configuration
- ✅ `vitest.config.ts` - Test configuration
- ✅ `tsconfig.json` - TypeScript config
- ✅ `"check": "tsc --noEmit"` script (package.json line 10)
- ✅ `"test": "vitest run"` script (package.json line 12)

**TypeScript Configuration** (tsconfig.json):
```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "isolatedModules": true
  }
}
```

**Pros**:
- Vite = instant HMR, fast builds
- Vitest = Vite-native testing (same fast experience)
- TypeScript strict = catch errors at compile time

**Anti-Pattern Indicators**:
- ❌ No `"strict": true` in tsconfig
- ❌ No test files visible (`*.test.ts`)
- ❌ `"any"` type usage

**Recommended Searches**:
```bash
# Find test files
find client -name "*.test.ts" -o -name "*.spec.ts"

# Check TypeScript config
cat tsconfig.json

# Find 'any' types
grep -r ": any" client/src/ | head -20
```

---

## 5. State/Data-Fetching Patterns

### Pattern: tRPC + TanStack Query v5 (Query-Native Integration)

**This Repo**: Full tRPC v11 + TanStack Query setup

```typescript
// client/src/lib/trpc.ts
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();
```

```typescript
// client/src/main.tsx
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,  // Serialization
    }),
  ],
});
```

**Server State Management**:
- **tRPC**: Type-safe API layer with Zod validation
- **TanStack Query**: Caching, background refetch, optimistic updates
- **superjson**: Date/Error serialization

**Signals in Code**:
- ✅ `@trpc/server`, `@trpc/client`, `@trpc/react-query` (package.json lines 46-48)
- ✅ `@tanstack/react-query` v5 (package.json line 45)
- ✅ `superjson` for serialization (package.json line 74)
- ✅ Zod for validation (package.json line 79)
- ✅ Global error handling via cache subscriptions (main.tsx lines 24-38)

**Query Key Pattern**: Not explicitly visible (custom hooks may use ad-hoc keys)

**Current Setup**:
```typescript
// Error handling pattern in main.tsx
queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    redirectToLoginIfUnauthorized(error);
  }
});
```

**Pros**:
- End-to-end type safety (AppRouter type flows to client)
- No API documentation needed (types = docs)
- React Query handles all caching/refetching
- Optimistic updates via `onMutate`/`onError`/`onSettled`

**Cons**:
- Tight coupling between client/server
- Requires tRPC backend
- Less flexible than REST/GraphQL for public APIs

**Anti-Pattern Indicators**:
- ❌ `useEffect` for data fetching (should use useQuery)
- ❌ Manual fetch calls instead of tRPC
- ❌ No query key factory (hardcoded strings)
- ❌ No optimistic updates for mutations

**Recommended Searches**:
```bash
# Find data fetching patterns
grep -r "useQuery\|useMutation" client/src/

# Find query keys
grep -r "queryKey" client/src/

# Find tRPC usage
grep -r "trpc\." client/src/

# Check for useEffect fetching
grep -r "useEffect.*fetch\|useEffect.*axios" client/src/
```

---

## Summary: Pattern Map for This Repo

| Area | Canonical Pattern | This Repo Status |
|------|------------------|------------------|
| Routing | File-based or explicit registry | ✅ Explicit (wouter) |
| Components | UI/Feature/Pages separation | ✅ Implemented |
| Styling | Tailwind v4 CSS-first + tokens | ✅ Advanced |
| Build | Vite + Vitest | ✅ Production-ready |
| Data | tRPC + TanStack Query | ✅ Full implementation |

---

## Anti-Patterns to Watch

1. **Hardcoded colors** in components (should use CSS variables)
2. **useEffect fetching** instead of tRPC hooks
3. **No query key factory** (strings scattered in code)
4. **Missing tests** (no .test.ts files found)
5. **Non-strict TypeScript** (may have `any` types)

---

## Recommended Validations

```bash
# 1. Check for hardcoded colors
grep -rn "#ff4d00\|#0047FF\|#00D1FF" client/src/components/ --include="*.tsx"

# 2. Verify strict TypeScript
cat tsconfig.json | grep -A5 "compilerOptions"

# 3. Check data fetching patterns
grep -rn "useEffect" client/src/pages/ --include="*.tsx" | grep fetch

# 4. Find all tRPC queries
grep -rn "trpc\." client/src/ --include="*.tsx" | head -20

# 5. List all pages
ls -la client/src/pages/

# 6. Check for design tokens
grep -rn "var(--" client/src/index.css | head -20
```

---

*Generated: March 2026*
*Based on: Official docs, Cursor Rules, DEV Community, and codebase analysis*
