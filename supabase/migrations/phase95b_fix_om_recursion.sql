-- =====================================================================
-- Phase 9.5b — fix infinite recursion in organization_members policy
-- =====================================================================
-- The om_read policy referenced user_org_ids(auth.uid()) which itself
-- selects from organization_members. Postgres flags that as recursion
-- regardless of SECURITY DEFINER, blocking all reads.
--
-- Simplify om_read to only the two non-recursive branches. Callers that
-- need "members of my org" can join through a separate query.
-- =====================================================================

begin;

drop policy if exists om_read on public.organization_members;

create policy om_read on public.organization_members
  for select using (
    user_id = auth.uid()
    or public.user_is_admin(auth.uid())
  );

commit;
