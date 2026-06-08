-- 0006_admin_management.sql — gestion des comptes par l'admin (rôles + invitations).
-- Écritures privilégiées via Edge Functions (service_role) + cette fonction SQL atomique.
-- AUCUNE policy UPDATE client sur profiles. Conçu d'après l'audit adversarial (2026-06-08).

-- Invariant : les ADULTES (prof/parent/admin) sont is_minor=false ; les élèves is_minor=true.
-- Le trigger handle_new_user défaut is_minor=true (orienté élève) → on backfill les adultes existants.
update profiles set is_minor = false where role in ('prof', 'parent', 'admin');

-- Journal d'audit des actions admin (accountability RGPD). Écriture = SECURITY DEFINER / service_role.
create table admin_audit (
	id uuid primary key default gen_random_uuid(),
	actor_id uuid references auth.users (id) on delete set null,
	actor_etablissement_id uuid,
	action text not null, -- 'invite' | 'set_role' | 'erase_student'
	target_id uuid,
	old_role app_role,
	new_role app_role,
	ts timestamptz not null default now()
);
alter table admin_audit enable row level security;
-- Lecture réservée à l'admin du tenant ; aucune policy d'écriture (deny-all client).
create policy audit_admin_read on admin_audit for select using (public.auth_is_admin_of(actor_etablissement_id));

-- Changement de rôle ATOMIQUE et sûr. Appelée par l'Edge set-user-role (service_role), qui
-- passe l'id de l'appelant (vérifié via SON JWT). Tout est REVÉRIFIÉ EN BASE ici (jamais le claim).
create or replace function public.admin_set_role(p_caller uuid, p_target uuid, p_role public.app_role)
returns text language plpgsql security definer set search_path = '' as $$
declare
	a_role public.app_role; a_tenant uuid;
	t_role public.app_role; t_tenant uuid; t_minor boolean;
	n_admins int;
begin
	if p_role not in ('prof', 'parent', 'admin') then return 'role_invalide'; end if;  -- adulte uniquement
	if p_caller = p_target then return 'self'; end if;                                  -- pas d'auto-modif
	select role, etablissement_id into a_role, a_tenant from public.profiles where id = p_caller;
	if a_role is distinct from 'admin' or a_tenant is null then return 'pas_admin'; end if;
	select role, etablissement_id, is_minor into t_role, t_tenant, t_minor from public.profiles where id = p_target;
	if not found then return 'introuvable'; end if;
	if t_tenant is null or t_tenant <> a_tenant then return 'autre_tenant'; end if;     -- même établissement
	if t_minor then return 'mineur'; end if;                                            -- un élève ne se promeut pas
	if t_role = 'admin' and p_role <> 'admin' then                                      -- garder ≥1 admin
		select count(*) into n_admins from public.profiles where etablissement_id = a_tenant and role = 'admin';
		if n_admins <= 1 then return 'dernier_admin'; end if;
	end if;
	update public.profiles set role = p_role where id = p_target and etablissement_id = a_tenant;
	insert into public.admin_audit (actor_id, actor_etablissement_id, action, target_id, old_role, new_role)
	values (p_caller, a_tenant, 'set_role', p_target, t_role, p_role);
	return 'ok';
end;
$$;

-- Seul le service_role (Edge Function) peut l'appeler ; jamais un client (qui forgerait p_caller).
revoke execute on function public.admin_set_role (uuid, uuid, public.app_role) from public, anon, authenticated;
grant execute on function public.admin_set_role (uuid, uuid, public.app_role) to service_role;
