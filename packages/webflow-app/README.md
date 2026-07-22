# Comply-Quick Webflow App

A lightweight Webflow App that injects the Comply-Quick compliance pixel into a published Webflow site.

## Install

1. Install this app from the Webflow App marketplace (or sideload for testing).
2. In the Comply-Quick dashboard, copy your agency API key.
3. The app will prompt for the key and write the pixel script into the site footer before `</body>`.

## Pixel snippet

```html
<script src="https://YOUR_APP_HOST/api/compliance-agent.js" data-key="cq_live_..."></script>
```

## Development

This package is scaffolded for packaging with the Webflow Designer API.
