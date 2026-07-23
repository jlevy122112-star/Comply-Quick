-- White-label engine + per-tenant SMTP (Phase I).
--
-- Each tenant (organization) can now store its own brand assets, theme palette,
-- support email, and outbound sender configuration. These values are separate
-- from the agency portal branding so they work for every organization type.

alter table public.organizations
  add column if not exists logo_url text,
  add column if not exists favicon_url text,
  add column if not exists primary_color text default '#4f46e5',
  add column if not exists theme_palette text default 'indigo',
  add column if not exists support_email text,
  add column if not exists smtp_from_email text,
  add column if not exists smtp_reply_to_email text;

-- Constrain the palette to the built-in token sets shipped by the app.
alter table public.organizations drop constraint if exists organizations_theme_palette_check;
alter table public.organizations add constraint organizations_theme_palette_check
  check (theme_palette in ('indigo', 'emerald', 'rose', 'amber', 'ocean', 'forest', 'slate'));

-- Validate primary_color is a 6-digit hex when set.
alter table public.organizations drop constraint if exists organizations_primary_color_check;
alter table public.organizations add constraint organizations_primary_color_check
  check (primary_color is null or primary_color ~ '^#[0-9a-fA-F]{6}$');

-- Support/SMTP addresses are optional but must be valid emails when provided.
alter table public.organizations drop constraint if exists organizations_support_email_check;
alter table public.organizations add constraint organizations_support_email_check
  check (support_email is null or support_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

alter table public.organizations drop constraint if exists organizations_smtp_from_email_check;
alter table public.organizations add constraint organizations_smtp_from_email_check
  check (smtp_from_email is null or smtp_from_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

alter table public.organizations drop constraint if exists organizations_smtp_reply_to_email_check;
alter table public.organizations add constraint organizations_smtp_reply_to_email_check
  check (smtp_reply_to_email is null or smtp_reply_to_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
