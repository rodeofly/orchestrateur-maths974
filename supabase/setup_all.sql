-- ============================================================
-- Orchestrateur Maths974 — setup complet (0001 → 0006)
-- À coller dans Supabase > SQL Editor (installation fraîche).
-- ============================================================

-- ========== 0001_init.sql ==========
-- 0001_init.sql — Schéma multi-établissement de l'orchestrateur Maths974.
-- RGPD/mineurs : PII minimale (email élève NULL, pseudonyme opaque), gating consentement.

create type app_role as enum ('admin', 'prof', 'eleve', 'parent');
create type activity_kind as enum ('graded', 'consult');
create type mastery_tier as enum ('fragile', 'satisfaisant', 'tres-satisfaisant', 'expert');

create table etablissements (
	id uuid primary key default gen_random_uuid(),
	nom text not null,
	uai text unique, -- code établissement (RNE/UAI)
	created_at timestamptz not null default now()
);

-- 1 ligne par utilisateur. email vit dans auth.users et reste NULL pour les élèves.
create table profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	etablissement_id uuid references etablissements (id) on delete set null,
	role app_role not null default 'eleve', -- rôle principal (v0 = mono-rôle)
	display_name text, -- prénom : PII, JAMAIS transmis aux iframes
	is_minor boolean not null default true,
	student_key uuid not null default gen_random_uuid(), -- pseudonyme opaque (vers les activités)
	parental_consent boolean not null default false,
	extended_processing boolean not null default false, -- gating RGPD (défaut OFF)
	created_at timestamptz not null default now()
);
create index on profiles (etablissement_id);

-- Cumul de rôles / multi-établissement (préparé ; v0 exploite profiles.role en mono).
create table user_roles (
	user_id uuid not null references auth.users (id) on delete cascade,
	role app_role not null,
	etablissement_id uuid not null references etablissements (id) on delete cascade,
	primary key (user_id, role, etablissement_id)
);

create table classes (
	id uuid primary key default gen_random_uuid(),
	etablissement_id uuid not null references etablissements (id) on delete cascade,
	nom text not null,
	join_code text unique, -- code de classe (révocable)
	created_at timestamptz not null default now()
);
create index on classes (etablissement_id);

create table class_teachers (
	class_id uuid not null references classes (id) on delete cascade,
	teacher_id uuid not null references auth.users (id) on delete cascade,
	primary key (class_id, teacher_id)
);

create table class_students (
	class_id uuid not null references classes (id) on delete cascade,
	student_id uuid not null references auth.users (id) on delete cascade,
	student_alias text, -- pseudonyme d'affichage côté prof
	primary key (class_id, student_id)
);
create index on class_students (student_id);

create table parent_links (
	parent_id uuid not null references auth.users (id) on delete cascade,
	child_id uuid not null references auth.users (id) on delete cascade,
	consent_given_at timestamptz,
	primary key (parent_id, child_id)
);
create index on parent_links (child_id);

-- Secrets de connexion élève (PIN haché). DENY-ALL côté client : RLS activée, AUCUNE policy.
-- Seul le service_role (Edge Functions) y accède.
create table student_credentials (
	student_id uuid primary key references auth.users (id) on delete cascade,
	class_code text not null,
	login text not null,
	pin_hash text not null,
	created_at timestamptz not null default now(),
	unique (class_code, login)
);

-- ===== Seams v1 (préparés, non exploités en v0) =====
create table parcours (
	id uuid primary key default gen_random_uuid(),
	etablissement_id uuid references etablissements (id) on delete cascade,
	author_id uuid references auth.users (id) on delete set null,
	titre text not null,
	steps jsonb not null default '[]'::jsonb, -- séquence d'activités embarquées
	is_published boolean not null default false, -- templates publiés = catalogue
	created_at timestamptz not null default now()
);

create table parcours_assignments (
	id uuid primary key default gen_random_uuid(),
	parcours_id uuid not null references parcours (id) on delete cascade,
	class_id uuid not null references classes (id) on delete cascade,
	assigned_by uuid references auth.users (id) on delete set null,
	created_at timestamptz not null default now()
);

-- Tentatives (calque @maths974/competences AttemptResult). Append-only (immuable).
create table attempts (
	id uuid primary key default gen_random_uuid(),
	student_id uuid not null references auth.users (id) on delete cascade,
	class_id uuid references classes (id) on delete set null,
	app text not null,
	activity_id text not null,
	passed boolean not null,
	score numeric, -- 0..1 dénormalisé
	outcome jsonb not null default '{}'::jsonb,
	measures jsonb not null default '{}'::jsonb,
	competencies jsonb not null default '[]'::jsonb,
	kind activity_kind not null default 'graded',
	ts timestamptz not null default now()
);
create index on attempts (student_id);
create index on attempts (class_id);
create index on attempts using gin (competencies);

