# Scope: Two-way Calendar Sync (follow-up to one-way ICS)

Status: **Proposed / not started.** This document scopes the follow-up to the shipped
one-way ICS feed ([Up7], PR #27). Decision on record: **ship one-way now, scope two-way
as a follow-up** — write events *into* the client's Google/Outlook calendar, and
optionally read their events back.

## What already ships (one-way, PR #27)
- Per-user revocable ICS feed token (`calendar_feeds`, migration `0014`).
- Public `GET /api/calendar/feed/<token>.ics` (RFC 5545), non-cacheable so Reset is immediate.
- Dashboard "Link calendar" panel: Add to Google/Outlook/Apple, copy URL, Reset URL.
- Direction: **our events → their calendar**, read-only from our side. No OAuth, no stored
  credentials, no background jobs. Works with all three providers.

## What two-way adds
Writing our events as *native* events in the user's Google/Outlook calendar (create/update/
delete), and/or reading their events back. This is an order of magnitude more work than the
ICS feed and carries ongoing operational + compliance cost.

### 1. OAuth per provider
- **Google Calendar API** + **Microsoft Graph** app registrations, consent screens, redirect
  flows, scope requests.
- Google requires a **security review / CASA assessment** for sensitive calendar scopes
  (`https://www.googleapis.com/auth/calendar`) before public launch — can take **weeks**.
- **Apple has no usable write API** (only messy CalDAV); "Add to Apple" stays one-way regardless.

### 2. Encrypted token storage + refresh
- New table (e.g. `calendar_connections`): provider, encrypted access/refresh tokens, scope,
  external calendar id, expiry, status. Tokens encrypted at rest (KMS/libsodium), never logged.
- Refresh-token rotation + revocation handling (user disconnects, expired grant, revoked app).

### 3. A real sync engine
- Map our event → provider event id (`calendar_event_links`: our `event.id` ↔ external id).
- Create / update / delete on our side must propagate; handle out-of-band deletion in the
  provider; handle conflicts and idempotency.
- **Incremental sync**: Google sync tokens / Graph delta queries; push channels/webhooks with
  renewal; backoff + retry on rate limits and 5xx; per-provider quota management.
- Backfill on connect; teardown on disconnect (delete our events from their calendar).

### 4. Operational & legal
- Holding write access to customers' calendars raises liability + support surface.
- Provider app verification maintenance; incident handling for token leaks.

## Recommended shape (if/when greenlit)
1. **Google first** (largest install base), Outlook second; Apple stays one-way.
2. Reuse the existing derived-event pipeline (`collectPersonalEvents`) as the source of truth;
   the sync engine only mirrors those events outward — no new event semantics.
3. Model it as **outbound mirror only** initially (our events → their calendar). Reading their
   events back is a separate, larger phase and is usually not needed for the compliance-deadline
   use case.
4. Budget the Google verification lead time up front; build behind a feature flag; dogfood with
   an internal Google Workspace before public launch.

## Effort estimate
- One-way (done): ~1 PR.
- Two-way outbound (Google only): multi-week (OAuth + token store + sync engine + verification lead time).
- Add Outlook: roughly doubles the provider-specific sync/verification work.
- Inbound (read their events): additional dedicated phase.

## Non-goals
- No two-way sync in the current release.
- No Apple write-back (no supported API).
