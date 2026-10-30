# mirr-frontend

Build a modern music analysis web app frontend for musicians and producers.

Tech stack preferences:
- React + TypeScript + Tailwind CSS + shadcn/ui
- Clean, dark, professional music-tool aesthetic (deep blacks, subtle neon accents in purple/cyan)
- Fully responsive (mobile + desktop)
- No authentication or database yet — just the UI + mockable API calls

Core user flow:
1. Upload an audio file (WAV or MP3) via drag-and-drop or file picker
2. See upload progress and get a file_id / session
3. Trigger analysis → show status (queued / processing / completed / failed)
4. Trigger stem separation → separate into drums, bass, other, vocals
5. View results: analysis summary + list of stems with download buttons and simple audio players

Pages / sections needed:
- Landing / Home: short hero explaining "Upload → Analyze → Separate stems", main CTA to start
- Main App (single primary screen after landing):
  - File upload zone (drag & drop + click)
  - Current session status card (file name, stages: uploaded → analyzing → separating → ready)
  - Action buttons: "Analyze" and "Separate Stems" (disabled until previous stage is ready)
  - Results panel:
    - Analysis results (placeholder cards for key, BPM, energy, genre/style tags, waveform thumbnail)
    - Stem cards for: Vocals, Drums, Bass, Other
      - Each stem: name, status, play button, download button, simple waveform visualization (can be static for now)
- Loading / progress states with skeletons and progress indicators
- Error states with clear messages and retry buttons
- Empty state when nothing is uploaded yet

API contract to support (use fetch or axios, base URL configurable via env):
- POST /api/upload → returns file_id / session
- GET /api/session/{file_id} → status + stages
- POST /api/analyze → starts analysis
- POST /api/separate → starts stem separation (drums, bass, other, vocals)

Make the frontend proxy-friendly (it will talk to a backend at localhost:8000 or via NEXT_PUBLIC_BACKEND_URL).

Design requirements:
- Dark theme, high contrast, music-production feel
- Smooth micro-interactions and hover states
- Clear visual hierarchy so the user always knows the current stage
- Accessible (keyboard + screen reader friendly)
- Use shadcn/ui components (Button, Card, Progress, Badge, Skeleton, etc.)
- No placeholder lorem ipsum — use realistic music-related copy

Start with a polished, production-ready UI that works with mock data first so I can review the layout and flow. Then we can wire the real API later.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://mirr-frontend.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2b1821d0-837a-431c-9d62-12010f71bd24).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