-- Création automatique du profil à l'inscription (rôle défaut = 'eleve', JAMAIS 'admin').
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
	insert into public.profiles (id, display_name)
	values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''));
	return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ========== 0002_rls.sql ==========
-- 0002_rls.sql — Row-Level Security, deny-by-default.
--
-- RÈGLE D'OR (audit) : la TABLE fait autorité, JAMAIS le claim JWT.
-- Tous les helpers sont SECURITY DEFINER, STABLE, search_path verrouillé (''),
-- et lisent profiles/liaisons via auth.uid(). Le custom_access_token_hook
-- (0003) n'est qu'un CACHE D'AFFICHAGE — il n'autorise jamais rien ici.
-- Ceinture + bretelles : la clause établissement (tenant) est ajoutée même
-- quand un helper la garantit déjà.

alter table etablissements enable row level security;
alter table profiles enable row level security;
alter table user_roles enable row level security;
alter table classes enable row level security;
alter table class_teachers enable row level security;
alter table class_students enable row level security;
alter table parent_links enable row level security;
alter table student_credentials enable row level security;
alter table parcours enable row level security;
alter table parcours_assignments enable row level security;
alter table attempts enable row level security;

-- ===== Helpers (autorité = table) =====
create or replace function public.my_role() returns app_role
language sql stable security definer set search_path = '' as $$
	select role from public.profiles where id = auth.uid()
$$;

create or replace function public.my_tenant() returns uuid
language sql stable security definer set search_path = '' as $$
	select etablissement_id from public.profiles where id = auth.uid()
$$;

