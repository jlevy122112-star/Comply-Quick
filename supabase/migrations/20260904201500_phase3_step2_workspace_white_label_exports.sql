-- Phase 3 Step 2: workspace-branded exports and deliverables.
--
-- Workspaces can now carry their own client-facing logo, accent color, palette,
-- and footer copy. Deliverables resolve workspace branding first, then fall
-- back to the parent organization's white-label settings.

alter table public.workspaces
  add column if not exists logo_url text,
  add column if not exists primary_color text default '#4f46e5',
  add column if not exists theme_palette text default 'indigo',
  add column if not exists footer_text text;

alter table public.workspaces drop constraint if exists workspaces_theme_palette_check;
alter table public.workspaces add constraint workspaces_theme_palette_check
  check (theme_palette in ('indigo', 'emerald', 'rose', 'amber', 'ocean', 'forest', 'slate'));

alter table public.workspaces drop constraint if exists workspaces_primary_color_check;
alter table public.workspaces add constraint workspaces_primary_color_check
  check (primary_color is null or primary_color ~ '^#[0-9a-fA-F]{6}$');
