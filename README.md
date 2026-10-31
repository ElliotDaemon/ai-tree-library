# AI Tree Library

The open library of the useful internet: websites, AI tools, iOS and Android apps, widgets and browser extensions, found by people and approved by a person. Live at [aitreelibrary.com](https://aitreelibrary.com).

## How it works

- **The database is git.** `data/library.json` (live), `data/queue.json` (waiting for review) and `data/rejected.json` (declined URLs). One entry per line, so diffs and pull requests stay readable.
- **No paid APIs.** Submissions describe themselves from their own page metadata; `lib/taxonomy.mjs` sorts them into branches with a small open classifier. Nothing calls an LLM.
- **Static site.** `scripts/build-index.mjs` turns the library into `public/api/index.json` (compact rows for search and the field), `public/api/library.json` (full CC0 dataset) and `public/llms.txt`. Every page is pre-rendered.
- **The Field.** The home page draws every link as a point: branches packed outward on a golden-angle spiral, links in sunflower phyllotaxis inside them. It is pure arithmetic, so it stays balanced from 0 to tens of thousands of links.
- **Review.** `/portal` is a keyboard-first desk. Decisions are staged in the browser and land as one commit through the GitHub API, which triggers a rebuild. Queue-only commits skip the build (`vercel.json`).

## Contribute

Use [the submit form](https://aitreelibrary.com/submit), or open a pull request adding a line to `data/queue.json`. Add a branch by editing `BRANCHES` in `lib/taxonomy.mjs`; colours, layout and routes follow.

## Run it

```bash
npm install
npm run dev                 # http://localhost:3000, portal open locally, writes data/ on disk
npm run import-bookmarks -- ~/Downloads/bookmarks.html   # Chrome export → queue (private links filtered)
```

## Deploy (Vercel)

| Env var | Purpose |
|---|---|
| `ADMIN_USER`, `ADMIN_PASSWORD` | Portal sign-in |
| `GITHUB_TOKEN` | Fine-grained token, this repo only, **Contents: read and write**. Lets the portal and submit form commit. |
| `GITHUB_BRANCH` | Optional. Defaults to the deployed branch. |
| `TURNSTILE_SECRET_KEY` | Optional spam guard. Honeypot and rate limits work without it. |

Data is CC0. An 11:11 project.
