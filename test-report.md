# Test Report — Auth (Google/GitHub OAuth), Annual Billing, Verified Stripe Entitlements

**PR:** [#5](https://github.com/jlevy122112-star/Qwik-Comply/pull/5) · branch `devin/1783120304-clause-engine`
**How tested:** Ran the app locally (`localhost:3000`) against the live Supabase project + Stripe **test mode** (`stripe listen` forwarding webhooks). Session established via an admin-generated email OTP (temporary test-only route, not committed). Recorded the full flow.

## Result summary — all assertions passed

- **OAuth buttons redirect to real providers** — passed
- **Annual toggle changes pricing** ($29/mo→$290/yr, $99/mo→$990/yr) — passed
- **Stripe Checkout uses the annual price** ($290.00/year) — passed
- **Webhook grants entitlement** (HTTP 200; DB `tier=agency, status=active`) — passed
- **Command Center badge flips Free→Agency** — passed
- **Premium unlocks** (full package, no paywall blur) — passed
- **Project persists server-side** (Active Projects) — passed

No failures or unexpected behavior. One note on method: the magic-link *email* link could not be exercised via the admin helper because that helper emits implicit-flow hash tokens while the server callback uses PKCE `?code=` (correct for real browser magic-links). I established the session via a temporary server-side OTP route instead. Completing an actual Google/GitHub third-party login is out of scope (no test account) — I verified the buttons reach the real provider screens.

---

## Test 3 — OAuth buttons initiate real provider redirects

| Login page (3 methods) | Google → real consent screen | GitHub → real consent screen |
|---|---|---|
| ![login](/home/ubuntu/screenshots/ss_6d4a0d6a.png) | ![google](/home/ubuntu/screenshots/ss_6433ebbb.png) | ![github](/home/ubuntu/screenshots/ss_baac9c31.png) |
| "Continue with Google", "Continue with GitHub", magic-link | accounts.google.com "to continue to eliziftznigyjkqwcyif.supabase.co" | github.com OAuth "to continue to Comply-Quick" |

## Test 1 — Annual checkout grants Agency tier

| 🔵 Precondition: Free tier | Paywall — Monthly | 🟢 Paywall — Annual |
|---|---|---|
| ![free](/home/ubuntu/screenshots/ss_a835688a.png) | ![monthly](/home/ubuntu/screenshots/ss_2393fcea.png) | ![annual](/home/ubuntu/screenshots/ss_542e11a2.png) |
| Badge "Free", 0 projects | Agency $29/mo, Enterprise $99/mo | Agency **$290/yr**, Enterprise **$990/yr** |

| Stripe Checkout (annual) | 🟢 After payment: Agency tier |
|---|---|
| ![stripe](/home/ubuntu/screenshots/ss_60457078.png) | ![agency](/home/ubuntu/screenshots/ss_4a061f0e.png) |
| "Agency Scale (Annual) — $290.00 per year" | `/dashboard/home?checkout=success`, badge **Agency**, Manage Billing |

Webhook + DB evidence:
```
stripe listen:  <-- [200] POST /api/webhooks/stripe  checkout.session.completed
DB subscriptions row: {"tier":"agency","status":"active",
  "stripe_customer_id":"cus_UpBsnThBYlcpGE",
  "stripe_subscription_id":"sub_1TpXVEAoRoRiCf7eHG7qdtT2"}
```

## Test 2 — Premium unlock + DB persistence

| 🟢 Premium package (no paywall) | 🟢 Project persisted in Command Center |
|---|---|
| ![premium](/home/ubuntu/screenshots/ss_fa0a9897.png) | ![persist](/home/ubuntu/screenshots/ss_6d7fa085.png) |
| Full addendum + 22-item checklist + Copy/Download, no blur | "Shopify Project · 1 pixel · 2 regions · 77 · Current" (server-rendered) |

---

## Adversarial value
- A broken annual wiring would show $29/mo in Stripe → **verified $290/yr**.
- A spoofable/unverified entitlement would leave the badge "Free" → **verified DB-backed Agency**.
- localStorage-only projects would vanish on server render → **verified server-rendered Active Projects**.
