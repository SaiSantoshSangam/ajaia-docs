# AI-Native Engineering Workflow — Ajaia Docs

This document details how AI-native development workflows were applied to design, implement, verify, and harden **Ajaia Docs** with senior-level engineering rigor.

---

## 1. Core Principles

1. **Inspect Before Generating**: Every phase began by inspecting the actual workspace, installed package versions, and framework documentation rather than relying on stale training assumptions.
   - Example: After initializing `next@16.4.6`, inspecting `node_modules/next/dist/docs/` immediately revealed Next.js 16 breaking conventions (`src/proxy.ts` replacing `middleware.ts`, and `cacheComponents: true` requiring `<Suspense>` boundaries instead of `export const dynamic = "force-dynamic"`), as well as Tiptap v3's `setContent(doc, { emitUpdate: false })` signature and bundled `link`/`underline` extensions.
2. **Vertical, Verifiable Slices**: Rather than generating a monolithic codebase in one pass, the application was built in clean incremental slices—each verified before moving on:
   1. Planning, folder architecture, and Supabase schema/RLS design
   2. Backend services, strict Zod validation, and authorization rules
   3. SaaS Dashboard (sidebar, cards, search, rename, delete, loading/empty/error states)
   4. Tiptap editor, 800ms autosave deduplication, and navigation safety
   5. TXT & Markdown import pipeline (2 MB limit, content/binary validation)
   6. End-to-end sharing workflows and direct API bypass tests
   7. Complete engineering review, security audit, and deployment readiness
3. **Never Trust AI Output Without Execution**: Every slice ended with running the real toolchain (`tsc --noEmit`, `vitest run`, `eslint`, `next build`, and live HTTP server probes) and fixing real compiler/React 19/runtime issues uncovered by those tools.

---

## 2. Guardrails & Failure Modes Prevented

| Risk in AI-Assisted Coding | Mitigation Applied in Ajaia Docs |
| :--- | :--- |
| **Hallucinated framework APIs** | Read bundled Next.js 16 docs and `@tiptap/core` `.d.ts` definitions directly before writing `proxy.ts`, `RouteContext`, `<Suspense>` wrappers, and `setContent` calls. |
| **Client-side-only "security"** | Enforced capabilities server-side (`authorization.ts` + PostgreSQL RLS + `.strict()` Zod schemas rejecting client-supplied `ownerId`/`userId`) and proved via direct API bypass tests (`tests/sharing-e2e.test.ts`). |
| **Silent test weakening** | When `multipart/form-data` tests uncovered an `instanceof File` cross-realm mismatch in `import/route.ts`, fixed the production handler with `isFormFile()` and ran API tests in `@vitest-environment node` rather than relaxing assertions. |
| **React 19 Compiler/Hook regressions** | Fixed all `react-hooks/error-boundaries`, `react-hooks/refs`, `react-hooks/immutability`, and `react-hooks/set-state-in-effect` violations surfaced by ESLint cleanly (e.g., keyed dialogs instead of reset-in-effect, `while` loop instead of recursive `useCallback`). |
| **Secret leakage** | Audited `src/`, `supabase/`, and `tests/` for `service_role` keys or hardcoded tokens; isolated `DEMO_USER_PASSWORD` strictly to server route execution; kept `.env*` git-ignored. |
| **Overstating unverified deployment** | Explicitly distinguished locally verified artifacts (`next build`, 37 passing tests, HTTP probes) from live Vercel/Supabase steps blocked on external credentials. |

---

## 3. Modularity & Code Hygiene

- **No Monolithic Files**: Separated domain types (`src/types/`), Zod validation schemas (`src/lib/validations/`), Supabase SSR clients (`src/lib/supabase/`), pure business & authorization services (`src/services/`), REST handlers (`src/app/api/`), and focused UI components (`src/components/`).
- **Testability by Design**: Services accept an injected `SupabaseClient` and `AuthUser`, allowing both unit tests (`tests/authorization.test.ts`, `tests/import-parser.test.ts`) and stateful multi-user end-to-end API tests (`tests/sharing-e2e.test.ts`) to run deterministically in ~2.8 seconds.

---

## 4. Verification Loop Used on Every Change

```bash
npm run typecheck   # Strict TypeScript check (noEmit)
npm test            # 9 Vitest suites / 37 tests (services, API, UI, E2E sharing)
npm run lint        # ESLint + Next.js + React 19 hooks rules
npm run build       # Full Turbopack production build
```

All four gates passed with zero errors and zero warnings prior to delivery.

