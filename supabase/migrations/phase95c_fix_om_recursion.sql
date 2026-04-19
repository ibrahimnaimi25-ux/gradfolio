-- =====================================================================
-- Phase 9.5c — split om_owner_write so it doesn't apply to SELECT.
-- =====================================================================
-- om_owner_write was created FOR ALL, and its USING clause selects from
-- organization_members. On SELECT this causes recursion (om_read and
-- om_owner_write are OR-ed together for SELECT).
--
-- Replace it with three per-command policies (INSERT/UPDATE/DELETE).
-- SELECT is handled exclusively by om_read.
-- =====================================================================

begin;

drop policy if exists om_owner_write on public.organization_members;

create policy om_owner_insert on public.organization_members
  for insert with check (
    exists (
      select 1 from public.organization_members m
       where m.org_id = organization_members.org_id
         and m.user_id = auth.uid()
         and m.role_in_org in ('owner','manager')
         and m.status = 'active'
    )
  );

create policy om_owner_update on public.organization_members
  for update using (
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

create policy om_owner_delete on public.organization_members
  for delete using (
    exists (
      select 1 from public.organization_members m
       where m.org_id = organization_members.org_id
         and m.user_id = auth.uid()
         and m.role_in_org in ('owner','manager')
         and m.status = 'active'
    )
  );

commit;
