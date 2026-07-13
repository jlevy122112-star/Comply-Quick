# Browser end-to-end tests

Run public visual regression tests with `npm run test:e2e`. To refresh baselines after an intentional visual change, run `npm run test:e2e:update` and review the resulting `e2e/*-snapshots` images.

For authenticated coverage, provision a disposable Supabase user and set these variables only in your local shell or CI secrets:

- `PLAYWRIGHT_TEST_EMAIL`
- `PLAYWRIGHT_TEST_PASSWORD`
- Optional: `PLAYWRIGHT_BASE_URL` for a deployed preview environment

The authenticated test is skipped when credentials are absent. Never commit credentials or use a production account.