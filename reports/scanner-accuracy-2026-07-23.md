# Scanner Accuracy Harness — 2026-07-23 (Phase B)

## Scope

Phase B keeps the scanner deterministic and offline while tightening the Google
signal model and expanding the vendor vocabulary. It does not add network
fetching, worker behavior, remediation, or accessibility scanning. The corpus
contains 14 deterministic fixtures covering:

- clean first-party, Sentry-only, generic decoys, and bare-`gtag(`;
- static and runtime-only Meta, TikTok, Google, Mixpanel, Zendesk, Vimeo, and
  Google Fonts signals;
- consent-gated tracker stacks;
- EU versus US/California jurisdiction behavior;
- Stripe PCI mapping;
- Meta joint-controller mapping;
- representative product analytics, marketing/CDP, advertising, chat,
  experimentation, and cookie-setting embed vendors; and
- Google Fonts, Maps, and reCAPTCHA as non-consent-gated EU transfer utilities.

Every fixture includes static HTML, captured runtime request URLs, jurisdiction,
compliance-state inputs, positive detection expectations, explicit negative
guards, expected linter findings, and expected obligation IDs.

## Measured results

The harness runs `detectTools`, `detectToolsDetailed`, `analyzeHtml`,
`getService`, `lintCompliance`, and `deriveObligations` over every fixture.

| Metric | Result | Gate |
| --- | ---: | ---: |
| Fixtures | 14 | >= 9 |
| Expected vendor detections | 31 | — |
| True positives | 31 | — |
| False positives | 0 | 0 |
| False negatives | 0 | — |
| Detection precision | 1.0000 | >= 0.90 |
| Detection recall | 1.0000 | >= 0.95 |
| Detection F1 | 1.0000 | >= 0.94 |
| Detailed confidence/layer cases | 54 / 54 | 100% |
| Weak-only confidence cap | 0.30 | <= 0.30 |
| Catalog resolution for detected IDs | 100% | 100% |

The Phase A bare-`gtag(` false positive is fixed. Bare `gtag(` now appears only
as a weak-only Google hint capped at `0.30`; it is excluded from boolean
detection and no known-gap carve-out remains in the harness.

Compliance mapping assertions pass for all non-gap fixtures, including:

- Sentry-only remains outside consent-gated tracker findings;
- generic vendor-neutral API shapes remain weak-only;
- consent banners suppress tracker-without-consent findings;
- EU tracker severity is `error` while the equivalent US/California case is
  `warning`;
- Stripe produces a PCI scope warning;
- Meta maps to an Art. 26 joint-controller obligation;
- Google utility services do not trigger consent findings but do trigger EU/UK
  transfer findings; and
- runtime-only detections retain `runtime` provenance.

## Current detectable vocabulary

The analyzer/catalog intersection now contains **47 services**:

### Existing vocabulary

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

### Phase B additions

- `mixpanel` — Mixpanel
- `amplitude` — Amplitude
- `heap` — Heap
- `adobe_analytics` — Adobe Analytics
- `klaviyo` — Klaviyo
- `mailchimp` — Mailchimp
- `hubspot` — HubSpot
- `criteo` — Criteo
- `taboola` — Taboola
- `outbrain` — Outbrain
- `bing_uet` — Microsoft/Bing UET
- `reddit` — Reddit Pixel
- `x_twitter` — X/Twitter Pixel
- `quora` — Quora Pixel
- `zendesk` — Zendesk
- `tawk` — Tawk.to
- `crisp` — Crisp
- `livechat` — LiveChat
- `optimizely` — Optimizely
- `vwo` — VWO
- `youtube` — YouTube Embed
- `vimeo` — Vimeo
- `google_fonts` — Google Fonts
- `google_maps` — Google Maps
- `recaptcha` — Google reCAPTCHA

## Classification decisions

- Product analytics, marketing/CDP, advertising pixels, chat/support,
  experimentation tools, and standard YouTube/Vimeo embeds use consent-gated
  tracker categories and `consentGated: true`.
- Google Fonts, Maps, and reCAPTCHA use the new `utility` category and
  `consentGated: false`. They remain non-EU processors so EU/UK transfer linting
  still applies.
- YouTube/Vimeo use the new `embed` category, included in the consent-gated
  category set because standard embeds can set third-party tracking cookies.
- New vendors use `processor` and shared tracker obligations where the vendor
  role is not sufficiently certain from the public integration pattern. No
  unverified DPA URLs were added.
- Existing Meta remains the joint-controller precedent; Phase B does not invent
  joint-controller assignments for vendors where the processing role cannot be
  confidently established from the fingerprint alone.

## Remaining gaps

1. The corpus proves representative new vendors, not every runtime URL shape
   for every vocabulary entry. LinkedIn, Pinterest, Snapchat, session replay,
   and payment runtime traffic need further captured-request fixtures.
2. CMP presence still does not prove that scripts are blocked before opt-in;
   that requires a browser-level integration harness.
3. CCPA/CPRA mappings are traversed, but the linter does not independently
   validate notice-at-collection or GPC/opt-out evidence.
4. Dedicated fixtures are still needed for LGPD, PIPEDA, HIPAA, EU AI Act,
   SOC 2, and UK-specific behavior.
5. Some vendors classified as processors may require later legal review for
   joint-controller treatment depending on the customer's contract and use
   case. Those decisions were intentionally not guessed in Phase B.

## Reproduction

```text
npx vitest run src/__tests__/scanner-accuracy-harness.test.ts
```

The test is offline and deterministic. It reads only the committed fixture
files and fails if detection thresholds, explicit negative guards, detailed
confidence/layer expectations, catalog resolution, or compliance mappings
regress.
