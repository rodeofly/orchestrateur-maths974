-- rls.test.sql — Prouve les NON-accès inter-tenant / inter-classe (audit).
--
-- À exécuter contre une base Supabase locale APRÈS les migrations 0001→0003 :
--   supabase db reset            # applique les migrations
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.test.sql
-- Chaque `assert` faux → le script échoue (à câbler en CI une fois le projet créé).
-- Tout tourne dans une transaction ROLLBACK : aucune donnée n'est laissée.

begin;

-- ---------- Seed (exécuté en propriétaire : RLS contournée) ----------
-- Deux établissements distincts.
insert into etablissements (id, nom) values
	('aaaaaaaa-0000-0000-0000-000000000001', 'Collège A'),
	('bbbbbbbb-0000-0000-0000-000000000002', 'Collège B');

-- Utilisateurs auth (insertion minimale ; le trigger crée le profil par défaut 'eleve').
insert into auth.users (id, email) values
	('11111111-0000-0000-0000-000000000001', 'profA1@test.fr'),
	('11111111-0000-0000-0000-000000000002', 'profA2@test.fr'),
	('22222222-0000-0000-0000-000000000001', null), -- élève A1 (sans email)
	('22222222-0000-0000-0000-000000000002', null), -- élève A2
	('33333333-0000-0000-0000-000000000001', null), -- élève B1
	('44444444-0000-0000-0000-000000000001', 'parent@test.fr');

-- Renseigne rôles + tenants (en propriétaire).
update profiles set role='prof',  etablissement_id='aaaaaaaa-0000-0000-0000-000000000001' where id='11111111-0000-0000-0000-000000000001';
update profiles set role='prof',  etablissement_id='aaaaaaaa-0000-0000-0000-000000000001' where id='11111111-0000-0000-0000-000000000002';
update profiles set role='eleve', etablissement_id='aaaaaaaa-0000-0000-0000-000000000001' where id='22222222-0000-0000-0000-000000000001';
update profiles set role='eleve', etablissement_id='aaaaaaaa-0000-0000-0000-000000000001' where id='22222222-0000-0000-0000-000000000002';
update profiles set role='eleve', etablissement_id='bbbbbbbb-0000-0000-0000-000000000002' where id='33333333-0000-0000-0000-000000000001';
update profiles set role='parent' where id='44444444-0000-0000-0000-000000000001';

-- Classes : CA1 (prof A1, élève A1), CA2 (prof A2, élève A2).
insert into classes (id, etablissement_id, nom) values
	('caaa0001-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'CA1'),
	('caaa0002-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'CA2');
insert into class_teachers (class_id, teacher_id) values
	('caaa0001-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001'),
	('caaa0002-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002');
insert into class_students (class_id, student_id) values
	('caaa0001-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001'),
	('caaa0002-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002');

-- Parent → enfant A1.
insert into parent_links (parent_id, child_id, consent_given_at) values
	('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', now());

-- Tentatives.
insert into attempts (student_id, class_id, app, activity_id, passed) values
	('22222222-0000-0000-0000-000000000001', 'caaa0001-0000-0000-0000-000000000001', 'lambdazef', 'lesson:a', true),
	('22222222-0000-0000-0000-000000000002', 'caaa0002-0000-0000-0000-000000000002', 'lambdazef', 'lesson:a', true);

-- Secret élève (doit rester invisible côté client).
insert into student_credentials (student_id, class_code, login, pin_hash) values
	('22222222-0000-0000-0000-000000000001', 'CA1', 'alice', 'x');

-- ---------- Helper d'identité ----------
create or replace function pg_temp.act_as(uid uuid) returns void
language sql as $$
	select set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
$$;

-- ---------- Tests ----------
set local role authenticated;

-- prof A1 : voit son élève (A1) et SA classe ; PAS l'élève A2 ni la classe CA2.
select pg_temp.act_as('11111111-0000-0000-0000-000000000001');
do $$ begin
	assert (select count(*) from profiles where id='22222222-0000-0000-0000-000000000001') = 1, 'profA1 doit voir élève A1';
	assert (select count(*) from profiles where id='22222222-0000-0000-0000-000000000002') = 0, 'profA1 NE doit PAS voir élève A2 (autre classe)';
	assert (select count(*) from classes  where id='caaa0001-0000-0000-0000-000000000001') = 1, 'profA1 doit voir CA1';
	assert (select count(*) from classes  where id='caaa0002-0000-0000-0000-000000000002') = 0, 'profA1 NE doit PAS voir CA2';
	assert (select count(*) from attempts where student_id='22222222-0000-0000-0000-000000000002') = 0, 'profA1 NE doit PAS voir les tentatives de A2';
	assert (select count(*) from profiles where id='33333333-0000-0000-0000-000000000001') = 0, 'profA1 NE doit PAS voir un élève du Collège B';
end $$;

-- élève A1 : voit ses tentatives, pas celles d'un autre.
select pg_temp.act_as('22222222-0000-0000-0000-000000000001');
do $$ begin
	assert (select count(*) from attempts where student_id='22222222-0000-0000-0000-000000000001') >= 1, 'élève A1 doit voir ses tentatives';
	assert (select count(*) from attempts where student_id='22222222-0000-0000-0000-000000000002') = 0, 'élève A1 NE doit PAS voir les tentatives d''un autre';
	assert (select count(*) from student_credentials) = 0, 'student_credentials doit être DENY-ALL côté client';
end $$;

-- parent : voit l'enfant rattaché (A1), pas A2.
select pg_temp.act_as('44444444-0000-0000-0000-000000000001');
do $$ begin
	assert (select count(*) from attempts where student_id='22222222-0000-0000-0000-000000000001') >= 1, 'parent doit voir les tentatives de son enfant';
	assert (select count(*) from attempts where student_id='22222222-0000-0000-0000-000000000002') = 0, 'parent NE doit PAS voir l''enfant d''un autre';
end $$;

reset role;
rollback;

\echo '✅ rls.test.sql : tous les non-accès attendus sont respectés.'
