# Comply-Quick WordPress Plugin

Official WordPress plugin for the Comply-Quick compliance pixel.

## Install

1. Upload the plugin folder to `/wp-content/plugins/` or install via the WordPress admin.
2. Activate the plugin through the "Plugins" menu.
3. In WordPress admin, go to **Settings > Comply-Quick** and paste your agency API key.
4. The plugin will inject the compliance pixel into the site footer on every page.

## Pixel snippet

```html
<script src="https://YOUR_APP_HOST/api/compliance-agent.js" data-key="cq_live_..."></script>
```

## Development

Place this directory in a WordPress install and run `composer install` if a `composer.json` is added.