create or replace function public.auth_is_admin_of(tenant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
	select exists (
		select 1 from public.profiles p
		where p.id = auth.uid() and p.role = 'admin' and p.etablissement_id = tenant
	)
$$;

create or replace function public.auth_teaches_class(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
	select exists (
		select 1 from public.class_teachers ct
		where ct.class_id = cid and ct.teacher_id = auth.uid()
	)
$$;

create or replace function public.auth_teaches_student(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
	select exists (
		select 1
		from public.class_teachers ct
		join public.class_students cs on cs.class_id = ct.class_id
		where ct.teacher_id = auth.uid() and cs.student_id = sid
	)
$$;

create or replace function public.auth_is_parent_of(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
	select exists (
		select 1 from public.parent_links pl
		where pl.parent_id = auth.uid() and pl.child_id = sid
	)
$$;

-- helper : tenant d'une classe (pour les policies des tables de liaison)
create or replace function public.class_tenant(cid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
	select etablissement_id from public.classes where id = cid
$$;

-- ===== profiles =====
-- Lecture : soi-même / ses élèves (prof) / ses enfants (parent) / son tenant (admin).
create policy profiles_self on profiles for select using (id = auth.uid());
create policy profiles_teacher on profiles for select using (public.auth_teaches_student(id));
create policy profiles_parent on profiles for select using (public.auth_is_parent_of(id));
create policy profiles_admin on profiles for select using (public.auth_is_admin_of(etablissement_id));
-- AUCUNE policy d'UPDATE client : role/tenant/consentement ne se modifient que via Edge
-- Functions (service_role) → pas d'élévation de privilège par auto-update.

-- ===== etablissements =====
create policy etab_member on etablissements for select using (id = public.my_tenant());
create policy etab_admin_all on etablissements for all
	using (public.auth_is_admin_of(id)) with check (public.auth_is_admin_of(id));

-- ===== user_roles =====
create policy uroles_self on user_roles for select using (user_id = auth.uid());
create policy uroles_admin on user_roles for all
	using (public.auth_is_admin_of(etablissement_id))
	with check (public.auth_is_admin_of(etablissement_id));

-- ===== classes =====
create policy classes_teacher on classes for select using (public.auth_teaches_class(id));
create policy classes_admin on classes for all
	using (public.auth_is_admin_of(etablissement_id))
	with check (public.auth_is_admin_of(etablissement_id));

-- ===== class_teachers =====
create policy ct_self on class_teachers for select using (teacher_id = auth.uid());
create policy ct_admin on class_teachers for all
	using (public.auth_is_admin_of(public.class_tenant(class_id)))
	with check (public.auth_is_admin_of(public.class_tenant(class_id)));

-- ===== class_students =====
create policy cs_teacher on class_students for select using (public.auth_teaches_class(class_id));
create policy cs_self on class_students for select using (student_id = auth.uid());
create policy cs_admin on class_students for all
	using (public.auth_is_admin_of(public.class_tenant(class_id)))
	with check (public.auth_is_admin_of(public.class_tenant(class_id)));

-- ===== parent_links =====
create policy pl_parent on parent_links for select using (parent_id = auth.uid());
create policy pl_child on parent_links for select using (child_id = auth.uid());

-- ===== student_credentials =====
-- DENY-ALL : RLS activée + AUCUNE policy → inaccessible côté client (anon/authenticated).
-- Seul le service_role (Edge Functions) la lit/écrit.

-- ===== parcours =====
create policy parcours_published on parcours for select using (is_published = true);
create policy parcours_author on parcours for all
	using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy parcours_admin on parcours for all
	using (public.auth_is_admin_of(etablissement_id))
	with check (public.auth_is_admin_of(etablissement_id));

-- ===== parcours_assignments =====
create policy pa_teacher_sel on parcours_assignments for select using (public.auth_teaches_class(class_id));
create policy pa_teacher_ins on parcours_assignments for insert with check (public.auth_teaches_class(class_id));

-- ===== attempts (append-only) =====
create policy attempts_self on attempts for select using (student_id = auth.uid());
create policy attempts_teacher on attempts for select using (public.auth_teaches_student(student_id));
create policy attempts_parent on attempts for select using (public.auth_is_parent_of(student_id));
create policy attempts_insert_self on attempts for insert with check (student_id = auth.uid());
-- pas d'UPDATE ni de DELETE : trace immuable.

-- ========== 0003_auth_hook.sql ==========
-- 0003_auth_hook.sql — Custom Access Token Hook.
--
-- ⚠️ Ce hook injecte role/tenant dans le JWT UNIQUEMENT pour l'UX (afficher le bon
-- portail dès le boot, sans aller-retour DB). Ce n'est JAMAIS une autorité de sécurité :
-- aucune policy RLS (0002) ne lit ce claim — elles lisent toutes la TABLE via auth.uid().
-- À activer dans Supabase : Authentication > Hooks > Custom Access Token.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
	claims jsonb;
	v_role text;
	v_tenant uuid;
begin
	select p.role::text, p.etablissement_id
	into v_role, v_tenant
	from public.profiles p
	where p.id = (event ->> 'user_id')::uuid;

	claims := coalesce(event -> 'claims', '{}'::jsonb);
	-- s'assurer que app_metadata existe avant d'y écrire
	claims := jsonb_set(claims, '{app_metadata}', coalesce(claims -> 'app_metadata', '{}'::jsonb), true);

	if v_role is not null then
		claims := jsonb_set(claims, '{app_metadata, user_role}', to_jsonb(v_role), true);
	end if;
	if v_tenant is not null then
		claims := jsonb_set(claims, '{app_metadata, tenant_id}', to_jsonb(v_tenant::text), true);
	end if;

	return jsonb_set(event, '{claims}', claims, true);
end;
$$;

-- Le hook n'est exécutable que par le serveur d'auth ; jamais par le client.
grant execute on function public.custom_access_token_hook (jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook (jsonb) from authenticated, anon, public;

-- ========== 0004_prof_classes.sql ==========
-- 0004_prof_classes.sql — un PROF peut créer ses propres classes (dans SON établissement)
-- et en devient automatiquement enseignant. Reste cloisonné par tenant (RLS).

alter table classes
	add column created_by uuid default auth.uid() references auth.users (id) on delete set null;

-- Un prof n'insère que dans SON établissement (autorité = table via my_tenant/my_role).
create policy classes_prof_insert on classes for insert
	with check (etablissement_id = public.my_tenant() and public.my_role() = 'prof');

-- À la création, le créateur devient enseignant de la classe.
create or replace function public.handle_new_class() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
	if new.created_by is not null then
		insert into public.class_teachers (class_id, teacher_id)
		values (new.id, new.created_by)
		on conflict do nothing;
	end if;
	return new;
end;
$$;

create trigger on_class_created
after insert on classes
for each row execute function public.handle_new_class();

-- ========== 0005_parcours.sql ==========
-- 0005_parcours.sql — l'élève accède (lecture seule) à SON parcours assigné.
-- Le prof crée/assigne (policies parcours_author + pa_teacher_ins déjà en place, 0002).
-- Helpers SECURITY DEFINER (autorité = table, anti-récursion).

create or replace function public.auth_in_class(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
	select exists (
		select 1 from public.class_students cs
		where cs.class_id = cid and cs.student_id = auth.uid()
	)
$$;

create or replace function public.auth_parcours_assigned(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
	select exists (
		select 1
		from public.parcours_assignments pa
		join public.class_students cs on cs.class_id = pa.class_id
		where pa.parcours_id = pid and cs.student_id = auth.uid()
	)
$$;

-- L'élève lit les assignations de SES classes…
create policy pa_student_sel on parcours_assignments for select
	using (public.auth_in_class(class_id));

-- …et un parcours qui lui est assigné (via une de ses classes).
create policy parcours_student_sel on parcours for select
	using (public.auth_parcours_assigned(id));

-- ========== 0006_admin_management.sql ==========
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
