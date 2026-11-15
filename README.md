# mirr-web

Frontend for the MIRR music analysis platform. Upload a track, run analysis and stem separation, and work with the results in a clean production-oriented UI.

**Live app:** https://mirr-web.novice-coder.workers.dev  
**Backend:** https://mirr-web.duckdns.org (`music-info-retrieval-research`)

Built with [Lovable](https://lovable.dev) and deployed on Cloudflare Workers.

## Stack

- React + TypeScript + Vite + TanStack Router
- Tailwind CSS + shadcn/ui
- Supabase Auth (Google OAuth + email/password)
- FastAPI backend via presigned R2 uploads and Celery task polling

## Environment

| Variable | Description | Default |
|---|---|---|
| `VITE_BACKEND_URL` | FastAPI base URL | `https://mirr-web.duckdns.org` |
| `VITE_USE_MOCK` | `"true"` uses the in-browser mock backend (shows "Demo mode", skips auth) | `false` |
| Supabase | Generated client in `src/integrations/supabase/client.ts` (managed by Lovable) | project `mghlumhhbjfeqvnmqrjs` |

The committed root `.env` holds the production defaults (both values are public). Override locally with
`.env.local` (git-ignored), e.g. `VITE_USE_MOCK=true` to work on the UI without a backend or account.
For production, set the same variables in the Cloudflare Workers dashboard (Settings → Variables and Secrets).

`VITE_*` values are inlined at build time, so changing them requires a rebuild/redeploy.

## Development

Use **bun** only (do not commit `package-lock.json`, `yarn.lock` or `pnpm-lock.yaml`).

```sh
git clone https://github.com/novice-coder-bw/mirr-web.git
cd mirr-web
bun install
bun run dev
```

Checks (same as CI in `.github/workflows/ci.yml`):

```sh
bun install --frozen-lockfile
bun run api:types && git diff --exit-code   # generated API types are up to date
bunx tsc --noEmit
bun run lint
bun run test
bun run build                               # also regenerates src/routeTree.gen.ts
```

## Auth & backend flow

- `/login` — email/password sign-in/sign-up and Google OAuth (redirects back to `/studio`).
- `/studio` — requires a Supabase session (unless `VITE_USE_MOCK=true`); unauthenticated users go to `/login`.
- Every backend call goes through `src/lib/api.ts`, which attaches `Authorization: Bearer <supabase access token>`.
  A `401` signs the user out locally and redirects to `/login`.
- Uploads: `POST /api/v1/uploads/presign` → `PUT` the file to the presigned R2 URL → `POST /api/v1/uploads/complete`.
- Status: `GET /api/v1/session/{file_id}` polled every 2000 ms; backend `pending`/`active`/`completed`/`failed`
  map to UI `queued`/`processing`/`completed`/`failed` (`idle` when a stage has not started).
- Max upload size: 100 MB (WAV/MP3).

## API contract

`src/api/openapi.json` is a snapshot of `https://mirr-web.duckdns.org/openapi.json`; `src/api/schema.d.ts`
is generated from it and imported by `src/lib/api.ts`. To sync with the backend:

```sh
curl -s https://mirr-web.duckdns.org/openapi.json | python3 -m json.tool > src/api/openapi.json
bun run api:types
bunx tsc --noEmit   # fix src/lib/api.ts if the contract changed
```

Push contract updates on a branch named `api-contract*`: if CI fails there, the `contract-drift` workflow
opens a GitHub issue labeled `devin`.

## Agent rules

See [AGENTS.md](./AGENTS.md). Summary:

- Keep Lovable sync intact (do not remove `.lovable/`, the Vite plugin, or the meta tag).
- All API traffic goes through `src/lib/api.ts`.
- Auth token on every backend request; 401 → sign out + `/login`.
- Uploads use the presigned R2 flow only.
- Poll sessions every 2000 ms; max file size 100 MB.

## Lovable / Jules co-existence

This repo is two-way synced with Lovable; `main` is the connected branch.

- **Lovable** — UI, styling, layout.
- **Jules / Devin / other agents** — API client, auth, data flow, CI, env wiring.
- Never force-push, rebase, amend or squash pushed commits on `main`; keep `main` building at all times.
- Do not delete `.lovable/` or edit Lovable-managed files: `src/integrations/supabase/*`, `vite.config.ts`,
  `bunfig.toml`, `src/lib/lovable-error-reporting.ts`, or the `LOVABLE` block in `AGENTS.md`.
- Keep routes in `src/routes/` and commit the regenerated `src/routeTree.gen.ts` after `bun run build`.
- No Cloudflare-specific imports/bindings (`cloudflare:workers`) or `wrangler` config files; Lovable owns the Worker build.
- Agents work on branches and open PRs; Lovable edits land directly on `main`, so pull before starting.

## Build & deploy

```sh
bun run build   # must produce a valid cloudflare-module output
```

Pushes to `main` trigger the Cloudflare Workers deployment.
