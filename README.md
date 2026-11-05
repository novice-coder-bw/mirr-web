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
| `VITE_USE_MOCK` | Force mock data (`"true"` only) | unset / false |
| Supabase vars | From `src/integrations/supabase/client.ts` | project `mghlumhhbjfeqvnmqrjs` |

Set these in the Cloudflare Workers dashboard (Settings → Variables) for production.

## Development

```sh
git clone https://github.com/novice-coder-bw/mirr-web.git
cd mirr-web
bun install
bun run dev
```

## Agent rules

See [AGENTS.md](./AGENTS.md). Summary:

- Keep Lovable sync intact (do not remove `.lovable/`, the Vite plugin, or the meta tag).
- All API traffic goes through `src/lib/api.ts`.
- Auth token on every backend request; 401 → sign out + `/login`.
- Uploads use the presigned R2 flow only.
- Poll sessions every 2000 ms; max file size 100 MB.

## Division of labor

- **Lovable** — UI, styling, layout.
- **Jules / backend work** — API client, auth, data flow, Cloudflare/env wiring.

## Build & deploy

```sh
bun run build   # must produce a valid cloudflare-module output
```

Pushes to `main` trigger the Cloudflare Workers deployment.
