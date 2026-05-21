# AI Tree Library (V2)

A personal curated web library of AI tools, design inspo, and creative resources, rendered as a navigable 3D constellation. Live at [aitreelibrary.com](https://aitreelibrary.com).

## Architecture (decoupled, "never goes down")

- **Content:** Notion (Library + Categories databases under `🎛️ 11:11 COMMAND CENTER → 🌌 AI TREE LIBRARY`).
- **Build:** Next.js fetches all `Status=Ready` rows at build time, runs `d3-force-3d` to bake all 3D node positions, writes `/public/library.json`. No runtime DB.
- **Runtime:** Static HTML + bundled JSON, deployed to Vercel edge. R3F renders the constellation client-side.
- **Auxiliary:** Two stateless Vercel serverless functions:
  - `/api/submit` — receives public submissions (with Turnstile)
  - `/api/classify` — called by Notion automation; runs Claude Haiku 4.5 to enrich new rows

## Local dev

```bash
cp .env.example .env.local       # Fill in NOTION_TOKEN at minimum
npm install
npm run fetch-content            # Pulls from Notion, writes public/library.json
npm run dev                      # http://localhost:3000
```

## V1 → V2 migration

70 categories + first 100 of ~301 V1 tools have been seeded into the Notion Library DB. The remaining 201 sit as JSON in `../v1-data/library-pages-batch-{2,3,4}.json` and can be one-shot imported with:

```bash
NOTION_TOKEN=secret_xxx npm run seed-library
```

(The script is idempotent — dedupes by URL.)

## Build & deploy

```bash
npm run build                    # Runs fetch-content then next build
```

Deploys to Vercel. Production env vars to set:

| Env var | Purpose |
|---|---|
| `NOTION_TOKEN` | Read Library + Categories at build, write new rows from /api/* |
| `ANTHROPIC_API_KEY` | Claude Haiku 4.5 for auto-classify |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Spam guard on submit form (client) |
| `TURNSTILE_SECRET_KEY` | Spam guard validation (server) |
| `CLASSIFY_WEBHOOK_SECRET` | Shared secret between Notion automation and /api/classify |
| `RESEND_API_KEY` | (Optional) Submitter ack emails |

Rebuild triggers:
- **Notion change** → Notion automation → Vercel deploy hook → live in ~90s
- **Daily cron** at 04:00 UTC (heartbeat)
- **Manual** `vercel deploy --prod`

## Notion data source IDs (hardcoded in pipeline)

- Library: `695ea981-738e-42bf-bec6-43ffd530d89c`
- Categories: `6e793850-a435-4b4f-8b02-9d4de4d48be5`

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- React Three Fiber + Drei + postprocessing (UnrealBloom)
- d3-force-3d (build-time only — positions are baked)
- Tailwind v4
- @notionhq/client, @anthropic-ai/sdk

## V1 source

The original aitreelibrary.com lived at [github.com/ElliotDaemon/ai-library](https://github.com/ElliotDaemon/ai-library) on a Hostinger VPS that was decommissioned. The V1 design doc (`ideas.md` in that repo, titled "Cosmic Neural Network") inspired V2's visual language — same dark space, same per-category glow colors, same multi-zoom concept — V2 finally implements it in true 3D.
