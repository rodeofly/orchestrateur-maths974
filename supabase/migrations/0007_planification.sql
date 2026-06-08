-- 0007_planification.sql
-- Planification annuelle : Année scolaire → Période → Séquence → Séance.
-- La « séance » EST le parcours existant (rituels + activités) ; on lui ajoute juste
-- son rattachement (sequence_id) + un ordre + une semaine optionnelle.
-- Découpage CONFIGURABLE par année (trimestre OU semestre) = champ term_system.
-- Vue cible : une FRISE des ~32 semaines → les périodes sont positionnées en semaines.

create type term_system as enum ('trimestre', 'semestre');

-- ===== Année scolaire (à cheval sur 2 années civiles) =====
create table annees_scolaires (
	id uuid primary key default gen_random_uuid(),
	etablissement_id uuid references etablissements (id) on delete set null,
	author_id uuid not null references auth.users (id) on delete cascade,
	label text not null, -- ex "2025–2026"
	date_debut date,
	date_fin date,
	term_system term_system not null default 'trimestre',
	nb_semaines int not null default 32,
	created_at timestamptz not null default now()
);

-- ===== Période (P1…) — positionnée en semaines pour la frise =====
create table periodes (
	id uuid primary key default gen_random_uuid(),
	annee_id uuid not null references annees_scolaires (id) on delete cascade,
	author_id uuid not null references auth.users (id) on delete cascade, -- dénormalisé : RLS directe
	label text not null,
	ordre int not null default 0,
	term int not null default 1, -- n° de trimestre/semestre (1..3 / 1..2)
	semaine_debut int, -- 1..nb_semaines (pilote la frise)
	semaine_fin int,
	date_debut date, -- indicatif, ajustable
	date_fin date,
	couleur text, -- accent optionnel (hsl hue ou hex)
	created_at timestamptz not null default now()
);

-- ===== Séquence (dans une période) =====
create table sequences (
	id uuid primary key default gen_random_uuid(),
	periode_id uuid not null references periodes (id) on delete cascade,
	author_id uuid not null references auth.users (id) on delete cascade,
	titre text not null,
	objectifs text,
	ordre int not null default 0,
	created_at timestamptz not null default now()
);

-- ===== La séance (parcours) rejoint une séquence =====
alter table parcours add column sequence_id uuid references sequences (id) on delete set null;
alter table parcours add column ordre int not null default 0;
alter table parcours add column semaine int; -- pin optionnel sur une semaine

create index on periodes (annee_id);
create index on sequences (periode_id);
create index on parcours (sequence_id);

-- ===== RLS : deny-by-default ; le prof gère SON plan (author_id = auth.uid()) =====
alter table annees_scolaires enable row level security;
alter table periodes enable row level security;
alter table sequences enable row level security;

create policy annee_author on annees_scolaires for all
	using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy periode_author on periodes for all
	using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy sequence_author on sequences for all
	using (author_id = auth.uid()) with check (author_id = auth.uid());
