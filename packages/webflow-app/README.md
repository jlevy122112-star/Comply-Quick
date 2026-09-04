# Comply-Quick Webflow App

A lightweight Webflow App that injects the Comply-Quick compliance pixel into a published Webflow site.

## Install

1. Install this app from the Webflow App marketplace (or sideload for testing).
2. In Comply-Quick, go to **Settings → Integrations → First-Class Integrations** and connect a Webflow integration for the correct workspace + client seat.
3. Paste the install snippet in Webflow Project Settings → Custom Code and publish.
4. Visit the live site once to trigger telemetry verification and move the integration from `pending` to `active`.

## Lifecycle

- Disconnects are soft-revoked (history retained for audit/compliance).
- Integration events are written to the unified durable event log (`connector.platform_webhook_events`).
- Native Webflow metadata is stored in `public.native_integrations`.

## Pixel snippet

```html
<script src="https://YOUR_APP_HOST/api/compliance-agent.js" data-key="cq_live_..."></script>
```

## Development

This package is scaffolded for packaging with the Webflow Designer API.
