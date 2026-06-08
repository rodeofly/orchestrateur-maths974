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
