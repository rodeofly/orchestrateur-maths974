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
