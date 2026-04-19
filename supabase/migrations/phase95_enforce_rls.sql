-- =====================================================================
-- Phase 9.5 — Enforce RLS + drop legacy columns
-- =====================================================================
-- Goal:
--   1. Replace the on-signup trigger so a company account creates an
--      `organizations` row + `organization_members` row atomically,
--      instead of dropping company_* fields into `profiles`.
--   2. Replace the Phase 9 shadow policies with enforceable ones, add
--      admin escapes, and add connections policies.
--   3. Enable RLS on organizations, organization_members, tasks,
--      job_posts, connections.
--   4. Drop the legacy columns kept during shadow mode:
--        - tasks.company_id
--        - job_posts.company_id
--        - connections.company_user_id
--        - profiles.company_name / industry / company_website /
--          company_size / company_description
--
-- Everything runs inside a single transaction. If any step fails the
-- whole thing rolls back.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. user_is_admin helper (SECURITY DEFINER so RLS on profiles doesn't
--    recurse into itself from a policy check).
-- ---------------------------------------------------------------------
create or replace function public.user_is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = uid and role in ('admin','manager')
  );
$$;

-- ---------------------------------------------------------------------
-- 2. handle_new_user trigger — rewrite.
--    On signup, always create a profile row. If role='company',
--    additionally create an organization + owner membership using
--    the metadata the frontend already sends.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role          text := coalesce(new.raw_user_meta_data->>'role', 'student');
  v_full_name     text := new.raw_user_meta_data->>'full_name';
  v_major         text := new.raw_user_meta_data->>'major';
  v_company_name  text := new.raw_user_meta_data->>'company_name';
  v_industry      text := new.raw_user_meta_data->>'industry';
  v_company_size  text := new.raw_user_meta_data->>'company_size';
  v_website       text := new.raw_user_meta_data->>'company_website';
  v_description   text := new.raw_user_meta_data->>'company_description';
  new_org_id      uuid;
  base_slug       text;
  final_slug      text;
