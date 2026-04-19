-- =====================================================================
-- Phase 9 — Foundation Reset
-- =====================================================================
-- Goal:
--   1. Introduce organizations + organization_members as the canonical
--      home for company (and later university) identity, replacing the
--      role-polymorphic `profiles` row as the source of truth for
--      company-owned data.
--   2. Backfill one organization per existing company profile, with
--      the profile owner as the sole 'owner' member.
--   3. Repoint ownership FKs: tasks.company_id -> tasks.org_id,
--      job_posts.company_id -> job_posts.org_id,
--      connections.company_user_id -> connections.org_id.
--      (Old columns are kept NULLABLE alongside during shadow mode.)
--   4. Add entitlement + usage scaffolding for future monetization
--      without turning any gating on.
--   5. Write RLS policies for the new org model but DO NOT enable RLS
--      yet — shadow mode. Enforcement is a later migration.
--
-- Safe to run multiple times: all DDL guarded with IF NOT EXISTS and
-- backfills guarded with NOT EXISTS checks.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. organizations
-- ---------------------------------------------------------------------
create table if not exists public.organizations (
  id             uuid primary key default gen_random_uuid(),
  type           text not null default 'company'
                   check (type in ('company', 'university')),
  slug           text not null unique,
  name           text not null,
  logo_url       text,
  website        text,
  description    text,
  industry       text,
  size           text,
  status         text not null default 'active'
                   check (status in ('active', 'suspended', 'archived')),
  verified_at    timestamptz,
  owner_user_id  uuid references auth.users(id) on delete set null,

  -- Monetization hooks (inert in Phase 9).
  plan           text not null default 'free',
  plan_status    text not null default 'active'
                   check (plan_status in ('active', 'trialing', 'past_due', 'canceled')),
  plan_seats     int  not null default 1,
  plan_renews_at timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists organizations_owner_idx on public.organizations(owner_user_id);
create index if not exists organizations_type_idx  on public.organizations(type);

-- ---------------------------------------------------------------------
-- 2. organization_members
-- ---------------------------------------------------------------------
create table if not exists public.organization_members (
  org_id       uuid not null references public.organizations(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role_in_org  text not null default 'member'
                  check (role_in_org in ('owner','manager','recruiter','advisor','member')),
  status       text not null default 'active'
                  check (status in ('active','invited','suspended','left')),
  invited_by   uuid references auth.users(id) on delete set null,
  joined_at    timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists organization_members_user_idx on public.organization_members(user_id);

-- ---------------------------------------------------------------------
-- 3. plan_entitlements + usage_events (monetization scaffolding, inert)
-- ---------------------------------------------------------------------
create table if not exists public.plan_entitlements (
  plan_code    text not null,
  feature_key  text not null,
  limit_value  int,
  primary key (plan_code, feature_key)
);

create table if not exists public.usage_events (
  id            bigserial primary key,
  subject_type  text not null check (subject_type in ('user','organization')),
  subject_id    uuid not null,
  event_key     text not null,
  amount        int  not null default 1,
  occurred_at   timestamptz not null default now(),
  metadata      jsonb not null default '{}'::jsonb
);

create index if not exists usage_events_subject_idx on public.usage_events(subject_type, subject_id, event_key, occurred_at desc);

-- ---------------------------------------------------------------------
-- 4. profiles — plan columns (user-level, for future B2C tiers)
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists plan           text not null default 'free',
  add column if not exists plan_status    text not null default 'active',
  add column if not exists plan_renews_at timestamptz;

-- ---------------------------------------------------------------------
-- 5. ownership columns on existing tables (nullable during shadow)
-- ---------------------------------------------------------------------
alter table public.tasks
  add column if not exists org_id uuid references public.organizations(id) on delete cascade;
create index if not exists tasks_org_id_idx on public.tasks(org_id);

alter table public.job_posts
  add column if not exists org_id uuid references public.organizations(id) on delete cascade;
create index if not exists job_posts_org_id_idx on public.job_posts(org_id);

alter table public.connections
  add column if not exists org_id uuid references public.organizations(id) on delete cascade;
create index if not exists connections_org_id_idx on public.connections(org_id);

-- ---------------------------------------------------------------------
-- 6. Backfill: one organization per existing company profile
-- ---------------------------------------------------------------------
do $$
declare
  p          record;
  new_org_id uuid;
  base_slug  text;
  final_slug text;
begin
  for p in
    select id, company_name, company_website,
           company_description, industry, company_size
    from public.profiles
    where role = 'company'
      and not exists (
        select 1 from public.organizations o where o.owner_user_id = profiles.id
      )
  loop
    new_org_id := gen_random_uuid();
    base_slug := lower(regexp_replace(coalesce(nullif(p.company_name, ''), 'company'), '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    if base_slug = '' then base_slug := 'company'; end if;
    final_slug := base_slug || '-' || substr(p.id::text, 1, 6);

    insert into public.organizations (
      id, type, slug, name, website, description, industry, size,
      owner_user_id, status, plan, plan_status
    ) values (
      new_org_id, 'company', final_slug,
      coalesce(nullif(p.company_name, ''), 'Untitled Company'),
      p.company_website, p.company_description,
      p.industry, p.company_size,
      p.id, 'active', 'free', 'active'
    );

    insert into public.organization_members (org_id, user_id, role_in_org, status)
    values (new_org_id, p.id, 'owner', 'active')
    on conflict do nothing;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 7. Backfill ownership columns by joining on owner_user_id
-- ---------------------------------------------------------------------
update public.tasks t
   set org_id = o.id
  from public.organizations o
 where t.org_id is null
   and t.company_id is not null
   and o.owner_user_id = t.company_id;

update public.job_posts j
   set org_id = o.id
  from public.organizations o
 where j.org_id is null
   and j.company_id is not null
   and o.owner_user_id = j.company_id;

update public.connections c
   set org_id = o.id
  from public.organizations o
 where c.org_id is null
   and c.company_user_id is not null
   and o.owner_user_id = c.company_user_id;

-- ---------------------------------------------------------------------
-- 8. Helper: org ids the current user belongs to (SECURITY DEFINER)
-- ---------------------------------------------------------------------
create or replace function public.user_org_ids(uid uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id
    from public.organization_members
   where user_id = uid
     and status = 'active'
$$;

-- ---------------------------------------------------------------------
-- 9. RLS policies — CREATED but RLS NOT ENABLED (shadow mode).
--    A later migration will run `alter table ... enable row level security`.
-- ---------------------------------------------------------------------

-- organizations: members can read their orgs; public can read active companies.
drop policy if exists organizations_public_read     on public.organizations;
drop policy if exists organizations_member_read     on public.organizations;
drop policy if exists organizations_owner_update    on public.organizations;

create policy organizations_public_read on public.organizations
  for select using (status = 'active');

create policy organizations_member_read on public.organizations
  for select using (id in (select public.user_org_ids(auth.uid())));

create policy organizations_owner_update on public.organizations
  for update using (
    exists (
      select 1 from public.organization_members m
       where m.org_id = organizations.id
         and m.user_id = auth.uid()
         and m.role_in_org in ('owner','manager')
         and m.status = 'active'
    )
  );

-- organization_members: members see their own org memberships.
drop policy if exists organization_members_self_read   on public.organization_members;
drop policy if exists organization_members_owner_write on public.organization_members;

create policy organization_members_self_read on public.organization_members
  for select using (user_id = auth.uid() or org_id in (select public.user_org_ids(auth.uid())));

create policy organization_members_owner_write on public.organization_members
  for all using (
    exists (
      select 1 from public.organization_members m
       where m.org_id = organization_members.org_id
         and m.user_id = auth.uid()
         and m.role_in_org in ('owner','manager')
         and m.status = 'active'
    )
  );

-- tasks: public read for open company + platform tasks; members write their org's tasks.
drop policy if exists tasks_public_read   on public.tasks;
drop policy if exists tasks_member_write  on public.tasks;

create policy tasks_public_read on public.tasks
  for select using (
    archived_at is null
    and (
      org_id is null
      or org_id in (select public.user_org_ids(auth.uid()))
      or status = 'open'
    )
  );

create policy tasks_member_write on public.tasks
  for all using (
    org_id in (select public.user_org_ids(auth.uid()))
  )
  with check (
    org_id in (select public.user_org_ids(auth.uid()))
  );

-- job_posts: public read for open; members write their org's posts.
drop policy if exists job_posts_public_read  on public.job_posts;
drop policy if exists job_posts_member_write on public.job_posts;

create policy job_posts_public_read on public.job_posts
  for select using (
    status = 'open'
    or org_id in (select public.user_org_ids(auth.uid()))
  );

create policy job_posts_member_write on public.job_posts
  for all using (
    org_id in (select public.user_org_ids(auth.uid()))
  )
  with check (
    org_id in (select public.user_org_ids(auth.uid()))
  );

-- ---------------------------------------------------------------------
-- 10. Deferred cleanup (Phase 9.5, after app fully reads from org_id):
--   alter table public.tasks        drop column company_id;
--   alter table public.job_posts    drop column company_id;
--   alter table public.connections  drop column company_user_id;
--   alter table public.profiles     drop column company_name,
--                                   drop column company_logo_url,
--                                   drop column company_website,
--                                   drop column company_description,
--                                   drop column industry,
--                                   drop column company_size;
--   alter table public.organizations  enable row level security;
--   alter table public.organization_members enable row level security;
--   alter table public.tasks          enable row level security;
--   alter table public.job_posts      enable row level security;
-- ---------------------------------------------------------------------

commit;
