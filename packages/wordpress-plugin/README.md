# Comply-Quick WordPress Plugin

Official WordPress plugin for the Comply-Quick compliance pixel.

## Install

1. Upload the plugin folder to `/wp-content/plugins/` or install via the WordPress admin.
2. Activate the plugin through the "Plugins" menu.
3. In Comply-Quick, open **Settings → Integrations → First-Class Integrations** and connect WordPress for the target workspace + client seat.
4. In WordPress admin, go to **Settings > Comply-Quick** and paste your install snippet/API key.
5. Load any public page once to trigger telemetry verification and move from `pending` to `active`.

## Lifecycle

- Disconnect is soft-revoke only (records remain for compliance/audit history).
- Native WordPress connection metadata is stored in `public.native_integrations`.
- Event ingest, monitoring, and idempotency use the unified event log (`connector.platform_webhook_events`).

## Pixel snippet

```html
<script src="https://YOUR_APP_HOST/api/compliance-agent.js" data-key="cq_live_..."></script>
```

## Development

Place this directory in a WordPress install and run `composer install` if a `composer.json` is added.