begin
  -- Always insert a profile row. `major` is nullable for company/admin.
  insert into public.profiles (id, full_name, role, major)
  values (
    new.id,
    coalesce(v_full_name, v_company_name, ''),
    v_role,
    case when v_role = 'student' then v_major else null end
  )
  on conflict (id) do nothing;

  -- Company signup → create org + owner membership.
  if v_role = 'company' then
    new_org_id := gen_random_uuid();
    base_slug := lower(regexp_replace(coalesce(nullif(v_company_name, ''), 'company'), '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    if base_slug = '' then base_slug := 'company'; end if;
    final_slug := base_slug || '-' || substr(new.id::text, 1, 6);

    insert into public.organizations (
      id, type, slug, name, website, description, industry, size,
      owner_user_id, status, plan, plan_status
    ) values (
      new_org_id, 'company', final_slug,
      coalesce(nullif(v_company_name, ''), 'Untitled Company'),
      v_website, v_description, v_industry, v_company_size,
      new.id, 'active', 'free', 'active'
    );

    insert into public.organization_members (org_id, user_id, role_in_org, status)
    values (new_org_id, new.id, 'owner', 'active')
    on conflict do nothing;
  end if;

  return new;
end;
$$;

-- Ensure the trigger is wired to auth.users (idempotent).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 3. Drop Phase 9 shadow policies so we can replace them cleanly.
-- ---------------------------------------------------------------------
drop policy if exists organizations_public_read       on public.organizations;
drop policy if exists organizations_member_read       on public.organizations;
drop policy if exists organizations_owner_update      on public.organizations;

drop policy if exists organization_members_self_read   on public.organization_members;
drop policy if exists organization_members_owner_write on public.organization_members;

drop policy if exists tasks_public_read   on public.tasks;
drop policy if exists tasks_member_write  on public.tasks;

drop policy if exists job_posts_public_read  on public.job_posts;
drop policy if exists job_posts_member_write on public.job_posts;

-- ---------------------------------------------------------------------
-- 4. organizations
-- ---------------------------------------------------------------------
create policy orgs_read_all on public.organizations
  for select using (true);

create policy orgs_member_write on public.organizations
  for update using (
    exists (
      select 1 from public.organization_members m
       where m.org_id = organizations.id
         and m.user_id = auth.uid()
         and m.role_in_org in ('owner','manager')
         and m.status = 'active'
    )
  );

create policy orgs_admin_all on public.organizations
  for all using (public.user_is_admin(auth.uid()))
  with check (public.user_is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- 5. organization_members
-- ---------------------------------------------------------------------
create policy om_read on public.organization_members
  for select using (
    user_id = auth.uid()
    or org_id in (select public.user_org_ids(auth.uid()))
    or public.user_is_admin(auth.uid())
  );

create policy om_owner_write on public.organization_members
  for all using (
    exists (
      select 1 from public.organization_members m
       where m.org_id = organization_members.org_id
         and m.user_id = auth.uid()
         and m.role_in_org in ('owner','manager')
         and m.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.organization_members m
       where m.org_id = organization_members.org_id
         and m.user_id = auth.uid()
         and m.role_in_org in ('owner','manager')
         and m.status = 'active'
    )
  );

create policy om_admin_all on public.organization_members
  for all using (public.user_is_admin(auth.uid()))
  with check (public.user_is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- 6. tasks
-- ---------------------------------------------------------------------
create policy tasks_read on public.tasks
  for select using (
    public.user_is_admin(auth.uid())
    or (org_id is not null and org_id in (select public.user_org_ids(auth.uid())))
    or (status = 'open' and archived_at is null)
  );

create policy tasks_company_write on public.tasks
  for all using (org_id in (select public.user_org_ids(auth.uid())))
  with check (org_id in (select public.user_org_ids(auth.uid())));

create policy tasks_admin_write on public.tasks
  for all using (public.user_is_admin(auth.uid()) and org_id is null)
  with check (public.user_is_admin(auth.uid()) and org_id is null);

-- ---------------------------------------------------------------------
-- 7. job_posts
-- ---------------------------------------------------------------------
create policy jobs_read on public.job_posts
  for select using (
    status = 'open'
    or (org_id is not null and org_id in (select public.user_org_ids(auth.uid())))
    or public.user_is_admin(auth.uid())
  );

create policy jobs_company_write on public.job_posts
  for all using (org_id in (select public.user_org_ids(auth.uid())))
  with check (org_id in (select public.user_org_ids(auth.uid())));

create policy jobs_admin_all on public.job_posts
  for all using (public.user_is_admin(auth.uid()))
  with check (public.user_is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- 8. connections
-- ---------------------------------------------------------------------
create policy conn_read on public.connections
  for select using (
    student_id = auth.uid()
    or (org_id is not null and org_id in (select public.user_org_ids(auth.uid())))
    or public.user_is_admin(auth.uid())
  );

create policy conn_company_write on public.connections
  for all using (org_id in (select public.user_org_ids(auth.uid())))
  with check (org_id in (select public.user_org_ids(auth.uid())));

create policy conn_student_withdraw on public.connections
  for update using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- ---------------------------------------------------------------------
-- 9. Drop dual-write columns. These are safe: no code still reads them
--    after the Phase 9.5 code commit.
-- ---------------------------------------------------------------------
alter table public.tasks         drop column if exists company_id;
alter table public.job_posts     drop column if exists company_id;
alter table public.connections   drop column if exists company_user_id;

alter table public.profiles
  drop column if exists company_name,
  drop column if exists company_website,
  drop column if exists company_description,
  drop column if exists company_size,
  drop column if exists industry;

-- ---------------------------------------------------------------------
-- 10. Make org_id NOT NULL on connections (every row must belong to an
--     org now). tasks.org_id stays nullable because platform tasks
--     (admin-owned) intentionally have org_id IS NULL.
--     job_posts.org_id stays nullable only if rows slipped through
--     without a match — backfill should have covered them.
-- ---------------------------------------------------------------------
alter table public.connections
  alter column org_id set not null;

-- ---------------------------------------------------------------------
-- 11. Enable RLS.
-- ---------------------------------------------------------------------
alter table public.organizations         enable row level security;
alter table public.organization_members  enable row level security;
alter table public.tasks                 enable row level security;
alter table public.job_posts             enable row level security;
alter table public.connections           enable row level security;

commit;
