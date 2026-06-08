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
