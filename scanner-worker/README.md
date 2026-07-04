# Comply-Quick Scanner Worker

A standalone headless-browser service that renders a URL, executes its
JavaScript, and returns the final HTML plus every outbound request URL. This is
what lets the compliance scanner detect **JS-injected trackers** (Meta Pixel,
TikTok, Google Analytics, LinkedIn, etc.) that never appear in the statically
served markup — the limitation of a plain server-side fetch.

The Next.js app calls this worker when `SCANNER_WORKER_URL` is set and
transparently falls back to a static fetch if the worker is unset or
unreachable, so nothing breaks if the worker is down.

## API

- `GET /health` → `{ "ok": true }`
- `POST /scan` → `{ url, status, html, requestUrls }`
  - Body: `{ "url": "https://example.com" }`
  - Auth (when `SCANNER_WORKER_SECRET` is set): `Authorization: Bearer <secret>`

```bash
curl -s -X POST http://localhost:8080/scan \
  -H "content-type: application/json" \
  -H "authorization: Bearer $SCANNER_WORKER_SECRET" \
  -d '{"url":"https://www.hubspot.com"}' | jq '{status, tools: (.requestUrls | length)}'
```

## Environment

| Variable                 | Default | Purpose                                             |
| ------------------------ | ------- | --------------------------------------------------- |
| `PORT`                   | `8080`  | Listen port.                                        |
| `SCANNER_WORKER_SECRET`  | (unset) | Shared bearer token. When unset, `/scan` is open.   |
| `SCAN_NAV_TIMEOUT_MS`    | `30000` | Max navigation time.                                |
| `SCAN_SETTLE_MS`         | `2500`  | Extra wait after load for late-firing tags.         |

> Set `SCANNER_WORKER_SECRET` to the **same value** configured in the Next app,
> and never expose the worker publicly without it.

## Run locally

```bash
cd scanner-worker
npm install          # downloads Chromium via postinstall
SCANNER_WORKER_SECRET=dev-secret npm start
```

## Deploy with Docker

```bash
docker build -t comply-quick-scanner scanner-worker
docker run -p 8080:8080 -e SCANNER_WORKER_SECRET=<secret> comply-quick-scanner
```

## Deploy on Fly.io

```bash
cd scanner-worker
fly launch --no-deploy           # or: fly apps create comply-quick-scanner
fly secrets set SCANNER_WORKER_SECRET=<secret>
fly deploy
```

Then, in the Next app's host (e.g. Vercel), set:

```
SCANNER_WORKER_URL=https://comply-quick-scanner.fly.dev
SCANNER_WORKER_SECRET=<same secret>
```

Railway / Render / any container host works the same way — point them at the
`Dockerfile`, set `SCANNER_WORKER_SECRET`, and expose port `8080`.
