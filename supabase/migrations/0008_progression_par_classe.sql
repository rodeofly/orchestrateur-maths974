-- 0008_progression_par_classe.sql
-- La progression appartient désormais à la CLASSE (point d'entrée : Mes classes → une
-- classe → sa progression). Option A : chaque classe possède sa propre année (calendrier
-- cloné par classe). On ajoute juste class_id sur l'année — périodes/séquences/séances en
-- héritent via annee_id. RLS inchangée (author_id = auth.uid() gouverne déjà).
alter table annees_scolaires add column class_id uuid references classes (id) on delete cascade;
create index on annees_scolaires (class_id);
