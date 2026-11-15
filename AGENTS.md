<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Agent Instructions for MIRR Frontend (mirr-web)

## 🚨 LOVABLE SYNC GUARDRAILS (DO NOT VIOLATE)
*   **Do NOT delete the `.lovable/` folder.**
*   **Do NOT remove `@lovable.dev/vite-tanstack-config` from package.json or vite.config.ts.** Lovable needs this to sync and build the Cloudflare Worker.
*   **Do NOT remove the `@Lovable` meta tag or the error reporting hook.** We are actively using Lovable for UI development.

## 🔌 API Integration Rules
*   **Single Source of Truth:** All backend calls MUST go through `src/lib/api.ts`.
*   **Base URL:** Use `VITE_BACKEND_URL` (default: `https://mirr-web.duckdns.org`). Never hardcode URLs.
*   **Auth:** Every request to the backend MUST include `Authorization: Bearer <supabase-access-token>`. Unauthenticated requests will 401.
*   **Uploads:** Do NOT send files directly to FastAPI. Use the presigned flow: `POST /api/v1/uploads/presign` → `PUT` to R2 → `POST /api/v1/uploads/complete`.

## 🏗️ UI/UX Guidelines
*   **Polling:** When waiting for Celery tasks, poll `GET /api/v1/session/{file_id}` every 2000ms.
*   **File Size:** Enforce a 100MB limit (matching backend `MAX_UPLOAD_MB`).

## 🤝 Lovable / Agent Compatibility Rules
*   **Package manager:** `bun` only. Commit `bun.lock`; never add `package-lock.json`, `yarn.lock` or `pnpm-lock.yaml`.
*   **Do NOT edit Lovable-managed files:** `src/integrations/supabase/*`, `vite.config.ts`, `bunfig.toml`, `.lovable/`, `src/lib/lovable-error-reporting.ts`, or the `LOVABLE:BEGIN/END` block above.
*   **Never rewrite history on `main`** (no force-push/rebase/amend/squash of pushed commits) and never leave `main` broken.
*   **Routes** live in `src/routes/`. After changing routes run `bun run build` and commit `src/routeTree.gen.ts`.
*   **No Cloudflare-specific code:** no `cloudflare:workers` imports, bindings, or `wrangler` config files.
*   **API contract:** `src/api/openapi.json` is the backend snapshot; regenerate `src/api/schema.d.ts` with `bun run api:types` and use those types in `src/lib/api.ts`. CI fails if the generated file is stale.
*   **Auth:** `/studio` is guarded client-side (`ssr: false` + `beforeLoad` in `src/routes/studio.tsx`); a `401` from the backend signs out locally and redirects to `/login` (handled in `src/lib/api.ts`).
*   **Before pushing:** `bun run lint`, `bunx tsc --noEmit`, `bun run test`, `bun run build` must pass.
