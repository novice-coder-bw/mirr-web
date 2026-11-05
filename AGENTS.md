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
*   **Polling:** When waiting for Celery tasks, poll `/api/v1/sessions/{id}` every 2000ms.
*   **File Size:** Enforce a 100MB limit (matching backend `MAX_UPLOAD_MB`).
