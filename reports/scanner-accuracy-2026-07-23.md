# Scanner Accuracy Harness — 2026-07-23

## Scope

Phase A measures the existing offline scanner and compliance mapping pipeline. It
does not add fingerprints, alter detection behavior, or claim that an
unrepresented vendor is absent from a site. The corpus contains ten deterministic
fixtures:

- clean first-party site;
- Sentry-only error monitoring;
- generic `analytics.track(` decoy;
- bare `gtag(` decoy;
- runtime-only Meta, TikTok, and Google pixels;
- consent-banner-present Meta and Google stack;
- EU tracker stack;
- US/California tracker stack;
- Stripe payment page; and
- Meta joint-controller deployment with OneTrust.

Every fixture includes static HTML, captured runtime request URLs, jurisdiction,
compliance-state inputs, positive detection expectations, explicit negative
guards, expected linter findings, and expected obligation IDs.

## Measured results

The harness runs `detectTools`, `detectToolsDetailed`, `analyzeHtml`,
`getService`, `lintCompliance`, and `deriveObligations` over every fixture.

| Metric | Result | Gate |
| --- | ---: | ---: |
| Fixtures | 10 | >= 9 |
| Expected vendor detections | 14 | — |
| True positives | 14 | — |
| False positives | 1 | — |
| False negatives | 0 | — |
| Detection precision | 0.9333 | >= 0.90 |
| Detection recall | 1.0000 | >= 0.95 |
| Detection F1 | 0.9655 | >= 0.94 |
| Detailed confidence/layer cases | 15 / 15 | 100% |
| Weak-only confidence cap | 0.30 | <= 0.30 |
| Catalog resolution for detected IDs | 100% | 100% |

The single false positive is the intentionally documented bare-`gtag(` gap
below. Excluding that known gap, the corpus has 1.0000 precision, recall, and
F1 for the vendor-positive cases.

Compliance mapping assertions pass for all non-gap fixtures, including:

- no false tracker finding for Sentry-only;
- no tracker-without-consent finding when Cookiebot is present;
- EU tracker severity `error` versus US/California severity `warning`;
- PCI scope warning for Stripe;
- Meta Art. 26 joint-controller mapping, distinct from processor DPA mapping;
- CCPA/CPRA traversal obligations for US/California tracker stacks; and
- runtime provenance for pixels absent from static HTML.

## Currently detectable vendor vocabulary

The current fingerprint/catalog intersection contains 22 services:

- `google` — Google Analytics / Ads
- `meta` — Meta Pixel
- `tiktok` — TikTok Pixel
- `linkedin` — LinkedIn Insight
- `pinterest` — Pinterest Tag
- `snapchat` — Snap Pixel
- `hotjar` — Hotjar
- `fullstory` — FullStory
- `clarity` — Microsoft Clarity
- `intercom` — Intercom
- `drift` — Drift
- `cookiebot` — Cookiebot
- `onetrust` — OneTrust
- `termly` — Termly
- `osano` — Osano
- `stripe` — Stripe
- `paypal` — PayPal
- `square` — Square
- `segment` — Segment
- `sentry` — Sentry
- `datadog` — Datadog RUM
- `gtm` — Google Tag Manager

The corpus proves only the representative services listed in the fixture
section; the remaining catalog entries still need fixture coverage in a later
expansion of the harness.

## Accuracy and coverage gaps exposed

### Detection gaps

1. **Bare `gtag(` is currently a Google false positive.** The Google fingerprint
   treats the generic call shape as a strong signal, even without a Google
   hostname, measurement ID format, or Google script URL. The harness keeps
   this as a known gap rather than changing detection logic in Phase A.
2. **Weak-only hints are not part of boolean detection.** A generic
   `analytics.track(` shape is visible through `detectToolsDetailed` as a
   Segment weak-only hint capped at `0.30`, while `detectTools` correctly
   excludes it from definite vendor/compliance detection.
3. **Runtime provenance is covered for only three vendors.** LinkedIn,
   Pinterest, Snapchat, Hotjar, FullStory, Clarity, chat, and payment runtime
   URL patterns need additional real captured-request fixtures before their
   runtime accuracy can be claimed.
4. **Consent presence is not consent behavior.** `analyzeHtml` can establish
   that a CMP marker exists, but cannot prove that scripts are blocked before
   opt-in. Browser-level blocking evidence belongs in a later integration
   harness.

### Compliance/law coverage gaps

1. **CCPA/CPRA mappings exist in the obligation graph, but the linter does not
   yet independently check notice-at-collection or opt-out/GPC evidence.**
   Phase A verifies traversal mapping, not document-evidence completeness.
2. **The analyzer emits generic scanner findings only.** PCI scope and
   Meta joint-controller obligations are correctly surfaced by
   `lintCompliance`/`deriveObligations`, not by `analyzeHtml` itself. This
   separation should remain explicit in future accuracy reports.
3. **No fixture currently proves LGPD, PIPEDA, HIPAA, EU AI Act, or SOC 2
   jurisdiction/evidence behavior.** Those graph nodes exist in the corpus,
   but their linter and traversal behavior needs dedicated fixtures before
   launch claims are made.
4. **The corpus does not yet cover UK separately from EU.** The linter groups
   UK with EU for consent, DPA, and transfer rules; a UK-specific fixture is
   needed to prove that behavior independently.

## Reproduction

```text
npx vitest run src/__tests__/scanner-accuracy-harness.test.ts
```

The test is offline and deterministic. It reads only the committed fixture
files and fails if detection thresholds, explicit negative guards, detailed
confidence/layer expectations, catalog resolution, or compliance mappings
regress.
