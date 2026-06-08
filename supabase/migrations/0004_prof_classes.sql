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
