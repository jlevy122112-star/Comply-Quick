-- Comply-Quick — Phase 6 (cont.): template types, deliverable body, earnings.
-- Additive + backward compatible: existing rows default to type 'custom' and an
-- empty body. Creator earnings and marketplace revenue are derived from the
-- existing marketplace_purchases columns (amount_cents / platform_fee_cents), so
-- no new tables are needed — this migration just adds the two listing columns and
-- a helper aggregate for platform-wide revenue reporting.

-- ─── marketplace_templates: type + body ──────────────────────────────────────
-- `type` classifies the deliverable (privacy policy, cookie banner, ADA pack,
-- HIPAA pack, or a free-form custom template). `body` holds the actual document
-- the buyer receives once they own the template; `preview` remains a short,
-- publicly visible teaser.
alter table public.marketplace_templates
  add column if not exists type text not null default 'custom'
    check (type in ('privacy_policy', 'cookie_banner', 'ada_pack', 'hipaa_pack', 'custom'));

alter table public.marketplace_templates
  add column if not exists body text not null default '';

create index if not exists marketplace_templates_type_idx
  on public.marketplace_templates (type)
  where status = 'published';

-- ─── Marketplace revenue aggregate (platform-wide) ───────────────────────────
-- Sums paid purchases into gross revenue, the platform's retained fees, and the
-- net paid out to creators. SECURITY DEFINER so a platform admin can read the
-- global total; the API restricts who may call it via an email allowlist.
create or replace function public.marketplace_revenue_totals()
returns table (gross_cents bigint, platform_fee_cents bigint, creator_net_cents bigint, sales bigint)
language sql
security definer
stable
set search_path = public
as $$
  select
    coalesce(sum(amount_cents), 0)::bigint as gross_cents,
    coalesce(sum(platform_fee_cents), 0)::bigint as platform_fee_cents,
    coalesce(sum(amount_cents - platform_fee_cents), 0)::bigint as creator_net_cents,
    count(*)::bigint as sales
  from public.marketplace_purchases
  where status = 'paid';
$$;
