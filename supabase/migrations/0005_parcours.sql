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
